import { type NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// This is a server-side only file.

const firestore = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);
const secretManager = new SecretManagerServiceClient();
const projectId = process.env.GCLOUD_PROJECT;

async function getAuthenticatedUser(request: NextRequest) {
    const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!idToken) {
        throw new Error('Unauthorized');
    }
    return await adminAuth.verifyIdToken(idToken);
}

async function setSecret(secretName: string, payload: string): Promise<any> {
    if (!projectId) {
        throw new Error('Google Cloud Project ID is not configured.');
    }
    const parent = `projects/${projectId}`;
    
    // Check if secret exists
    try {
       await secretManager.getSecret({ name: `${parent}/secrets/${secretName}` });
    } catch (e: any) {
        if (e.code === 5) { // NOT_FOUND
             await secretManager.createSecret({
                parent,
                secretId: secretName,
                secret: {
                    replication: {
                        automatic: {},
                    },
                },
            });
        } else {
            throw e;
        }
    }
    
    const [version] = await secretManager.addSecretVersion({
        parent: `${parent}/secrets/${secretName}`,
        payload: {
            data: Buffer.from(payload, 'utf8'),
        },
    });

    return version;
}

async function deleteSecret(secretName: string): Promise<void> {
    if (!projectId) {
        throw new Error('Google Cloud Project ID is not configured.');
    }
    const parent = `projects/${projectId}`;
    await secretManager.deleteSecret({
      name: `${parent}/secrets/${secretName}`,
    });
}


export async function POST(request: NextRequest) {
  try {
    // We don't authenticate here, as testConnection needs to run before user logs in
    // Will authenticate inside each action if needed
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
    // Auth check needed for deletion
    // const user = await getAuthenticatedUser(request);
    
    const { serverId, ownerUid } = await request.json();
    
    if (!serverId) {
        return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
    }

    const serverRef = firestore.collection('servers').doc(serverId);
    const secretName = `ssh-password-${serverRef.id}`;

    const batch = firestore.batch();
    
    // Delete server document
    batch.delete(serverRef);
    
    // Find and delete associated managers
    const managersQuery = firestore.collection('users').where('assignedServerId', '==', serverId);
    const managersSnapshot = await managersQuery.get();
    for (const managerDoc of managersSnapshot.docs) {
        // Here you might want to just unassign them instead of deleting their auth account
        batch.update(managerDoc.ref, { assignedServerId: null });
    }

    // Find and delete associated vpnUsers
    const vpnUsersQuery = firestore.collection('vpnUsers').where('serverId', '==', serverId);
    const vpnUsersSnapshot = await vpnUsersQuery.get();
    vpnUsersSnapshot.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
    
    // Delete the secret
    await deleteSecret(secretName);

    return NextResponse.json({ success: true, message: 'Server deleted successfully.' });

  } catch (error: any)
  {
    console.error('Delete Server API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
