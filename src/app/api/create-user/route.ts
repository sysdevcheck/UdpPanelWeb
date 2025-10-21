import { type NextRequest, NextResponse } from 'next/server';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    initializeAdminApp();
    const adminAuth = getAdminAuth();
    const firestore = getFirestore();
    
    const body = await request.json();
    const { email, password, role, assignedServerId } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and role are required.' }, { status: 400 });
    }
    if (role === 'manager' && !assignedServerId) {
        return NextResponse.json({ error: 'A server must be assigned to a manager.' }, { status: 400 });
    }

    // 1. Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      emailVerified: true,
    });

    // 2. Set custom claims for the user
    const claims = { role, assignedServerId: assignedServerId || null };
    await adminAuth.setCustomUserClaims(userRecord.uid, claims);

    // 3. Create a corresponding user document in Firestore
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const userDocData = {
        uid: userRecord.uid,
        email: userRecord.email,
        role: role,
        assignedServerId: assignedServerId || null,
        createdAt: new Date(),
        expiresAt: role === 'owner' ? null : expiresAt
    };

    await firestore.collection('users').doc(userRecord.uid).set(userDocData);
    
    // Invalidate the user's token to make sure claims are applied immediately
    await adminAuth.revokeRefreshTokens(userRecord.uid);
    
    return NextResponse.json({ success: true, uid: userRecord.uid });

  } catch (error: any) {
    console.error('Create User API error:', error);
    let message = 'Error creating user.';
    if (error.code === 'auth/email-already-exists') {
      message = 'Este correo ya está en uso.';
    } else if (error.code === 'auth/invalid-password') {
      message = 'La contraseña debe tener al menos 6 caracteres.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

    