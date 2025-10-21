
'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';


export async function POST(request: NextRequest) {
  try {
    const adminAuth = getAuth(adminApp);
    
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'ID Token es requerido.' }, { status: 400 });
    }

    // Paso 1: Verificar el token de ID. Si es inválido, esto lanzará un error.
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Paso 2: Si el token es válido, creamos una sesión simple sin verificar roles en Firestore.
    // Esto permite que cualquier usuario de Firebase Auth inicie sesión.
    const sessionPayload = {
        uid: decodedToken.uid,
        username: decodedToken.name || decodedToken.email,
        email: decodedToken.email,
        role: 'user', // Asignamos un rol genérico por ahora
        assignedServerId: null,
    };
    
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
    let message = 'Error de autenticación.';
    if (error.code === 'auth/id-token-expired') {
        message = 'La sesión ha expirado, por favor inicia sesión de nuevo.';
    } else if (error.code === 'auth/argument-error' || error.code === 'auth/id-token-revoked') {
        message = 'Token de autenticación inválido. Por favor, intenta de nuevo.';
    }
    // Devolvemos 401 para cualquier error de verificación del token.
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
