import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
// Importa el archivo JSON directamente. Next.js lo incluirá en el bundle.
import users from '@/../data/credentials.json';

export const dynamic = 'force-dynamic';

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

    // Los usuarios se cargan directamente desde el archivo importado
    const typedUsers = users as UserCredentials[];

    // Buscar al usuario por nombre de usuario
    const user = typedUsers.find(u => u.username === username);

    // Si no se encuentra el usuario, es inválido
    if (!user) {
        return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    let passwordMatch = false;

    // Lógica de validación de contraseña
    if (user.role === 'owner') {
        const ownerUsername = process.env.OWNER_USERNAME || 'admin';
        const ownerPassword = process.env.OWNER_PASSWORD || 'password';
        if (username === ownerUsername && password === ownerPassword) {
            passwordMatch = true;
        }
    } else {
        // Para managers, la contraseña está en el JSON
        if (user.password === password) {
            passwordMatch = true;
        }
    }

    if (!passwordMatch) {
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
    await cookies().set('session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: Date.now() + thirtyDays,
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ success: true, user: sessionPayload });

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Ocurrió un error inesperado en el servidor.' }, { status: 500 });
  }
}
