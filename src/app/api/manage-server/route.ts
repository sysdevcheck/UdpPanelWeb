import { type NextRequest, NextResponse } from 'next/server';
import { readServers, writeServers, readCredentials, writeCredentials, readVpnUsers, writeVpnUsers } from '@/lib/data';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    try {
        const servers = await readServers();
        if (serverId) {
            const server = servers.find(s => s.id === serverId);
            if (!server) {
                return NextResponse.json({ error: 'Server not found' }, { status: 404 });
            }
            return NextResponse.json(server);
        } else {
            return NextResponse.json(servers);
        }
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch servers.', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverId, name, host, port, username, password, serviceCommand } = body;
    
    const servers = await readServers();
    
    const serverData: any = { 
        name, 
        host, 
        port: parseInt(port) || 22,
        username,
        serviceCommand: serviceCommand || 'systemctl restart zivpn'
    };

    if (serverId) {
        const serverIndex = servers.findIndex(s => s.id === serverId);
        if (serverIndex === -1) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }
        
        const existingServer = servers[serverIndex];
        serverData.id = serverId;
        // Keep old password if new one isn't provided
        serverData.password = password || existingServer.password;
        
        servers[serverIndex] = serverData;

    } else {
        if (!password) {
            return NextResponse.json({ error: 'Password is required for new servers.' }, { status: 400 });
        }
        serverData.id = randomBytes(8).toString('hex');
        serverData.password = password;
        servers.push(serverData);
    }
    
    await writeServers(servers);
    
    return NextResponse.json({ success: true, message: `Servidor "${name}" guardado exitosamente.` });

  } catch (error: any) {
    console.error('Manage Server API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { serverId } = await request.json();
    
    if (!serverId) {
        return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
    }

    // 1. Delete the server
    const servers = await readServers();
    const updatedServers = servers.filter(s => s.id !== serverId);
    await writeServers(updatedServers);

    // 2. Unassign managers
    const credentials = await readCredentials();
    const updatedCredentials = credentials.map(c => {
        if (c.assignedServerId === serverId) {
            return { ...c, assignedServerId: null };
        }
        return c;
    });
    await writeCredentials(updatedCredentials);

    // 3. Delete associated VPN users
    const vpnUsers = await readVpnUsers();
    const updatedVpnUsers = vpnUsers.filter(u => u.serverId !== serverId);
    await writeVpnUsers(updatedVpnUsers);
    
    return NextResponse.json({ success: true, message: 'Server deleted successfully.' });

  } catch (error: any) {
    console.error('Delete Server API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
