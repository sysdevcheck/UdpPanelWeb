import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const firestore = getFirestore(adminApp);
    const usersRef = firestore.collection('users');
    const userQuery = await usersRef.where('username', '==', username).limit(1).get();

    if (userQuery.empty) {
        return NextResponse.json({ error: 'Usuario o contraseña inválidos.' }, { status: 401 });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    if (userData.password !== password) {
        return NextResponse.json({ error: 'Usuario o contraseña inválidos.' }, { status: 401 });
    }

    const sessionPayload = {
        uid: userDoc.id,
        username: userData.username,
        email: userData.email, // keeping email if available
        role: userData.role || 'user',
        assignedServerId: userData.assignedServerId || null,
    };
    
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    cookies().set('session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: Date.now() + thirtyDays,
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ success: true, user: sessionPayload });

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
