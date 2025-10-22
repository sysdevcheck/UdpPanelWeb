import { type NextRequest, NextResponse } from 'next/server';
import { readServers, writeServers } from '@/lib/data';
import { randomBytes } from 'crypto';

// GET all servers
export async function GET(request: NextRequest) {
    try {
        const servers = await readServers();
        return NextResponse.json(servers);
    } catch (error: any) {
        console.error('GET Servers error:', error);
        return NextResponse.json({ error: 'Failed to retrieve servers.', details: error.message }, { status: 500 });
    }
}

// ADD a new server
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, host, port, username, password, serviceCommand } = body;

        if (!name || !host || !port || !username || !password) {
            return NextResponse.json({ error: 'Missing required server fields.' }, { status: 400 });
        }

        const newServer = {
            id: randomBytes(8).toString('hex'),
            name,
            host,
            port: Number(port),
            username,
            password,
            serviceCommand: serviceCommand || 'systemctl restart zivpn'
        };

        const servers = await readServers();
        
        // Check for duplicate name or host
        if (servers.some(s => s.name === name)) {
            return NextResponse.json({ error: 'Ya existe un servidor con este nombre.' }, { status: 409 });
        }
        if (servers.some(s => s.host === host)) {
            return NextResponse.json({ error: 'Ya existe un servidor con este Host/IP.' }, { status: 409 });
        }
        
        servers.push(newServer);
        await writeServers(servers);

        return NextResponse.json({ success: true, server: newServer });

    } catch (error: any) {
        console.error('POST Server error:', error);
        return NextResponse.json({ error: 'Failed to add server.', details: error.message }, { status: 500 });
    }
}

// UPDATE an existing server
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'Server ID is required for update.' }, { status: 400 });
        }

        const servers = await readServers();
        const serverIndex = servers.findIndex(s => s.id === id);

        if (serverIndex === -1) {
            return NextResponse.json({ error: 'Server not found.' }, { status: 404 });
        }

        // Check for duplicate name or host on other servers
        if (updateData.name && servers.some(s => s.name === updateData.name && s.id !== id)) {
            return NextResponse.json({ error: 'Ya existe otro servidor con este nombre.' }, { status: 409 });
        }
        if (updateData.host && servers.some(s => s.host === updateData.host && s.id !== id)) {
            return NextResponse.json({ error: 'Ya existe otro servidor con este Host/IP.' }, { status: 409 });
        }

        servers[serverIndex] = { ...servers[serverIndex], ...updateData };
        await writeServers(servers);

        return NextResponse.json({ success: true, server: servers[serverIndex] });

    } catch (error: any) {
        console.error('PUT Server error:', error);
        return NextResponse.json({ error: 'Failed to update server.', details: error.message }, { status: 500 });
    }
}


// DELETE a server
export async function DELETE(request: NextRequest) {
    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Server ID is required for deletion.' }, { status: 400 });
        }

        let servers = await readServers();
        const initialLength = servers.length;
        servers = servers.filter(s => s.id !== id);

        if (servers.length === initialLength) {
             return NextResponse.json({ error: 'Server not found.' }, { status: 404 });
        }

        await writeServers(servers);

        // Optional: also delete associated VPN users
        // let vpnUsers = await readVpnUsers();
        // vpnUsers = vpnUsers.filter(u => u.serverId !== id);
        // await writeVpnUsers(vpnUsers);

        return NextResponse.json({ success: true, message: 'Server deleted successfully.' });

    } catch (error: any) {
        console.error('DELETE Server error:', error);
        return NextResponse.json({ error: 'Failed to delete server.', details: error.message }, { status: 500 });
    }
}
