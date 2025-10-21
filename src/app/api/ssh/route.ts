
import { NextResponse } from 'next/server';
import { Client, SFTPWrapper } from 'ssh2';

type LogEntry = { level: 'INFO' | 'SUCCESS' | 'ERROR'; message: string };

async function getSshConnection(sshConfig: any): Promise<Client> {
    const conn = new Client();
    return new Promise((resolve, reject) => {
        conn.on('ready', () => resolve(conn))
            .on('error', (err) => reject(err))
            .on('timeout', () => reject(new Error('Connection timed out')))
            .connect(sshConfig);
    });
}

async function execCommand(ssh: Client, command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        ssh.exec(command, (err, stream) => {
            if (err) return reject(err);
            stream.on('close', () => {
                resolve({ stdout, stderr });
            }).on('data', (data: Buffer) => {
                stdout += data.toString();
            }).stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });
        });
    });
}

function getSftp(ssh: Client): Promise<SFTPWrapper> {
    return new Promise((resolve, reject) => {
        ssh.sftp((err, sftp) => {
            if (err) return reject(err);
            resolve(sftp);
        });
    });
}

export async function POST(request: Request) {
    const log: LogEntry[] = [];
    let ssh: Client | null = null;
    
    try {
        const { action, payload, sshConfig } = await request.json();

        if (!sshConfig || !sshConfig.host || !sshConfig.username || !sshConfig.password) {
            log.push({ level: 'ERROR', message: 'SSH credentials are required in the request.' });
            return NextResponse.json({ success: false, error: 'SSH credentials are required.', log }, { status: 400 });
        }
        
        if (action === 'testConnection') {
            try {
                log.push({ level: 'INFO', message: `Attempting to connect to ${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}...` });
                ssh = await getSshConnection(sshConfig);
                log.push({ level: 'SUCCESS', message: 'Connection established & authenticated.' });
                
                ssh.end();
                
                log.push({ level: 'SUCCESS', message: 'SSH Connection Verified!' });
                return NextResponse.json({ success: true, message: 'Connection successful', log });
            } catch (e: any) {
                let errorMessage = e.message;
                 if (e.code === 'ENOTFOUND' || e.message.includes('ENOTFOUND')) {
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

        ssh = await getSshConnection(sshConfig);
        const sftp = await getSftp(ssh);

        switch (action) {
            case 'readFile': {
                const { path } = payload;
                return new Promise((resolve) => {
                    sftp.readFile(path, 'utf8', (err: any, data: string) => {
                        if (err) {
                            if (err.code === 2) { // SFTP_STATUS_CODE.NO_SUCH_FILE
                                resolve(NextResponse.json({ success: true, data: '' }));
                            } else {
                                resolve(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
                            }
                        } else {
                            resolve(NextResponse.json({ success: true, data }));
                        }
                    });
                });
            }
            
            case 'writeFile': {
                const { path, data } = payload;
                 return new Promise((resolve) => {
                    sftp.writeFile(path, data, 'utf8', (err) => {
                         if (err) {
                            resolve(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
                        } else {
                            resolve(NextResponse.json({ success: true }));
                        }
                    });
                });
            }

            case 'ensureDir': {
                 const { path } = payload;
                 // sftp.mkdir doesn't have a recursive option, so we use `mkdir -p` via exec.
                 await execCommand(ssh, `mkdir -p ${path}`);
                 return NextResponse.json({ success: true });
            }

            case 'restartService': {
                 const { stdout, stderr } = await execCommand(ssh, 'sudo /usr/bin/systemctl restart zivpn');
                 if (stderr) {
                     return NextResponse.json({ success: false, error: stderr }, { status: 500 });
                 }
                 return NextResponse.json({ success: true, data: stdout });
            }

            default:
                log.push({ level: 'ERROR', message: `Invalid action specified: '${action}'` });
                return NextResponse.json({ success: false, error: 'Invalid action', log }, { status: 400 });
        }

    } catch (error: any) {
        console.error('API SSH Route Error:', error);
        let errorMessage = error.message;
        if (error.code === 'ENOTFOUND' || error.message.includes('ENOTFOUND')) {
            errorMessage = `Host not found. Could not resolve DNS.`;
        } else if (error.message.includes('All configured authentication methods failed')) {
            errorMessage = 'Authentication failed. Please check your username and password.';
        } else if (error.level === 'client-timeout' || error.message.includes('Timed out')) {
            errorMessage = `Connection timed out. Check the host IP and port.`;
        }
        log.push({ level: 'ERROR', message: `An unexpected error occurred in the API route: ${errorMessage}` });
        return NextResponse.json({ success: false, error: errorMessage, log }, { status: 500 });
    } finally {
        if(ssh && ssh.readable) {
            ssh.end();
        }
    }
}
