
import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const firestore = getFirestore(adminApp);

    const body = await request.json();
    const { docId, username, password, assignedServerId } = body;

    if (!docId) {
      return NextResponse.json({ error: 'User Doc ID is required.' }, { status: 400 });
    }
    
    // Update Firestore document
    const userDocRef = firestore.collection('users').doc(docId);
    const updateFirestorePayload: { [key: string]: any } = {};

    if (username) {
      // Check if new username is already taken by another user
      const existingUserQuery = await firestore.collection('users').where('username', '==', username).limit(1).get();
      const existingUser = existingUserQuery.docs.find(doc => doc.id !== docId);
      if (existingUser) {
        return NextResponse.json({ error: 'Este nombre de usuario ya está en uso.' }, { status: 409 });
      }
      updateFirestorePayload.username = username;
    }
    
    if (password) updateFirestorePayload.password = password;
    if (assignedServerId !== undefined) updateFirestorePayload.assignedServerId = assignedServerId;

    if(Object.keys(updateFirestorePayload).length > 0) {
        await userDocRef.update(updateFirestorePayload);
    }

    return NextResponse.json({ success: true, message: 'User updated successfully.' });

  } catch (error: any) {
    console.error('Update User API error:', error);
    let message = 'Error updating user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
