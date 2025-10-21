
import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

const firestore = getFirestore(adminApp);

// GET handler to fetch users
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const serverId = searchParams.get('serverId');
        const createdBy = searchParams.get('createdBy');

        if (!serverId) {
            return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
        }

        let usersQuery = firestore.collection('vpnUsers').where('serverId', '==', serverId);
        if (createdBy) {
            usersQuery = usersQuery.where('createdBy', '==', createdBy);
        }
        
        const snapshot = await usersQuery.orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            return NextResponse.json([]);
        }
        
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(users);

    } catch (error: any) {
        console.error('VPN Users GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch VPN users.', details: error.message }, { status: 500 });
    }
}


// POST handler to create a new user
export async function POST(request: NextRequest) {
    try {
        const { username, serverId, createdBy } = await request.json();

        if (!username || !serverId || !createdBy) {
            return NextResponse.json({ error: 'Username, serverId, and createdBy are required.' }, { status: 400 });
        }

        const expiresAt = Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const newUserRef = await firestore.collection('vpnUsers').add({
            username,
            serverId,
            createdBy,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt,
        });

        return NextResponse.json({ success: true, id: newUserRef.id });

    } catch (error: any) {
        console.error('VPN Users POST Error:', error);
        return NextResponse.json({ error: 'Failed to create VPN user.', details: error.message }, { status: 500 });
    }
}

// PUT handler to update (edit username or renew) a user
export async function PUT(request: NextRequest) {
    try {
        const { docId, username, renew } = await request.json();

        if (!docId) {
            return NextResponse.json({ error: 'Document ID is required.' }, { status: 400 });
        }

        const docRef = firestore.collection('vpnUsers').doc(docId);
        const updateData: { [key: string]: any } = {};

        if (username) {
            updateData.username = username;
        }

        if (renew) {
            updateData.expiresAt = Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No update data provided (username or renew).' }, { status: 400 });
        }

        await docRef.update(updateData);
        return NextResponse.json({ success: true, message: 'User updated successfully.' });

    } catch (error: any) {
        console.error('VPN Users PUT Error:', error);
        return NextResponse.json({ error: 'Failed to update VPN user.', details: error.message }, { status: 500 });
    }
}


// DELETE handler to remove a user
export async function DELETE(request: NextRequest) {
    try {
        const { docId } = await request.json();

        if (!docId) {
            return NextResponse.json({ error: 'Document ID is required.' }, { status: 400 });
        }

        await firestore.collection('vpnUsers').doc(docId).delete();
        return NextResponse.json({ success: true, message: 'User deleted successfully.' });

    } catch (error: any) {
        console.error('VPN Users DELETE Error:', error);
        return NextResponse.json({ error: 'Failed to delete VPN user.', details: error.message }, { status: 500 });
    }
}
