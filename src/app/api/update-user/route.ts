
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, username, password, assignedServerId } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }
    
    let credentials = await readCredentials();
    const userIndex = credentials.findIndex((u: any) => u.id === id);

    if (userIndex === -1) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    
    const currentUser = credentials[userIndex];

    if (username) {
      const existingUser = credentials.find((u: any) => u.username === username && u.id !== id);
      if (existingUser) {
        return NextResponse.json({ error: 'Este nombre de usuario ya está en uso.' }, { status: 409 });
      }
      currentUser.username = username;
    }
    
    if (password) currentUser.password = password;
    if (assignedServerId !== undefined) currentUser.assignedServerId = assignedServerId;

    credentials[userIndex] = currentUser;
    await writeCredentials(credentials);

    return NextResponse.json({ success: true, message: 'User updated successfully.' });

  } catch (error: any) {
    console.error('Update User API error:', error);
    return NextResponse.json({ error: 'Error updating user.' }, { status: 500 });
  }
}
