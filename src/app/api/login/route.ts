
import { type NextRequest, NextResponse } from 'next/server';
import { readCredentials } from '@/lib/data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos.' }, { status: 400 });
    }
    
    // Handle Owner login via environment variables first
    const ownerUsername = process.env.OWNER_USERNAME || 'admin';
    const ownerPassword = process.env.OWNER_PASSWORD || 'password';

    if (username === ownerUsername && password === ownerPassword) {
      const sessionPayload = {
        username: ownerUsername,
        role: 'owner',
        assignedServerId: null
      };

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
    }
    
    // Handle Manager login via local file
    const credentials = await readCredentials();
    const user = credentials.find(c => c.username === username && c.role === 'manager');

    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const sessionPayload = {
      username: user.username,
      role: user.role,
      assignedServerId: user.assignedServerId || null
    };

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
