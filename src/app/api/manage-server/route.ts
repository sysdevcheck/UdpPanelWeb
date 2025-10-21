
import { type NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const firestore = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
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
            name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
        });
        const payload = version.payload?.data?.toString();
        return payload || null;
    } catch (e: any) {
        if (e.code === 5) { // NOT_FOUND
            return null;
        }
        console.error(`Could not access secret: ${secretName}`, e);
        return null;
    }
}


async function deleteSecret(secretName: string): Promise<void> {
    if (!projectId) {
        throw new Error('Google Cloud Project ID is not configured.');
    }
    const parent = `projects/${projectId}`;
    try {
        await secretManager.deleteSecret({
            name: `${parent}/secrets/${secretName}`,
        });
    } catch (error: any) {
        if (error.code === 5) { // NOT_FOUND
            console.log(`Secret ${secretName} not found, skipping deletion.`);
        } else {
            throw error;
        }
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    try {
        if (serverId) {
            const serverDoc = await firestore.collection('servers').doc(serverId).get();
            if (!serverDoc.exists) {
                return NextResponse.json({ error: 'Server not found' }, { status: 404 });
            }
            return NextResponse.json({ id: serverDoc.id, ...serverDoc.data() });
        } else {
            const serversSnapshot = await firestore.collection('servers').get();
            if (serversSnapshot.empty) {
                return NextResponse.json([]);
            }
            const servers = serversSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return NextResponse.json(servers);
        }
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch servers.', details: error.message }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverId, ownerUid, name, host, port, username, password } = body;
    
    const serverRef = serverId ? firestore.collection('servers').doc(serverId) : firestore.collection('servers').doc();
    const secretName = `ssh-password-${serverRef.id}`;
    
    const serverData = {
        name,
        host,
        port,
        username,
        ownerUid,
    };

    if (serverId) { // Editing existing server
        await serverRef.update(serverData);
        if (password) {
             await setSecret(secretName, password);
        }
    } else { // Creating new server
        await serverRef.set(serverData);
        await setSecret(secretName, password);
    }
    
    return NextResponse.json({ success: true, message: `Servidor "${name}" guardado exitosamente.`, serverId: serverRef.id });

  } catch (error: any) {
    console.error('Manage Server API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const { serverId, ownerUid } = await request.json();
    
    if (!serverId) {
        return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
    }

    const serverRef = firestore.collection('servers').doc(serverId);
    const secretName = `ssh-password-${serverRef.id}`;

    const batch = firestore.batch();
    
    batch.delete(serverRef);
    
    const managersQuery = firestore.collection('users').where('assignedServerId', '==', serverId);
    const managersSnapshot = await managersQuery.get();
    for (const managerDoc of managersSnapshot.docs) {
        batch.update(managerDoc.ref, { assignedServerId: null });
    }

    const vpnUsersQuery = firestore.collection('vpnUsers').where('serverId', '==', serverId);
    const vpnUsersSnapshot = await vpnUsersQuery.get();
    vpnUsersSnapshot.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
    
    await deleteSecret(secretName);

    return NextResponse.json({ success: true, message: 'Server deleted successfully.' });

  } catch (error: any)
  {
    console.error('Delete Server API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
