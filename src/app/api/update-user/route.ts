import { type NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { getSdks } from '@/firebase';

const { firestore } = getSdks();
const credentialsCollection = collection(firestore, 'credentials');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, username, password, assignedServerId } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }
    
    const userDocRef = doc(firestore, 'credentials', id);
    const updateData: any = {};

    if (username) {
      const q = query(credentialsCollection, where('username', '==', username));
      const existingUser = await getDocs(q);
      const anotherUserExists = existingUser.docs.some(doc => doc.id !== id);

      if (anotherUserExists) {
        return NextResponse.json({ error: 'Este nombre de usuario ya está en uso.' }, { status: 409 });
      }
      updateData.username = username;
    }
    
    if (password) updateData.password = password;
    if (assignedServerId !== undefined) updateData.assignedServerId = assignedServerId;

    if(Object.keys(updateData).length > 0) {
        await updateDoc(userDocRef, updateData);
    }

    return NextResponse.json({ success: true, message: 'User updated successfully.' });

  } catch (error: any) {
    console.error('Update User API error:', error);
    return NextResponse.json({ error: 'Error updating user.' }, { status: 500 });
  }
}
