import { type NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { getSdks } from '@/firebase';

export async function GET(request: NextRequest) {
    const { firestore } = getSdks();
    const credentialsCollection = collection(firestore, 'credentials');
    try {
        const q = query(credentialsCollection, where('role', '==', 'manager'));
        const querySnapshot = await getDocs(q);
        const managers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(managers);
    } catch (error: any) {
        console.error('Get Managers API error:', error);
        return NextResponse.json({ error: 'Failed to fetch managers', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
  const { firestore } = getSdks();
  const credentialsCollection = collection(firestore, 'credentials');
  try {
    const body = await request.json();
    const { username, password, role, assignedServerId } = body;

    if (!username || !password || !role) {
      return NextResponse.json({ error: 'Username, password, and role are required.' }, { status: 400 });
    }
    if (role === 'manager' && !assignedServerId) {
        return NextResponse.json({ error: 'A server must be assigned to a manager.' }, { status: 400 });
    }
    
    const q = query(credentialsCollection, where('username', '==', username));
    const existingUser = await getDocs(q);

    if (!existingUser.empty) {
      return NextResponse.json({ error: 'Este nombre de usuario ya está en uso.' }, { status: 409 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const newUser = {
        username,
        password, 
        role,
        assignedServerId: assignedServerId || null,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
    };
    
    const docRef = await addDoc(credentialsCollection, newUser);

    return NextResponse.json({ success: true, user: { id: docRef.id, ...newUser } });

  } catch (error: any) {
    console.error('Create User API error:', error);
    return NextResponse.json({ error: 'Error creating user.', details: error.message }, { status: 500 });
  }
}
