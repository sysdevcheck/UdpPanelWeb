
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
                    error: `API request failed with status ${response.status}: ${response.statusText}`,
                    log: [{ level: 'ERROR', message: `API request failed with status ${response.status}: ${response.statusText}` }]
                };
            }
            return {
                success: false,
                error: errorBody.error || 'An unknown API error occurred',
                log: errorBody.log || [{ level: 'ERROR', message: errorBody.error || 'An unknown API error occurred' }]
            };
        }

        const responseBody: SshApiResponse = await response.json();
        return responseBody;

    } catch (e: any) {
        console.error(`Failed to fetch from SSH API endpoint. Is the app running? URL: ${baseUrl}/api/ssh`, e);
        return {
            success: false,
            error: `Could not connect to the internal SSH service. Details: ${e.message}`,
            log: [{ level: 'ERROR', message: `Could not connect to the internal SSH service. Is the panel running correctly? Details: ${e.message}` }]
        };
    }
}


// ====================================================================
// Core Service Functions (Low-level file IO)
// ====================================================================

async function restartVpnService(sshConfig: any | null): Promise<{ success: boolean; error?: string }> {
    if (!isProduction) {
        console.log("DEV-MODE: Simulated service restart.");
        return { success: true };
    }
    // In production, we assume local execution if no sshConfig is provided.
    // However, with the new model, only remote execution should restart services.
    if (!sshConfig) {
        return { success: false, error: "Cannot restart service without SSH config in production." };
    }

    const result = await sshApiRequest('restartService', {}, sshConfig);
    return { success: result.success, error: result.error };
}

async function ensureDirExists(sshConfig: any | null, remotePath: string) {
    if (!sshConfig) { // Local mode (dev)
        try {
            await fs.mkdir(path.dirname(remotePath), { recursive: true });
        } catch (e) {
            console.error("Could not create local directory", path.dirname(remotePath), e);
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

async function getSshConfig(managerUsername: string, serverId?: string): Promise<any | null> {
    const managersData = await readManagersFile();
    const isOwner = await isOwnerCheck(managerUsername);

    if (isOwner) {
        if (!serverId) return null; // Owner must specify a server
        return managersData.servers.find(s => s.id === serverId) || null;
    }

    // It's a manager
    const manager = managersData.managers.find(m => m.username === managerUsername);
    if (!manager || !manager.assignedServerId) {
        return null; // Manager not found or not assigned to a server
    }

    return managersData.servers.find(s => s.id === manager.assignedServerId) || null;
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
        console.error(`Failed to parse config.json for ${hostIdentifier}, returning default. Content:`, configData);
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
        console.error(`Error parsing user metadata for ${hostIdentifier}:`, e);
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
  const sshConfig = await getSshConfig(managerUsername, serverId);
  
  if (!sshConfig) {
      const errorMsg = isOwner 
          ? "Server not found or specified." 
          : "You are not assigned to a server. Please contact the owner.";
      console.log(`Manager ${managerUsername}: ${errorMsg}`);
      return { auth: { config: [] }, error: errorMsg };
  }

  let usersMetadata = await readUsersMetadata(sshConfig);
  const now = new Date();

  const validMetadata = usersMetadata.filter((user: any) => user.expiresAt && new Date(user.expiresAt) > now);

  if (validMetadata.length < usersMetadata.length) {
    console.log(`Removing ${usersMetadata.length - validMetadata.length} expired users from server ${sshConfig.host}.`);
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
        return { success: false, error: "Authentication required. Please log in again." };
    }
    const sshConfig = await getSshConfig(managerUsername, serverId);
    if (!sshConfig) {
      return { success: false, error: "You are not assigned to a server or the server is misconfigured." };
    }

    const username = formData.get('username') as string;
    if (!username) {
        return { success: false, error: "Username cannot be empty." };
    }

    let usersMetadata = await readUsersMetadata(sshConfig);
    if (usersMetadata.some((user: any) => user.username === username)) {
        return { success: false, error: "User already exists." };
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
    return { success: true, users: managerUsers, message: `User "${username}" has been added.` };
}

export async function deleteUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[], error?: string }> {
    const managerUsername = formData.get('managerUsername') as string;
    const serverId = formData.get('serverId') as string | undefined;
    if (!managerUsername) {
        return { success: false, error: "Authentication required." };
    }
    const sshConfig = await getSshConfig(managerUsername, serverId);
    if (!sshConfig) {
      return { success: false, error: "Cannot perform action: not assigned to a server." };
    }

    const username = formData.get('username') as string;

    let usersMetadata = await readUsersMetadata(sshConfig);
    const userToDelete = usersMetadata.find((user: any) => user.username === username);
    const isOwner = await isOwnerCheck(managerUsername);

    if (!userToDelete) {
        return { success: false, error: "User not found." };
    }
    if (!isOwner && userToDelete.createdBy !== managerUsername) {
        return { success: false, error: "Permission denied." };
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
        return { success: false, error: "Authentication required." };
    }
    const sshConfig = await getSshConfig(managerUsername, serverId);
    if (!sshConfig) {
      return { success: false, error: "Cannot perform action: not assigned to a server." };
    }
    
    const oldUsername = formData.get('oldUsername') as string;
    const newUsername = formData.get('newUsername') as string;
    if (!oldUsername || !newUsername) {
        return { success: false, error: "Usernames cannot be empty." };
    }

    let usersMetadata = await readUsersMetadata(sshConfig);
    const userIndex = usersMetadata.findIndex((user: any) => user.username === oldUsername);
    const isOwner = await isOwnerCheck(managerUsername);

    if (userIndex === -1) {
        return { success: false, error: `User "${oldUsername}" not found.` };
    }
    if (!isOwner && usersMetadata[userIndex].createdBy !== managerUsername) {
        return { success: false, error: "Permission denied." };
    }
    if (oldUsername !== newUsername && usersMetadata.some((user: any) => user.username === newUsername)) {
        return { success: false, error: `User "${newUsername}" already exists.` };
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
    return { success: true, users: managerUsers, message: `User updated to "${newUsername}".` };
}

export async function renewUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const managerUsername = formData.get('managerUsername') as string;
    const serverId = formData.get('serverId') as string | undefined;
    if (!managerUsername) {
        return { success: false, error: "Authentication required." };
    }
    const sshConfig = await getSshConfig(managerUsername, serverId);
    if (!sshConfig) {
      return { success: false, error: "Cannot perform action: not assigned to a server." };
    }
    
    const username = formData.get('username') as string;
    let usersMetadata = await readUsersMetadata(sshConfig);
    const userIndex = usersMetadata.findIndex((user: any) => user.username === username);
    const isOwner = await isOwnerCheck(managerUsername);

    if (userIndex === -1) {
        return { success: false, error: `User "${username}" not found.` };
    }
    if (!isOwner && usersMetadata[userIndex].createdBy !== managerUsername) {
        return { success: false, error: "Permission denied." };
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
        console.log('No managers file found. Creating default.');
        await saveManagersFile(defaultManagersFile);
        return defaultManagersFile;
    }
    
    try {
      const data = JSON.parse(managersData);
      return data;
    } catch(e) {
      console.error("Failed to parse managers.json, creating default. Error:", e);
      await saveManagersFile(defaultManagersFile);
      return defaultManagersFile;
    }
}

async function saveManagersFile(data: any): Promise<{success: boolean, error?: string}> {
     return writeFile(localManagersConfigPath, JSON.stringify(data, null, 2), null);
}

export async function getLoggedInUser() {
  const cookieStore = await cookies();
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
    return { error: 'Username and password are required.' };
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

  return { error: 'Invalid username or password.' };
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
          console.log(`Removing ${data.managers.length - validManagers.length} expired managers.`);
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
    if(!isOwner) return { success: false, error: "Permission denied." };
    
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const assignedServerId = formData.get('assignedServerId') as string;

    if (!username || !password) return { success: false, error: "Username and password are required." };
    if (!assignedServerId) return { success: false, error: "A server must be assigned to the manager." };

    const data = await readManagersFile();
    if (data.managers.some((m:any) => m.username === username) || data.owner.username === username) {
        return { success: false, error: "Manager username already exists." };
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
      return { success: true, managersData: data, message: `Manager "${username}" has been added.` };
    } else {
      return { success: false, error: result.error, managersData: data };
    }
}

export async function deleteManager(prevState: any, formData: FormData): Promise<{ success: boolean; managersData?: any, error?: string }> {
    const usernameToDelete = formData.get('username') as string;
    const ownerUsername = formData.get('ownerUsername') as string;
    const isOwner = await isOwnerCheck(ownerUsername);
    if(!isOwner) return { success: false, error: "Permission denied." };

    if (usernameToDelete === ownerUsername) {
        return { success: false, error: "The owner account cannot be deleted." };
    }
    
    let data = await readManagersFile();
    const initialCount = data.managers.length;
    data.managers = data.managers.filter((m:any) => m.username !== usernameToDelete);

    if (data.managers.length === initialCount) {
        return { success: false, error: "Manager not found." };
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
    if (!isOwner) return { success: false, error: "Permission denied." };

    const oldUsername = formData.get('oldUsername') as string;
    const newUsername = formData.get('newUsername') as string;
    const newPassword = formData.get('newPassword') as string;
    const assignedServerId = formData.get('assignedServerId') as string;

    if (!oldUsername) return { success: false, error: "Old username is missing." };

    const data = await readManagersFile();
    const managerIndex = data.managers.findIndex((m:any) => m.username === oldUsername);

    if (managerIndex === -1) {
        const isOwnerAccount = oldUsername === data.owner.username;
        if (!isOwnerAccount) return { success: false, error: `Manager "${oldUsername}" not found.` };
        
        // Editing owner account
        if(newPassword) data.owner.password = newPassword;

    } else {
        // Editing a regular manager
        if (newUsername) {
            if (newUsername !== oldUsername && (data.managers.some((m:any) => m.username === newUsername) || data.owner.username === newUsername)) {
                return { success: false, error: `Manager username "${newUsername}" already exists.` };
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
    
    return { success: true, managersData: data, message: `Account for "${newUsername || oldUsername}" has been updated.` };
}


// --- Server Management Actions by Owner ---

export async function testServerConnection(serverConfig: any): Promise<{ success: boolean }> {
  const result = await sshApiRequest('testConnection', {}, serverConfig);
  return { success: result.success };
}

export async function saveServerConfig(prevState: any, formData: FormData): Promise<SshApiResponse> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!await isOwnerCheck(ownerUsername)) return { success: false, error: "Permission denied.", log: [] };

    const serverId = formData.get('serverId') as string | null; // Will be null for new servers
    const name = formData.get('name') as string;
    const host = formData.get('host') as string;
    const port = formData.get('port') as string;
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!name || !host || !username || !password) {
        return { success: false, error: "Name, host, username, and password are required.", log: [] };
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
        return { success: false, error: testResult.error || 'Connection failed', log: testResult.log };
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
        return { success: true, message: "Server Connection Verified & Saved!", log: testResult.log };
    }

    const finalLog = testResult.log || [];
    finalLog.push({ level: 'ERROR', message: `Failed to save configuration file: ${result.error}` });
    return { success: false, error: result.error || "Failed to save server configuration.", log: finalLog };
}


export async function deleteServer(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!await isOwnerCheck(ownerUsername)) return { success: false, error: "Permission denied." };
    
    const serverId = formData.get('serverId') as string;
    if (!serverId) return { success: false, error: "Server ID is missing." };

    const data = await readManagersFile();
    
    const initialServerCount = data.servers.length;
    data.servers = data.servers.filter((s: any) => s.id !== serverId);
    if(data.servers.length === initialServerCount) {
        return { success: false, error: "Server not found." };
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
        return { success: true, message: "Server has been deleted." };
    }

    return { success: false, error: result.error || "Failed to delete server." };
}

export async function resetServerConfig(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; message?: string }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!await isOwnerCheck(ownerUsername)) return { success: false, error: "Permission denied." };
    
    const serverId = formData.get('serverId') as string;
    if (!serverId) return { success: false, error: "Server ID is missing." };

    const sshConfig = await getSshConfig(ownerUsername, serverId);
    if (!sshConfig) {
        return { success: false, error: "Could not find SSH configuration for this server." };
    }
    
    const result = await sshApiRequest('resetConfig', { host: sshConfig.host }, sshConfig);

    if (result.success) {
        revalidatePath('/');
        return { success: true, message: `Server ${sshConfig.name} has been reset successfully.` };
    }

    return { success: false, error: result.error || "An unknown error occurred during server reset." };
}
