
import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'data', 'credentials.json');

const readCredentials = async () => {
    try {
        const data = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e: any) {
        if (e.code === 'ENOENT') return [];
        throw e;
    }
};

const writeCredentials = async (data: any) => {
    await fs.mkdir(path.dirname(CREDENTIALS_PATH), { recursive: true });
    await fs.writeFile(CREDENTIALS_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

export async function GET(request: NextRequest) {
    try {
        const credentials = await readCredentials();
        const managers = credentials.filter((u: any) => u.role === 'manager');
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
    const existingUser = credentials.find((u: any) => u.username === username);
    if (existingUser) {
      return NextResponse.json({ error: 'Este nombre de usuario ya está en uso.' }, { status: 409 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const newUser = {
        id: `user_${Date.now()}`,
        username,
        password, 
        role,
        assignedServerId: assignedServerId || null,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
    };
    
    credentials.push(newUser);
    await writeCredentials(credentials);

    return NextResponse.json({ success: true, user: newUser });

  } catch (error: any) {
    console.error('Create User API error:', error);
    return NextResponse.json({ error: 'Error creating user.', details: error.message }, { status: 500 });
  }
}
