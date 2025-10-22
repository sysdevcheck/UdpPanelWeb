'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { readServers } from '@/lib/data';
import { sshApiRequest } from '@/app/actions';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos.' }, { status: 400 });
    }

    const servers = await readServers();
    if (!servers || servers.length === 0) {
      return NextResponse.json({ error: 'No hay servidores configurados. El dueño debe configurar al menos un servidor.' }, { status: 503 });
    }

    // Usaremos el primer servidor de la lista como el servidor de autenticación principal.
    const authServer = servers[0];

    // Construimos la configuración SSH para el intento de login
    const loginAttemptSshConfig = {
      host: authServer.host,
      port: authServer.port,
      username: username,
      password: password,
    };

    // 1. Intentar conectar vía SSH para validar las credenciales del usuario.
    const loginResult = await sshApiRequest('testConnection', {}, loginAttemptSshConfig);

    if (!loginResult.success) {
      return NextResponse.json({ error: loginResult.error || 'Credenciales inválidas.' }, { status: 401 });
    }

    // 2. Si el login es exitoso, usar las credenciales del panel para verificar si el usuario es sudoer.
    // Esto se hace con las credenciales del servidor guardadas, no con las del usuario.
    const panelSshConfig = {
      host: authServer.host,
      port: authServer.port,
      username: authServer.username,
      password: authServer.password,
    };
    
    const sudoCheckResult = await sshApiRequest('checkUserSudo', { usernameToCheck: username }, panelSshConfig);
    
    const role = sudoCheckResult.data?.isSudoer ? 'owner' : 'manager';
    
    // El 'assignedServerId' para un manager será el ID del servidor contra el que se logueó.
    // Un owner no tiene servidor asignado (null), puede ver todos.
    const assignedServerId = role === 'owner' ? null : authServer.id;

    const sessionPayload = {
      username,
      role,
      assignedServerId,
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
