'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { readCredentials } from '@/lib/data';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos.' }, { status: 400 });
    }

    // Comprobar si es el Dueño (Owner)
    const isOwner = username === process.env.OWNER_USERNAME && password === process.env.OWNER_PASSWORD;

    let sessionPayload = null;

    if (isOwner) {
      sessionPayload = {
        username,
        role: 'owner',
        assignedServerId: null,
      };
    } else {
      // Si no es el dueño, buscar en los managers
      const credentials = await readCredentials();
      const manager = credentials.find(c => c.role === 'manager' && c.username === username);

      if (manager) {
        const isPasswordValid = password === manager.password;
        if (isPasswordValid) {
          sessionPayload = {
            username: manager.username,
            role: 'manager',
            assignedServerId: manager.assignedServerId || null,
          };
        }
      }
    }

    if (!sessionPayload) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const response = NextResponse.json({ success: true, user: sessionPayload });
    response.cookies.set('session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: Date.now() + thirtyDays,
      sameSite: 'lax',
      path: '/',
    });

    return response;

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Ocurrió un error inesperado en el servidor.' }, { status: 500 });
  }
}
