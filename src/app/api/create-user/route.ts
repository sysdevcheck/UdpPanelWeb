
import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

const firestore = getFirestore(adminApp);
const auth = getAuth(adminApp);

export async function GET(request: NextRequest) {
    try {
        const managersSnapshot = await firestore.collection('users').where('role', '==', 'manager').get();
        if (managersSnapshot.empty) {
            return NextResponse.json([]);
        }
        const managers = managersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(managers);
    } catch (error: any) {
        console.error('Get Managers API error:', error);
        return NextResponse.json({ error: 'Failed to fetch managers', details: error.message }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
    
    await auth.setCustomUserClaims(userRecord.uid, { role: 'manager' });
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const userDocRef = firestore.collection('users').doc();
    await userDocRef.set({
        uid: userRecord.uid, // Link to the auth user
        username,
        email,
        password, 
        role,
        assignedServerId: assignedServerId || null,
        createdAt: Timestamp.now(),
        expiresAt: expiresAt,
    });
    
    const newManagerData = await userDocRef.get();

    return NextResponse.json({ success: true, user: {id: newManagerData.id, ...newManagerData.data()} });

  } catch (error: any) {
    console.error('Create User API error:', error);
    let message = 'Error creating user.';
    if(error.code === 'auth/email-already-exists') {
        message = 'Este correo electrónico ya está en uso.';
    }
    return NextResponse.json({ error: message, details: error.message }, { status: 500 });
  }
}
