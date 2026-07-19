import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── Macqet Portal Middleware ──────────────────────────────────────────────────
// Routes macqet.trustlink.com.ng to the (macqet) route group.
// Redirects trustlink.com.ng/dashboard → macqet.trustlink.com.ng/escrow (308).
// Passes through trustlink.com.ng marketing site + all /api routes untouched.

const MACQET_HOST = 'macqet.trustlink.com.ng';
const MAIN_HOST = 'trustlink.com.ng';

// Routes that belong to the Macqet portal (authenticated app)
const PORTAL_ROUTES = ['/escrow', '/marketplace', '/profile', '/admin', '/support', '/user', '/trade'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // ── Always pass through API routes regardless of host
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // ── Always pass through Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ── Development: localhost — allow all routes without subdomain checks
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return NextResponse.next();
  }

  // ── trustlink.com.ng/dashboard → 308 permanent redirect to macqet portal
  if (hostname.includes(MAIN_HOST) && !hostname.includes(MACQET_HOST)) {
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
      const redirectUrl = new URL(request.url);
      redirectUrl.hostname = MACQET_HOST;
      redirectUrl.pathname = pathname.replace('/dashboard', '/escrow') || '/escrow';
      return NextResponse.redirect(redirectUrl, 308);
    }

    // ── Portal routes accessed on main domain → redirect to subdomain
    const isPortalRoute = PORTAL_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
    if (isPortalRoute) {
      const redirectUrl = new URL(request.url);
      redirectUrl.hostname = MACQET_HOST;
      return NextResponse.redirect(redirectUrl, 308);
    }

    // ── Marketing site: pass through everything else on main domain
    return NextResponse.next();
  }

  // ── macqet.trustlink.com.ng — the portal subdomain
  if (hostname.includes(MACQET_HOST)) {
    // Root of macqet portal defaults to escrow (existing behavior/muscle memory)
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/escrow';
      return NextResponse.rewrite(url);
    }

    // All portal routes serve normally
    return NextResponse.next();
  }

  // ── Fallback: allow everything else
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
