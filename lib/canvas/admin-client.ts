import { getCanvasServerConfig } from "@/lib/canvas/config";
import { normalizeCanvasBaseUrl } from "@/lib/canvas/client";

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
  default_view?: string;
  wiki_page?: { url?: string };
};

function canvasAdminHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
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

      let detail = "";
      try {
        const body = await response.json();
        detail = body?.errors?.[0]?.message || body?.message || JSON.stringify(body);
      } catch {
        detail = await response.text();
      }
      throw new Error(
        `Canvas API error (${response.status}) on ${method} ${path}: ${detail || response.statusText}`,
      );
    }

    if (response.status === 204) return null as T;
    return (await response.json()) as T;
  }

  async function listCourseExternalTools(courseId: string) {
    const tools = await canvasJson<CanvasExternalTool[]>(`/courses/${courseId}/external_tools`, {
      query: { per_page: "100" },
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

    async getCourseHomeStatus(courseId: string) {
      const course = await canvasJson<CanvasCourse>(`/courses/${courseId}`);
      let frontPageBody: string | null = null;
      let frontPageUrl: string | null = null;

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
        hasStudentAlertsEmbed: Boolean(
          frontPageBody?.includes("student-alerts-home") ||
            frontPageBody?.includes("external_tools") ||
            frontPageBody?.includes("Student Alerts"),
        ),
      };
    },

    async setCourseHomeToFrontPage(courseId: string, frontPageUrl: string) {
      // PUT .../front_page only edits the content of whichever page is
      // *already* the front page — it has no way to reassign which page
      // holds that role. Reassignment has to go through the page's own
      // endpoint with front_page: true.
      await canvasJson(`/courses/${courseId}/pages/${frontPageUrl}`, {
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
