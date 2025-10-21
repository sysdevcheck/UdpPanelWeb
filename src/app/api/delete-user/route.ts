import { type NextRequest, NextResponse } from 'next/server';
import { doc, deleteDoc } from 'firebase/firestore';
import { getSdks } from '@/firebase';

const { firestore } = getSdks();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }
    
    const userDocRef = doc(firestore, 'credentials', id);
    await deleteDoc(userDocRef);
    
    return NextResponse.json({ success: true, message: 'User deleted successfully.' });

  } catch (error: any) {
    console.error('Delete User API error:', error);
    return NextResponse.json({ error: 'Error deleting user.' }, { status: 500 });
  }
}
