import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest) {
    const { action, payload } = await request.json();
    
    // Path to the external Node.js script
    const scriptPath = path.join(process.cwd(), 'src', 'lib', 'ssh-client.js');

    const child = spawn('node', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_PATH: process.cwd() } // Ensure node can find modules
    });

    // Write data to the child process's stdin
    child.stdin.write(JSON.stringify({ action, payload }));
    child.stdin.end();

    let stdoutData = '';
    let stderrData = '';

    for await (const chunk of child.stdout) {
        stdoutData += chunk;
    }

    for await (const chunk of child.stderr) {
        stderrData += chunk;
    }

    const [exitCode, signal] = await new Promise((resolve) => {
        child.on('close', (code, signal) => resolve([code, signal]));
    });

    if (exitCode === 0) {
        try {
            // The script should output JSON on success
            const result = JSON.parse(stdoutData);
            return NextResponse.json(result);
        } catch (e) {
            // This might happen if the script outputs non-JSON text
            return NextResponse.json({ error: 'Invalid response from SSH client.', details: stdoutData }, { status: 500 });
        }
    } else {
         try {
            // The script should output a JSON error object on failure
            const errorResult = JSON.parse(stderrData);
            return NextResponse.json({ error: errorResult.error || 'Unknown SSH client error' }, { status: 500 });
        } catch (e) {
            // Fallback if stderr is not valid JSON
            return NextResponse.json({ error: 'SSH client failed.', details: stderrData || 'No error output.' }, { status: 500 });
        }
    }
}
