
import { NextResponse } from 'next/server';
import SSH2Promise from 'ssh2-promise';

async function getSshConnection(sshConfig: any) {
    const ssh = new SSH2Promise(sshConfig);
    await ssh.connect();
    return ssh;
}

export async function POST(request: Request) {
    try {
        const { action, payload, sshConfig } = await request.json();

        if (!sshConfig || !sshConfig.host || !sshConfig.username || !sshConfig.password) {
            return NextResponse.json({ success: false, error: 'SSH credentials are required.' }, { status: 400 });
        }
        
        const ssh = await getSshConnection(sshConfig);
        const sftp = ssh.sftp();

        switch (action) {
            case 'readFile': {
                const { path } = payload;
                try {
                    const data = await sftp.readFile(path, 'utf8');
                    await ssh.close();
                    return NextResponse.json({ success: true, data });
                } catch (e: any) {
                    await ssh.close();
                    if (e.code === 2) { // SFTP_STATUS_CODE.NO_SUCH_FILE
                         return NextResponse.json({ success: true, data: '' }); // Return empty string if file doesn't exist
                    }
                    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
                }
            }
            
            case 'writeFile': {
                const { path, data } = payload;
                await sftp.writeFile(path, data, 'utf8');
                await ssh.close();
                return NextResponse.json({ success: true });
            }

            case 'ensureDir': {
                 const { path } = payload;
                 try {
                    await ssh.exec(`mkdir -p ${path}`);
                 } catch(e) {
                     // Ignore if dir already exists
                 }
                 await ssh.close();
                 return NextResponse.json({ success: true });
            }

            case 'restartService': {
                 const { stdout, stderr } = await ssh.exec('sudo /usr/bin/systemctl restart zivpn');
                 await ssh.close();
                 if (stderr) {
                     return NextResponse.json({ success: false, error: stderr }, { status: 500 });
                 }
                 return NextResponse.json({ success: true, data: stdout });
            }

            default:
                return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('API SSH Route Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
