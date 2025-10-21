import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    initializeAdminApp();
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    const userRecord = await adminAuth.getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    const sessionPayload = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: customClaims.role || 'user', // default to 'user' if no role
        assignedServerId: customClaims.assignedServerId || null,
    };
    
    // Set cookie
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
    let message = 'Internal Server Error';
    if(error.code === 'auth/id-token-expired') {
        message = 'La sesión ha expirado, por favor inicia sesión de nuevo.';
    } else if (error.code === 'auth/argument-error') {
        message = 'Token de autenticación inválido.';
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
