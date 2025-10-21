'use server';

import { type NextRequest, NextResponse } from 'next/headers';
import { cookies } from 'next/headers';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const firestore = getFirestore(adminApp);
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos.' }, { status: 400 });
    }

    // Buscar al usuario por su nombre de usuario en Firestore
    const usersQuery = await firestore.collection('users').where('username', '==', username).limit(1).get();

    if (usersQuery.empty) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const userDoc = usersQuery.docs[0];
    const userData = userDoc.data();

    // Comparar la contraseña directamente (esto asume que las contraseñas se guardan en texto plano)
    if (userData.password !== password) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    // Si las credenciales son correctas, crear la sesión con el UID de Firebase Auth si existe, o el ID del documento como fallback
    const sessionPayload = { uid: userData.uid || userDoc.id };
    
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    cookies().set('session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: Date.now() + thirtyDays,
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ success: true, uid: sessionPayload.uid });

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Ocurrió un error inesperado en el servidor.' }, { status: 500 });
  }
}
