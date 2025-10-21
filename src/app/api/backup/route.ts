import { type NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { getSdks } from '@/firebase';

const { firestore } = getSdks();

export async function GET(request: NextRequest) {
    try {
        const credentialsSnap = await getDocs(collection(firestore, 'credentials'));
        const serversSnap = await getDocs(collection(firestore, 'servers'));
        const vpnUsersSnap = await getDocs(collection(firestore, 'vpn-users'));

        const allCredentials = credentialsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const owner = allCredentials.find((u: any) => u.role === 'owner');
        const managers = allCredentials.filter((u: any) => u.role === 'manager');

        const servers = serversSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const vpnUsers = vpnUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
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
    const batch = writeBatch(firestore);

    try {
        const backup = await request.json();

        // Clear existing data
        const collections = ['servers', 'credentials', 'vpn-users'];
        for (const coll of collections) {
            const snap = await getDocs(collection(firestore, coll));
            snap.docs.forEach(doc => batch.delete(doc.ref));
        }

        // Restore servers
        if (backup.servers) {
            backup.servers.forEach((server: any) => {
                const { id, ...data } = server;
                batch.set(doc(collection(firestore, 'servers'), id), data);
            });
        }

        // Restore credentials
        if (backup.owner) {
             const { id, ...data } = backup.owner;
             batch.set(doc(collection(firestore, 'credentials'), id), data);
        }
        if (backup.managers) {
            backup.managers.forEach((manager: any) => {
                const { id, ...data } = manager;
                batch.set(doc(collection(firestore, 'credentials'), id), data);
            });
        }

        // Restore vpnUsers
        if (backup.vpnUsers) {
            for (const serverId in backup.vpnUsers) {
                backup.vpnUsers[serverId].forEach((user: any) => {
                    const { id, ...data } = user;
                    batch.set(doc(collection(firestore, 'vpn-users'), id), { ...data, serverId });
                });
            }
        }
        
        await batch.commit();
        
        return NextResponse.json({ success: true, message: 'Backup importado exitosamente.' });

    } catch (error: any) {
        console.error(`Backup POST error:`, error);
        return NextResponse.json({ error: 'Fallo al importar el backup.', details: error.message }, { status: 500 });
    }
}
