import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const firestore = getFirestore(adminApp);
    const auth = getAuth(adminApp);
    
    const body = await request.json();
    const { authUid, docId } = body; // We need both auth UID and Firestore doc ID

    if (!authUid || !docId) {
      return NextResponse.json({ error: 'User Auth ID and Document ID are required.' }, { status: 400 });
    }

    // Delete from Firebase Authentication
    await auth.deleteUser(authUid);
    
    // Delete from Firestore
    await firestore.collection('users').doc(docId).delete();
    
    return NextResponse.json({ success: true, message: 'User deleted successfully.' });

  } catch (error: any) {
    console.error('Delete User API error:', error);
    let message = 'Error deleting user.';
    if(error.code === 'auth/user-not-found') {
        // If user is not in auth, we can still try to delete from firestore
        const { docId } = await request.json();
        if(docId) await firestore.collection('users').doc(docId).delete();
        return NextResponse.json({ success: true, message: 'User deleted from database.' });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
