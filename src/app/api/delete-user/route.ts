import { type NextRequest, NextResponse } from 'next/server';
import { readCredentials, writeCredentials } from '@/lib/data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }
    
    const credentials = await readCredentials();
    const updatedCredentials = credentials.filter(c => c.id !== id);

    if (credentials.length === updatedCredentials.length) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    await writeCredentials(updatedCredentials);
    
    return NextResponse.json({ success: true, message: 'User deleted successfully.' });

  } catch (error: any) {
    console.error('Delete User API error:', error);
    return NextResponse.json({ error: 'Error deleting user.' }, { status: 500 });
  }
}
