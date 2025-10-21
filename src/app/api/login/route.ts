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
    
    // Paso 2: Si el token es válido, creamos una cookie de sesión con el UID.
    // La información de rol se obtendrá más tarde usando el UID.
    const sessionPayload = {
        uid: decodedToken.uid,
    };
    
    // La cookie solo contendrá el UID, es más seguro y ligero.
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    cookies().set('session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: Date.now() + thirtyDays,
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ success: true, uid: decodedToken.uid });

  } catch (error: any) {
    console.error('Login API error:', error);
    let message = 'Error de autenticación.';
    if (error.code === 'auth/id-token-expired') {
        message = 'La sesión ha expirado, por favor inicia sesión de nuevo.';
    } else if (error.code === 'auth/argument-error' || error.code === 'auth/id-token-revoked' || error.code === 'auth/id-token-mismatch') {
        message = 'Token de autenticación inválido. Por favor, intenta de nuevo.';
    }
    // Devolvemos 401 para cualquier error de verificación del token.
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
