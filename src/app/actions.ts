
'use server';

import fs from 'fs/promises';
import path from 'path';
import { exec as localExec } from 'child_process';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SSH2Promise from 'ssh2-promise';

// ====================================================================
// Constants & Environment Configuration
// ====================================================================

const isProduction = process.env.NODE_ENV === 'production';
const useRemoteSsh = isProduction; // Use SSH in production, local files in dev

const localBasePath = path.join(process.cwd(), 'src', 'lib', 'local-dev');
const remoteBasePath = '/etc/zivpn';

const configPath = path.join(useRemoteSsh ? remoteBasePath : localBasePath, 'config.json');
const managersConfigPath = path.join(useRemoteSsh ? remoteBasePath : localBasePath, 'managers.json');
const usersMetadataPath = path.join(useRemoteSsh ? remoteBasePath : localBasePath, 'users-metadata.json');

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
// SSH Connection Management
// ====================================================================

async function getSshConnection() {
    if (!useRemoteSsh) return null;

    const managers = await readManagersFile(true); // read locally to get credentials
    const owner = managers[0];

    if (!owner || !owner.sshConfig || !owner.sshConfig.host) {
        throw new Error("SSH configuration is not set for the owner manager.");
    }
    
    const ssh = new SSH2Promise({
        host: owner.sshConfig.host,
        username: owner.sshConfig.username,
        password: owner.sshConfig.password,
        port: owner.sshConfig.port || 22,
    });

    return ssh;
}


// ====================================================================
// Core Service Functions (Local and Remote)
// ====================================================================

async function readFile(filePath: string): Promise<string> {
    if (!useRemoteSsh) {
        await fs.mkdir(localBasePath, { recursive: true });
        try {
            return await fs.readFile(filePath, 'utf8');
        } catch (error: any) {
            if (error.code === 'ENOENT') return ''; // Return empty string if file doesn't exist
            throw error;
        }
    } else {
        const ssh = await getSshConnection();
        if (!ssh) throw new Error("SSH connection failed");
        const sftp = ssh.sftp();
        try {
            await ssh.connect();
            const remoteDir = path.dirname(filePath);
            try {
                // Ensure directory exists, suppress error if it does
                await ssh.exec(`mkdir -p ${remoteDir}`).catch(() => {});
            } catch (e) { /* ignore */ }

            const fileExists = await sftp.exists(filePath);
            if (!fileExists) return '';

            const data = await sftp.readFile(filePath, 'utf8');
            return data as string;
        } finally {
            ssh.close();
        }
    }
}

async function writeFile(filePath: string, data: string): Promise<void> {
    if (!useRemoteSsh) {
        await fs.mkdir(localBasePath, { recursive: true });
        await fs.writeFile(filePath, data, 'utf8');
    } else {
        const ssh = await getSshConnection();
        if (!ssh) throw new Error("SSH connection failed");
        const sftp = ssh.sftp();
        try {
            await ssh.connect();
             const remoteDir = path.dirname(filePath);
            try {
                // Ensure directory exists
                await ssh.exec(`mkdir -p ${remoteDir}`).catch(() => {});
            } catch (e) { /* ignore */ }

            await sftp.writeFile(filePath, data, 'utf8');
        } finally {
            ssh.close();
        }
    }
}


/**
 * Executes a shell command to restart the VPN service.
 */
async function restartVpnService(): Promise<{ success: boolean; error?: string }> {
  if (!useRemoteSsh) {
    console.log("DEV-MODE: Simulated systemctl restart zivpn");
    return { success: true };
  }
  
  const ssh = await getSshConnection();
  if (!ssh) return { success: false, error: "SSH Connection failed" };

  try {
      await ssh.connect();
      // The command must allow running without a tty, which is common for sudo configs.
      const result = await ssh.exec('/usr/bin/sudo /usr/bin/systemctl restart zivpn');
      if (typeof result === 'string' && (result.includes('failed') || result.includes('error'))) {
           return { success: false, error: `Failed to restart VPN service. Details: ${result}` };
      }
      return { success: true };
  } catch (error: any) {
       const errorMessage = `Error restarting zivpn service: ${error.message}`;
       console.error(errorMessage);
       return { success: false, error: `Failed to restart VPN service. Is 'sudo systemctl' configured correctly in sudoers? Details: ${error.message}` };
  } finally {
      ssh.close();
  }
}

/**
 * Reads the raw VPN user configuration.
 */
async function readRawConfig(): Promise<any> {
    try {
        const data = await readFile(configPath);
        return data.trim() ? JSON.parse(data) : { ...defaultConfig };
    } catch (error: any) {
        if (error.message.includes('No such file')) {
            await saveConfig([]); // Create with empty user list
            return { ...defaultConfig };
        }
        console.error(`CRITICAL: Error reading config file at ${configPath}:`, error);
        throw new Error(`Could not read config file: ${error.message}`);
    }
}

/**
 * Reads the users metadata file.
 */
async function readUsersMetadata(): Promise<any[]> {
    try {
        const data = await readFile(usersMetadataPath);
        if (!data.trim()) {
            await saveUsersMetadata([]);
            return [];
        }
        return JSON.parse(data);
    } catch (error: any) {
       if (error.message.includes('No such file')) {
            await saveUsersMetadata([]);
            return [];
        }
        console.error(`CRITICAL: Error reading users metadata file at ${usersMetadataPath}:`, error);
        throw new Error(`Could not read users metadata file: ${error.message}`);
    }
}


/**
 * Saves the provided list of usernames to the main zivpn config.json file.
 */
async function saveConfig(usernames: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const configData = await readRawConfig();
    configData.auth.config = usernames; 
    await writeFile(configPath, JSON.stringify(configData, null, 2));
    return { success: true };
  } catch (error: any) {
    console.error(`CRITICAL: Error writing config file at ${configPath}:`, error);
    return { success: false, error: `Failed to write config.json. Details: ${error.message}` };
  }
}


/**
 * Saves the provided users metadata to the users-metadata.json file.
 */
async function saveUsersMetadata(metadata: any[]): Promise<{ success: boolean; error?: string }> {
  try {
    await writeFile(usersMetadataPath, JSON.stringify(metadata, null, 2));
    return { success: true };
  } catch (error: any) {
    console.error(`CRITICAL: Error writing metadata file at ${usersMetadataPath}:`, error);
    return { success: false, error: `Failed to write users-metadata.json. Details: ${error.message}` };
  }
}


// ====================================================================
// VPN User Management
// ====================================================================

/**
 * Reads both config and metadata, combines them, filters out expired users, and returns users for the current manager.
 */
export async function readConfig(managerUsername: string): Promise<any> {
  if (!managerUsername) {
    redirect('/login');
  }

  let usersMetadata = await readUsersMetadata();
  const now = new Date();

  const validMetadata = usersMetadata.filter((user: any) => user.expiresAt && new Date(user.expiresAt) > now);

  if (validMetadata.length < usersMetadata.length) {
    console.log(`Removing ${usersMetadata.length - validMetadata.length} expired users.`);
    const activeUsernames = validMetadata.map((user: any) => user.username);
    
    await saveUsersMetadata(validMetadata);
    const saveResult = await saveConfig(activeUsernames);
    if(saveResult.success) {
        await restartVpnService();
    }
    usersMetadata = validMetadata;
  }

  // Filter users to show only those created by the logged-in manager
  const managerUsers = usersMetadata.filter((user: any) => user.createdBy === managerUsername);
  
  return { auth: { config: managerUsers } };
}


export async function addUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[]; error?: string; message?: string; }> {
    const username = formData.get('username') as string;
    const managerUsername = formData.get('managerUsername') as string;

    if (!managerUsername) {
        return { success: false, error: "Authentication required. Please log in again." };
    }
    if (!username) {
        return { success: false, error: "Username cannot be empty." };
    }

    let usersMetadata = await readUsersMetadata();
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
    
    const metadataResult = await saveUsersMetadata(usersMetadata);
    if (!metadataResult.success) {
        return { success: false, error: metadataResult.error };
    }

    const activeUsernames = usersMetadata.map(u => u.username);
    const configResult = await saveConfig(activeUsernames);
    if (!configResult.success) {
        return { success: false, error: configResult.error };
    }
    
    const restartResult = await restartVpnService();
    if(!restartResult.success) {
        return { success: false, error: restartResult.error };
    }

    const managerUsers = usersMetadata.filter((u: any) => u.createdBy === managerUsername);
    return { success: true, users: managerUsers, message: `User "${username}" has been added.` };
}

export async function deleteUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[], error?: string }> {
    const username = formData.get('username') as string;
    const managerUsername = formData.get('managerUsername') as string;
    
    if (!managerUsername) {
        return { success: false, error: "Authentication required." };
    }

    let usersMetadata = await readUsersMetadata();
    const userToDelete = usersMetadata.find((user: any) => user.username === username);

    if (!userToDelete) {
        return { success: false, error: "User not found." };
    }
    if (userToDelete.createdBy !== managerUsername) {
        return { success: false, error: "Permission denied." };
    }
    
    const updatedMetadata = usersMetadata.filter((user: any) => user.username !== username);
    const metadataResult = await saveUsersMetadata(updatedMetadata);
    if (!metadataResult.success) {
        return { success: false, error: metadataResult.error };
    }

    const activeUsernames = updatedMetadata.map(u => u.username);
    const configResult = await saveConfig(activeUsernames);
    if (!configResult.success) {
        return { success: false, error: configResult.error };
    }
    
    const restartResult = await restartVpnService();
    if(!restartResult.success) {
        return { success: false, error: restartResult.error };
    }

    const managerUsers = updatedMetadata.filter((u: any) => u.createdBy === managerUsername);
    return { success: true, users: managerUsers };
}

export async function editUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[], error?: string, message?: string }> {
    const oldUsername = formData.get('oldUsername') as string;
    const newUsername = formData.get('newUsername') as string;
    const managerUsername = formData.get('managerUsername') as string;

    if (!managerUsername) {
        return { success: false, error: "Authentication required." };
    }
    if (!oldUsername || !newUsername) {
        return { success: false, error: "Usernames cannot be empty." };
    }

    let usersMetadata = await readUsersMetadata();
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

    const metadataResult = await saveUsersMetadata(usersMetadata);
    if (!metadataResult.success) {
        return { success: false, error: metadataResult.error };
    }

    const activeUsernames = usersMetadata.map(u => u.username);
    const configResult = await saveConfig(activeUsernames);
    if (!configResult.success) {
        return { success: false, error: configResult.error };
    }
    
    const restartResult = await restartVpnService();
    if(!restartResult.success) {
        return { success: false, error: restartResult.error };
    }

    const managerUsers = usersMetadata.filter((u: any) => u.createdBy === managerUsername);
    return { success: true, users: managerUsers, message: `User updated to "${newUsername}".` };
}

export async function renewUser(prevState: any, formData: FormData): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const username = formData.get('username') as string;
    const managerUsername = formData.get('managerUsername') as string;

    if (!managerUsername) {
        return { success: false, error: "Authentication required." };
    }

    let usersMetadata = await readUsersMetadata();
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
    
    const metadataResult = await saveUsersMetadata(usersMetadata);
    if (!metadataResult.success) {
        return { success: false, error: metadataResult.error };
    }

    const managerUsers = usersMetadata.filter((u: any) => u.createdBy === managerUsername);
    return { success: true, users: managerUsers };
}

// ====================================================================
// Authentication & Manager Management
// ====================================================================

/**
 * Reads the managers.json file.
 * @param forceLocal - If true, reads from the local dev file system regardless of environment.
 */
export async function readManagersFile(forceLocal = false): Promise<any[]> {
    const filePath = (forceLocal || !useRemoteSsh) ? path.join(localBasePath, 'managers.json') : managersConfigPath;
    const readFn = (forceLocal || !useRemoteSsh) ? fs.readFile : readFile;
    
    if (!(forceLocal || !useRemoteSsh)) {
        // When remote, we need to read the local managers file to check for SSH config.
        // This is a bit of a chicken-and-egg, but we assume managers.json is managed by the app owner.
        // For remote operations on managers, we will need to re-evaluate.
        // For now, let's assume manager operations happen on a local/synced file.
    }

    await fs.mkdir(localBasePath, { recursive: true });

    try {
        // Always read managers from local file system, as it contains SSH credentials.
        const data = await fs.readFile(path.join(localBasePath, 'managers.json'), 'utf8');
        const managers = data.trim() ? JSON.parse(data) : [];
        
        // Expiry logic only applies to non-owner managers
        const now = new Date();
        if (managers.length > 0) {
            const owner = managers[0];
            const otherManagers = managers.slice(1);
            const validManagers = otherManagers.filter((m: any) => !m.expiresAt || new Date(m.expiresAt) > now);
            const updatedManagers = [owner, ...validManagers];

            if (updatedManagers.length < managers.length) {
                console.log(`Removing ${managers.length - updatedManagers.length} expired managers.`);
                await saveManagersFile(updatedManagers);
                return updatedManagers;
            }
        }
        return managers;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return []; 
        }
        console.error(`CRITICAL: Could not read managers file:`, error);
        throw new Error(`Failed to read managers file: ${error.message}`);
    }
}


/**
 * Saves the provided list of managers to the local managers.json file.
 */
export async function saveManagersFile(managers: any[]): Promise<{success: boolean, error?: string}> {
    await fs.mkdir(localBasePath, { recursive: true });
    const localManagersPath = path.join(localBasePath, 'managers.json');
    try {
        await fs.writeFile(localManagersPath, JSON.stringify(managers, null, 2), 'utf8');
        return { success: true };
    } catch (error: any) {
        console.error(`CRITICAL: Could not write to local managers file:`, error);
        return { success: false, error: `Failed to write managers.json. Check permissions for ${localManagersPath}. Details: ${error.message}` };
    }
}

/**
 * Retrieves the currently logged-in user from the session cookie.
 */
export async function getLoggedInUser() {
  const cookieStore = cookies();
  return cookieStore.get('session')?.value;
}

/**
 * Logs out the current manager by deleting the session cookie.
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  redirect('/login');
}

/**
 * Validates credentials against the managers.json file and creates a session.
 */
export async function login(prevState: any, formData: FormData): Promise<{ error?: string }> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  let managerFound = false;
  let errorState: { error?: string } = {};

  try {
      if (!username || !password) {
        return { error: 'Username and password are required.' };
      }

      let managers = await readManagersFile(true); // Always read local for login
      
      if (managers.length === 0) {
          console.log('No managers found. Creating default admin user.');
          const now = new Date();
          const defaultManager = { 
              username: 'admin', 
              password: 'password',
              createdAt: now.toISOString(),
          };
          const result = await saveManagersFile([defaultManager]);
          
          if (!result.success) {
              return { error: `Initial setup failed. Could not create managers file. Details: ${result.error}` };
          }
          managers = [defaultManager];
      }

      const manager = managers.find((m) => m.username === username && m.password === password);
      
      if (manager) {
        managerFound = true;
        const cookieStore = cookies();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        cookieStore.set('session', username, { 
            httpOnly: true, 
            secure: isProduction,
            expires: Date.now() + thirtyDays,
            sameSite: 'lax',
            path: '/',
        });
      } else {
        errorState = { error: 'Invalid username or password.' };
      }
  } catch (e: any) {
    console.error("Error during login process:", e);
    if (e.digest?.startsWith('NEXT_REDIRECT')) {
      throw e;
    }
    errorState = { error: 'A server error occurred during login. Please check the logs.' }
  }

  if (managerFound) {
    redirect('/');
  }

  return errorState;
}

// ====================================================================
// Superadmin Actions for Manager Management
// ====================================================================

/**
 * Checks if the given username is the owner (first manager in the list).
 */
async function isOwner(username: string): Promise<boolean> {
    const managers = await readManagersFile(true);
    return managers.length > 0 && managers[0].username === username;
}

export async function readManagers(): Promise<{ managers?: any[], error?: string }> {
    try {
      const managers = await readManagersFile(true);
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

    const managers = await readManagersFile(true);
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
    
    let managers = await readManagersFile(true);
    const updatedManagers = managers.filter(m => m.username !== usernameToDelete);

    if (updatedManagers.length === managers.length) {
        return { success: false, error: "Manager not found." };
    }

    const result = await saveManagersFile(updatedManagers);

    if (result.success) {
      return { success: true, managers: updatedManagers };
    } else {
      return { success: false, error: result.error, managers };
    }
}


export async function editManager(prevState: any, formData: FormData): Promise<{ success: boolean; managers?: any[]; error?: string; message?: string; }> {
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
    
    const sshHost = formData.get('sshHost') as string;
    const sshPort = formData.get('sshPort') as string;
    const sshUser = formData.get('sshUser') as string;
    const sshPassword = formData.get('sshPassword') as string;

    if (!oldUsername) {
        return { success: false, error: "Old username is missing." };
    }

    const managers = await readManagersFile(true);
    const managerIndex = managers.findIndex(m => m.username === oldUsername);

    if (managerIndex === -1) {
        return { success: false, error: `Manager "${oldUsername}" not found.` };
    }
    
    // Handle SSH config update for owner
    if (oldUsername === managers[0].username) {
        managers[managerIndex].sshConfig = {
            host: sshHost,
            port: sshPort ? parseInt(sshPort, 10) : 22,
            username: sshUser,
            password: sshPassword,
        }
    }
    
    // Handle username/password update
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

    if (oldUsername === ownerUsername && newPassword) {
        await logout();
    }
    
    return { success: true, managers, message: `Manager "${newUsername || oldUsername}" has been updated.` };
}
