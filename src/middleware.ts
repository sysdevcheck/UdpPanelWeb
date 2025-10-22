
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session');
  const { pathname } = request.nextUrl;

  // Si no hay cookie de sesión y el usuario intenta acceder a una ruta protegida
  if (!sessionCookie && pathname !== '/login') {
    // Redirige a la página de login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si hay una cookie de sesión y el usuario está en la página de login
  if (sessionCookie && pathname === '/login') {
     // Redirige a la página principal
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Configura el middleware para que se ejecute en las rutas relevantes
export const config = {
  matcher: ['/', '/login'],
};
