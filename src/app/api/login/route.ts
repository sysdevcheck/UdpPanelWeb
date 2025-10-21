
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
    
    // Check if the user is the designated owner by checking the 'owner' document
    const ownerDoc = await firestore.collection('users').doc('owner').get();
    let isOwner = false;
    if (ownerDoc.exists && ownerDoc.data()?.uid === decodedToken.uid) {
        isOwner = true;
    }

    const role = isOwner ? 'owner' : 'manager';

    // Find matching user document in firestore to get assignedServerId for managers
    const usersRef = firestore.collection('users');
    // If it's the owner, we already have their info. If manager, query by UID.
    let userQuerySnapshot;
    if (!isOwner) {
        userQuerySnapshot = await usersRef.where('uid', '==', decodedToken.uid).limit(1).get();
    }
    
    const userDocData = isOwner 
        ? ownerDoc.data() 
        : (userQuerySnapshot && !userQuerySnapshot.empty ? userQuerySnapshot.docs[0].data() : null);

    let assignedServerId = null;
    let username = decodedToken.email; // Default to email

    if (userDocData) {
        assignedServerId = userDocData.assignedServerId || null;
        username = userDocData.username || decodedToken.email;
    } else if (!isOwner) {
        // This is a manager who has an auth account but no firestore doc yet.
        // This case might need to be handled depending on app logic, but for now we proceed.
        console.warn(`Manager with UID ${decodedToken.uid} is missing a Firestore document.`);
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
    } else if (error.code === 'auth/argument-error') {
        message = 'Token de autenticación inválido.';
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
