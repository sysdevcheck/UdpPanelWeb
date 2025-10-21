import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // If the user is trying to access the login page
  if (pathname.startsWith('/login')) {
    // If they are already logged in, redirect to home
    if (sessionCookie) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Otherwise, let them access the login page
    return NextResponse.next();
  }

  // For any other page, if there is no session cookie, redirect to login
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If they have a session, let them proceed
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
