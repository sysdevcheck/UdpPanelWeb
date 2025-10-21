
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
    try {
        const allCredentials = await readData(MANAGERS_PATH);
        const owner = allCredentials.find((u: any) => u.role === 'owner');
        const managers = allCredentials.filter((u: any) => u.role === 'manager');
        const servers = await readData(SERVERS_PATH);
        const vpnUsers = await readData(VPN_USERS_PATH);

        const vpnUsersByServer: { [key: string]: any[] } = {};
        vpnUsers.forEach((user: any) => {
            if (!vpnUsersByServer[user.serverId]) {
                vpnUsersByServer[user.serverId] = [];
            }
            vpnUsersByServer[user.serverId].push(user);
        });

        const backupData = {
            owner,
            managers,
            servers,
            vpnUsers: vpnUsersByServer,
        };

        return NextResponse.json(backupData);

    } catch (error: any) {
        console.error('Backup GET error:', error);
        return NextResponse.json({ error: 'Failed to create backup.', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const backup = await request.json();

        // Restore servers
        if (backup.servers) {
            await writeData(SERVERS_PATH, backup.servers);
        } else {
            await writeData(SERVERS_PATH, []);
        }

        // Restore users (owner and managers)
        const allCredentials = [];
        if (backup.owner) {
            allCredentials.push({ ...backup.owner, role: 'owner' });
        }
        if (backup.managers) {
            allCredentials.push(...backup.managers.map((m: any) => ({...m, role: 'manager'})));
        }
        await writeData(MANAGERS_PATH, allCredentials);


        // Restore vpnUsers
        let allVpnUsers: any[] = [];
        if (backup.vpnUsers) {
            for (const serverId in backup.vpnUsers) {
                const users = backup.vpnUsers[serverId].map((user: any) => ({
                    ...user,
                    serverId,
                }));
                allVpnUsers = allVpnUsers.concat(users);
            }
        }
        await writeData(VPN_USERS_PATH, allVpnUsers);
        
        return NextResponse.json({ success: true, message: 'Backup importado exitosamente.' });

    } catch (error: any) {
        console.error(`Backup POST error:`, error);
        return NextResponse.json({ error: 'Fallo al importar el backup.', details: error.message }, { status: 500 });
    }
}
