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
    const { uid } = body;

    if (!uid) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    // 1. Delete user from Firebase Auth
    await adminAuth.deleteUser(uid);

    // 2. Delete user document from Firestore
    await firestore.collection('users').doc(uid).delete();
    
    return NextResponse.json({ success: true, message: 'User deleted successfully.' });

  } catch (error: any) {
    console.error('Delete User API error:', error);
    let message = 'Error deleting user.';
    if (error.code === 'auth/user-not-found') {
        message = 'El usuario no fue encontrado para eliminar.';
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

    