import { type NextRequest, NextResponse } from 'next/server';
import { readCredentials, readServers, readVpnUsers, backupsDir, ensureDir } from '@/lib/data';
import fs from 'fs/promises';
import path from 'path';
import { format } from 'date-fns';

// CREATES a new backup file on the server
export async function POST(request: NextRequest) {
    try {
        await ensureDir(backupsDir);

        const credentials = await readCredentials();
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
            managers: credentials.filter((u: any) => u.role === 'manager'),
            servers,
            vpnUsers: vpnUsersByServer,
            createdAt: new Date().toISOString(),
        };

        const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        const filename = `backup_${timestamp}.json`;
        const filePath = path.join(backupsDir, filename);

        await fs.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

        return NextResponse.json({ success: true, filename });

    } catch (error: any) {
        console.error('Create Backup API error:', error);
        return NextResponse.json({ error: 'Failed to create backup file.', details: error.message }, { status: 500 });
    }
}
