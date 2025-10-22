import { type NextRequest, NextResponse } from 'next/server';
import { readCredentials, writeCredentials } from '@/lib/data';

export async function POST(request: NextRequest) {
    try {
        const { id } = await request.json();
        
        if (!id) {
            return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
        }

        let credentials = await readCredentials();
        const initialLength = credentials.length;

        credentials = credentials.filter(c => c.id !== id);

        if (credentials.length === initialLength) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }
        
        await writeCredentials(credentials);
        
        return NextResponse.json({ success: true, message: 'User deleted successfully.' });

    } catch (error: any) {
        console.error('Delete User API error:', error);
        return NextResponse.json({ error: 'Failed to delete user.', details: error.message }, { status: 500 });
    }
}
