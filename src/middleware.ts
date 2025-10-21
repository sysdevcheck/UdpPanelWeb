import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-url', request.url);
  
  // No logic needed, just forcing edge runtime
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    }
  });
}

// Se aplica a todas las rutas.
export const config = {
  matcher: '/:path*',
};
