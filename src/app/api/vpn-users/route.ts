import { type NextRequest, NextResponse } from 'next/server';
import { readVpnUsers, writeVpnUsers } from '@/lib/data';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const serverId = searchParams.get('serverId');
        const createdBy = searchParams.get('createdBy');

        if (!serverId) {
            return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
        }
        
        let users = await readVpnUsers();
        users = users.filter(u => u.serverId === serverId);

        if (createdBy) {
            users = users.filter(u => u.createdBy === createdBy);
        }

        users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return NextResponse.json(users);

    } catch (error: any) {
        console.error('VPN Users GET Error:', error);
        return NextResponse.json({ error: 'Failed to fetch VPN users.', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { username, serverId, createdBy } = await request.json();

        if (!username || !serverId || !createdBy) {
            return NextResponse.json({ error: 'Username, serverId, and createdBy are required.' }, { status: 400 });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        
        const users = await readVpnUsers();

        const newUser = {
            id: randomBytes(8).toString('hex'),
            username,
            serverId,
            createdBy,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
        };
        
        users.push(newUser);
        await writeVpnUsers(users);

        return NextResponse.json({ success: true, id: newUser.id });

    } catch (error: any) {
        console.error('VPN Users POST Error:', error);
        return NextResponse.json({ error: 'Failed to create VPN user.', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { docId, username, renew } = await request.json();

        if (!docId) {
            return NextResponse.json({ error: 'Document ID is required.' }, { status: 400 });
        }
        
        const users = await readVpnUsers();
        const userIndex = users.findIndex(u => u.id === docId);

        if (userIndex === -1) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userToUpdate = users[userIndex];

        if (username) {
            userToUpdate.username = username;
        }

        if (renew) {
            const newExpiresAt = new Date();
            newExpiresAt.setDate(newExpiresAt.getDate() + 30);
            userToUpdate.expiresAt = newExpiresAt.toISOString();
        }
        
        users[userIndex] = userToUpdate;
        await writeVpnUsers(users);

        return NextResponse.json({ success: true, message: 'User updated successfully.' });

    } catch (error: any) {
        console.error('VPN Users PUT Error:', error);
        return NextResponse.json({ error: 'Failed to update VPN user.', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const docId = searchParams.get('docId');

        if (!docId) {
            return NextResponse.json({ error: 'Document ID is required.' }, { status: 400 });
        }
        
        const users = await readVpnUsers();
        const updatedUsers = users.filter(u => u.id !== docId);

        if (users.length === updatedUsers.length) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        await writeVpnUsers(updatedUsers);

        return NextResponse.json({ success: true, message: 'User deleted successfully.' });

    } catch (error: any) {
        console.error('VPN Users DELETE Error:', error);
        return NextResponse.json({ error: 'Failed to delete VPN user.', details: error.message }, { status: 500 });
    }
}
