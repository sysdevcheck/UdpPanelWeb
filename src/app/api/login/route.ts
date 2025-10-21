
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
    
    let isOwner = false;
    let assignedServerId = null;
    let username = decodedToken.email; // Default to email
    let role = 'manager'; // Default role

    // Step 1: Check if the user is the designated owner.
    const ownerDoc = await firestore.collection('users').doc('owner').get();
    if (ownerDoc.exists && ownerDoc.data()?.uid === decodedToken.uid) {
        isOwner = true;
        role = 'owner';
        const ownerData = ownerDoc.data();
        username = ownerData?.username || decodedToken.email;
    } else {
        // Step 2: If not owner, query for their user document by UID to find manager details.
        const usersRef = firestore.collection('users');
        const userQuerySnapshot = await usersRef.where('uid', '==', decodedToken.uid).limit(1).get();

        if (!userQuerySnapshot.empty) {
            const userDocData = userQuerySnapshot.docs[0].data();
            // This is a confirmed manager with a document
            role = userDocData.role || 'manager';
            assignedServerId = userDocData.assignedServerId || null;
            username = userDocData.username || decodedToken.email;
        } else {
            // This is a user authenticated by Firebase but is NOT the owner and has NO document in the 'users' collection.
            // For security, we deny login, as they are not a recognized user of this application.
            console.warn(`Login attempt by an unauthorized user with UID ${decodedToken.uid}.`);
            return NextResponse.json({ error: 'Usuario no autorizado para acceder a este panel.' }, { status: 403 }); // 403 Forbidden is more appropriate here
        }
    }

    const sessionPayload = {
        uid: decodedToken.uid,
        username: username,
        email: decodedToken.email,
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
    } else if (error.code === 'auth/argument-error' || error.code === 'auth/id-token-revoked') {
        message = 'Token de autenticación inválido. Por favor, intenta de nuevo.';
    }
    // Return 401 for any token verification errors.
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
