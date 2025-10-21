
import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const firestore = getFirestore(adminApp);
const auth = getAuth(adminApp);
const secretManager = new SecretManagerServiceClient();
const projectId = process.env.GCLOUD_PROJECT;

async function setSecret(secretName: string, payload: string): Promise<any> {
    if (!projectId) {
        throw new Error('Google Cloud Project ID is not configured.');
    }
    const parent = `projects/${projectId}`;
    try {
       await secretManager.getSecret({ name: `${parent}/secrets/${secretName}` });
    } catch (e: any) {
        if (e.code === 5) { // NOT_FOUND
             await secretManager.createSecret({
                parent,
                secretId: secretName,
                secret: { replication: { automatic: {} } },
            });
        } else { throw e; }
    }
    const [version] = await secretManager.addSecretVersion({
        parent: `${parent}/secrets/${secretName}`,
        payload: { data: Buffer.from(payload, 'utf8') },
    });
    return version;
}

async function getSecret(secretName: string): Promise<string | null> {
    try {
        const [version] = await secretManager.accessSecretVersion({
            name: `${secretName}/versions/latest`,
        });
        const payload = version.payload?.data?.toString();
        return payload || null;
    } catch (e) {
        return null;
    }
}


export async function GET(request: NextRequest) {
    try {
        const ownerDoc = await firestore.collection('users').doc('owner').get();
        const ownerData = ownerDoc.data();

        const serversSnapshot = await firestore.collection('servers').get();
        const servers = await Promise.all(serversSnapshot.docs.map(async (doc) => {
            const server = { id: doc.id, ...doc.data() };
            const secretName = `projects/${projectId}/secrets/ssh-password-${server.id}`;
            const password = await getSecret(secretName);
            return { ...server, password };
        }));

        const managersSnapshot = await firestore.collection('users').where('role', '==', 'manager').get();
        const managers = managersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const vpnUsersSnapshot = await firestore.collection('vpnUsers').get();
        const vpnUsersByServer: { [key: string]: any[] } = {};
        vpnUsersSnapshot.docs.forEach(doc => {
            const user = doc.data();
            if (!vpnUsersByServer[user.serverId]) {
                vpnUsersByServer[user.serverId] = [];
            }
            vpnUsersByServer[user.serverId].push(user);
        });

        const backupData = {
            owner: ownerData,
            servers,
            managers,
            vpnUsers: vpnUsersByServer,
        };

        return NextResponse.json(backupData);

    } catch (error: any) {
        console.error('Backup GET error:', error);
        return NextResponse.json({ error: 'Failed to create backup.', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const transactionId = new Date().getTime();
    console.log(`[${transactionId}] Starting backup import...`);

    try {
        const backup = await request.json();
        const batch = firestore.batch();
        
        // Clear existing data
        console.log(`[${transactionId}] Deleting existing data...`);
        const collections = ['servers', 'users', 'vpnUsers'];
        for (const col of collections) {
            const snapshot = await firestore.collection(col).limit(500).get();
            if (!snapshot.empty) {
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
            }
        }
        console.log(`[${transactionId}] Existing data marked for deletion.`);

        // Restore owner
        if (backup.owner) {
            console.log(`[${transactionId}] Restoring owner...`);
            let ownerRecord;
            try {
                ownerRecord = await auth.getUserByEmail(backup.owner.email);
            } catch (e: any) {
                if (e.code === 'auth/user-not-found') {
                    ownerRecord = await auth.createUser({ email: backup.owner.email, password: backup.owner.password || 'password123' });
                } else { throw e; }
            }
            await auth.setCustomUserClaims(ownerRecord.uid, { role: 'owner' });
            const ownerDocRef = firestore.collection('users').doc('owner');
            batch.set(ownerDocRef, { ...backup.owner, uid: ownerRecord.uid, role: 'owner' });
        }

        // Restore servers and secrets
        if (backup.servers) {
            console.log(`[${transactionId}] Restoring ${backup.servers.length} servers...`);
            for (const server of backup.servers) {
                const serverRef = firestore.collection('servers').doc(server.id);
                const { password, ...serverData } = server;
                batch.set(serverRef, serverData);
                if (password) {
                    const secretName = `ssh-password-${server.id}`;
                    await setSecret(secretName, password);
                }
            }
        }
        
        // Restore managers
        if (backup.managers) {
            console.log(`[${transactionId}] Restoring ${backup.managers.length} managers...`);
            for (const manager of backup.managers) {
                let managerRecord;
                try {
                    managerRecord = await auth.getUserByEmail(manager.email);
                } catch (e: any) {
                    if (e.code === 'auth/user-not-found') {
                        managerRecord = await auth.createUser({ email: manager.email, password: manager.password || 'password123', displayName: manager.username });
                    } else { throw e; }
                }
                 await auth.setCustomUserClaims(managerRecord.uid, { role: 'manager' });
                 const managerDocRef = firestore.collection('users').doc(); // New doc id
                 const managerData = {
                     ...manager,
                     uid: managerRecord.uid,
                     role: 'manager',
                     createdAt: manager.createdAt ? Timestamp.fromDate(new Date(manager.createdAt)) : Timestamp.now(),
                     expiresAt: manager.expiresAt ? Timestamp.fromDate(new Date(manager.expiresAt)) : null,
                 };
                 delete managerData.id; // don't need old doc id
                 delete managerData.password;
                 batch.set(managerDocRef, managerData);
            }
        }

        // Restore vpnUsers
        if (backup.vpnUsers) {
            console.log(`[${transactionId}] Restoring VPN users...`);
            for (const serverId in backup.vpnUsers) {
                for (const vpnUser of backup.vpnUsers[serverId]) {
                    const vpnUserRef = firestore.collection('vpnUsers').doc(); // new doc
                    const userData = {
                        ...vpnUser,
                        serverId,
                        createdAt: vpnUser.createdAt ? Timestamp.fromDate(new Date(vpnUser.createdAt)) : Timestamp.now(),
                        expiresAt: vpnUser.expiresAt ? Timestamp.fromDate(new Date(vpnUser.expiresAt)) : Timestamp.now(),
                    };
                    batch.set(vpnUserRef, userData);
                }
            }
        }

        console.log(`[${transactionId}] Committing batch write...`);
        await batch.commit();
        console.log(`[${transactionId}] Backup import successful.`);
        
        return NextResponse.json({ success: true, message: 'Backup importado exitosamente.' });

    } catch (error: any) {
        console.error(`[${transactionId}] Backup POST error:`, error);
        return NextResponse.json({ error: 'Fallo al importar el backup.', details: error.message }, { status: 500 });
    }
}
