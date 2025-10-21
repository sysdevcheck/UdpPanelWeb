
'use server';

import fs from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

// ====================================================================
// Constants & Environment Configuration
// ====================================================================

const isProduction = process.env.NODE_ENV === 'production';
const localBasePath = path.join(process.cwd(), 'src', 'lib', 'local-dev');
const remoteBasePath = '/etc/zivpn';

const localConfigPath = path.join(localBasePath, 'config.json');
const localManagersConfigPath = path.join(localBasePath, 'managers.json');
const localUsersMetadataPath = path.join(localBasePath, 'users-metadata.json');

const remoteConfigPath = path.join(remoteBasePath, 'config.json');
const remoteManagersConfigPath = path.join(remoteBasePath, 'managers.json');
const remoteUsersMetadataPath = path.join(remoteBasePath, 'users-metadata.json');

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

async function sshApiRequest(action: string, payload: any, sshConfig: any) {
    // This function will run on the Next.js server, not the browser.
    // We can get the base URL for the fetch request.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
    
    try {
        const response = await fetch(`${baseUrl}/api/ssh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload, sshConfig }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.error || `API request failed with status ${response.status}`);
        }

        return await response.json();
    } catch (e: any) {
        console.error(`Failed to fetch from SSH API endpoint. Is the app running? URL: ${baseUrl}/api/ssh`, e);
        throw new Error(`Could not connect to the internal SSH service. Details: ${e.message}`);
    }
}


// ====================================================================
// Core Service Functions
// ====================================================================

/**
 * Executes a shell command to restart the VPN service.
 */
async function restartVpnService(sshConfig: any): Promise<{ success: boolean; error?: string }> {
    if (!sshConfig) {
        console.log("DEV-MODE: Simulated service restart.");
        return { success: true };
    }
    return sshApiRequest('restartService', {}, sshConfig);
}

async function ensureDirExists(sshConfig: any) {
    if (!sshConfig) {
        try {
            await fs.mkdir(localBasePath, { recursive: true });
        } catch (e) {
            console.error("Could not create local directory", localBasePath, e);
        }
        return;
    }
    await sshApiRequest('ensureDir', { path: remoteBasePath }, sshConfig);
}

async function readFile(filePath: string, sshConfig: any): Promise<string> {
    if (!sshConfig) {
        try {
            return await fs.readFile(filePath, 'utf8');
        } catch (e: any) {
            if (e.code === 'ENOENT') return '';
            throw e;
        }
    }
    const result = await sshApiRequest('readFile', { path: filePath }, sshConfig);
    if (!result.success) throw new Error(result.error);
    return result.data;
}

async function writeFile(filePath: string, data: string, sshConfig: any): Promise<{ success: boolean, error?: string }> {
    if (!sshConfig) {
        await fs.writeFile(filePath, data, 'utf8');
        return { success: true };
    }
    const result = await sshApiRequest('writeFile', { path: filePath, data }, sshConfig);
     if (!result.success) return { success: false, error: result.error };
    return { success: true };
}


async function readRawConfig(sshConfig: any): Promise<any> {
    await ensureDirExists(sshConfig);
    const configData = await readFile(sshConfig ? remoteConfigPath : localConfigPath, sshConfig);
    return configData.trim() ? JSON.parse(configData) : { ...defaultConfig };
}

async function readUsersMetadata(sshConfig: any): Promise<any[]> {
    await ensureDirExists(sshConfig);
    const metadataStr = await readFile(sshConfig ? remoteUsersMetadataPath : localUsersMetadataPath, sshConfig);
    if (!metadataStr.trim()) {
        await saveUsersMetadata([], sshConfig);
        return [];
    }
    return JSON.parse(metadataStr);
}

async function saveConfig(usernames: string[], sshConfig: any): Promise<{ success: boolean; error?: string }> {
    await ensureDirExists(sshConfig);
    const configData = await readRawConfig(sshConfig);
    configData.auth.config = usernames;
    return writeFile(sshConfig ? remoteConfigPath : localConfigPath, JSON.stringify(configData, null, 2), sshConfig);
}

async function saveUsersMetadata(metadata: any[], sshConfig: any): Promise<{ success: boolean; error?: string }> {
    await ensureDirExists(sshConfig);
    return writeFile(sshConfig ? remoteUsersMetadataPath : localUsersMetadataPath, JSON.stringify(metadata, null, 2), sshConfig);
}


// ====================================================================
// VPN User Management
// ====================================================================

export async function readConfig(managerUsername: string): Promise<any> {
  if (!managerUsername) {
    redirect('/login');
  }

  const manager = await getManager(managerUsername);
  const owner = await getOwnerManager();
  const sshConfig = owner?.ssh;

  let usersMetadata = await readUsersMetadata(sshConfig);
  const now = new Date();

  const validMetadata = usersMetadata.filter((user: any) => user.expiresAt && new Date(user.expiresAt) > now);

  if (validMetadata.length < usersMetadata.length) {
    console.log(`Removing ${usersMetadata.length - validMetadata.length} expired users.`);
    const activeUsernames = validMetadata.map((user: any) => user.username);
    
    await saveUsersMetadata(validMetadata, sshConfig);
    const saveResult = await saveConfig(activeUsernames, sshConfig);
    if(saveResult.success) {
        await restartVpnService(sshConfig);
    }
    usersMetadata = validMetadata;
  }

  const managerUsers = usersMetadata.filter((user: any) => user.createdBy === managerUsername);
  
  return { auth: { config: managerUsers } };
}


export async function addUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[]; error?: string; message?: string; }> {
    const managerUsername = formData.get('managerUsername') as string;
    if (!managerUsername) {
        return { success: false, error: "Authentication required. Please log in again." };
    }
    const owner = await getOwnerManager();
    const sshConfig = owner?.ssh;

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
    
    const restartResult = await restartVpnService(sshConfig);
    if(!restartResult.success) {
        return { success: false, error: restartResult.error };
    }

    const managerUsers = usersMetadata.filter((u: any) => u.createdBy === managerUsername);
    revalidatePath('/');
    return { success: true, users: managerUsers, message: `User "${username}" has been added.` };
}

export async function deleteUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[], error?: string }> {
    const managerUsername = formData.get('managerUsername') as string;
    if (!managerUsername) {
        return { success: false, error: "Authentication required." };
    }
    const owner = await getOwnerManager();
    const sshConfig = owner?.ssh;

    const username = formData.get('username') as string;

    let usersMetadata = await readUsersMetadata(sshConfig);
    const userToDelete = usersMetadata.find((user: any) => user.username === username);

    if (!userToDelete) {
        return { success: false, error: "User not found." };
    }
    if (userToDelete.createdBy !== managerUsername) {
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
    
    const restartResult = await restartVpnService(sshConfig);
    if(!restartResult.success) {
        return { success: false, error: restartResult.error };
    }

    const managerUsers = updatedMetadata.filter((u: any) => u.createdBy === managerUsername);
    revalidatePath('/');
    return { success: true, users: managerUsers };
}

export async function editUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[], error?: string, message?: string }> {
    const managerUsername = formData.get('managerUsername') as string;
    if (!managerUsername) {
        return { success: false, error: "Authentication required." };
    }
    const owner = await getOwnerManager();
    const sshConfig = owner?.ssh;
    
    const oldUsername = formData.get('oldUsername') as string;
    const newUsername = formData.get('newUsername') as string;
    if (!oldUsername || !newUsername) {
        return { success: false, error: "Usernames cannot be empty." };
    }

    let usersMetadata = await readUsersMetadata(sshConfig);
    const userIndex = usersMetadata.findIndex((user: any) => user.username === oldUsername);

    if (userIndex === -1) {
        return { success: false, error: `User "${oldUsername}" not found.` };
    }
    if (usersMetadata[userIndex].createdBy !== managerUsername) {
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
    
    const restartResult = await restartVpnService(sshConfig);
    if(!restartResult.success) {
        return { success: false, error: restartResult.error };
    }

    const managerUsers = usersMetadata.filter((u: any) => u.createdBy === managerUsername);
    revalidatePath('/');
    return { success: true, users: managerUsers, message: `User updated to "${newUsername}".` };
}

export async function renewUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const managerUsername = formData.get('managerUsername') as string;
    if (!managerUsername) {
        return { success: false, error: "Authentication required." };
    }
    const owner = await getOwnerManager();
    const sshConfig = owner?.ssh;
    
    const username = formData.get('username') as string;

    let usersMetadata = await readUsersMetadata(sshConfig);
    const userIndex = usersMetadata.findIndex((user: any) => user.username === username);

    if (userIndex === -1) {
        return { success: false, error: `User "${username}" not found.` };
    }
    if (usersMetadata[userIndex].createdBy !== managerUsername) {
        return { success: false, error: "Permission denied." };
    }

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    usersMetadata[userIndex].expiresAt = newExpiresAt.toISOString();
    
    const metadataResult = await saveUsersMetadata(usersMetadata, sshConfig);
    if (!metadataResult.success) {
        return { success: false, error: metadataResult.error };
    }

    const managerUsers = usersMetadata.filter((u: any) => u.createdBy === managerUsername);
    revalidatePath('/');
    return { success: true, users: managerUsers };
}

// ====================================================================
// Authentication & Manager Management
// ====================================================================

async function readManagersFile(): Promise<any[]> {
    await ensureDirExists(null); // Ensure local-dev dir exists
    const managersData = await readFile(localManagersConfigPath, null); // Always reads local file system
    const managers = managersData.trim() ? JSON.parse(managersData) : [];
    
    if (managers.length === 0) {
        console.log('No managers found. Creating default admin user.');
        const defaultManager = { username: 'admin', password: 'password', createdAt: new Date().toISOString() };
        await saveManagersFile([defaultManager]);
        return [defaultManager];
    }
    
    return managers;
}

async function getManager(username: string): Promise<any | undefined> {
    const managers = await readManagersFile();
    return managers.find(m => m.username === username);
}

async function getOwnerManager(): Promise<any | undefined> {
    const managers = await readManagersFile();
    return managers.length > 0 ? managers[0] : undefined;
}


async function saveManagersFile(managers: any[]): Promise<{success: boolean, error?: string}> {
     return writeFile(localManagersConfigPath, JSON.stringify(managers, null, 2), null); // Always writes to local file system
}

export async function getLoggedInUser() {
  const cookieStore = cookies();
  return cookieStore.get('session')?.value;
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  redirect('/login');
}

export async function login(prevState: any, formData: FormData): Promise<{ error?: string }> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username and password are required.' };
  }
  
  const managers = await readManagersFile();
  const manager = managers.find((m) => m.username === username && m.password === password);
  
  if (manager) {
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
// Superadmin Actions for Manager Management
// ====================================================================

async function isOwner(username: string): Promise<boolean> {
    const managers = await readManagersFile();
    return managers.length > 0 && managers[0].username === username;
}

export async function readManagers(): Promise<{ managers?: any[], error?: string }> {
    try {
      let managers = await readManagersFile();
      // Expiry logic only applies to non-owner managers
      const now = new Date();
      if (managers.length > 1) {
          const owner = managers[0];
          const otherManagers = managers.slice(1);
          const validManagers = otherManagers.filter((m: any) => !m.expiresAt || new Date(m.expiresAt) > now);
          const updatedManagers = [owner, ...validManagers];

          if (updatedManagers.length < managers.length) {
              console.log(`Removing ${managers.length - updatedManagers.length} expired managers.`);
              await saveManagersFile(updatedManagers);
              managers = updatedManagers;
          }
      }
      return { managers };
    } catch(e: any) {
      return { error: e.message }
    }
}

export async function addManager(prevState: any, formData: FormData): Promise<{ success: boolean; managers?: any[], error?: string, message?: string }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!ownerUsername) {
        return { success: false, error: "Authentication required." };
    }
    const isOwnerCheck = await isOwner(ownerUsername);
    if(!isOwnerCheck) {
        return { success: false, error: "Permission denied. Only the owner can add managers." };
    }
    
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    if (!username || !password) {
        return { success: false, error: "Username and password are required." };
    }

    const managers = await readManagersFile();
    if (managers.some(m => m.username === username)) {
        return { success: false, error: "Manager username already exists." };
    }
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    managers.push({ 
        username, 
        password,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
    });
    const result = await saveManagersFile(managers);
    
    if (result.success) {
      revalidatePath('/');
      return { success: true, managers, message: `Manager "${username}" has been added.` };
    } else {
      return { success: false, error: result.error, managers };
    }
}

export async function deleteManager(prevState: any, formData: FormData): Promise<{ success: boolean; managers?: any[], error?: string }> {
    const usernameToDelete = formData.get('username') as string;
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!ownerUsername) {
        return { success: false, error: "Authentication required." };
    }

    const isOwnerCheck = await isOwner(ownerUsername);
    if(!isOwnerCheck) {
        return { success: false, error: "Permission denied. Only the owner can delete managers." };
    }

    if (usernameToDelete === ownerUsername) {
        return { success: false, error: "The owner account cannot be deleted." };
    }
    
    let managers = await readManagersFile();
    const updatedManagers = managers.filter(m => m.username !== usernameToDelete);

    if (updatedManagers.length === managers.length) {
        return { success: false, error: "Manager not found." };
    }

    const result = await saveManagersFile(updatedManagers);
    revalidatePath('/');
    if (result.success) {
      return { success: true, managers: updatedManagers };
    } else {
      return { success: false, error: result.error, managers };
    }
}


export async function editManager(prevState: any, formData: FormData): Promise<{ success: boolean; managers?: any[], error?: string; message?: string; }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!ownerUsername) {
        return { success: false, error: "Authentication required." };
    }

    const isOwnerCheck = await isOwner(ownerUsername);
    if (!isOwnerCheck) {
        return { success: false, error: "Permission denied. Only the owner can edit managers." };
    }

    const oldUsername = formData.get('oldUsername') as string;
    const newUsername = formData.get('newUsername') as string;
    const newPassword = formData.get('newPassword') as string;

    if (!oldUsername) {
        return { success: false, error: "Old username is missing." };
    }

    const managers = await readManagersFile();
    const managerIndex = managers.findIndex(m => m.username === oldUsername);

    if (managerIndex === -1) {
        return { success: false, error: `Manager "${oldUsername}" not found.` };
    }
    
    if (newUsername) {
        if (oldUsername === managers[0].username && oldUsername !== newUsername) {
            return { success: false, error: "The owner's username cannot be changed." };
        }
        if (newUsername !== oldUsername && managers.some(m => m.username === newUsername)) {
            return { success: false, error: `Manager username "${newUsername}" already exists.` };
        }
        managers[managerIndex].username = newUsername;
    }
    
    if (newPassword) { 
        managers[managerIndex].password = newPassword;
    }

    const result = await saveManagersFile(managers);
    if (!result.success) {
        return { success: false, error: result.error, managers };
    }
    
    revalidatePath('/');

    if (oldUsername === ownerUsername && newPassword) {
        await logout();
    }
    
    return { success: true, managers, message: `Manager "${newUsername || oldUsername}" has been updated.` };
}

export async function saveSshConfig(prevState: any, formData: FormData): Promise<{ success: boolean, error?: string, message?: string }> {
    const ownerUsername = formData.get('ownerUsername') as string;
    if (!ownerUsername) return { success: false, error: "Authentication required." };

    const isOwnerCheck = await isOwner(ownerUsername);
    if (!isOwnerCheck) return { success: false, error: "Permission denied." };
    
    const host = formData.get('host') as string;
    const port = formData.get('port') as string;
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!host || !username || !password) {
        return { success: false, error: "Host, username, and password are required." };
    }

    const newSshConfig = {
        host,
        port: port ? parseInt(port, 10) : 22,
        username,
        password
    };

    // Test the new configuration first
    try {
        const testResult = await sshApiRequest('testConnection', {}, newSshConfig);
        if (!testResult.success) {
            return { success: false, error: `Connection failed: ${testResult.error}` };
        }
    } catch(e: any) {
         return { success: false, error: `Connection failed: ${e.message}` };
    }


    const managers = await readManagersFile();
    const ownerIndex = managers.findIndex(m => m.username === ownerUsername);

    if (ownerIndex === -1) {
        return { success: false, error: "Owner account not found." };
    }

    managers[ownerIndex].ssh = newSshConfig;
    
    const result = await saveManagersFile(managers);
    if(result.success) {
        revalidatePath('/');
        return { success: true, message: "SSH Connection Successful!" };
    }

    return { success: false, error: result.error || "Failed to save SSH configuration." };
}

export async function clearSshConfig(ownerUsername: string): Promise<{ success: boolean; error?: string; message?: string }> {
    if (!ownerUsername) {
        return { success: false, error: "Authentication required." };
    }

    const isOwnerCheck = await isOwner(ownerUsername);
    if (!isOwnerCheck) {
        return { success: false, error: "Permission denied. Only the owner can clear the SSH configuration." };
    }
    
    const managers = await readManagersFile();
    const ownerIndex = managers.findIndex(m => m.username === ownerUsername);

    if (ownerIndex === -1) {
        return { success: false, error: "Owner account not found." };
    }

    // Delete the ssh property from the owner object
    if (managers[ownerIndex].ssh) {
        delete managers[ownerIndex].ssh;
    }

    const result = await saveManagersFile(managers);

    if (!result.success) {
        return { success: false, error: result.error };
    }
    
    revalidatePath('/');
    return { success: true, message: "SSH configuration has been cleared." };
}

    