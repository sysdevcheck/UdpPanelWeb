
import { type NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';
import { syncVpnUsersWithVps as syncVpnUsersAction } from '@/app/actions';

const firestore = getFirestore(adminApp);

export async function POST(request: NextRequest) {
    try {
        const { serverId, sshConfig } = await request.json();

        if (!serverId || !sshConfig) {
            return NextResponse.json({ error: 'Server ID and SSH Config are required.' }, { status: 400 });
        }
        
        // Fetch ALL users for this server, not just the manager's
        const allUsersForServerQuery = firestore.collection('vpnUsers').where('serverId', '==', serverId);
        const allUsersSnapshot = await allUsersForServerQuery.get();
        const allVpnUsers = allUsersSnapshot.docs.map(d => d.data());

        const result = await syncVpnUsersAction(serverId, sshConfig, allVpnUsers);

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
