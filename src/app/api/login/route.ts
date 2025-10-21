import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getSdks } from '@/firebase';

const { firestore } = getSdks();
const credentialsCollection = collection(firestore, 'credentials');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos.' }, { status: 400 });
    }

    const q = query(credentialsCollection, where('username', '==', username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }
    
    const userDoc = querySnapshot.docs[0];
    const user = userDoc.data();

    let passwordMatch = false;

    if (user.role === 'owner') {
        const ownerUsername = process.env.OWNER_USERNAME || 'admin';
        const ownerPassword = process.env.OWNER_PASSWORD || 'password';
        if (username === ownerUsername && password === ownerPassword) {
            passwordMatch = true;
        }
    } else {
        if (user.password === password) {
            passwordMatch = true;
        }
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Credenciales inválidas.' }, { status: 401 });
    }

    const sessionPayload = {
      username: user.username,
      role: user.role,
      assignedServerId: user.assignedServerId || null
    };

    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    await cookies().set('session', JSON.stringify(sessionPayload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: Date.now() + thirtyDays,
      sameSite: 'lax',
      path: '/',
    });

    return NextResponse.json({ success: true, user: sessionPayload });

  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Ocurrió un error inesperado en el servidor.' }, { status: 500 });
  }
}
