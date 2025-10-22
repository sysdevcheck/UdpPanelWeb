import { type NextRequest, NextResponse } from 'next/server';
import { readCredentials, writeCredentials } from '@/lib/data';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, username, password, assignedServerId } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }
    
    const credentials = await readCredentials();
    const userIndex = credentials.findIndex(c => c.id === id);

    if (userIndex === -1) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const updateData = credentials[userIndex];

    if (username) {
      const anotherUserExists = credentials.some(c => c.username === username && c.id !== id);
      if (anotherUserExists) {
        return NextResponse.json({ error: 'Este nombre de usuario ya está en uso.' }, { status: 409 });
      }
      updateData.username = username;
    }
    
    if (password) {
        updateData.password = await bcrypt.hash(password, 10);
    }
    if (assignedServerId !== undefined) {
        updateData.assignedServerId = assignedServerId;
    }

    credentials[userIndex] = updateData;
    await writeCredentials(credentials);

    return NextResponse.json({ success: true, message: 'User updated successfully.' });

  } catch (error: any)
    {
    console.error('Update User API error:', error);
    return NextResponse.json({ error: 'Error updating user.' }, { status: 500 });
  }
}
