
import { NextResponse } from 'next/server';
import SSH2Promise from 'ssh2-promise';

type LogEntry = { level: 'INFO' | 'SUCCESS' | 'ERROR'; message: string };

async function getSshConnection(sshConfig: any) {
    const ssh = new SSH2Promise(sshConfig);
    await ssh.connect();
    return ssh;
}

export async function POST(request: Request) {
    const log: LogEntry[] = [];
    
    try {
        const { action, payload, sshConfig } = await request.json();

        if (!sshConfig || !sshConfig.host || !sshConfig.username || !sshConfig.password) {
            log.push({ level: 'ERROR', message: 'SSH credentials are required in the request.' });
            return NextResponse.json({ success: false, error: 'SSH credentials are required.', log }, { status: 400 });
        }
        
        if (action === 'testConnection') {
            try {
                log.push({ level: 'INFO', message: `Attempting to connect to ${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}...` });
                const ssh = await getSshConnection(sshConfig);
                log.push({ level: 'SUCCESS', message: 'Connection established.' });
                // connect() already implies authentication was successful
                log.push({ level: 'SUCCESS', message: 'Authentication successful.' });
                await ssh.close();
                log.push({ level: 'SUCCESS', message: 'SSH Connection Verified!' });
                return NextResponse.json({ success: true, message: 'Connection successful', log });
            } catch (e: any) {
                let errorMessage = e.message;
                if (e.code === 'ENOTFOUND') {
                    errorMessage = `Host not found. Could not resolve DNS for ${sshConfig.host}.`;
                } else if (e.message.includes('All configured authentication methods failed')) {
                    errorMessage = 'Authentication failed. Please check your username and password.';
                } else if (e.level === 'client-timeout' || e.message.includes('Timed out')) {
                    errorMessage = `Connection timed out. Check the host IP and port. Ensure the port is open and not blocked by a firewall.`;
                }
                log.push({ level: 'ERROR', message: errorMessage });
                return NextResponse.json({ success: false, error: errorMessage, log }, { status: 500 });
            }
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
                await ssh.close();
                log.push({ level: 'ERROR', message: `Invalid action specified: '${action}'` });
                return NextResponse.json({ success: false, error: 'Invalid action', log }, { status: 400 });
        }

    } catch (error: any) {
        console.error('API SSH Route Error:', error);
        log.push({ level: 'ERROR', message: `An unexpected error occurred in the API route: ${error.message}` });
        return NextResponse.json({ success: false, error: error.message, log }, { status: 500 });
    }
}
