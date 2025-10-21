'use server';

import { type NextRequest, NextResponse } from 'next/headers';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

// Define la estructura de un usuario en el archivo de credenciales
interface UserCredentials {
  username: string;
  password?: string; // La contraseña es opcional, ya que no la devolveremos
  role: 'owner' | 'manager';
  assignedServerId?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos.' }, { status: 400 });
    }

    // Ruta al archivo de credenciales local
    const filePath = path.join(process.cwd(), 'data', 'credentials.json');
    
    // Leer y parsear el archivo de credenciales
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const users: UserCredentials[] = JSON.parse(fileContents);

    // Buscar al usuario por nombre de usuario
    const user = users.find(u => u.username === username);

    // Validar si el usuario existe y la contraseña coincide
    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    // Crear la carga útil de la sesión sin la contraseña
    const sessionPayload = {
      username: user.username,
      role: user.role,
      assignedServerId: user.assignedServerId || null
    };

    // Establecer la cookie de sesión
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    cookies().set('session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: Date.now() + thirtyDays,
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ success: true, user: sessionPayload });

  } catch (error: any) {
    console.error('Login API error:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Error interno: El archivo de credenciales está mal formado.' }, { status: 500 });
    }
    if (error.code === 'ENOENT') {
         return NextResponse.json({ error: 'Error interno: El archivo de credenciales no se encuentra.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Ocurrió un error inesperado en el servidor.' }, { status: 500 });
  }
}
