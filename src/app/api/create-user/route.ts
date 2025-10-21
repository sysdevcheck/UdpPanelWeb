import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const firestore = getFirestore(adminApp);
    
    const body = await request.json();
    const { username, password, role, assignedServerId } = body;

    if (!username || !password || !role) {
      return NextResponse.json({ error: 'Username, password, and role are required.' }, { status: 400 });
    }
    if (role === 'manager' && !assignedServerId) {
        return NextResponse.json({ error: 'A server must be assigned to a manager.' }, { status: 400 });
    }
    
    const usersRef = firestore.collection('users');
    const existingUser = await usersRef.where('username', '==', username).get();
    if (!existingUser.empty) {
        return NextResponse.json({ error: 'Este nombre de usuario ya está en uso.' }, { status: 409 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const userDocData = {
        username,
        password, // Storing password in plain text as requested to mimic old system
        role,
        assignedServerId: assignedServerId || null,
        createdAt: new Date(),
        expiresAt: role === 'owner' ? null : expiresAt
    };

    const newUserRef = await usersRef.add(userDocData);
    
    return NextResponse.json({ success: true, uid: newUserRef.id });

  } catch (error: any) {
    console.error('Create User API error:', error);
    let message = 'Error creating user.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
