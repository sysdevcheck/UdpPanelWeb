import { type NextRequest, NextResponse } from 'next/server';
import { readCredentials, writeCredentials, readServers, writeServers, readVpnUsers, writeVpnUsers, backupsDir, ensureDir } from '@/lib/data';
import fs from 'fs/promises';
import path from 'path';

// LISTS available backup files
export async function GET(request: NextRequest) {
    try {
        await ensureDir(backupsDir);
        const files = await fs.readdir(backupsDir);
        const backupFiles = files
            .filter(file => file.endsWith('.json'))
            .sort((a, b) => {
                // Sort by date descending (newest first)
                return b.localeCompare(a);
            });
        return NextResponse.json(backupFiles);
    } catch (error: any) {
        console.error('Backup GET (list) error:', error);
        return NextResponse.json({ error: 'Failed to list backups.', details: error.message }, { status: 500 });
    }
}


// RESTORES a backup from a given filename
export async function POST(request: NextRequest) {
    try {
        const { filename } = await request.json();

        if (!filename) {
            return NextResponse.json({ error: 'Filename is required.' }, { status: 400 });
        }
        
        await ensureDir(backupsDir);
        const backupFilePath = path.join(backupsDir, filename);

        // Check if file exists
        try {
            await fs.access(backupFilePath);
        } catch {
            return NextResponse.json({ error: 'Backup file not found.' }, { status: 404 });
        }

        const backupJson = await fs.readFile(backupFilePath, 'utf-8');
        const backup = JSON.parse(backupJson);

        // Clear existing data
        await writeServers([]);
        await writeCredentials([]);
        await writeVpnUsers([]);

        // Restore servers
        if (backup.servers) {
            await writeServers(backup.servers);
        }

        // Restore credentials
        let credentialsToRestore = [];
        if (backup.managers) {
            credentialsToRestore.push(...backup.managers);
        }
        
        // Find owner from existing credentials if not in backup (for older backups)
        const oldCredentials = await readCredentials();
        const owner = oldCredentials.find(c => c.role === 'owner');
        if (owner) {
             credentialsToRestore.push(owner);
        }

        await writeCredentials(credentialsToRestore);

        // Restore vpnUsers
        let vpnUsersToRestore: any[] = [];
        if (backup.vpnUsers) {
             Object.values(backup.vpnUsers).flat().forEach((user: any) => {
                vpnUsersToRestore.push(user);
             });
        }
        await writeVpnUsers(vpnUsersToRestore);
        
        return NextResponse.json({ success: true, message: `Backup "${filename}" importado exitosamente.` });

    } catch (error: any) {
        console.error(`Backup POST (restore) error:`, error);
        return NextResponse.json({ error: 'Fallo al importar el backup.', details: error.message }, { status: 500 });
    }
}