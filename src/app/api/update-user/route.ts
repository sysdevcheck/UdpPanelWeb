import { type NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const adminAuth = getAuth(adminApp);
    const firestore = getFirestore(adminApp);

    const body = await request.json();
    const { uid, email, password, assignedServerId } = body;

    if (!uid) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const authUpdatePayload: { email?: string; password?: string } = {};
    if (email) authUpdatePayload.email = email;
    if (password) authUpdatePayload.password = password;

    // 1. Update Firebase Auth user
    if (Object.keys(authUpdatePayload).length > 0) {
      await adminAuth.updateUser(uid, authUpdatePayload);
    }
    
    const userRecord = await adminAuth.getUser(uid);
    const currentClaims = userRecord.customClaims || {};

    // 2. Update custom claims if they changed
    if (assignedServerId !== undefined && currentClaims.assignedServerId !== assignedServerId) {
        await adminAuth.setCustomUserClaims(uid, { ...currentClaims, assignedServerId });
        // Invalidate token so user gets new claims on next refresh
        await adminAuth.revokeRefreshTokens(uid);
    }

    // 3. Update Firestore document
    const userDocRef = firestore.collection('users').doc(uid);
    const firestoreUpdatePayload: { email?: string; assignedServerId?: string } = {};
    if (email) firestoreUpdatePayload.email = email;
    if (assignedServerId !== undefined) firestoreUpdatePayload.assignedServerId = assignedServerId;

    if(Object.keys(firestoreUpdatePayload).length > 0) {
        await userDocRef.update(firestoreUpdatePayload);
    }

    return NextResponse.json({ success: true, message: 'User updated successfully.' });

  } catch (error: any) {
    console.error('Update User API error:', error);
    let message = 'Error updating user.';
    if (error.code === 'auth/user-not-found') {
      message = 'Usuario no encontrado.';
    } else if (error.code === 'auth/email-already-exists') {
      message = 'El correo ya está en uso por otra cuenta.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
