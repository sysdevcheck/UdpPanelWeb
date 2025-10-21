'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Client } from 'ssh2';

// ====================================================================
// Constants & Environment Configuration
// ====================================================================

const isProduction = process.env.NODE_ENV === 'production';
const remoteBasePath = '/etc/zivpn';
const remoteConfigPath = '/etc/zivpn/config.json';
const defaultConfig = {
  "listen": ":5667",
  "cert": "/etc/zivpn/zivpn.crt",
  "key": "/etc/zivpn/zivpn.key",
  "obfs": "zivpn",
  "auth": {
    "mode": "passwords",
    "config": []
  }
};


// ====================================================================
// SSH API Wrapper Functions
// ====================================================================

type SshApiResponse = {
    success: boolean;
    error?: string;
    message?: string;
    log?: { level: 'INFO' | 'SUCCESS' | 'ERROR', message: string }[];
    data?: any;
}

async function sshApiRequest(action: string, payload: any, sshConfig: any): Promise<SshApiResponse> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
    
    try {
        const response = await fetch(`${baseUrl}/api/ssh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload, sshConfig }),
            cache: 'no-store',
        });

        if (!response.ok) {
            let errorBody;
            try {
                errorBody = await response.json();
            } catch (e) {
                return {
                    success: false,
                    error: `La petición a la API falló con estado ${response.status}: ${response.statusText}`,
                };
            }
            return {
                success: false,
                error: errorBody.error || 'Ocurrió un error desconocido en la API',
                log: errorBody.log,
            };
        }

        return await response.json();

    } catch (e: any) {
        console.error(`Fallo al conectar con el endpoint de la API SSH. URL: ${baseUrl}/api/ssh`, e);
        return {
            success: false,
            error: `No se pudo conectar al servicio SSH interno. Detalles: ${e.message}`,
        };
    }
}


// ====================================================================
// Core Service Functions (Low-level file IO via SSH)
// ====================================================================

async function restartVpnService(sshConfig: any): Promise<{ success: boolean; error?: string }> {
    if (!sshConfig) {
        return { success: false, error: "No se puede reiniciar el servicio sin una configuración SSH." };
    }
    const result = await sshApiRequest('restartService', {}, sshConfig);
    return { success: result.success, error: result.error };
}

async function saveConfigToVps(usernames: string[], sshConfig: any): Promise<{ success: boolean; error?: string }> {
    const payload = { usernames };
    const result = await sshApiRequest('updateVpnConfig', payload, sshConfig);
    return { success: result.success, error: result.error };
}

// This function will now be called after a successful Firestore write.
export async function syncVpnUsersWithVps(serverId: string, sshConfig: any, vpnUsers: any[]) {
    const usernames = vpnUsers.map(u => u.username);
    const saveResult = await saveConfigToVps(usernames, sshConfig);

    if (saveResult.success && isProduction) {
        await restartVpnService(sshConfig);
    }
    
    revalidatePath('/');
    return saveResult;
}


// ====================================================================
// Authentication (Kept simple for now)
// ====================================================================

export async function getLoggedInUser() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('session');
  if (!sessionCookie) return null;
  // In a real Firebase app, you'd verify this token.
  // For now, we'll just trust the username stored in it.
  try {
    const session = JSON.parse(sessionCookie.value);
    return session;
  } catch {
    return null;
  }
}

export async function logout() {
  cookies().delete('session');
  redirect('/login');
}


// ====================================================================
// Owner Actions for Server Management (Still hits local API, which then uses SSH)
// ====================================================================

export async function testServerConnection(serverConfig: any): Promise<{ success: boolean }> {
  const result = await sshApiRequest('testConnection', {}, serverConfig);
  return { success: result.success };
}

export async function resetServerConfig(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const serverId = formData.get('serverId') as string;
    const sshConfigPayload = formData.get('sshConfig') as string;

    if (!serverId || !sshConfigPayload) {
        return { success: false, error: "Falta información del servidor." };
    }
    
    const sshConfig = JSON.parse(sshConfigPayload);
    const result = await sshApiRequest('resetConfig', { host: sshConfig.host }, sshConfig);

    if (result && result.success) {
        revalidatePath('/');
        return { success: true, message: `El servidor ${sshConfig.name} ha sido reseteado exitosamente.` };
    }

    return { success: false, error: result?.error || "Ocurrió un error desconocido durante el reseteo del servidor." };
}

export async function restartService(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const serverId = formData.get('serverId') as string;
    const sshConfigPayload = formData.get('sshConfig') as string;

     if (!serverId || !sshConfigPayload) {
        return { success: false, error: "Falta información del servidor." };
    }

    const sshConfig = JSON.parse(sshConfigPayload);
    const result = await restartVpnService(sshConfig);

    if (result.success) {
        return { success: true, message: `El servicio en ${sshConfig.name} ha sido reiniciado.` };
    }
    return { success: false, error: result.error || "Ocurrió un error desconocido durante el reinicio del servicio." };
}
