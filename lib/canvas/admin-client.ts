import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCanvasServerConfig } from "@/lib/canvas/config";
import { CANVAS_USER_AGENT, normalizeCanvasBaseUrl } from "@/lib/canvas/client";
import { sanitizeFrontPageBody } from "@/lib/canvas/front-page-sanitize";
import { getToolPublicJwk } from "@/lib/lti/tool-jwk";
import { HOME_EMBED_VERSION } from "@/lib/canvas/home-embed-constants";

type CanvasDeveloperKey = {
  id?: number;
  name?: string;
  is_lti_key?: boolean;
  workflow_state?: string;
  client_id?: string;
};

function isStudentAlertsDeveloperKey(key: CanvasDeveloperKey) {
  const name = (key.name || "").toLowerCase();
  return name.includes("student alert") || name === "student alerts";
}

function extractDeveloperKeyId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as Record<string, unknown>;

  const fromRecord = (value: unknown) => {
    if (!value || typeof value !== "object") return "";
    const record = value as { id?: number | string; client_id?: number | string; developer_key_id?: number | string };
    const id = record.id || record.client_id || record.developer_key_id;
    return id != null ? String(id) : "";
  };

  return (
    fromRecord(data.developer_key) ||
    (data.developer_key_id != null ? String(data.developer_key_id) : "") ||
    (data.client_id != null ? String(data.client_id) : "") ||
    fromRecord(data.tool_configuration) ||
    fromRecord(data.lti_registration) ||
    (data.is_lti_key || isStudentAlertsDeveloperKey(data as CanvasDeveloperKey)
      ? data.id != null
        ? String(data.id)
        : ""
      : "")
  );
}

function readStudentAlertsToolSettings() {
  const settings = JSON.parse(
    readFileSync(join(process.cwd(), "public", "canvas-lti-key.json"), "utf8"),
  ) as Record<string, unknown>;
  settings.public_jwk = getToolPublicJwk();
  settings.public_jwk_url = "";
  return settings;
}

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

function isCurrentStudentAlertsEmbed(body: string) {
  return (
    body.includes('data-student-alerts-embed="true"') &&
    body.includes("/external_tools/retrieve") &&
    body.includes(`data-student-alerts-version="${HOME_EMBED_VERSION}"`)
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

  async function canvasLtiJson<T>(path: string, init?: RequestInit) {
    const method = init?.method || "GET";
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...canvasAdminHeaders(apiToken),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      let detail = raw;
      try {
        const parsed = raw
          ? (JSON.parse(raw) as { errors?: Array<{ message?: string }>; message?: string })
          : null;
        detail = parsed?.errors?.[0]?.message || parsed?.message || raw;
      } catch {
        detail = raw;
      }
      throw new Error(
        `Canvas API error (${response.status}) on ${method} ${path}: ${detail || response.statusText}`,
      );
    }
    if (!raw) return null as T;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
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
      const tools = await listCourseExternalTools(courseId, true);
      const directMatch = tools.find((tool) => matchesExternalTool(tool, options));
      if (directMatch) return directMatch;

      const accountTool = (await this.listAccountExternalTools("self")).find((tool) =>
        matchesExternalTool(tool, options),
      );
      if (accountTool) return accountTool;

      return findExternalToolInModules(courseId, options);
    },

    async insertStudentAlertsModuleItem(
      courseId: string,
      options: {
        searchName: string;
        clientId?: string;
        launchHost?: string;
        moduleId?: string | null;
        embedUrl: string;
      },
    ) {
      let moduleId = options.moduleId || "";
      if (!moduleId) {
        const modules = await canvasJson<Array<{ id?: number; name?: string }>>(
          `/courses/${courseId}/modules`,
          { query: { per_page: "100" }, allowNotFound: true },
        );
        const existing =
          modules?.find((item) => (item.name || "").toLowerCase() === "student alerts") ||
          modules?.[0];
        if (existing?.id) {
          moduleId = String(existing.id);
        } else {
          const created = await canvasJson<{ id?: number }>(`/courses/${courseId}/modules`, {
            method: "POST",
            body: JSON.stringify({
              module: { name: "Student Alerts", published: true },
            }),
          });
          moduleId = created?.id ? String(created.id) : "";
        }
      }
      if (!moduleId) {
        throw new Error("Could not find or create a Canvas module.");
      }

      const items = await canvasJson<Array<{ title?: string; type?: string }>>(
        `/courses/${courseId}/modules/${moduleId}/items`,
        { query: { per_page: "100" }, allowNotFound: true },
      );
      const already = items?.some((item) => {
        const title = (item.title || "").toLowerCase();
        return title.includes("student alert") || title === "alerts";
      });
      if (already) {
        return { ok: true as const, moduleId, created: false };
      }

      const tool = await this.findCourseExternalTool(courseId, {
        searchName: options.searchName,
        clientId: options.clientId,
        launchHost: options.launchHost,
      });

      const moduleItem = tool?.id
        ? {
            title: "Student Alerts",
            type: "ExternalTool",
            content_id: tool.id,
            published: true,
            new_tab: false,
          }
        : {
            title: "Student Alerts",
            type: "ExternalUrl",
            external_url: options.embedUrl,
            published: true,
            new_tab: false,
          };

      await canvasJson(`/courses/${courseId}/modules/${moduleId}/items`, {
        method: "POST",
        body: JSON.stringify({ module_item: moduleItem }),
      });

      return { ok: true as const, moduleId, created: true };
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

      if (isCurrentStudentAlertsEmbed(existingBody)) {
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

      const existing = page.body || "";
      const hasEmbed =
        existing.includes("data-student-alerts-embed") || existing.includes("/canvas/home-embed");
      if (!hasEmbed) {
        return { removed: false };
      }

      const body = existing ? sanitizeFrontPageBody(existing) : "";

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

      const targets = [accountId];
      if (accountId === "self") {
        const self = await canvasJson<{ id?: number }>("/accounts/self").catch(() => null);
        if (self?.id) targets.push(String(self.id));
      }

      let lastError: Error | null = null;
      for (const target of targets) {
        try {
          return await postClientIdTool(`/accounts/${target}/external_tools`, clientId.trim());
        } catch (error) {
          if (isAlreadyInstalledError(error)) {
            const tools = await this.listAccountExternalTools(target);
            return (
              tools.find(
                (tool) => tool.client_id === clientId.trim() || (tool.name || "").toLowerCase().includes("alert"),
              ) || null
            );
          }
          lastError = error instanceof Error ? error : new Error("Could not install the Canvas app.");
        }
      }

      const tools = await this.listAccountExternalTools(accountId);
      const existing =
        tools.find(
          (tool) => tool.client_id === clientId.trim() || (tool.name || "").toLowerCase().includes("alert"),
        ) || null;
      if (existing) return existing;
      if (lastError) throw lastError;
      return null;
    },

    async removeDuplicateAccountStudentAlertsTools(options: {
      searchName: string;
      clientId?: string;
      launchHost?: string;
    }) {
      const self = await canvasJson<{ id: number; root_account_id?: number | null }>(
        "/accounts/self",
      ).catch(() => null);
      const keepAccounts = new Set<string>(["self"]);
      if (self?.id) keepAccounts.add(String(self.id));
      if (self?.root_account_id) keepAccounts.add(String(self.root_account_id));

      const accountIds = ["self", ...(await this.listAccountIdsIncludingSubaccounts()).filter((id) => id !== "self")];
      const keepToolIds = new Set<number>();
      let removed = 0;

      for (const accountId of accountIds) {
        const tools = await this.listAccountExternalTools(accountId).catch(() => []);
        const matches = tools.filter((tool) => matchesExternalTool(tool, options));
        for (const tool of matches) {
          if (!tool.id) continue;
          if (keepAccounts.has(accountId) && keepToolIds.size === 0) {
            keepToolIds.add(tool.id);
            continue;
          }
          if (keepToolIds.has(tool.id)) continue;
          try {
            await canvasJson(`/accounts/${accountId}/external_tools/${tool.id}`, {
              method: "DELETE",
              allowNotFound: true,
            });
            removed += 1;
          } catch {
            // Tool may be inherited or already deleted.
          }
        }
      }

      return { removed, kept: keepToolIds.size };
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
      const keys = await this.listStudentAlertsDeveloperKeys().catch(() => []);
      const match = keys.find(isStudentAlertsDeveloperKey);
      if (match?.id) return String(match.id);

      const configured = preferred?.trim();
      if (configured && keys.some((key) => String(key.id) === configured || key.client_id === configured)) {
        return configured;
      }
      return configured || "149450000000000305";
    },

    async listLtiRegistrations() {
      const listed = await canvasJson<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
        "/accounts/self/lti_registrations",
        { query: { per_page: "100" } },
      );
      if (Array.isArray(listed)) return listed;
      if (listed && Array.isArray(listed.data)) return listed.data;
      return [];
    },

    async findStudentAlertsRegistration() {
      const rows = await this.listLtiRegistrations();
      return (
        rows.find((row) => String(row.name || "").toLowerCase().includes("student alert")) || null
      );
    },

    async unlockAndInstallStudentAlertsApp(clientId: string) {
      const registration = await this.findStudentAlertsRegistration().catch(() => null);
      const registrationId = registration?.id != null ? String(registration.id) : "";
      if (registrationId) {
        await canvasJson(`/accounts/self/lti_registrations/${registrationId}`, {
          method: "PUT",
          body: JSON.stringify({ lock_deploying: false, workflow_state: "on" }),
        }).catch(() => null);
        await canvasJson(`/accounts/self/apps/${registrationId}`, {
          method: "PUT",
          body: JSON.stringify({ lock_deploying: false, workflow_state: "on" }),
        }).catch(() => null);
        await canvasJson(`/accounts/self/lti_registrations/${registrationId}/bind`, {
          method: "POST",
          body: JSON.stringify({ workflow_state: "on" }),
        }).catch(() => null);
      }

      return this.installAccountExternalToolByClientId(clientId);
    },

    async listStudentAlertsDeveloperKeys() {
      return canvasGetAll<CanvasDeveloperKey>("/accounts/self/developer_keys", {
        per_page: "100",
      });
    },

    async findStudentAlertsDeveloperKey() {
      const keys = await this.listStudentAlertsDeveloperKeys();
      const matches = keys
        .filter(isStudentAlertsDeveloperKey)
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      for (const key of matches) {
        if (!key.id) continue;
        try {
          const registration = await canvasJson<{ id?: number; workflow_state?: string }>(
            `/accounts/self/lti_registration_by_client_id/${key.id}`,
          );
          if (registration?.id) return key;
        } catch {
          // Listed developer keys can remain after the LTI registration/app is deleted.
        }
      }
      return null;
    },

    async inspectStudentAlertsLtiKey(clientId?: string) {
      const keys = await this.listStudentAlertsDeveloperKeys().catch((error) => error);
      const summarizedKeys = Array.isArray(keys)
        ? keys
            .filter((key) => isStudentAlertsDeveloperKey(key) || String(key.id) === clientId)
            .map((key) => ({
              id: key.id != null ? String(key.id) : null,
              name: key.name || null,
              isLtiKey: key.is_lti_key !== false,
              workflowState: key.workflow_state || null,
            }))
        : [];
      const id = clientId || summarizedKeys[0]?.id || "";
      let key: unknown = null;
      let registration: unknown = null;
      let toolConfiguration: unknown = null;
      if (id) {
        try {
          key = await canvasJson(`/accounts/self/developer_keys/${id}`);
        } catch (error) {
          try {
            key = await canvasJson(`/developer_keys/${id}`);
          } catch (innerError) {
            key = {
              error: innerError instanceof Error ? innerError.message : "Could not read developer key.",
            };
          }
        }
        try {
          registration = await canvasJson(`/accounts/self/lti_registration_by_client_id/${id}`);
        } catch (error) {
          registration = { error: error instanceof Error ? error.message : "Could not read LTI registration." };
        }
        try {
          toolConfiguration = await canvasLtiJson(`/api/lti/developer_keys/${id}/tool_configuration`);
        } catch (error) {
          toolConfiguration = {
            error: error instanceof Error ? error.message : "Could not read LTI tool configuration.",
          };
        }
      }
      let registrations: unknown = null;
      try {
        registrations = await canvasJson(`/accounts/self/lti_registrations`, {
          query: { per_page: "20" },
        });
      } catch (error) {
        registrations = {
          error: error instanceof Error ? error.message : "Could not list LTI registrations.",
        };
      }
      return {
        clientId: id || null,
        keys: summarizedKeys,
        keyListError: keys instanceof Error ? keys.message : null,
        key,
        registration,
        toolConfiguration,
        registrations,
      };
    },

    async createStudentAlertsDeveloperKey() {
      const settings = readStudentAlertsToolSettings();
      const launchUrl =
        typeof settings.target_link_uri === "string"
          ? settings.target_link_uri
          : `${baseUrl.replace(/\/+$/, "")}/api/lti/launch`;
      const errors: string[] = [];

      try {
        const created = await canvasLtiJson<unknown>("/api/lti/accounts/self/developer_keys/tool_configuration", {
          method: "POST",
          body: JSON.stringify({
            tool_configuration: {
              settings,
              privacy_level: "public",
            },
            developer_key: {
              name: "Student Alerts",
              redirect_uris: Array.isArray(settings.redirect_uris)
                ? settings.redirect_uris
                : [launchUrl],
              scopes: [],
            },
          }),
        });
        const clientId = extractDeveloperKeyId(created);
        if (clientId) return { clientId, created, errors: [] };
        errors.push("Canvas created an LTI key but did not return its client id.");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Could not create the LTI developer key.");
      }

      try {
        const created = await canvasJson<unknown>("/accounts/self/lti_registrations", {
          method: "POST",
          body: JSON.stringify({
            name: "Student Alerts",
            workflow_state: "on",
            lock_deploying: false,
            configuration: {
              title: "Student Alerts",
              description: settings.description || "Bold course alerts from your teacher",
              domain: "safety-training-platform-eight.vercel.app",
              tool_id: "student-alerts",
              privacy_level: "public",
              target_link_uri: launchUrl,
              oidc_initiation_url: settings.oidc_initiation_url,
              redirect_uris: settings.redirect_uris || [launchUrl],
              public_jwk: settings.public_jwk,
              scopes: [],
              custom_fields: settings.custom_fields || {
                user_id: "$Canvas.user.id",
                course_id: "$Canvas.course.id",
              },
              placements: [
                {
                  placement: "course_home_sub_navigation",
                  enabled: true,
                  visibility: "members",
                  required_permissions: "manage_course_content_edit",
                  text: "Set Student Alerts",
                  message_type: "LtiResourceLinkRequest",
                  target_link_uri: `${String(launchUrl)}?placement=alert_settings`,
                },
              ],
            },
          }),
        });
        const clientId = extractDeveloperKeyId(created);
        if (clientId) return { clientId, created, errors: [] };
        errors.push("Canvas created an LTI registration but did not return its client id.");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Could not create the LTI registration.");
      }

      const found = await this.findStudentAlertsDeveloperKey().catch(() => null);
      if (found?.id && errors.length === 0) return { clientId: String(found.id), created: found, errors };

      throw new Error(errors.filter(Boolean).join(" ") || "Could not recreate the Student Alerts LTI key.");
    },

    async ensureDeveloperKeyEnabled(clientId: string) {
      const bindingBody = JSON.stringify({
        developer_key_account_binding: { workflow_state: "on" },
      });

      for (const [method, path] of [
        ["PUT", `/accounts/self/developer_keys/${clientId}/developer_key_account_bindings`],
        ["POST", `/accounts/self/developer_keys/${clientId}/developer_key_account_bindings`],
        ["PUT", `/developer_keys/${clientId}`],
      ] as const) {
        try {
          await canvasJson(path, {
            method,
            body: method === "PUT" && path === `/developer_keys/${clientId}`
              ? JSON.stringify({ developer_key: { workflow_state: "on" } })
              : bindingBody,
          });
          break;
        } catch {
          // Try the next Canvas binding endpoint.
        }
      }

      try {
        const registration = await canvasJson<{ id?: number }>(
          `/accounts/self/lti_registration_by_client_id/${clientId}`,
        );
        if (registration?.id) {
          await canvasJson(`/accounts/self/lti_registrations/${registration.id}/bind`, {
            method: "POST",
            body: JSON.stringify({ workflow_state: "on" }),
          });
        }
      } catch {
        // Older Canvas sites may not expose LTI registration bind.
      }

      await this.syncDeveloperKeyPublicJwk(clientId);
      await this.syncLtiToolConfiguration(clientId);
    },

    async syncDeveloperKeyPublicJwk(clientId: string) {
      if (!clientId.trim()) return;
      const publicJwk = getToolPublicJwk();
      const payload = {
        developer_key: {
          public_jwk: publicJwk,
          // Canvas fails deep-linking JWTs with KidNotFound when both a
          // pasted JWK and a JWK URL are set. Keep only the matching JWK.
          public_jwk_url: "",
        },
      };

      try {
        await canvasJson(`/developer_keys/${clientId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        return;
      } catch {
        // Try the account-scoped endpoint used on some Canvas sites.
      }

      try {
        await canvasJson(`/accounts/self/developer_keys/${clientId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } catch {
        // Token may not be allowed to edit developer keys.
      }
    },

    async syncLtiToolConfiguration(clientId: string) {
      if (!clientId.trim()) return;
      let settings: unknown;
      try {
        settings = JSON.parse(
          readFileSync(join(process.cwd(), "public", "canvas-lti-key.json"), "utf8"),
        );
      } catch {
        return;
      }

      const payload = JSON.stringify({
        tool_configuration: {
          settings,
          privacy_level: "public",
          disabled_placements: [
            "resource_selection",
            "assignment_selection",
            "editor_button",
            "homework_submission",
            "migration_selection",
            "collaboration",
            "course_assignments_menu",
          ],
        },
      });

      for (const path of [
        `/api/lti/developer_keys/${clientId}/tool_configuration`,
        `/api/lti/accounts/self/developer_keys/${clientId}/tool_configuration`,
      ]) {
        try {
          const response = await fetch(`${baseUrl}${path}`, {
            method: "PUT",
            headers: canvasAdminHeaders(apiToken),
            body: payload,
            cache: "no-store",
          });
          if (response.ok) return;
          if (response.status === 404) {
            const created = await fetch(`${baseUrl}${path}`, {
              method: "POST",
              headers: canvasAdminHeaders(apiToken),
              body: payload,
              cache: "no-store",
            });
            if (created.ok) return;
          }
        } catch {
          // Try the next endpoint.
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

    async removeCourseLevelStudentAlertsTools(
      courseId: string,
      options: { searchName: string; clientId?: string; launchHost?: string },
    ) {
      const localTools = await listCourseExternalTools(courseId, false);
      let removed = 0;
      for (const tool of localTools) {
        if (!tool.id || !matchesExternalTool(tool, options)) continue;
        await canvasJson(`/courses/${courseId}/external_tools/${tool.id}`, {
          method: "DELETE",
          allowNotFound: true,
        });
        removed += 1;
      }
      return { removed };
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
