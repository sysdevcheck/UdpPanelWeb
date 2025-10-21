import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const firestore = getFirestore(adminApp);
    const auth = getAuth(adminApp);
    
    const body = await request.json();
    // Use email as the primary identifier now
    const { username, email, password, role, assignedServerId } = body;

    if (!username || !email || !password || !role) {
      return NextResponse.json({ error: 'Username, email, password, and role are required.' }, { status: 400 });
    }
    if (role === 'manager' && !assignedServerId) {
        return NextResponse.json({ error: 'A server must be assigned to a manager.' }, { status: 400 });
    }
    
    // Create user in Firebase Authentication
    const userRecord = await auth.createUser({
        email,
        password,
        displayName: username,
    });
    
    // Set custom claims if it's a manager
    if (role === 'manager') {
        await auth.setCustomUserClaims(userRecord.uid, { role: 'manager' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create a corresponding document in Firestore
    const userDocRef = firestore.collection('users').doc();
    await userDocRef.set({
        uid: userRecord.uid, // Link to the auth user
        username,
        email,
        password, // Store password for direct login
        role,
        assignedServerId: assignedServerId || null,
        createdAt: new Date(),
        expiresAt: role === 'owner' ? null : expiresAt
    });
    
    return NextResponse.json({ success: true, uid: userRecord.uid });

  } catch (error: any) {
    console.error('Create User API error:', error);
    let message = 'Error creating user.';
    if(error.code === 'auth/email-already-exists') {
        message = 'Este correo electrónico ya está en uso.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
