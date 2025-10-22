
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { readVpnUsers } from '@/lib/data';

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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    try {
        const response = await fetch(`${baseUrl}/api/ssh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload, sshConfig }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            let errorBody;
             if (contentType && contentType.indexOf('application/json') !== -1) {
                try {
                    errorBody = await response.json();
                } catch (e) {
                     return {
                        success: false,
                        error: `La petición a la API falló con estado ${response.status}: ${response.statusText}`,
                    };
                }
            } else {
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
        
        const textResponse = await response.text();
        if (!textResponse) {
             if (action === 'testConnection') {
                return { success: response.status === 200 };
            }
            return { success: true };
        }

        return JSON.parse(textResponse);

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

export async function syncVpnUsersWithVps(serverId: string, sshConfig: any) {
    const allVpnUsers = await readVpnUsers();
    const usernames = allVpnUsers.filter(u => u.serverId === serverId).map(u => u.username);

    const saveResult = await saveConfigToVps(usernames, sshConfig);

    if (saveResult.success) {
        await restartVpnService(sshConfig);
    }
    
    revalidatePath('/');
    return saveResult;
}


// ====================================================================
// Authentication
// ====================================================================

export async function getSession() {
    const cookieStore = cookies();
    return cookieStore.get('session');
}

export function logout() {
  cookies().delete('session');
  redirect('/login');
}


// ====================================================================
// Owner Actions for Server Management
// ====================================================================

export async function testServerConnection(serverConfig: any): Promise<{ success: boolean }> {
  const result = await sshApiRequest('testConnection', {}, serverConfig);
  return { success: result?.success || false };
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
