
import { NextResponse } from 'next/server';
import { Client, SFTPWrapper } from 'ssh2';
import fs from 'fs/promises';
import path from 'path';

type LogEntry = { level: 'INFO' | 'SUCCESS' | 'ERROR'; message: string };

const remoteBasePath = '/etc/zivpn';
const remoteConfigPath = `${remoteBasePath}/config.json`;
const SERVERS_PATH = path.join(process.cwd(), 'data', 'servers.json');

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
        // Ensure directory exists before writing
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

const readServers = async () => {
    try {
        const data = await fs.readFile(SERVERS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e: any) {
        if (e.code === 'ENOENT') return [];
        throw e;
    }
};

export async function POST(request: Request) {
    const log: LogEntry[] = [];
    let ssh: Client | null = null;
    
    try {
        const { action, payload, sshConfig } = await request.json();
        
        let finalSshConfig = { ...sshConfig };

        if (!finalSshConfig || !finalSshConfig.host || !finalSshConfig.username) {
            log.push({ level: 'ERROR', message: 'SSH host and username are required.' });
            return NextResponse.json({ success: false, error: 'SSH host and username are required.', log }, { status: 400 });
        }
        
        if (!finalSshConfig.password && finalSshConfig.id) {
            const servers = await readServers();
            const server = servers.find((s: any) => s.id === finalSshConfig.id);
            if (server && server.password) {
                finalSshConfig.password = server.password;
            } else {
                 log.push({ level: 'ERROR', message: 'SSH password not provided and not found in local data.' });
                 return NextResponse.json({ success: false, error: 'SSH password not available.', log }, { status: 400 });
            }
        } else if (!finalSshConfig.password) {
            if (action === 'testConnection') {
                log.push({ level: 'ERROR', message: 'SSH password is required for this operation.' });
                return NextResponse.json({ success: false, error: 'SSH password is required.', log }, { status: 400 });
            }
        }

        if (action === 'testConnection') {
            try {
                log.push({ level: 'INFO', message: `Attempting to connect to ${finalSshConfig.username}@${finalSshConfig.host}:${finalSshConfig.port || 22}...` });
                ssh = await getSshConnection(finalSshConfig);
                log.push({ level: 'SUCCESS', message: 'Connection established & authenticated.' });
                ssh.end();
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
        const sftp = await getSftp(ssh);

        switch (action) {
            case 'updateVpnConfig': {
                const { usernames } = payload;
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
                 const { stdout, stderr } = await execCommand(ssh, 'sudo /usr/bin/systemctl restart zivpn');
                 if (stderr) {
                     return NextResponse.json({ success: false, error: stderr }, { status: 500 });
                 }
                 return NextResponse.json({ success: true, data: stdout });
            }
            
            case 'resetConfig': {
                const scriptCommand = 'wget -O zi.sh https://raw.githubusercontent.com/zahidbd2/udp-zivpn/main/zi.sh && sudo chmod +x zi.sh && sudo ./zi.sh';
                const { stderr: scriptErr } = await execCommand(ssh, scriptCommand);
                if (scriptErr) {
                    console.warn("Error during script execution:", scriptErr);
                    return NextResponse.json({ success: false, error: `Script execution failed: ${scriptErr}` }, { status: 500 });
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
