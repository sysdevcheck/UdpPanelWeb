
import { type NextRequest, NextResponse } from 'next/server';
import { syncVpnUsersWithVps as syncVpnUsersAction } from '@/app/actions';
import fs from 'fs/promises';
import path from 'path';

const VPN_USERS_PATH = path.join(process.cwd(), 'data', 'vpn-users.json');

const readVpnUsers = async () => {
    try {
        const data = await fs.readFile(VPN_USERS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e: any) {
        if (e.code === 'ENOENT') return [];
        throw e;
    }
};

export async function POST(request: NextRequest) {
    try {
        const { serverId, sshConfig } = await request.json();

        if (!serverId || !sshConfig) {
            return NextResponse.json({ error: 'Server ID and SSH Config are required.' }, { status: 400 });
        }
        
        const allUsers = await readVpnUsers();
        const allUsersForServer = allUsers.filter((u: any) => u.serverId === serverId);
        
        const result = await syncVpnUsersAction(serverId, sshConfig, allUsersForServer);

        if (result.success) {
            return NextResponse.json({ success: true, message: `Los usuarios del servidor ${sshConfig.name} han sido sincronizados.` });
        } else {
            return NextResponse.json({ success: false, error: result.error || 'Unknown sync error' }, { status: 500 });
        }

    } catch (e: any) {
        console.error('API Sync Users Error:', e);
        return NextResponse.json({ success: false, error: `Failed to sync users: ${e.message}` }, { status: 500 });
    }
}
