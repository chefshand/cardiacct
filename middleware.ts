import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const PUBLIC_PREFIXES = [
  "/login",
  "/api/login",
  "/api/mcp/", // token-protected inside the route
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/",
  "/offline",
  "/pdf.worker.min.mjs",
  "/favicon",
  "/robots.txt",
];

function toLogin(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  if (req.nextUrl.pathname !== "/") url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl;
    if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
    const ok = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    return ok ? NextResponse.next() : toLogin(req);
  } catch (e) {
    console.error("[middleware]", e);
    return toLogin(req);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
