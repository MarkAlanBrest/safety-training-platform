import { getCanvasServerConfig } from "@/lib/canvas/config";
import { CANVAS_USER_AGENT, normalizeCanvasBaseUrl } from "@/lib/canvas/client";
import { sanitizeFrontPageBody } from "@/lib/canvas/front-page-sanitize";

type CanvasExternalTool = {
  id: number;
  name?: string;
  url?: string;
  client_id?: string;
};

type CanvasModule = {
  id: number;
  name?: string;
};

type CanvasModuleItem = {
  id: number;
  type?: string;
  title?: string;
  content_id?: number;
  external_url?: string;
};

type WikiPage = {
  url?: string;
  page_id?: number;
};

type CanvasCourse = {
  id?: number;
  name?: string;
  account_id?: number;
  default_view?: string;
  wiki_page?: { url?: string };
  workflow_state?: string;
};

function isAlreadyInstalledError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("already") ||
    message.includes("taken") ||
    message.includes("duplicate") ||
    message.includes("unique")
  );
}

function parseLinkHeaderRel(link: string, rel: string) {
  const part = link
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.includes(`rel="${rel}"`));
  return part?.match(/<([^>]+)>/)?.[1] || null;
}

function canvasAdminHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": CANVAS_USER_AGENT,
  };
}

export function createCanvasAdminClient() {
  const { baseUrl: rawBaseUrl, apiToken } = getCanvasServerConfig();
  const baseUrl = normalizeCanvasBaseUrl(rawBaseUrl);

  async function canvasJson<T>(
    path: string,
    init?: RequestInit & { query?: Record<string, string>; allowNotFound?: boolean },
  ) {
    const query = init?.query
      ? `?${new URLSearchParams(init.query).toString()}`
      : "";
    const method = init?.method || "GET";
    const response = await fetch(`${baseUrl}/api/v1${path}${query}`, {
      ...init,
      headers: {
        ...canvasAdminHeaders(apiToken),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (init?.allowNotFound && response.status === 404) {
        return null as T;
      }

      const raw = await response.text().catch(() => "");
      let detail = raw;
      try {
        const parsed = raw ? (JSON.parse(raw) as { errors?: Array<{ message?: string }>; message?: string }) : null;
        detail = parsed?.errors?.[0]?.message || parsed?.message || raw;
      } catch {
        detail = raw;
      }
      throw new Error(
        `Canvas API error (${response.status}) on ${method} ${path}: ${detail || response.statusText}`,
      );
    }

    if (response.status === 204) return null as T;
    return (await response.json()) as T;
  }

  async function fetchCanvasCollectionPage<T>(url: string, path: string) {
    const response = await fetch(url, {
      headers: canvasAdminHeaders(apiToken),
      cache: "no-store",
    });
    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as { errors?: Array<{ message?: string }>; message?: string };
        detail = body?.errors?.[0]?.message || body?.message || JSON.stringify(body);
      } catch {
        detail = await response.text();
      }
      throw new Error(
        `Canvas API error (${response.status}) on GET ${path}: ${detail || response.statusText}`,
      );
    }
    const batch = (await response.json()) as T[];
    return {
      items: Array.isArray(batch) ? batch : [],
      link: response.headers.get("link") || "",
    };
  }

  async function canvasGetAll<T>(path: string, query?: Record<string, string>): Promise<T[]> {
    const search = new URLSearchParams(query);
    if (!search.has("per_page")) search.set("per_page", "100");
    const firstUrl = `${baseUrl}/api/v1${path}?${search.toString()}`;
    const first = await fetchCanvasCollectionPage<T>(firstUrl, path);
    const items = [...first.items];
    const nextUrl = parseLinkHeaderRel(first.link, "next");
    if (!nextUrl) return items;

    const lastUrl = parseLinkHeaderRel(first.link, "last");
    const lastPage = lastUrl ? Number(new URL(lastUrl).searchParams.get("page")) : NaN;
    if (Number.isFinite(lastPage) && lastPage > 1) {
      const remaining: string[] = [];
      const template = new URL(lastUrl || nextUrl);
      for (let page = 2; page <= lastPage; page += 1) {
        template.searchParams.set("page", String(page));
        remaining.push(template.toString());
      }
      let index = 0;
      async function worker() {
        while (index < remaining.length) {
          const current = remaining[index];
          index += 1;
          if (!current) return;
          const page = await fetchCanvasCollectionPage<T>(current, path);
          items.push(...page.items);
        }
      }
      await Promise.all(Array.from({ length: Math.min(8, remaining.length) }, () => worker()));
      return items;
    }

    let url: string | null = nextUrl;
    while (url) {
      const page = await fetchCanvasCollectionPage<T>(url, path);
      items.push(...page.items);
      url = parseLinkHeaderRel(page.link, "next");
    }
    return items;
  }

  async function postClientIdTool(path: string, clientId: string) {
    try {
      return await canvasJson<CanvasExternalTool>(path, {
        method: "POST",
        body: JSON.stringify({ client_id: clientId }),
      });
    } catch (error) {
      if (isAlreadyInstalledError(error)) throw error;
    }

    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ client_id: clientId }).toString(),
      cache: "no-store",
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as { errors?: Array<{ message?: string }>; message?: string };
        detail = body?.errors?.[0]?.message || body?.message || JSON.stringify(body);
      } catch {
        detail = await response.text();
      }
      throw new Error(
        `Canvas API error (${response.status}) on POST ${path}: ${detail || response.statusText}`,
      );
    }

    return (await response.json()) as CanvasExternalTool;
  }

  async function listCourseExternalTools(courseId: string, includeParents = false) {
    const query: Record<string, string> = { per_page: "100" };
    if (includeParents) query.include_parents = "true";
    const tools = await canvasJson<CanvasExternalTool[]>(`/courses/${courseId}/external_tools`, {
      query,
      allowNotFound: true,
    });
    return tools || [];
  }

  function matchesExternalTool(
    tool: { id?: number; name?: string; url?: string; client_id?: string; title?: string },
    options: { searchName: string; clientId?: string; launchHost?: string },
  ) {
    const normalizedClientId = options.clientId?.trim();
    const launchHost = options.launchHost?.toLowerCase();
    const searchName = options.searchName.toLowerCase();
    const label = (tool.name || tool.title || "").toLowerCase();
    const url = tool.url?.toLowerCase() || "";

    if (normalizedClientId && tool.client_id === normalizedClientId) return true;
    if (label.includes(searchName) || label.includes("alert")) return true;
    if (launchHost && url.includes(launchHost)) return true;
    if (url.includes("/api/lti/launch") || url.includes("/api/lti/login")) return true;
    return false;
  }

  async function findExternalToolInModules(
    courseId: string,
    options: { searchName: string; clientId?: string; launchHost?: string },
  ) {
    const modules = await canvasJson<CanvasModule[]>(`/courses/${courseId}/modules`, {
      query: { per_page: "100" },
      allowNotFound: true,
    });
    if (!modules) return null;

    for (const module of modules) {
      const items = await canvasJson<CanvasModuleItem[]>(
        `/courses/${courseId}/modules/${module.id}/items`,
        { query: { per_page: "100" }, allowNotFound: true },
      );
      if (!items) continue;

      for (const item of items) {
        if (item.type !== "ExternalTool" || !item.content_id) continue;
        if (!matchesExternalTool(item, options)) continue;
        return { id: item.content_id, name: item.title, url: item.external_url };
      }
    }

    return null;
  }

  return {
    async getCourseAccess(courseId: string) {
      const course = await canvasJson<CanvasCourse & { name?: string }>(`/courses/${courseId}`, {
        allowNotFound: true,
      });

      if (!course) {
        return {
          ok: false as const,
          reason:
            `The Canvas API token cannot access course ${courseId}. ` +
            "Create CANVAS_API_TOKEN from a Canvas admin account (Account → Settings → New Access Token), " +
            "update it in Vercel, redeploy, then save again.",
        };
      }

      return {
        ok: true as const,
        courseName: course.name || null,
        defaultView: course.default_view || null,
        accountId: course.account_id ? String(course.account_id) : null,
      };
    },

    async findCourseExternalTool(
      courseId: string,
      options: { searchName: string; clientId?: string; launchHost?: string },
    ) {
      const tools = await listCourseExternalTools(courseId);
      const directMatch = tools.find((tool) => matchesExternalTool(tool, options));
      if (directMatch) return directMatch;

      return findExternalToolInModules(courseId, options);
    },

    async upsertCourseFrontPage(
      courseId: string,
      page: { url: string; title: string; body: string },
    ) {
      const existing = await canvasJson<WikiPage | { wiki_page: WikiPage }>(
        `/courses/${courseId}/pages/${page.url}`,
        { method: "GET" },
      ).catch(() => null);

      const payload = {
        wiki_page: {
          title: page.title,
          body: page.body,
          published: true,
          front_page: true,
          editing_role: "teachers",
        },
      };

      if (existing) {
        await canvasJson(`/courses/${courseId}/pages/${page.url}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        return;
      }

      await canvasJson(`/courses/${courseId}/pages`, {
        method: "POST",
        body: JSON.stringify({
          wiki_page: {
            ...payload.wiki_page,
            url: page.url,
          },
        }),
      });
    },

    async upsertCourseAnnouncement(
      courseId: string,
      announcement: { title: string; message: string },
    ) {
      const topics = await canvasJson<Array<{ id: number; title?: string }>>(
        `/courses/${courseId}/discussion_topics`,
        {
          query: { only_announcements: "true", per_page: "50" },
          allowNotFound: true,
        },
      );

      const existing = topics?.find((topic) => topic.title === announcement.title);
      const payload = {
        title: announcement.title,
        message: announcement.message,
        is_announcement: true,
        published: true,
      };

      if (existing) {
        const updated = await canvasJson<{ id: number }>(
          `/courses/${courseId}/discussion_topics/${existing.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
        );
        return { id: updated.id };
      }

      const created = await canvasJson<{ id: number }>(`/courses/${courseId}/discussion_topics`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return { id: created.id };
    },

    async prependEmbedToFrontPage(courseId: string, embedHtml: string) {
      const page = await canvasJson<{ url?: string; body?: string }>(`/courses/${courseId}/front_page`, {
        allowNotFound: true,
      });

      let targetUrl = page?.url || "";
      let existingBody = page?.body || "";

      if (!targetUrl) {
        const pages = await canvasJson<Array<{ url?: string; title?: string }>>(
          `/courses/${courseId}/pages`,
          { query: { per_page: "100" }, allowNotFound: true },
        );
        const listed =
          pages?.find(
            (item) => (item.title || "").toLowerCase() === "home" || item.url === "home",
          ) || pages?.[0];
        if (listed?.url) {
          const full = await canvasJson<{ url?: string; body?: string }>(
            `/courses/${courseId}/pages/${encodeURIComponent(listed.url)}`,
            { allowNotFound: true },
          );
          targetUrl = listed.url;
          existingBody = full?.body || "";
        }
      }

      if (!targetUrl) {
        const home = await canvasJson<{ url?: string; body?: string }>(
          `/courses/${courseId}/pages/home`,
          { allowNotFound: true },
        );
        if (home?.url) {
          targetUrl = home.url;
          existingBody = home.body || "";
        }
      }

      if (!targetUrl) {
        try {
          const created = await canvasJson<{ url?: string }>(`/courses/${courseId}/pages`, {
            method: "POST",
            body: JSON.stringify({
              wiki_page: {
                title: "Home",
                body: embedHtml,
                published: true,
                front_page: true,
                editing_roles: "teachers",
              },
            }),
          });
          return { frontPageUrl: created?.url || "home", alreadyEmbedded: false as const };
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (!message.includes("(409)") && !/already exists|taken/i.test(message)) {
            throw error;
          }
          const home = await canvasJson<{ url?: string; body?: string }>(
            `/courses/${courseId}/pages/home`,
            { allowNotFound: true },
          );
          if (!home?.url) throw error;
          targetUrl = home.url;
          existingBody = home.body || "";
        }
      }

      if (existingBody.includes('data-student-alerts-embed="true"')) {
        return { frontPageUrl: targetUrl, alreadyEmbedded: true as const };
      }

      const cleanedBody = existingBody ? sanitizeFrontPageBody(existingBody) : "";
      const body = `${embedHtml}\n${cleanedBody}`.trim();

      await canvasJson(`/courses/${courseId}/pages/${encodeURIComponent(targetUrl)}`, {
        method: "PUT",
        body: JSON.stringify({
          wiki_page: {
            body,
            published: true,
            front_page: true,
          },
        }),
      });

      return { frontPageUrl: targetUrl, alreadyEmbedded: false as const };
    },

    async removeEmbedFromFrontPage(courseId: string) {
      const page = await canvasJson<{ url?: string; body?: string }>(`/courses/${courseId}/front_page`);

      if (!page?.url) {
        return { removed: false };
      }

      const body = page.body ? sanitizeFrontPageBody(page.body) : "";

      await canvasJson(`/courses/${courseId}/pages/${page.url}`, {
        method: "PUT",
        body: JSON.stringify({
          wiki_page: {
            body,
            published: true,
          },
        }),
      });

      return { removed: true, frontPageUrl: page.url };
    },

    async getFrontPageEmbedStatus(courseId: string) {
      try {
        const page = await canvasJson<{ body?: string; url?: string }>(`/courses/${courseId}/front_page`);
        const body = page.body || "";
        const versionMatch = body.match(/data-student-alerts-version="(\d+)"/);
        return {
          frontPageUrl: page.url || null,
          frontPageBody: body,
          hasStudentAlertsEmbed: body.includes('data-student-alerts-embed="true"'),
          embedVersion: versionMatch?.[1] || null,
        };
      } catch {
        return {
          frontPageUrl: null,
          frontPageBody: "",
          hasStudentAlertsEmbed: false,
          embedVersion: null,
        };
      }
    },

    async getCourseHomeStatus(courseId: string) {
      const course = await canvasJson<CanvasCourse>(`/courses/${courseId}`);
      let frontPageBody: string | null = null;
      let frontPageUrl: string | null = null;
      let hasStudentAlertsAnnouncement = false;

      try {
        const topics = await canvasJson<Array<{ id: number; title?: string }>>(
          `/courses/${courseId}/discussion_topics`,
          {
            query: { only_announcements: "true", per_page: "50" },
            allowNotFound: true,
          },
        );
        hasStudentAlertsAnnouncement = Boolean(
          topics?.some((topic) => topic.title === "Student Alerts Reminder"),
        );
      } catch {
        hasStudentAlertsAnnouncement = false;
      }

      try {
        const page = await canvasJson<{ body?: string; url?: string }>(`/courses/${courseId}/front_page`);
        frontPageBody = page.body || null;
        frontPageUrl = page.url || null;
      } catch {
        frontPageUrl = course.wiki_page?.url || null;
      }

      return {
        defaultView: course.default_view || null,
        frontPageUrl,
        hasStudentAlertsAnnouncement,
        hasStudentAlertsEmbed: Boolean(
          frontPageBody?.includes('data-student-alerts-embed="true"') ||
            frontPageBody?.includes("student-alerts-home") ||
            frontPageBody?.includes("Student Alerts"),
        ),
      };
    },

    async listAccountExternalTools(accountId = "self") {
      const tools = await canvasJson<CanvasExternalTool[]>(`/accounts/${accountId}/external_tools`, {
        query: { per_page: "100" },
        allowNotFound: true,
      });
      return tools || [];
    },

    async installAccountExternalToolByClientId(clientId: string, accountId = "self") {
      if (!clientId.trim()) {
        throw new Error("CANVAS_LTI_CLIENT_ID is not configured.");
      }

      try {
        return await postClientIdTool(`/accounts/${accountId}/external_tools`, clientId.trim());
      } catch (error) {
        if (!isAlreadyInstalledError(error)) throw error;
        const tools = await this.listAccountExternalTools(accountId);
        return (
          tools.find((tool) => tool.client_id === clientId.trim() || (tool.name || "").toLowerCase().includes("alert")) ||
          null
        );
      }
    },

    async ensureAccountExternalTool(options: {
      searchName: string;
      clientId?: string;
      launchHost?: string;
      accountId?: string;
    }) {
      const accountId = options.accountId || "self";
      const tools = await this.listAccountExternalTools(accountId);
      const existing = tools.find((tool) => matchesExternalTool(tool, options));
      if (existing) return existing;
      if (!options.clientId?.trim()) return null;

      try {
        return await this.installAccountExternalToolByClientId(options.clientId, accountId);
      } catch (error) {
        const retry = await this.listAccountExternalTools(accountId);
        const found = retry.find((tool) => matchesExternalTool(tool, options));
        if (found) return found;
        throw error;
      }
    },

    async listAccountIdsIncludingSubaccounts() {
      const ids = new Set<string>(["self"]);
      try {
        const manageable = await canvasGetAll<{ id: number }>("/accounts", { per_page: "100" });
        for (const account of manageable) {
          if (account.id) ids.add(String(account.id));
        }
      } catch {
        // Token may not be able to list accounts.
      }
      try {
        const self = await canvasJson<{ id: number; root_account_id?: number | null }>("/accounts/self");
        if (self.id) ids.add(String(self.id));
        const rootId = String(self.root_account_id || self.id);
        ids.add(rootId);
        const subs = await canvasGetAll<{ id: number }>(`/accounts/${rootId}/sub_accounts`, {
          recursive: "true",
          per_page: "100",
        });
        for (const sub of subs) {
          if (sub.id) ids.add(String(sub.id));
        }
      } catch {
        try {
          const subs = await canvasGetAll<{ id: number }>("/accounts/self/sub_accounts", {
            recursive: "true",
            per_page: "100",
          });
          for (const sub of subs) {
            if (sub.id) ids.add(String(sub.id));
          }
        } catch {
          // Still install on self.
        }
      }
      return [...ids];
    },

    async resolveStudentAlertsClientId(preferred?: string) {
      const configured = preferred?.trim();
      if (configured) return configured;
      try {
        const keys = await canvasGetAll<{ id: number; name?: string }>("/accounts/self/developer_keys", {
          per_page: "100",
        });
        const match = keys.find((key) => {
          const name = (key.name || "").toLowerCase();
          return name.includes("student alert") || name === "student alerts" || name.includes("alert");
        });
        if (match?.id) return String(match.id);
      } catch {
        // Fall back to the known MyTrades Student Alerts client id.
      }
      return "149450000000000305";
    },

    async ensureDeveloperKeyEnabled(clientId: string) {
      try {
        await canvasJson(`/accounts/self/developer_keys/${clientId}/developer_key_account_bindings`, {
          method: "POST",
          body: JSON.stringify({
            developer_key_account_binding: { workflow_state: "on" },
          }),
        });
      } catch {
        try {
          await canvasJson(`/developer_keys/${clientId}`, {
            method: "PUT",
            body: JSON.stringify({ developer_key: { workflow_state: "on" } }),
          });
        } catch {
          // Key may already be on, or the token cannot manage developer keys.
        }
      }
    },

    async listPublishedCourses() {
      const courses: Array<{ id: number; name?: string; account_id?: number }> = [];
      const seen = new Set<number>();
      const accountErrors: string[] = [];

      const addCourses = (batch: CanvasCourse[], options?: { allowMasters?: boolean }) => {
        for (const course of batch) {
          if (!course.id || seen.has(course.id)) continue;
          const state = course.workflow_state || "";
          if (state === "deleted" || state === "completed") continue;
          const name = course.name || "";
          if (
            !options?.allowMasters &&
            /master|demo|sample|growing with canvas|practice class|sandbox|instructor training/i.test(
              name,
            )
          ) {
            continue;
          }
          seen.add(course.id);
          courses.push({ id: course.id, name: course.name, account_id: course.account_id });
        }
      };

      let rootId = "self";
      try {
        const self = await canvasJson<{ id: number; root_account_id?: number | null }>("/accounts/self");
        rootId = String(self.root_account_id || self.id || "self");
      } catch (error) {
        accountErrors.push(
          `accounts/self: ${error instanceof Error ? error.message : "failed"}`,
        );
      }

      let enrollmentTermId = "";
      try {
        const terms = await canvasGetAll<{
          id: number;
          workflow_state?: string;
          start_at?: string | null;
          end_at?: string | null;
        }>(`/accounts/${rootId}/terms`, { per_page: "100" });
        const now = Date.now();
        const current = terms.find((term) => {
          if (term.workflow_state && term.workflow_state !== "active") return false;
          const start = term.start_at ? Date.parse(term.start_at) : 0;
          const end = term.end_at ? Date.parse(term.end_at) : Number.POSITIVE_INFINITY;
          return start <= now && now <= end;
        });
        if (current?.id) enrollmentTermId = String(current.id);
      } catch {
        // Continue without a term filter.
      }

      const courseQuery: Record<string, string> = {
        per_page: "100",
        published: "true",
        completed: "false",
        with_enrollments: "true",
        blueprint: "false",
      };
      if (enrollmentTermId) courseQuery.enrollment_term_id = enrollmentTermId;

      try {
        addCourses(await canvasGetAll<CanvasCourse>(`/accounts/${rootId}/courses`, courseQuery));
      } catch (error) {
        accountErrors.push(
          `Cannot list courses on account ${rootId}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }

      if (courses.length === 0 && rootId !== "self") {
        try {
          addCourses(await canvasGetAll<CanvasCourse>("/accounts/self/courses", courseQuery));
        } catch (error) {
          accountErrors.push(
            `Cannot list courses on account self: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
        }
      }

      if (courses.length < 20) {
        try {
          addCourses(await canvasGetAll<CanvasCourse>("/courses", { per_page: "100" }), {
            allowMasters: true,
          });
        } catch {
          // Token user's own enrollments are a bonus, not required.
        }
      }

      let usedFallback = false;
      if (courses.length === 0) {
        usedFallback = true;
        try {
          addCourses(await canvasGetAll<CanvasCourse>("/courses", { per_page: "100" }));
        } catch (error) {
          accountErrors.push(
            `Fallback /courses lookup also failed: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          );
        }
      }

      return { courses, accountErrors, usedFallback };
    },

    async listTokenUserCourses() {
      const courses: Array<{ id: number; name?: string; account_id?: number }> = [];
      const seen = new Set<number>();
      try {
        const mine = await canvasGetAll<CanvasCourse>("/courses", { per_page: "100" });
        for (const course of mine) {
          if (!course.id || seen.has(course.id)) continue;
          const state = course.workflow_state || "";
          if (state === "deleted" || state === "completed") continue;
          seen.add(course.id);
          courses.push({ id: course.id, name: course.name, account_id: course.account_id });
        }
      } catch {
        // Ignore.
      }
      return courses;
    },

    async listLinkSelectionLaunchDefinitions(courseId: string) {
      const search = new URLSearchParams();
      search.append("placements[]", "link_selection");
      search.append("placements[]", "resource_selection");
      search.set("per_page", "100");
      const response = await fetch(
        `${baseUrl}/api/v1/courses/${courseId}/lti_apps/launch_definitions?${search.toString()}`,
        {
          headers: canvasAdminHeaders(apiToken),
          cache: "no-store",
        },
      );
      if (!response.ok) {
        return [] as Array<{ name?: string; definition_id?: number }>;
      }
      const data = (await response.json()) as Array<{ name?: string; definition_id?: number }>;
      return Array.isArray(data) ? data : [];
    },

    async installExternalToolByClientId(courseId: string, clientId: string) {
      if (!clientId.trim()) {
        throw new Error("CANVAS_LTI_CLIENT_ID is not configured.");
      }

      try {
        const created = await postClientIdTool(`/courses/${courseId}/external_tools`, clientId.trim());
        if (created?.id) return created;
      } catch (error) {
        if (!isAlreadyInstalledError(error)) {
          const inherited = (await listCourseExternalTools(courseId, true)).find((tool) =>
            matchesExternalTool(tool, { searchName: "Student Alerts", clientId }),
          );
          if (inherited) return inherited;
          throw error;
        }
      }

      const local = (await listCourseExternalTools(courseId, true)).find((tool) =>
        matchesExternalTool(tool, { searchName: "Student Alerts", clientId }),
      );
      if (local) return local;

      return findExternalToolInModules(courseId, {
        searchName: "Student Alerts",
        clientId,
      });
    },

    async ensureCourseExternalTool(
      courseId: string,
      options: { searchName: string; clientId?: string; launchHost?: string },
    ) {
      // Modules → Add → External Tool lists course-level installs. An inherited
      // account tool often does not appear in that picker, so install locally
      // even when a parent account already has the app.
      const localTools = await listCourseExternalTools(courseId, false);
      const local = localTools.find((tool) => matchesExternalTool(tool, options));
      if (local) return local;

      if (!options.clientId?.trim()) {
        return (await listCourseExternalTools(courseId, true)).find((tool) =>
          matchesExternalTool(tool, options),
        ) || null;
      }

      try {
        return await this.installExternalToolByClientId(courseId, options.clientId);
      } catch {
        return (
          (await listCourseExternalTools(courseId, true)).find((tool) =>
            matchesExternalTool(tool, options),
          ) || this.findCourseExternalTool(courseId, options)
        );
      }
    },

    async probeAccess() {
      const probe: {
        tokenUser: string | null;
        selfAccount: string | null;
        manageableAccountCount: number;
        courseCount: number;
        courseNames: string[];
        usedFallback: boolean;
        errors: string[];
      } = {
        tokenUser: null,
        selfAccount: null,
        manageableAccountCount: 0,
        courseCount: 0,
        courseNames: [],
        usedFallback: false,
        errors: [],
      };

      try {
        const me = await canvasJson<{ id: number; name?: string }>("/users/self");
        probe.tokenUser = me.name ? `${me.name} (${me.id})` : String(me.id);
      } catch (error) {
        probe.errors.push(
          `users/self: ${error instanceof Error ? error.message : "failed"}`,
        );
      }

      try {
        const self = await canvasJson<{ id: number; name?: string; root_account_id?: number }>(
          "/accounts/self",
        );
        probe.selfAccount = `${self.name || "account"} ${self.id}${
          self.root_account_id ? ` root=${self.root_account_id}` : ""
        }`;
      } catch (error) {
        probe.errors.push(
          `accounts/self: ${error instanceof Error ? error.message : "failed"}`,
        );
      }

      try {
        const page = await canvasJson<{ id: number }[] | { id: number }[]>("/accounts", {
          query: { per_page: "10" },
        });
        probe.manageableAccountCount = Array.isArray(page) ? page.length : 0;
      } catch (error) {
        probe.errors.push(
          `accounts: ${error instanceof Error ? error.message : "failed"}`,
        );
      }

      try {
        const listed = await this.listPublishedCourses();
        probe.courseCount = listed.courses.length;
        probe.courseNames = listed.courses.slice(0, 20).map((course) => course.name || String(course.id));
        probe.usedFallback = listed.usedFallback;
        probe.errors.push(...listed.accountErrors.slice(0, 8));
      } catch (error) {
        probe.errors.push(
          `list courses: ${error instanceof Error ? error.message : "failed"}`,
        );
      }
      return probe;
    },

    async setCourseHomeToFrontPage(courseId: string, frontPageUrl: string) {
      // PUT .../front_page only edits the content of whichever page is
      // *already* the front page — it has no way to reassign which page
      // holds that role. Reassignment has to go through the page's own
      // endpoint with front_page: true.
      await canvasJson(`/courses/${courseId}/pages/${encodeURIComponent(frontPageUrl)}`, {
        method: "PUT",
        body: JSON.stringify({
          wiki_page: {
            front_page: true,
            published: true,
          },
        }),
      });

      await canvasJson(`/courses/${courseId}`, {
        method: "PUT",
        body: JSON.stringify({
          course: {
            default_view: "wiki",
          },
        }),
      });
    },
  };
}
