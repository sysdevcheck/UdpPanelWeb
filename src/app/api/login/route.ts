'use server';

import { type NextRequest, NextResponse } from 'next/headers';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

// Helper function to simulate a fetch call to verify password.
// Firebase Admin SDK does not have a direct signInWithPassword method.
// We must use the client SDK's REST API for this verification step.
async function verifyPassword(email: string, password: string): Promise<{idToken: string, localId: string} | null> {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.error("Firebase API Key is not configured.");
      return null;
    }
    const restApiUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    try {
        const res = await fetch(restApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            })
        });

        if (!res.ok) {
           return null;
        }

        const data = await res.json();
        return { idToken: data.idToken, localId: data.localId };
    } catch (e) {
        console.error("Error verifying password via REST API", e);
        return null;
    }
}


export async function POST(request: NextRequest) {
  try {
    const adminAuth = getAuth(adminApp);
    const firestore = getFirestore(adminApp);
    
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos.' }, { status: 400 });
    }

    // Step 1: Find user by username in Firestore to get their email
    const usersQuery = await firestore.collection('users').where('username', '==', username).limit(1).get();

    if (usersQuery.empty) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const userDoc = usersQuery.docs[0];
    const userDocData = userDoc.data();
    const email = userDocData.email;

    if (!email) {
      return NextResponse.json({ error: 'La cuenta de usuario no tiene un email asociado.' }, { status: 500 });
    }
    
    // Step 2: Verify the user's password using the REST API with the fetched email.
    const verificationResult = await verifyPassword(email, password);

    if (!verificationResult) {
         return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const { idToken, localId: uid } = verificationResult;

    // Step 3: Verify the token just to be sure, although getting it means password was correct.
    await adminAuth.verifyIdToken(idToken);
    
    // Step 4: Create a session cookie with the user's UID.
    const sessionPayload = {
        uid,
    };
    
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    cookies().set('session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: Date.now() + thirtyDays,
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ success: true, uid });

  } catch (error: any) {
    console.error('Login API error:', error);
    let message = 'Error de autenticación.';
    // Return a generic 401 for auth errors.
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
