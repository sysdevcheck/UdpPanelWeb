import { type NextRequest, NextResponse } from 'next/server';
import { collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getSdks } from '@/firebase';

const { firestore } = getSdks();
const serversCollection = collection(firestore, 'servers');

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    try {
        if (serverId) {
            const serverDoc = await getDoc(doc(firestore, 'servers', serverId));
            if (!serverDoc.exists()) {
                return NextResponse.json({ error: 'Server not found' }, { status: 404 });
            }
            return NextResponse.json({ id: serverDoc.id, ...serverDoc.data() });
        } else {
            const querySnapshot = await getDocs(serversCollection);
            const servers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return NextResponse.json(servers);
        }
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch servers.', details: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverId, name, host, port, username, password } = body;
    
    const serverData = { name, host, port, username, password };

    if (serverId) {
        const serverDocRef = doc(firestore, 'servers', serverId);
        // Do not update password if it's not provided
        const updateData: Partial<typeof serverData> = { name, host, port, username };
        if (password) {
            updateData.password = password;
        }
        await updateDoc(serverDocRef, updateData);
    } else {
        await addDoc(serversCollection, serverData);
    }
    
    return NextResponse.json({ success: true, message: `Servidor "${name}" guardado exitosamente.` });

  } catch (error: any) {
    console.error('Manage Server API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { serverId } = await request.json();
    
    if (!serverId) {
        return NextResponse.json({ error: 'Server ID is required.' }, { status: 400 });
    }
    
    const batch = writeBatch(firestore);

    // 1. Delete the server
    const serverDocRef = doc(firestore, 'servers', serverId);
    batch.delete(serverDocRef);

    // 2. Unassign managers
    const credentialsSnap = await getDocs(collection(firestore, 'credentials'));
    credentialsSnap.forEach(docSnap => {
        if (docSnap.data().assignedServerId === serverId) {
            batch.update(docSnap.ref, { assignedServerId: null });
        }
    });

    // 3. Delete associated VPN users
    const vpnUsersSnap = await getDocs(collection(firestore, 'vpn-users'));
    vpnUsersSnap.forEach(docSnap => {
        if (docSnap.data().serverId === serverId) {
            batch.delete(docSnap.ref);
        }
    });

    await batch.commit();
    
    return NextResponse.json({ success: true, message: 'Server deleted successfully.' });

  } catch (error: any) {
    console.error('Delete Server API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
