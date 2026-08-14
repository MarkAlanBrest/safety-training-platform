import type {
  CanvasEnrollment,
  CanvasMissingSubmission,
  CanvasPlannerItem,
  CanvasUser,
} from "@/lib/canvas/types";

type CanvasListParams = Record<string, string | number | boolean | string[] | undefined>;

export type CanvasClientOptions = {
  baseUrl: string;
  token: string;
  userId?: number;
};

function buildQuery(params?: CanvasListParams) {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
      continue;
    }
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function normalizeCanvasBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Canvas URL is required.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/api\/v1$/i, "");
}

const CANVAS_USER_AGENT =
  process.env.CANVAS_USER_AGENT?.trim() || "safety-training-platform/1.0 (Canvas Student Alerts)";

function canvasRequestHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": CANVAS_USER_AGENT,
  };
}

export function createCanvasClient(options: CanvasClientOptions) {
  const baseUrl = normalizeCanvasBaseUrl(options.baseUrl);
  const token = options.token.trim();
  if (!token) throw new Error("Canvas access token is required.");

  const userRoot = options.userId ? `/users/${options.userId}` : "/users/self";

  async function canvasFetch<T>(path: string, params?: CanvasListParams): Promise<T> {
    const url = `${baseUrl}/api/v1${path}${buildQuery(params)}`;
    const response = await fetch(url, {
      headers: canvasRequestHeaders(token),
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
      throw new Error(
        response.status === 401
          ? "Canvas rejected the access token. Check CANVAS_API_TOKEN."
          : `Canvas API error (${response.status}): ${detail || response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async function canvasFetchAll<T>(path: string, params?: CanvasListParams): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = `${baseUrl}/api/v1${path}${buildQuery({
      per_page: 100,
      ...params,
    })}`;

    while (nextUrl) {
      const pageUrl = nextUrl;
      const response: Response = await fetch(pageUrl, {
        headers: canvasRequestHeaders(token),
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

      const page = (await response.json()) as T[];
      results.push(...page);

      const linkHeader = response.headers.get("link");
      nextUrl = null;
      if (linkHeader) {
        const nextMatch = linkHeader
          .split(",")
          .map((part) => part.trim())
          .find((part) => part.endsWith('rel="next"'));
        if (nextMatch) {
          const urlMatch = nextMatch.match(/<([^>]+)>/);
          nextUrl = urlMatch?.[1] || null;
        }
      }
    }

    return results;
  }

  return {
    baseUrl,
    userId: options.userId ?? null,
    async getUser() {
      if (options.userId) {
        return canvasFetch<CanvasUser>(`/users/${options.userId}`);
      }
      return canvasFetch<CanvasUser>("/users/self");
    },
    async getStudentEnrollments() {
      return canvasFetchAll<CanvasEnrollment>(`${userRoot}/enrollments`, {
        state: ["active"],
        type: ["StudentEnrollment"],
        include: ["current_points", "course"],
      });
    },
    async getMissingSubmissions() {
      return canvasFetchAll<CanvasMissingSubmission>(`${userRoot}/missing_submissions`, {
        include: ["planner_overrides"],
        filter: ["submittable"],
      });
    },
    async getPlannerItems() {
      return canvasFetchAll<CanvasPlannerItem>(`${userRoot}/planner/items`);
    },
  };
}
