import { type NextRequest, NextResponse } from 'next/server';
import { readVpnUsers, writeVpnUsers } from '@/lib/data';
import { randomBytes } from 'crypto';
import { format } from 'date-fns';

// GET all VPN users
export async function GET(request: NextRequest) {
    try {
        const users = await readVpnUsers();
        return NextResponse.json(users);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to get VPN users.' }, { status: 500 });
    }
}

// ADD new VPN users
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { serverId, usernames, createdBy, days } = body;

        if (!serverId || !usernames || !Array.isArray(usernames) || !createdBy || !days) {
            return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
        }

        const allUsers = await readVpnUsers();
        const newUsers = [];
        const existingUsernames: string[] = [];

        for (const username of usernames) {
            const isDuplicate = allUsers.some(u => u.username === username && u.serverId === serverId);
            if (isDuplicate) {
                existingUsernames.push(username);
                continue;
            }

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + Number(days));

            newUsers.push({
                id: randomBytes(8).toString('hex'),
                username,
                serverId,
                createdBy,
                createdAt: new Date().toISOString(),
                expiresAt: expiresAt.toISOString(),
            });
        }
        
        if (existingUsernames.length > 0) {
             return NextResponse.json({ 
                error: `Los siguientes nombres de usuario ya existen en este servidor: ${existingUsernames.join(', ')}`,
                code: 'DUPLICATE_USERS'
            }, { status: 409 });
        }

        if (newUsers.length > 0) {
            const updatedUsers = [...allUsers, ...newUsers];
            await writeVpnUsers(updatedUsers);
        }

        return NextResponse.json({ success: true, users: newUsers });

    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to create VPN users.' }, { status: 500 });
    }
}

// RENEW existing VPN user
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, days } = body;

        if (!userId || !days) {
            return NextResponse.json({ error: 'User ID and days are required.' }, { status: 400 });
        }

        const allUsers = await readVpnUsers();
        const userIndex = allUsers.findIndex(u => u.id === userId);

        if (userIndex === -1) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + Number(days));
        allUsers[userIndex].expiresAt = expiresAt.toISOString();

        await writeVpnUsers(allUsers);

        return NextResponse.json({ success: true, user: allUsers[userIndex] });

    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to renew VPN user.' }, { status: 500 });
    }
}

// DELETE a VPN user
export async function DELETE(request: NextRequest) {
     try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
        }

        let allUsers = await readVpnUsers();
        const initialLength = allUsers.length;
        
        allUsers = allUsers.filter(u => u.id !== userId);

        if (allUsers.length === initialLength) {
             return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        await writeVpnUsers(allUsers);

        return NextResponse.json({ success: true, message: 'User deleted successfully.' });

    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to delete VPN user.' }, { status: 500 });
    }
}
