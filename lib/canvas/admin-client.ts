import { getCanvasServerConfig } from "@/lib/canvas/config";
import { normalizeCanvasBaseUrl } from "@/lib/canvas/client";

type CanvasExternalTool = {
  id: number;
  name?: string;
  url?: string;
  client_id?: string;
};

type WikiPage = {
  url?: string;
  page_id?: number;
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
    init?: RequestInit & { query?: Record<string, string> },
  ) {
    const query = init?.query
      ? `?${new URLSearchParams(init.query).toString()}`
      : "";
    const response = await fetch(`${baseUrl}/api/v1${path}${query}`, {
      ...init,
      headers: {
        ...canvasAdminHeaders(apiToken),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = await response.json();
        detail = body?.errors?.[0]?.message || body?.message || JSON.stringify(body);
      } catch {
        detail = await response.text();
      }
      throw new Error(`Canvas API error (${response.status}): ${detail || response.statusText}`);
    }

    if (response.status === 204) return null as T;
    return (await response.json()) as T;
  }

  async function listCourseExternalTools(courseId: string) {
    return canvasJson<CanvasExternalTool[]>(`/courses/${courseId}/external_tools`, {
      query: { per_page: "100" },
    });
  }

  return {
    async findCourseExternalTool(
      courseId: string,
      options: { searchName: string; clientId?: string; launchHost?: string },
    ) {
      const tools = await listCourseExternalTools(courseId);
      const normalizedClientId = options.clientId?.trim();
      const launchHost = options.launchHost?.toLowerCase();

      return (
        tools.find((tool) => {
          if (normalizedClientId && tool.client_id === normalizedClientId) return true;
          if (tool.name?.toLowerCase().includes(options.searchName.toLowerCase())) return true;
          if (launchHost && tool.url?.toLowerCase().includes(launchHost)) return true;
          return false;
        }) || null
      );
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

    async setCourseHomeToFrontPage(courseId: string, frontPageUrl: string) {
      await canvasJson(`/courses/${courseId}`, {
        method: "PUT",
        body: JSON.stringify({
          course: {
            default_view: "wiki",
          },
        }),
      });

      await canvasJson(`/courses/${courseId}/front_page`, {
        method: "PUT",
        body: JSON.stringify({
          wiki_page: {
            url: frontPageUrl,
          },
        }),
      });
    },
  };
}
