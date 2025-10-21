import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Este middleware fuerza la ejecución en el "edge runtime",
  // lo que puede resolver problemas de sincronización de tiempo (clock skew)
  // que a veces causan errores de validación de tokens de Firebase.
  // No se necesita lógica adicional aquí.
  return NextResponse.next();
}

// Se aplica a todas las rutas.
export const config = {
  matcher: '/:path*',
};
