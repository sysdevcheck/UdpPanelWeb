
// This is a pure Node.js script, intentionally kept as .js to avoid TypeScript compilation issues.
// It is executed as a separate process by the /api/ssh route.

const { Client } = require('ssh2');

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

// Helper functions that wrap ssh2 operations in Promises
async function getSshConnection(sshConfig) {
    const conn = new Client();
    return new Promise((resolve, reject) => {
        conn.on('ready', () => resolve(conn))
            .on('error', (err) => reject(err))
            .on('timeout', () => reject(new Error('Connection timed out')))
            .connect(sshConfig);
    });
}

async function execCommand(ssh, command, timeout = 15000) {
    return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            reject(new Error(`El comando ha superado el tiempo de espera de ${timeout / 1000}s.`));
        }, timeout);

        ssh.exec(command, (err, stream) => {
            if (err) {
                clearTimeout(timer);
                return reject(err);
            }
            stream.on('close', (code) => {
                clearTimeout(timer);
                if (code !== 0 && stderr) {
                    // Ignore "not a tty" error for sudo commands
                    if (!stderr.includes('not a tty')) {
                        return reject(new Error(stderr.trim()));
                    }
                }
                resolve({ stdout, stderr });
            }).on('data', (data) => {
                stdout += data.toString();
            }).stderr.on('data', (data) => {
                stderr += data.toString();
            });
        });
    });
}

function getSftp(ssh) {
    return new Promise((resolve, reject) => {
        ssh.sftp((err, sftp) => {
            if (err) return reject(err);
            resolve(sftp);
        });
    });
}

async function readFileSftp(sftp, path) {
    return new Promise((resolve, reject) => {
        sftp.readFile(path, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 2) resolve(''); // File doesn't exist
                else reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

async function writeFileSftp(sftp, path, data) {
    return new Promise(async (resolve, reject) => {
        const dirname = path.substring(0, path.lastIndexOf('/'));
        try {
            // sftp.mkdir doesn't have a -p equivalent, so we must use exec
            await execCommand(sftp.getClient(), `mkdir -p ${dirname}`);
            sftp.writeFile(path, data, 'utf8', (err) => {
                if (err) reject(err);
                else resolve();
            });
        } catch (err) {
            reject(err);
        }
    });
}

// Main execution logic
async function main(action, payload) {
    const { sshConfig } = payload;
    let ssh = null;

    try {
        if (action === 'testConnection') {
            const log = [];
            try {
                log.push({ level: 'INFO', message: `Attempting to connect to ${sshConfig.username}@${sshConfig.host}:${sshConfig.port || 22}...` });
                ssh = await getSshConnection(sshConfig);
                log.push({ level: 'SUCCESS', message: 'Connection established & authenticated.' });
                return { success: true, message: 'Connection successful', log };
            } catch (e) {
                let errorMessage = e.message;
                 if (e.code === 'ENOTFOUND') errorMessage = `Host not found: ${sshConfig.host}.`;
                 else if (e.message.includes('All configured authentication methods failed')) errorMessage = 'Authentication failed. Check username/password.';
                 else if (e.message.includes('Timed out')) errorMessage = `Connection timed out. Check IP, port, and firewall.`;
                log.push({ level: 'ERROR', message: errorMessage });
                return { success: false, error: errorMessage, log };
            }
        }
        
        ssh = await getSshConnection(sshConfig);

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
                config.auth.config = usernames.map(u => ({ "user": u, "pass": u }));
                await writeFileSftp(sftp, remoteConfigPath, JSON.stringify(config, null, 2));
                return { message: "Config updated on VPS" };
            }

            case 'restartService': {
                const serviceCommand = sshConfig.serviceCommand || 'systemctl restart zivpn';
                const { stdout, stderr } = await execCommand(ssh, `sudo ${serviceCommand}`);
                if (stderr && !stderr.includes('not a tty')) throw new Error(stderr);
                return { data: stdout };
            }
            
            case 'resetConfig': {
                const scriptCommand = 'wget -O zi.sh https://raw.githubusercontent.com/zahidbd2/udp-zivpn/main/zi.sh && sudo chmod +x zi.sh && sudo ./zi.sh';
                const { stderr } = await execCommand(ssh, scriptCommand, 60000);
                 if (stderr && !stderr.includes("stty: not a tty")) {
                    throw new Error(`Script execution failed: ${stderr}`);
                }
                return { message: "Reset script executed." };
            }
            
            default:
                throw new Error(`Invalid action specified: '${action}'`);
        }
    } finally {
        if (ssh && ssh.readable) {
            ssh.end();
        }
    }
}

// Read from stdin, execute, and write to stdout/stderr
let input = '';
process.stdin.on('data', chunk => {
    input += chunk;
});

process.stdin.on('end', () => {
    try {
        const { action, payload } = JSON.parse(input);
        main(action, payload)
            .then(result => {
                process.stdout.write(JSON.stringify(result || {}));
            })
            .catch(err => {
                // Write error as JSON to stderr
                process.stderr.write(JSON.stringify({ error: err.message || 'An unknown error occurred in the SSH client.' }));
                process.exit(1);
            });
    } catch (e) {
        process.stderr.write(JSON.stringify({ error: 'Invalid JSON input to ssh-client.js', details: e.message }));
        process.exit(1);
    }
});
