import { type NextRequest, NextResponse } from 'next/server';
import { readCredentials, writeCredentials } from '@/lib/data';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
    try {
        const credentials = await readCredentials();
        const managers = credentials.filter(c => c.role === 'manager').map(({ password, ...manager }) => manager);
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
    
    const credentials = await readCredentials();
    const existingUser = credentials.find(c => c.username === username);

    if (existingUser) {
      return NextResponse.json({ error: 'Este nombre de usuario ya está en uso.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const newUser = {
        id: randomBytes(8).toString('hex'),
        username,
        password: hashedPassword, 
        role,
        assignedServerId: assignedServerId || null,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
    };
    
    credentials.push(newUser);
    await writeCredentials(credentials);
    
    const { password: _, ...userToReturn } = newUser;
    return NextResponse.json({ success: true, user: userToReturn });

  } catch (error: any) {
    console.error('Create User API error:', error);
    return NextResponse.json({ error: 'Error creating user.', details: error.message }, { status: 500 });
  }
}
