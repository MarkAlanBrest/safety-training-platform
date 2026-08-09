import { NextRequest, NextResponse } from "next/server";
import { ADMIN_AUTH_DISABLED } from "@/lib/admin-auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ADMIN_AUTH_DISABLED) {
    if (pathname === "/admin/login") {
      return NextResponse.redirect(new URL("/admin/courses", request.url));
    }
    return NextResponse.next();
  }

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isResumePage = pathname.startsWith("/resumes");
  const isResumeApi = pathname.startsWith("/api/resumes");

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  if (
    (isAdminPage || isAdminApi || isResumePage || isResumeApi) &&
    !request.cookies.get("admin-session")?.value
  ) {
    if (isAdminApi || isResumeApi) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/resumes/:path*", "/api/resumes/:path*"],
};
