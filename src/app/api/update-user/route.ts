import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const firestore = getFirestore(adminApp);
    const auth = getAuth(adminApp);

    const body = await request.json();
    const { docId, authUid, username, email, password, assignedServerId } = body;

    if (!docId || !authUid) {
      return NextResponse.json({ error: 'User Doc ID and Auth UID are required.' }, { status: 400 });
    }

    // Update Firebase Authentication
    const updateAuthPayload: { [key: string]: any } = {};
    if (email) updateAuthPayload.email = email;
    if (password) updateAuthPayload.password = password;
    if (username) updateAuthPayload.displayName = username;

    if (Object.keys(updateAuthPayload).length > 0) {
        await auth.updateUser(authUid, updateAuthPayload);
    }
    
    // Update Firestore document
    const userDocRef = firestore.collection('users').doc(docId);
    const updateFirestorePayload: { [key: string]: any } = {};
    if (username) updateFirestorePayload.username = username;
    if (email) updateFirestorePayload.email = email;
    if (password) updateFirestorePayload.password = password; // Also update password in firestore
    if (assignedServerId !== undefined) updateFirestorePayload.assignedServerId = assignedServerId;

    if(Object.keys(updateFirestorePayload).length > 0) {
        await userDocRef.update(updateFirestorePayload);
    }

    return NextResponse.json({ success: true, message: 'User updated successfully.' });

  } catch (error: any) {
    console.error('Update User API error:', error);
    let message = 'Error updating user.';
    if(error.code === 'auth/email-already-exists') {
        message = 'Este correo electrónico ya está en uso por otra cuenta.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
