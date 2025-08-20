import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // Allow access to the login page
  if (pathname === '/login') {
    // If logged in, redirect to home
    if (session) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    // If not logged in, allow access
    return NextResponse.next();
  }

  // For all other pages, require a session
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except for static files and internal Next.js paths
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
