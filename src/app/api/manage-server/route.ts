
import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SERVERS_PATH = path.join(process.cwd(), 'data', 'servers.json');
const MANAGERS_PATH = path.join(process.cwd(), 'data', 'credentials.json');
const VPN_USERS_PATH = path.join(process.cwd(), 'data', 'vpn-users.json');

const readData = async (filePath: string) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (e: any) {
        if (e.code === 'ENOENT') return []; // File not found, return empty array
        throw e;
    }
};

const writeData = async (filePath: string, data: any) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    try {
        const servers = await readData(SERVERS_PATH);
        if (serverId) {
            const server = servers.find((s: any) => s.id === serverId);
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
    const { serverId, name, host, port, username, password } = body;
    
    let servers = await readData(SERVERS_PATH);
    
    if (serverId) { // Editing existing server
        const serverIndex = servers.findIndex((s: any) => s.id === serverId);
        if (serverIndex === -1) {
            return NextResponse.json({ error: 'Server not found for update' }, { status: 404 });
        }
        servers[serverIndex] = {
            ...servers[serverIndex],
            name,
            host,
            port,
            username,
        };
        // Only update password if a new one is provided
        if (password) {
            servers[serverIndex].password = password;
        }

    } else { // Creating new server
        const newServer = {
            id: `server_${Date.now()}`,
            name,
            host,
            port,
            username,
            password,
        };
        servers.push(newServer);
    }
    
    await writeData(SERVERS_PATH, servers);
    
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

    let servers = await readData(SERVERS_PATH);
    let managers = await readData(MANAGERS_PATH);
    let vpnUsers = await readData(VPN_USERS_PATH);

    // Filter out the server to delete
    const updatedServers = servers.filter((s: any) => s.id !== serverId);

    // Unassign managers from the deleted server
    const updatedManagers = managers.map((m: any) => {
        if (m.assignedServerId === serverId) {
            return { ...m, assignedServerId: null };
        }
        return m;
    });

    // Delete VPN users associated with the server
    const updatedVpnUsers = vpnUsers.filter((u: any) => u.serverId !== serverId);

    // Write all changes back to files
    await writeData(SERVERS_PATH, updatedServers);
    await writeData(MANAGERS_PATH, updatedManagers);
    await writeData(VPN_USERS_PATH, updatedVpnUsers);
    
    return NextResponse.json({ success: true, message: 'Server deleted successfully.' });

  } catch (error: any) {
    console.error('Delete Server API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
