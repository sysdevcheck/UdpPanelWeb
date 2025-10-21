
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
    const { id } = body; // Use the user's unique ID

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }
    
    let credentials = await readCredentials();
    const userIndex = credentials.findIndex((u: any) => u.id === id);

    if (userIndex === -1) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    credentials.splice(userIndex, 1);
    await writeCredentials(credentials);
    
    return NextResponse.json({ success: true, message: 'User deleted successfully.' });

  } catch (error: any) {
    console.error('Delete User API error:', error);
    return NextResponse.json({ error: 'Error deleting user.' }, { status: 500 });
  }
}
