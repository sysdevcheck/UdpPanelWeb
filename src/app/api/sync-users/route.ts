
import { type NextRequest, NextResponse } from 'next/server';
import { syncVpnUsersWithVps as syncVpnUsersAction } from '@/app/actions';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getSdks } from '@/firebase';


export async function POST(request: NextRequest) {
    try {
        const { serverId, sshConfig } = await request.json();

        if (!serverId || !sshConfig) {
            return NextResponse.json({ error: 'Server ID and SSH Config are required.' }, { status: 400 });
        }
        
        const result = await syncVpnUsersAction(serverId, sshConfig);

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
