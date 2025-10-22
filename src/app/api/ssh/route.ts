
import { NextResponse } from 'next/server';
import type { Client, SFTPWrapper } from 'ssh2';

type LogEntry = { level: 'INFO' | 'SUCCESS' | 'ERROR'; message: string };

const remoteBasePath = '/etc/zivpn';
const remoteConfigPath = `${remoteBasePath}/config.json`;

const defaultConfig = {
  "listen": ":5667",
  "cert": `${remoteBasePath}/zivpn.crt`,
  "key": `${remoteBasePath}/zivpn.key`,
  "obfs": "zivpn",
  "auth": {
    "mode": "passwords",
    "config": []
  }
};

// ====================================================================
// Dynamic SSH2 Loader - This is the key to bypass Next.js build errors
// ====================================================================
let ssh2Client: typeof import('ssh2').Client;
const loadSsh2 = (): typeof import('ssh2').Client => {
    if (!ssh2Client) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        ssh2Client = require('ssh2').Client;
    }
    return ssh2Client;
};


async function getSshConnection(sshConfig: any): Promise<Client> {
    const Client = loadSsh2();
    const conn = new Client();
    return new Promise((resolve, reject) => {
        conn.on('ready', () => resolve(conn))
            .on('error', (err) => reject(err))
            .on('timeout', () => reject(new Error('Connection timed out')))
            .connect(sshConfig);
    });
}

async function execCommand(ssh: Client, command: string, timeout = 15000): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        
        const timer = setTimeout(() => {
            reject(new Error(`El comando ha superado el tiempo de espera de ${timeout / 1000}s. Posiblemente es un comando interactivo no soportado.`));
        }, timeout);

        ssh.exec(command, (err, stream) => {
            if (err) {
                clearTimeout(timer);
                return reject(err);
            }
            stream.on('close', (code: any, signal: any) => {
                clearTimeout(timer);
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

async function readFileSftp(sftp: SFTPWrapper, path: string): Promise<string> {
    return new Promise((resolve, reject) => {
        sftp.readFile(path, 'utf8', (err: any, data: string) => {
            if (err) {
                 if (err.code === 2) { // SFTP_STATUS_CODE.NO_SUCH_FILE
                    resolve(''); // Return empty string if file doesn't exist
                } else {
                    reject(err);
                }
            } else {
                resolve(data);
            }
        });
    });
}

async function writeFileSftp(sftp: SFTPWrapper, path: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const dirname = path.substring(0, path.lastIndexOf('/'));
        const ssh = sftp.getClient();
        execCommand(ssh, `mkdir -p ${dirname}`).then(() => {
            sftp.writeFile(path, data, 'utf8', (err: any) => {
                if (err) reject(err);
                else resolve();
            });
        }).catch(reject);
    });
}

export async function POST(request: Request) {
    const log: LogEntry[] = [];
    let ssh: Client | null = null;
    
    try {
        const body = await request.json();
        const { action, payload, sshConfig } = body;
        
        let finalSshConfig = { ...sshConfig };

        if (!finalSshConfig || !finalSshConfig.host || !finalSshConfig.username) {
            log.push({ level: 'ERROR', message: 'SSH host and username are required.' });
            return NextResponse.json({ success: false, error: 'SSH host and username are required.', log }, { status: 400 });
        }
        
        if (action === 'testConnection') {
            try {
                log.push({ level: 'INFO', message: `Attempting to connect to ${finalSshConfig.username}@${finalSshConfig.host}:${finalSshConfig.port || 22}...` });
                ssh = await getSshConnection(finalSshConfig);
                log.push({ level: 'SUCCESS', message: 'Connection established & authenticated.' });
                log.push({ level: 'SUCCESS', message: 'SSH Connection Verified!' });
                return NextResponse.json({ success: true, message: 'Connection successful', log });
            } catch (e: any) {
                let errorMessage = e.message;
                 if (e.code === 'ENOTFOUND' || e.message.includes('ENOTFOUND')) {
                    errorMessage = `Host not found. Could not resolve DNS for ${finalSshConfig.host}.`;
                } else if (e.message.includes('All configured authentication methods failed')) {
                    errorMessage = 'Authentication failed. Please check your username and password.';
                } else if (e.level === 'client-timeout' || e.message.includes('Timed out')) {
                    errorMessage = `Connection timed out. Check the host IP and port. Ensure the port is open and not blocked by a firewall.`;
                }
                log.push({ level: 'ERROR', message: errorMessage });
                return NextResponse.json({ success: false, error: errorMessage, log }, { status: 500 });
            }
        }

        ssh = await getSshConnection(finalSshConfig);
        
        switch (action) {
            case 'updateVpnConfig': {
                const { usernames } = payload;
                const sftp = await getSftp(ssh);
                const configStr = await readFileSftp(sftp, remoteConfigPath);
                let config;
                try {
                    config = configStr ? JSON.parse(configStr) : { ...defaultConfig };
                } catch {
                    config = { ...defaultConfig };
                }
                config.auth.config = usernames;
                await writeFileSftp(sftp, remoteConfigPath, JSON.stringify(config, null, 2));
                return NextResponse.json({ success: true, message: "Config updated on VPS" });
            }
            
            case 'restartService': {
                 const serviceCommand = finalSshConfig.serviceCommand || 'systemctl restart zivpn';
                 const { stdout, stderr } = await execCommand(ssh, `sudo ${serviceCommand}`);
                 if (stderr) {
                     return NextResponse.json({ success: false, error: stderr }, { status: 500 });
                 }
                 return NextResponse.json({ success: true, data: stdout });
            }
            
            case 'resetConfig': {
                const scriptCommand = 'wget -O zi.sh https://raw.githubusercontent.com/zahidbd2/udp-zivpn/main/zi.sh && sudo chmod +x zi.sh && sudo ./zi.sh';
                const { stderr: scriptErr } = await execCommand(ssh, scriptCommand, 60000); // Longer timeout for reset
                if (scriptErr) {
                    console.warn("Error during script execution:", scriptErr);
                    if (!scriptErr.includes("stty: not a tty")) {
                       return NextResponse.json({ success: false, error: `Script execution failed: ${scriptErr}` }, { status: 500 });
                    }
                }
                return NextResponse.json({ success: true, message: "Reset script executed. Re-syncing users is required." });
            }

            default:
                log.push({ level: 'ERROR', message: `Invalid action specified: '${action}'` });
                return NextResponse.json({ success: false, error: 'Invalid action', log }, { status: 400 });
        }

    } catch (error: any) {
        console.error('API SSH Route Error:', error);
        let errorMessage = error.message;

        const contentType = request.headers.get('content-type');
        let isJsonRequest = contentType && contentType.includes('application/json');

        if (!isJsonRequest) {
            // If it's not a JSON request, it might not be a SyntaxError we can recover from.
            // But we can check if the body is parseable as JSON.
             try {
                await request.json(); // try to parse
            } catch(e) {
                 if (e instanceof SyntaxError) {
                    errorMessage = 'Invalid JSON in request body.';
                    return NextResponse.json({ success: false, error: errorMessage, log }, { status: 400 });
                }
            }
        }
        
        if (error.code === 'ENOTFOUND' || error.message.includes('ENOTFOUND')) {
            errorMessage = `Host not found. Could not resolve DNS.`;
        } else if (error.message.includes('All configured authentication methods failed')) {
            errorMessage = 'Authentication failed. Please check your username and password.';
        } else if (error.level === 'client-timeout' || error.message.includes('Timed out')) {
            errorMessage = `Connection timed out. Check the host IP and port.`;
        }
        log.push({ level: 'ERROR', message: `An unexpected error occurred in the API route: ${errorMessage}` });
        
        return new Response(`<html><body><h1>Server Error</h1><p>${errorMessage}</p></body></html>`, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });

    } finally {
        if(ssh && ssh.readable) {
            ssh.end();
        }
    }
}
