
import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const firestore = getFirestore(adminApp);
    
    const body = await request.json();
    const { docId } = body; // We only need the Firestore doc ID

    if (!docId) {
      return NextResponse.json({ error: 'User Document ID is required.' }, { status: 400 });
    }
    
    // Delete from Firestore
    await firestore.collection('users').doc(docId).delete();
    
    return NextResponse.json({ success: true, message: 'User deleted successfully.' });

  } catch (error: any) {
    console.error('Delete User API error:', error);
    let message = 'Error deleting user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
