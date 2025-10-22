
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

type LogEntry = { level: 'INFO' | 'SUCCESS' | 'ERROR'; message: string };

function executeSshClient(action: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(process.cwd(), 'src', 'lib', 'ssh-client.js');
        
        // Ensure Node.js executable can be found regardless of env
        const nodeExecutable = process.execPath;

        const child = spawn(nodeExecutable, [scriptPath]);
        
        let stdoutData = '';
        let stderrData = '';

        child.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        child.on('close', (code) => {
            if (stderrData) {
                 // Try to parse stderr as JSON for structured errors
                try {
                    const errorJson = JSON.parse(stderrData);
                    return reject(errorJson);
                } catch (e) {
                    // Otherwise, treat it as a plain text error
                    return reject({ error: stderrData.trim() });
                }
            }
            if (code !== 0) {
                return reject({ error: `El script SSH finalizó con el código ${code}` });
            }
            try {
                resolve(JSON.parse(stdoutData || '{}'));
            } catch (e) {
                reject({ error: 'La respuesta del script SSH no es un JSON válido.', details: stdoutData });
            }
        });
        
        child.on('error', (err) => {
            reject({ error: 'Fallo al iniciar el proceso del cliente SSH.', details: err.message });
        });

        // Send data to the child process
        child.stdin.write(JSON.stringify({ action, payload }));
        child.stdin.end();
    });
}


export async function POST(request: NextRequest) {
    const log: LogEntry[] = [];
    
    try {
        const body = await request.json();
        const { action, sshConfig, payload = {} } = body;
        
        if (!action || !sshConfig) {
            return NextResponse.json({ success: false, error: 'La acción y la configuración SSH son requeridas.' }, { status: 400 });
        }

        const internalPayload = {
            sshConfig,
            ...payload
        };

        const result = await executeSshClient(action, internalPayload);

        // For testConnection, the log is the primary output
        if (action === 'testConnection') {
            return NextResponse.json(result);
        }

        return NextResponse.json({ success: true, ...result });

    } catch (error: any) {
        console.error('API SSH Route Error:', error);
        
        const errorMessage = error.error || error.message || 'Ocurrió un error desconocido.';
        const errorDetails = error.details || '';
        log.push({ level: 'ERROR', message: `${errorMessage} ${errorDetails}`.trim() });
        
        return NextResponse.json({ success: false, error: errorMessage, log }, { status: 500 });
    }
}
