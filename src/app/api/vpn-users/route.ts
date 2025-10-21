
import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const VPN_USERS_PATH = path.join(process.cwd(), 'data', 'vpn-users.json');

const readData = async () => {
    try {
        const data = await fs.readFile(VPN_USERS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e: any) {
        if (e.code === 'ENOENT') return [];
        throw e;
    }
};

const writeData = async (data: any) => {
    await fs.mkdir(path.dirname(VPN_USERS_PATH), { recursive: true });
    await fs.writeFile(VPN_USERS_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

// GET handler to fetch users
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const serverId = searchParams.get('serverId');
        const createdBy = searchParams.get('createdBy');

        if (!serverId) {
            return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
        }

        let allUsers = await readData();
        
        let usersQuery = allUsers.filter((u: any) => u.serverId === serverId);

        if (createdBy) {
            usersQuery = usersQuery.filter((u: any) => u.createdBy === createdBy);
        }
        
        // Sort descending by creation date
        usersQuery.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return NextResponse.json(usersQuery);

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

        let allUsers = await readData();
        
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const newUser = {
            id: `vpn_${Date.now()}`,
            username,
            serverId,
            createdBy,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
        };

        allUsers.push(newUser);
        await writeData(allUsers);

        return NextResponse.json({ success: true, id: newUser.id });

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

        let allUsers = await readData();
        const userIndex = allUsers.findIndex((u: any) => u.id === docId);

        if (userIndex === -1) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (username) {
            allUsers[userIndex].username = username;
        }

        if (renew) {
            const newExpiresAt = new Date();
            newExpiresAt.setDate(newExpiresAt.getDate() + 30);
            allUsers[userIndex].expiresAt = newExpiresAt.toISOString();
        }

        await writeData(allUsers);
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

        let allUsers = await readData();
        const updatedUsers = allUsers.filter((u: any) => u.id !== docId);

        if (allUsers.length === updatedUsers.length) {
             return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        await writeData(updatedUsers);
        return NextResponse.json({ success: true, message: 'User deleted successfully.' });

    } catch (error: any) {
        console.error('VPN Users DELETE Error:', error);
        return NextResponse.json({ error: 'Failed to delete VPN user.', details: error.message }, { status: 500 });
    }
}
