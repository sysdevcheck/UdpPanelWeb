import { type NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { getSdks } from '@/firebase';

export async function GET(request: NextRequest) {
    const { firestore } = getSdks();
    const vpnUsersCollection = collection(firestore, 'vpn-users');
    try {
        const { searchParams } = new URL(request.url);
        const serverId = searchParams.get('serverId');
        const createdBy = searchParams.get('createdBy');

        if (!serverId) {
            return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
        }
        
        const conditions = [where('serverId', '==', serverId)];
        if (createdBy) {
            conditions.push(where('createdBy', '==', createdBy));
        }

        const q = query(vpnUsersCollection, ...conditions, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        return NextResponse.json(users);

    } catch (error: any) {
        console.error('VPN Users GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch VPN users.', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const { firestore } = getSdks();
    const vpnUsersCollection = collection(firestore, 'vpn-users');
    try {
        const { username, serverId, createdBy } = await request.json();

        if (!username || !serverId || !createdBy) {
            return NextResponse.json({ error: 'Username, serverId, and createdBy are required.' }, { status: 400 });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const newUser = {
            username,
            serverId,
            createdBy,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
        };

        const docRef = await addDoc(vpnUsersCollection, newUser);

        return NextResponse.json({ success: true, id: docRef.id });

    } catch (error: any) {
        console.error('VPN Users POST Error:', error);
        return NextResponse.json({ error: 'Failed to create VPN user.', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const { firestore } = getSdks();
    try {
        const { docId, username, renew } = await request.json();

        if (!docId) {
            return NextResponse.json({ error: 'Document ID is required.' }, { status: 400 });
        }
        
        const userDocRef = doc(firestore, 'vpn-users', docId);
        const updateData: any = {};

        if (username) {
            updateData.username = username;
        }

        if (renew) {
            const newExpiresAt = new Date();
            newExpiresAt.setDate(newExpiresAt.getDate() + 30);
            updateData.expiresAt = newExpiresAt.toISOString();
        }
        
        if (Object.keys(updateData).length > 0) {
             await updateDoc(userDocRef, updateData);
        }

        return NextResponse.json({ success: true, message: 'User updated successfully.' });

    } catch (error: any) {
        console.error('VPN Users PUT Error:', error);
        return NextResponse.json({ error: 'Failed to update VPN user.', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { firestore } = getSdks();
    try {
        const { searchParams } = new URL(request.url);
        const docId = searchParams.get('docId');

        if (!docId) {
            return NextResponse.json({ error: 'Document ID is required.' }, { status: 400 });
        }

        const userDocRef = doc(firestore, 'vpn-users', docId);
        await deleteDoc(userDocRef);

        return NextResponse.json({ success: true, message: 'User deleted successfully.' });

    } catch (error: any) {
        console.error('VPN Users DELETE Error:', error);
        return NextResponse.json({ error: 'Failed to delete VPN user.', details: error.message }, { status: 500 });
    }
}
