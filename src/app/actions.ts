
'use server';

import fs from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Client } from 'ssh2';

// ====================================================================
// Constants & Environment Configuration
// ====================================================================

const isProduction = process.env.NODE_ENV === 'production';
const localBasePath = path.join(process.cwd(), 'src', 'lib', 'local-dev');
const remoteBasePath = '/etc/zivpn';

const localManagersConfigPath = path.join(localBasePath, 'managers.json');
const remoteUsersMetadataPath = (host: string) => path.join(remoteBasePath, `users-metadata.${host}.json`);
const remoteConfigPath = path.join(remoteBasePath, 'config.json');

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

const defaultManagersFile = {
  owner: { username: 'admin', password: 'password', createdAt: new Date().toISOString() },
  servers: [],
  managers: [],
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

        // Check if the response is ok, otherwise try to parse the error body
        if (!response.ok) {
            let errorBody;
            try {
                errorBody = await response.json();
            } catch (e) {
                // If the body isn't JSON, use the status text.
                return {
                    success: false,
                    error: `La petición a la API falló con estado ${response.status}: ${response.statusText}`,
                    log: [{ level: 'ERROR', message: `La petición a la API falló con estado ${response.status}: ${response.statusText}` }]
                };
            }
            return {
                success: false,
                error: errorBody.error || 'Ocurrió un error desconocido en la API',
                log: errorBody.log || [{ level: 'ERROR', message: errorBody.error || 'Ocurrió un error desconocido en la API' }]
            };
        }

        const responseBody: SshApiResponse = await response.json();
        return responseBody;

    } catch (e: any) {
        console.error(`Fallo al conectar con el endpoint de la API SSH. ¿Está la app corriendo? URL: ${baseUrl}/api/ssh`, e);
        return {
            success: false,
            error: `No se pudo conectar al servicio SSH interno. Detalles: ${e.message}`,
            log: [{ level: 'ERROR', message: `No se pudo conectar al servicio SSH interno. ¿Está el panel corriendo correctamente? Detalles: ${e.message}` }]
        };
    }
}


// ====================================================================
// Core Service Functions (Low-level file IO)
// ====================================================================

async function restartVpnService(sshConfig: any | null): Promise<{ success: boolean; error?: string }> {
    if (!sshConfig) {
        return { success: false, error: "No se puede reiniciar el servicio sin una configuración SSH." };
    }

    const result = await sshApiRequest('restartService', {}, sshConfig);
    return { success: result.success, error: result.error };
}

async function ensureDirExists(sshConfig: any | null, remotePath: string) {
    if (!sshConfig) { // Local mode (dev)
        try {
            await fs.mkdir(path.dirname(remotePath), { recursive: true });
        } catch (e) {
            console.error("No se pudo crear el directorio local", path.dirname(remotePath), e);
        }
        return;
    }
    // Remote mode
    await sshApiRequest('ensureDir', { path: path.dirname(remotePath) }, sshConfig);
}

async function readFile(filePath: string, sshConfig: any | null): Promise<string> {
    if (!sshConfig) { // Local mode
        try {
            return await fs.readFile(filePath, 'utf8');
        } catch (e: any) {
            if (e.code === 'ENOENT') return '';
            throw e;
        }
    }
    // Remote mode
    const result = await sshApiRequest('readFile', { path: filePath }, sshConfig);
    if (!result.success) throw new Error(result.error);
    return result.data;
}

async function writeFile(filePath: string, data: string, sshConfig: any | null): Promise<{ success: boolean, error?: string }> {
    if (!sshConfig) { // Local mode
        await ensureDirExists(null, filePath);
        await fs.writeFile(filePath, data, 'utf8');
        return { success: true };
    }
    // Remote mode
    await ensureDirExists(sshConfig, filePath);
    const result = await sshApiRequest('writeFile', { path: filePath, data }, sshConfig);
     if (!result.success) return { success: false, error: result.error };
    return { success: true };
}

// ====================================================================
// Data Access Layer (Reading/Writing JSON files)
// ====================================================================

async function getSshConfigForUser(managerUsername: string, serverId?: string): Promise<any | null> {
    const managersData = await readManagersFile();
    const isOwner = await isOwnerCheck(managerUsername);

    if (isOwner) {
        if (!serverId) return null; // Owner must specify a server
        return managersData.servers.find((s:any) => s.id === serverId) || null;
    }

    // It's a manager
    const manager = managersData.managers.find((m:any) => m.username === managerUsername);
    if (!manager || !manager.assignedServerId) {
        return null; // Manager not found or not assigned to a server
    }
    // For non-owner, serverId from form is ignored, we use the one from their profile
    const finalServerId = manager.assignedServerId;
    return managersData.servers.find((s:any) => s.id === finalServerId) || null;
}

async function readRawConfig(sshConfig: any): Promise<any> {
    const hostIdentifier = sshConfig ? sshConfig.host : 'local';
    const configPath = sshConfig ? remoteConfigPath : path.join(localBasePath, `config.${hostIdentifier}.json`);
    
    await ensureDirExists(sshConfig, configPath);
    const configData = await readFile(configPath, sshConfig);

    if (!configData || !configData.trim()) {
        return { ...defaultConfig };
    }
    try {
        return JSON.parse(configData);
    } catch (e) {
        console.error(`Fallo al parsear config.json para ${hostIdentifier}, devolviendo config por defecto. Contenido:`, configData);
        return { ...defaultConfig };
    }
}

async function readUsersMetadata(sshConfig: any): Promise<any[]> {
    const hostIdentifier = sshConfig ? sshConfig.host : 'local';
    const metadataPath = sshConfig ? remoteUsersMetadataPath(hostIdentifier) : path.join(localBasePath, `users-metadata.${hostIdentifier}.json`);

    await ensureDirExists(sshConfig, metadataPath);
    const metadataStr = await readFile(metadataPath, sshConfig);
    
    if (!metadataStr.trim()) {
        await saveUsersMetadata([], sshConfig); // Create the file if it doesn't exist
        return [];
    }
    try {
        return JSON.parse(metadataStr);
    } catch (e) {
        console.error(`Error al parsear metadata de usuarios para ${hostIdentifier}:`, e);
        return [];
    }
}

async function saveConfig(usernames: string[], sshConfig: any): Promise<{ success: boolean; error?: string }> {
    const hostIdentifier = sshConfig ? sshConfig.host : 'local';
    const configPath = sshConfig ? remoteConfigPath : path.join(localBasePath, `config.${hostIdentifier}.json`);

    const configData = await readRawConfig(sshConfig);
    configData.auth.config = usernames;
    return writeFile(configPath, JSON.stringify(configData, null, 2), sshConfig);
}

async function saveUsersMetadata(metadata: any[], sshConfig: any): Promise<{ success: boolean; error?: string }> {
    const hostIdentifier = sshConfig ? sshConfig.host : 'local';
    const metadataPath = sshConfig ? remoteUsersMetadataPath(hostIdentifier) : path.join(localBasePath, `users-metadata.${hostIdentifier}.json`);
    
    return writeFile(metadataPath, JSON.stringify(metadata, null, 2), sshConfig);
}


// ====================================================================
// VPN User Management
// ====================================================================

export async function readConfig(managerUsername: string, serverId?: string): Promise<any> {
  if (!managerUsername) {
    redirect('/login');
  }

  const isOwner = await isOwnerCheck(managerUsername);
  
  // For owners, if no serverId is provided, it's a request for the initial page state, not for user data.
  if (isOwner && !serverId) {
    return { auth: { config: [] } };
  }

  // Get the sshConfig. For managers, serverId is ignored. For owners, it's required.
  const sshConfig = await getSshConfigForUser(managerUsername, serverId);
  
  if (!sshConfig) {
      const errorMsg = isOwner 
          ? "Servidor no encontrado o no especificado." 
          : "No estás asignado a un servidor. Por favor, contacta al dueño.";
      console.log(`Manager ${managerUsername}: ${errorMsg}`);
      return { auth: { config: [] }, error: errorMsg };
  }

  let usersMetadata = await readUsersMetadata(sshConfig);
  const now = new Date();

  const validMetadata = usersMetadata.filter((user: any) => user.expiresAt && new Date(user.expiresAt) > now);

  if (validMetadata.length < usersMetadata.length) {
    console.log(`Eliminando ${usersMetadata.length - validMetadata.length} usuarios vencidos del servidor ${sshConfig.host}.`);
    const activeUsernames = validMetadata.map((user: any) => user.username);
    
    await saveUsersMetadata(validMetadata, sshConfig);
    const saveResult = await saveConfig(activeUsernames, sshConfig);
    if (isProduction && saveResult.success) {
        await restartVpnService(sshConfig);
    }
    usersMetadata = validMetadata;
  }

  // Filter users for the specific manager, unless it's the owner, who sees all users on the selected server.
  const usersForResponse = isOwner
    ? usersMetadata
    : usersMetadata.filter((user: any) => user.createdBy === managerUsername);
  
  return { auth: { config: usersForResponse } };
}


export async function addUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[]; error?: string; message?: string; }> {
    const managerUsername = formData.get('managerUsername') as string;
    const serverId = formData.get('serverId') as string | undefined; // For owner
    if (!managerUsername) {
        return { success: false, error: "Autenticación requerida. Por favor, inicia sesión de nuevo." };
    }
    const sshConfig = await getSshConfigForUser(managerUsername, serverId);
    if (!sshConfig) {
      return { success: false, error: "No estás asignado a un servidor o el servidor está mal configurado." };
    }

    const username = formData.get('username') as string;
    if (!username) {
        return { success: false, error: "El nombre de usuario no puede estar vacío." };
    }

    let usersMetadata = await readUsersMetadata(sshConfig);
    if (usersMetadata.some((user: any) => user.username === username)) {
        return { success: false, error: "El usuario ya existe." };
    }
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    usersMetadata.push({
        username,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        createdBy: managerUsername,
    });
    
    const metadataResult = await saveUsersMetadata(usersMetadata, sshConfig);
    if (!metadataResult.success) {
        return { success: false, error: metadataResult.error };
    }

    const activeUsernames = usersMetadata.map(u => u.username);
    const configResult = await saveConfig(activeUsernames, sshConfig);
    if (!configResult.success) {
        return { success: false, error: configResult.error };
    }
    
    if (isProduction) {
        const restartResult = await restartVpnService(sshConfig);
        if(!restartResult.success) {
            return { success: false, error: restartResult.error };
        }
    }

    const isOwner = await isOwnerCheck(managerUsername);
    const managerUsers = isOwner ? usersMetadata : usersMetadata.filter((u: any) => u.createdBy === managerUsername);
    revalidatePath('/');
    return { success: true, users: managerUsers, message: `Usuario "${username}" ha sido añadido.` };
}

export async function deleteUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[], error?: string }> {
    const managerUsername = formData.get('managerUsername') as string;
    const serverId = formData.get('serverId') as string | undefined;
    if (!managerUsername) {
        return { success: false, error: "Autenticación requerida." };
    }
    const sshConfig = await getSshConfigForUser(managerUsername, serverId);
    if (!sshConfig) {
      return { success: false, error: "No se puede realizar la acción: no asignado a un servidor." };
    }

    const username = formData.get('username') as string;

    let usersMetadata = await readUsersMetadata(sshConfig);
    const userToDelete = usersMetadata.find((user: any) => user.username === username);
    const isOwner = await isOwnerCheck(managerUsername);

    if (!userToDelete) {
        return { success: false, error: "Usuario no encontrado." };
    }
    if (!isOwner && userToDelete.createdBy !== managerUsername) {
        return { success: false, error: "Permiso denegado." };
    }
    
    const updatedMetadata = usersMetadata.filter((user: any) => user.username !== username);
    const metadataResult = await saveUsersMetadata(updatedMetadata, sshConfig);
    if (!metadataResult.success) {
        return { success: false, error: metadataResult.error };
    }

    const activeUsernames = updatedMetadata.map(u => u.username);
    const configResult = await saveConfig(activeUsernames, sshConfig);
    if (!configResult.success) {
        return { success: false, error: configResult.error };
    }
    
    if (isProduction) {
        const restartResult = await restartVpnService(sshConfig);
        if(!restartResult.success) {
            return { success: false, error: restartResult.error };
        }
    }
    
    const managerUsers = isOwner ? updatedMetadata : updatedMetadata.filter((u: any) => u.createdBy === managerUsername);
    revalidatePath('/');
    return { success: true, users: managerUsers };
}

export async function editUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[], error?: string, message?: string }> {
    const managerUsername = formData.get('managerUsername') as string;
    const serverId = formData.get('serverId') as string | undefined;
    if (!managerUsername) {
        return { success: false, error: "Autenticación requerida." };
    }
    const sshConfig = await getSshConfigForUser(managerUsername, serverId);
    if (!sshConfig) {
      return { success: false, error: "No se puede realizar la acción: no asignado a un servidor." };
    }
    
    const oldUsername = formData.get('oldUsername') as string;
    const newUsername = formData.get('newUsername') as string;
    if (!oldUsername || !newUsername) {
        return { success: false, error: "Los nombres de usuario no pueden estar vacíos." };
    }

    let usersMetadata = await readUsersMetadata(sshConfig);
    const userIndex = usersMetadata.findIndex((user: any) => user.username === oldUsername);
    const isOwner = await isOwnerCheck(managerUsername);

    if (userIndex === -1) {
        return { success: false, error: `Usuario "${oldUsername}" no encontrado.` };
    }
    if (!isOwner && usersMetadata[userIndex].createdBy !== managerUsername) {
        return { success: false, error: "Permiso denegado." };
    }
    if (oldUsername !== newUsername && usersMetadata.some((user: any) => user.username === newUsername)) {
        return { success: false, error: `El usuario "${newUsername}" ya existe.` };
    }
    
    usersMetadata[userIndex].username = newUsername;

    const metadataResult = await saveUsersMetadata(usersMetadata, sshConfig);
    if (!metadataResult.success) {
        return { success: false, error: metadataResult.error };
    }

    const activeUsernames = usersMetadata.map(u => u.username);
    const configResult = await saveConfig(activeUsernames, sshConfig);
    if (!configResult.success) {
        return { success: false, error: configResult.error };
    }
    
    if (isProduction) {
        const restartResult = await restartVpnService(sshConfig);
        if(!restartResult.success) {
            return { success: false, error: restartResult.error };
        }
    }

    const managerUsers = isOwner ? usersMetadata : usersMetadata.filter((u: any) => u.createdBy === managerUsername);
    revalidatePath('/');
    return { success: true, users: managerUsers, message: `Usuario actualizado a "${newUsername}".` };
}

export async function renewUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const managerUsername = formData.get('managerUsername') as string;
    const serverId = formData.get('serverId') as string | undefined;
    if (!managerUsername) {
        return { success: false, error: "Autenticación requerida." };
    }
    const sshConfig = await getSshConfigForUser(managerUsername, serverId);
    if (!sshConfig) {
      return { success: false, error: "No se puede realizar la acción: no asignado a un servidor." };
    }
    
    const username = formData.get('username') as string;
    let usersMetadata = await readUsersMetadata(sshConfig);
    const userIndex = usersMetadata.findIndex((user: any) => user.username === username);
    const isOwner = await isOwnerCheck(managerUsername);

    if (userIndex === -1) {
        return { success: false, error: `Usuario "${username}" no encontrado.` };
    }
    if (!isOwner && usersMetadata[userIndex].createdBy !== managerUsername) {
        return { success: false, error: "Permiso denegado." };
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    usersMetadata[userIndex].expiresAt = newExpiresAt.toISOString();
    
    const metadataResult = await saveUsersMetadata(usersMetadata, sshConfig);
    if (!metadataResult.success) {
        return { success: false, error: metadataResult.error };
    }
    
    const managerUsers = isOwner ? usersMetadata : usersMetadata.filter((u: any) => u.createdBy === managerUsername);
    revalidatePath('/');
    return { success: true, users: managerUsers };
}

// ====================================================================
// Authentication & Manager/Server Management
// ====================================================================

async function readManagersFile(): Promise<any> {
    await ensureDirExists(null, localManagersConfigPath);
    const managersData = await readFile(localManagersConfigPath, null);
    if (!managersData.trim()) {
        console.log('No se encontró archivo de managers. Creando por defecto.');
        await saveManagersFile(defaultManagersFile);
        return defaultManagersFile;
    }
    
    try {
      const data = JSON.parse(managersData);
      // Ensure servers and managers are arrays if they don't exist
      if (!data.servers) data.servers = [];
      if (!data.managers) data.managers = [];
      return data;
    } catch(e) {
      console.error("Fallo al parsear managers.json, creando por defecto. Error:", e);
      await saveManagersFile(defaultManagersFile);
      return defaultManagersFile;
    }
}

async function saveManagersFile(data: any): Promise<{success: boolean, error?: string}> {
     return writeFile(localManagersConfigPath, JSON.stringify(data, null, 2), null);
}

export async function getLoggedInUser() {
  const cookieStore = cookies();
  return cookieStore.get('session')?.value;
}

export async function logout() {
  const cookieStore = cookies();
  cookieStore.delete('session');
  redirect('/login');
}

export async function login(prevState: any, formData: FormData): Promise<{ error?: string }> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Se requieren usuario y contraseña.' };
  }
  
  const managersData = await readManagersFile();
  const isOwner = managersData.owner.username === username && managersData.owner.password === password;
  const manager = managersData.managers.find((m: any) => m.username === username && m.password === password);
  
  if (isOwner || manager) {
    const cookieStore = cookies();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    cookieStore.set('session', username, { 
        httpOnly: true, 
        secure: isProduction,
        expires: Date.now() + thirtyDays,
        sameSite: 'lax',
        path: '/',
    });
    redirect('/');
  }

  return { error: 'Usuario o contraseña inválidos.' };
}

// ====================================================================
// Owner Actions for Manager & Server Management
// ====================================================================

async function isOwnerCheck(username: string): Promise<boolean> {
    const data = await readManagersFile();
    return data.owner.username === username;
}

export async function readFullConfig(): Promise<{ managersData?: any, error?: string }> {
    try {
      let data = await readManagersFile();

      // Expiry logic for managers
      const now = new Date();
      const validManagers = data.managers.filter((m: any) => !m.expiresAt || new Date(m.expiresAt) > now);

      if (validManagers.length < data.managers.length) {
          console.log(`Eliminando ${data.managers.length - validManagers.length} managers vencidos.`);
          data.managers = validManagers;
          await saveManagersFile(data);
      }
      return { managersData: data };
    } catch(e: any) {
      return { error: e.message }
    }
}

export async function addManager(prevState: any, formData: FormData): Promise<{ success: boolean; managersData?: any, error?: string, message?: string }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    const isOwner = await isOwnerCheck(ownerUsername);
    if(!isOwner) return { success: false, error: "Permiso denegado." };
    
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const assignedServerId = formData.get('assignedServerId') as string;

    if (!username || !password) return { success: false, error: "Se requieren usuario y contraseña." };
    if (!assignedServerId) return { success: false, error: "Se debe asignar un servidor al manager." };

    const data = await readManagersFile();
    if (data.managers.some((m:any) => m.username === username) || data.owner.username === username) {
        return { success: false, error: "El nombre de usuario del manager ya existe." };
    }
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    data.managers.push({ 
        username, 
        password,
        assignedServerId,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
    });
    const result = await saveManagersFile(data);
    
    if (result.success) {
      revalidatePath('/');
      return { success: true, managersData: data, message: `Manager "${username}" ha sido añadido.` };
    } else {
      return { success: false, error: result.error, managersData: data };
    }
}

export async function deleteManager(prevState: any, formData: FormData): Promise<{ success: boolean; managersData?: any, error?: string }> {
    const usernameToDelete = formData.get('username') as string;
    const ownerUsername = formData.get('ownerUsername') as string;
    const isOwner = await isOwnerCheck(ownerUsername);
    if(!isOwner) return { success: false, error: "Permiso denegado." };

    if (usernameToDelete === ownerUsername) {
        return { success: false, error: "La cuenta del dueño no se puede eliminar." };
    }
    
    let data = await readManagersFile();
    const initialCount = data.managers.length;
    data.managers = data.managers.filter((m:any) => m.username !== usernameToDelete);

    if (data.managers.length === initialCount) {
        return { success: false, error: "Manager no encontrado." };
    }

    const result = await saveManagersFile(data);
    revalidatePath('/');
    if (result.success) {
      return { success: true, managersData: data };
    } else {
      return { success: false, error: result.error, managersData: data };
    }
}

export async function editManager(prevState: any, formData: FormData): Promise<{ success: boolean; managersData?: any, error?: string; message?: string; }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    const isOwner = await isOwnerCheck(ownerUsername);
    if (!isOwner) return { success: false, error: "Permiso denegado." };

    const oldUsername = formData.get('oldUsername') as string;
    const newUsername = formData.get('newUsername') as string;
    const newPassword = formData.get('newPassword') as string;
    const assignedServerId = formData.get('assignedServerId') as string;

    if (!oldUsername) return { success: false, error: "Falta el nombre de usuario antiguo." };

    const data = await readManagersFile();
    const managerIndex = data.managers.findIndex((m:any) => m.username === oldUsername);

    if (managerIndex === -1) {
        const isOwnerAccount = oldUsername === data.owner.username;
        if (!isOwnerAccount) return { success: false, error: `Manager "${oldUsername}" no encontrado.` };
        
        // Editing owner account
        if(newPassword) data.owner.password = newPassword;

    } else {
        // Editing a regular manager
        if (newUsername) {
            if (newUsername !== oldUsername && (data.managers.some((m:any) => m.username === newUsername) || data.owner.username === newUsername)) {
                return { success: false, error: `El nombre de usuario "${newUsername}" ya existe.` };
            }
            data.managers[managerIndex].username = newUsername;
        }
        if (newPassword) data.managers[managerIndex].password = newPassword;
        if (assignedServerId) data.managers[managerIndex].assignedServerId = assignedServerId;
    }

    const result = await saveManagersFile(data);
    if (!result.success) return { success: false, error: result.error, managersData: data };
    
    revalidatePath('/');

    // If owner changed their own password, log them out
    if (oldUsername === ownerUsername && newPassword) {
        await logout();
    }
    
    return { success: true, managersData: data, message: `La cuenta de "${newUsername || oldUsername}" ha sido actualizada.` };
}


// --- Server Management Actions by Owner ---

export async function testServerConnection(serverConfig: any): Promise<{ success: boolean }> {
  const result = await sshApiRequest('testConnection', {}, serverConfig);
  return { success: result.success };
}

export async function saveServerConfig(prevState: any, formData: FormData): Promise<SshApiResponse> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!await isOwnerCheck(ownerUsername)) return { success: false, error: "Permiso denegado.", log: [] };

    const serverId = formData.get('serverId') as string | null; // Will be null for new servers
    const name = formData.get('name') as string;
    const host = formData.get('host') as string;
    const port = formData.get('port') as string;
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!name || !host || !username || !password) {
        return { success: false, error: "Nombre, host, usuario y contraseña son requeridos.", log: [] };
    }

    const newSshConfig = {
        name,
        host,
        port: port ? parseInt(port, 10) : 22,
        username,
        password
    };

    const testResult = await sshApiRequest('testConnection', {}, newSshConfig);
    if (!testResult.success) {
        return { success: false, error: testResult.error || 'Conexión fallida', log: testResult.log };
    }

    const data = await readManagersFile();

    if (serverId) { // Editing existing server
        const serverIndex = data.servers.findIndex((s:any) => s.id === serverId);
        if (serverIndex > -1) {
            data.servers[serverIndex] = { ...data.servers[serverIndex], ...newSshConfig };
        }
    } else { // Adding new server
        const newServer = { id: crypto.randomUUID(), ...newSshConfig };
        data.servers.push(newServer);
    }
    
    const result = await saveManagersFile(data);
    if(result.success) {
        revalidatePath('/');
        return { success: true, message: "¡Conexión Verificada y Guardada!", log: testResult.log };
    }

    const finalLog = testResult.log || [];
    finalLog.push({ level: 'ERROR', message: `Fallo al guardar el archivo de configuración: ${result.error}` });
    return { success: false, error: result.error || "Fallo al guardar la configuración del servidor.", log: finalLog };
}


export async function deleteServer(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!await isOwnerCheck(ownerUsername)) return { success: false, error: "Permiso denegado." };
    
    const serverId = formData.get('serverId') as string;
    if (!serverId) return { success: false, error: "Falta el ID del servidor." };

    const data = await readManagersFile();
    
    const initialServerCount = data.servers.length;
    data.servers = data.servers.filter((s: any) => s.id !== serverId);
    if(data.servers.length === initialServerCount) {
        return { success: false, error: "Servidor no encontrado." };
    }

    // Un-assign any managers that were assigned to this server
    data.managers = data.managers.map((m: any) => {
        if (m.assignedServerId === serverId) {
            return { ...m, assignedServerId: null };
        }
        return m;
    });

    const result = await saveManagersFile(data);
    if (result.success) {
        revalidatePath('/');
        return { success: true, message: "El servidor ha sido eliminado." };
    }

    return { success: false, error: result.error || "Fallo al eliminar el servidor." };
}

export async function resetServerConfig(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const username = formData.get('ownerUsername') as string; // Can be owner or manager
    const serverId = formData.get('serverId') as string;
    
    if (!username || !serverId) {
        return { success: false, error: "Falta información del usuario o del servidor." };
    }

    const sshConfig = await getSshConfigForUser(username, serverId);
    if (!sshConfig) {
        return { success: false, error: "No se pudo encontrar la configuración SSH para este servidor." };
    }
    
    const result = await sshApiRequest('resetConfig', { host: sshConfig.host }, sshConfig);

    if (result.success) {
        revalidatePath('/');
        return { success: true, message: `El servidor ${sshConfig.name} ha sido reseteado exitosamente.` };
    }

    return { success: false, error: result.error || "Ocurrió un error desconocido durante el reseteo del servidor." };
}

export async function restartService(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const username = formData.get('ownerUsername') as string; // Can be owner or manager
    const serverId = formData.get('serverId') as string;

    if (!username || !serverId) {
        return { success: false, error: "Falta información del usuario o del servidor." };
    }
    
    const sshConfig = await getSshConfigForUser(username, serverId);
    if (!sshConfig) {
        return { success: false, error: "No se pudo encontrar la configuración SSH para este servidor." };
    }

    const result = await restartVpnService(sshConfig);

    if (result.success) {
        return { success: true, message: `El servicio en ${sshConfig.name} ha sido reiniciado.` };
    }
    return { success: false, error: result.error || "Ocurrió un error desconocido durante el reinicio del servicio." };
}


export async function exportBackup(prevState: any, formData: FormData): Promise<{ success: boolean; data?: string; error?: string; }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!await isOwnerCheck(ownerUsername)) return { success: false, error: "Permiso denegado." };

    try {
        const managersData = await readManagersFile();
        const fullBackup: any = {
            ...managersData,
            vpnUsers: {}
        };

        for (const server of managersData.servers) {
            const sshConfig = await getSshConfigForUser(ownerUsername, server.id);
            if (sshConfig) {
                const usersMetadata = await readUsersMetadata(sshConfig);
                // Use server ID as key for uniqueness instead of host
                fullBackup.vpnUsers[server.id] = usersMetadata;
            }
        }
        
        return { success: true, data: JSON.stringify(fullBackup, null, 2) };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function importBackup(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string; }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!await isOwnerCheck(ownerUsername)) return { success: false, error: "Permiso denegado." };

    const backupFileContent = formData.get('backupFile') as string;
    if (!backupFileContent) {
        return { success: false, error: "No se proporcionó contenido de archivo de backup." };
    }

    try {
        const backupData = JSON.parse(backupFileContent);

        // Validate backup structure
        if (!backupData.owner || !backupData.servers || !backupData.managers || !backupData.vpnUsers) {
            throw new Error("Estructura de archivo de backup inválida.");
        }

        const { vpnUsers, ...managersData } = backupData;
        
        // Restore managers.json
        await saveManagersFile(managersData);

        // Restore VPN users for each server
        for (const server of managersData.servers) {
            const sshConfig = await getSshConfigForUser(ownerUsername, server.id);
            const usersForServer = vpnUsers[server.id];

            if (sshConfig && usersForServer) {
                // Save metadata
                await saveUsersMetadata(usersForServer, sshConfig);
                
                // Save main config and restart service
                const activeUsernames = usersForServer.map((u: any) => u.username);
                await saveConfig(activeUsernames, sshConfig);

                if (isProduction) {
                    await restartVpnService(sshConfig);
                }
            }
        }
        revalidatePath('/');
        return { success: true, message: "¡Backup restaurado exitosamente!" };

    } catch (e: any) {
        return { success: false, error: `Fallo al restaurar backup: ${e.message}` };
    }
}
