'use server';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';


export async function POST(request: NextRequest) {
  try {
    const firestore = getFirestore(adminApp);
    const adminAuth = getAuth(adminApp);
    
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'ID Token es requerido.' }, { status: 400 });
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userRecord = await adminAuth.getUser(decodedToken.uid);

    const role = userRecord.customClaims?.role || 'manager';
    
    // Find matching user document in firestore to get assignedServerId for managers
    const usersRef = firestore.collection('users');
    const userQuery = await usersRef.where('uid', '==', decodedToken.uid).limit(1).get();

    let assignedServerId = null;
    let username = userRecord.email; // Default to email

    if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();
        assignedServerId = userData.assignedServerId || null;
        username = userData.username || userRecord.email;
    }

    const sessionPayload = {
        uid: decodedToken.uid,
        username: username,
        email: userRecord.email,
        role: role,
        assignedServerId: assignedServerId,
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
    } else if (error.code === 'auth/argument-error') {
        message = 'Token de autenticación inválido.';
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
