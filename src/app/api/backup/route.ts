import { type NextRequest, NextResponse } from 'next/server';
import { readCredentials, readServers, readVpnUsers, writeCredentials, writeServers, writeVpnUsers } from '@/lib/data';

export async function GET(request: NextRequest) {
    try {
        const allCredentials = await readCredentials();
        const owner = allCredentials.find((u: any) => u.role === 'owner');
        const managers = allCredentials.filter((u: any) => u.role === 'manager');

        const servers = await readServers();
        const vpnUsers = await readVpnUsers();
        
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

        // Clear existing data by writing empty arrays
        await writeServers([]);
        await writeCredentials([]);
        await writeVpnUsers([]);

        // Restore servers
        if (backup.servers) {
            await writeServers(backup.servers);
        }

        // Restore credentials
        let credentialsToRestore = [];
        if (backup.owner) {
             credentialsToRestore.push(backup.owner);
        }
        if (backup.managers) {
            credentialsToRestore.push(...backup.managers);
        }
        await writeCredentials(credentialsToRestore);

        // Restore vpnUsers
        let vpnUsersToRestore: any[] = [];
        if (backup.vpnUsers) {
            for (const serverId in backup.vpnUsers) {
                backup.vpnUsers[serverId].forEach((user: any) => {
                    vpnUsersToRestore.push({ ...user, serverId });
                });
            }
        }
        await writeVpnUsers(vpnUsersToRestore);
        
        return NextResponse.json({ success: true, message: 'Backup importado exitosamente.' });

    } catch (error: any) {
        console.error(`Backup POST error:`, error);
        return NextResponse.json({ error: 'Fallo al importar el backup.', details: error.message }, { status: 500 });
    }
}
