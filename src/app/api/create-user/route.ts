
import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

const firestore = getFirestore(adminApp);

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
    const { username, password, role, assignedServerId } = body;

    if (!username || !password || !role) {
      return NextResponse.json({ error: 'Username, password, and role are required.' }, { status: 400 });
    }
    if (role === 'manager' && !assignedServerId) {
        return NextResponse.json({ error: 'A server must be assigned to a manager.' }, { status: 400 });
    }
    
    // Check if username already exists
    const existingUserQuery = await firestore.collection('users').where('username', '==', username).limit(1).get();
    if (!existingUserQuery.empty) {
      return NextResponse.json({ error: 'Este nombre de usuario ya está en uso.' }, { status: 409 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const userDocRef = firestore.collection('users').doc();
    await userDocRef.set({
        uid: userDocRef.id, // Self-reference ID as UID
        username,
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
    return NextResponse.json({ error: message, details: error.message }, { status: 500 });
  }
}
