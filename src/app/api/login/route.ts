'use server';

import { type NextRequest, NextResponse } from 'next/headers';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

// Helper function to verify password using Firebase REST API.
async function verifyPassword(email: string, password: string): Promise<{idToken: string, localId: string} | null> {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.error("Firebase API Key is not configured.");
      // Explicitly return null if API key is missing.
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

        // If the response is not ok (e.g., 400 for bad password), return null.
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
      // User not found in our database, invalid credentials.
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const userDoc = usersQuery.docs[0];
    const userDocData = userDoc.data();
    const email = userDocData.email;

    if (!email) {
      // This is a server-side data integrity issue.
      return NextResponse.json({ error: 'La cuenta de usuario no tiene un email asociado.' }, { status: 500 });
    }
    
    // Step 2: Verify the user's password using the REST API with the fetched email.
    const verificationResult = await verifyPassword(email, password);

    // CRITICAL: If verification fails for any reason (bad password, etc.), return 401.
    if (!verificationResult) {
         return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const { idToken, localId: uid } = verificationResult;

    // Step 3: Verify the token to ensure integrity.
    await adminAuth.verifyIdToken(idToken);
    
    // Step 4: Create a session cookie with the user's UID.
    const sessionPayload = { uid };
    
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
    // Generic error for any other unexpected issues.
    return NextResponse.json({ error: 'Ocurrió un error inesperado en el servidor.' }, { status: 500 });
  }
}
