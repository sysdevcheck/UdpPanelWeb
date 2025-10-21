import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const firestore = getFirestore(adminApp);

    const body = await request.json();
    const { uid, username, password, assignedServerId } = body;

    if (!uid) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const userDocRef = firestore.collection('users').doc(uid);
    
    const updatePayload: { [key: string]: any } = {};
    if (username) updatePayload.username = username;
    if (password) updatePayload.password = password; // Storing plain text
    if (assignedServerId !== undefined) updatePayload.assignedServerId = assignedServerId;

    if(Object.keys(updatePayload).length > 0) {
        await userDocRef.update(updatePayload);
    }

    return NextResponse.json({ success: true, message: 'User updated successfully.' });

  } catch (error: any) {
    console.error('Update User API error:', error);
    let message = 'Error updating user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
