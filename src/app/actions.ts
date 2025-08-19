
'use server';

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// ====================================================================
// Constants
// ====================================================================

const configPath = '/etc/zivpn/config.json';
const managersConfigPath = '/etc/zivpn/managers.json';

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
// Core Service Functions
// ====================================================================

/**
 * Executes a shell command to restart the VPN service.
 */
async function restartVpnService(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    exec('sudo systemctl restart zivpn', (error, stdout, stderr) => {
      if (error) {
        const errorMessage = `Error restarting zivpn service: ${stderr || error.message}`;
        console.error(errorMessage);
        resolve({ success: false, error: `Failed to restart VPN service: ${stderr || error.message}` });
        return;
      }
      if (stderr) {
        console.warn(`Stderr while restarting zivpn service: ${stderr}`);
      }
      resolve({ success: true });
    });
  });
}

/**
 * Reads the raw VPN user configuration from the JSON file.
 * Creates a default config if the file doesn't exist.
 */
async function readRawConfig(): Promise<any> {
    try {
        await fs.access(configPath);
        const data = await fs.readFile(configPath, 'utf8');
        return data.trim() ? JSON.parse(data) : defaultConfig;
    } catch (error) {
        console.log(`Config file not found or empty at ${configPath}. Creating default config.`);
        await saveConfig(defaultConfig);
        return defaultConfig;
    }
}

/**
 * Saves the provided data to the main zivpn JSON configuration file.
 */
async function saveConfig(data: any): Promise<{ success: boolean; error?: string }> {
  try {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (error: any) {
    console.error(`CRITICAL: Error writing config file at ${configPath}:`, error);
    return { success: false, error: `Failed to write to ${configPath}. Check permissions.` };
  }
}

// ====================================================================
// VPN User Management
// ====================================================================

/**
 * Reads the configuration, filters out expired users, and returns users for the current manager.
 */
export async function readConfig(): Promise<any> {
  const managerUsername = await getLoggedInUser();
  if (!managerUsername) {
    redirect('/login');
  }

  const config = await readRawConfig();

  // Clean up expired users
  const now = new Date();
  const allUsers = config.auth?.config || [];
  const validUsers = allUsers.filter((user: any) => user.expiresAt && new Date(user.expiresAt) > now);

  if (validUsers.length < allUsers.length) {
    console.log(`Removing ${allUsers.length - validUsers.length} expired users.`);
    config.auth.config = validUsers;
    const saveResult = await saveConfig(config);
    if(saveResult.success) {
        await restartVpnService();
    }
  }

  // Filter users to show only those created by the logged-in manager
  const managerUsers = config.auth.config.filter((user: any) => user.createdBy === managerUsername);
  
  return { ...config, auth: { ...config.auth, config: managerUsers } };
}


export async function addUser(username: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const managerUsername = await getLoggedInUser();
    if (!managerUsername) return { success: false, error: "Authentication required." };
    if (!username) return { success: false, error: "Username cannot be empty." };

    const config = await readRawConfig();
    const users = config.auth?.config || [];

    if (users.some((user: any) => user.username === username)) {
        return { success: false, error: "User already exists." };
    }
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    config.auth.config.push({
        username,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        createdBy: managerUsername,
    });
    
    const result = await saveConfig(config);
    if (result.success) {
        const restartResult = await restartVpnService();
        if(!restartResult.success) {
            return { success: false, error: restartResult.error };
        }
        const managerUsers = config.auth.config.filter((u: any) => u.createdBy === managerUsername);
        return { success: true, users: managerUsers };
    } else {
        return { success: false, error: result.error };
    }
}

export async function deleteUser(username: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const managerUsername = await getLoggedInUser();
    if (!managerUsername) return { success: false, error: "Authentication required." };

    const config = await readRawConfig();
    const users = config.auth?.config || [];
    const userToDelete = users.find((user: any) => user.username === username);

    if (!userToDelete) return { success: false, error: "User not found." };
    if (userToDelete.createdBy !== managerUsername) return { success: false, error: "Permission denied." };
    
    config.auth.config = users.filter((user: any) => user.username !== username);
    const result = await saveConfig(config);
    if (result.success) {
        const restartResult = await restartVpnService();
         if(!restartResult.success) {
            return { success: false, error: restartResult.error };
        }
        const managerUsers = config.auth.config.filter((u: any) => u.createdBy === managerUsername);
        return { success: true, users: managerUsers };
    } else {
        return { success: false, error: result.error };
    }
}

export async function editUser(oldUsername: string, newUsername: string): Promise<{ success: boolean; users?: any[], error?: string }> {
    const managerUsername = await getLoggedInUser();
    if (!managerUsername) return { success: false, error: "Authentication required." };
    if (!oldUsername || !newUsername) return { success: false, error: "Usernames cannot be empty." };

    const config = await readRawConfig();
    const users = config.auth?.config || [];
    const userIndex = users.findIndex((user: any) => user.username === oldUsername);

    if (userIndex === -1) return { success: false, error: `User "${oldUsername}" not found.` };
    if (users[userIndex].createdBy !== managerUsername) return { success: false, error: "Permission denied." };
    if (oldUsername !== newUsername && users.some((user: any) => user.username === newUsername)) {
        return { success: false, error: `User "${newUsername}" already exists.` };
    }
    
    users[userIndex].username = newUsername;
    config.auth.config = users;

    const result = await saveConfig(config);
    if (result.success) {
        const restartResult = await restartVpnService();
        if(!restartResult.success) {
            return { success: false, error: restartResult.error };
        }
        const managerUsers = config.auth.config.filter((u: any) => u.createdBy === managerUsername);
        return { success: true, users: managerUsers };
    } else {
        return { success: false, error: result.error };
    }
}

export async function renewUser(username: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const managerUsername = await getLoggedInUser();
    if (!managerUsername) return { success: false, error: "Authentication required." };

    const config = await readRawConfig();
    const users = config.auth?.config || [];
    const userIndex = users.findIndex((user: any) => user.username === username);

    if (userIndex === -1) return { success: false, error: `User "${username}" not found.` };
    if (users[userIndex].createdBy !== managerUsername) return { success: false, error: "Permission denied." };

    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    users[userIndex].expiresAt = newExpiresAt.toISOString();
    config.auth.config = users;
    
    const result = await saveConfig(config);
    if (result.success) {
        const restartResult = await restartVpnService();
         if(!restartResult.success) {
            return { success: false, error: restartResult.error };
        }
        const managerUsers = config.auth.config.filter((u: any) => u.createdBy === managerUsername);
        return { success: true, users: managerUsers };
    } else {
        return { success: false, error: result.error };
    }
}

// ====================================================================
// Authentication & Manager Management
// ====================================================================

/**
 * Reads the managers.json file. Returns an empty array if it doesn't exist.
 */
export async function readManagersFile(): Promise<any[]> {
    try {
        await fs.access(managersConfigPath);
        const data = await fs.readFile(managersConfigPath, 'utf8');
        return data.trim() ? JSON.parse(data) : [];
    } catch (error) {
        return [];
    }
}

/**
 * Saves the provided list of managers to the managers.json file.
 */
export async function saveManagersFile(managers: any[]): Promise<{success: boolean, error?: string}> {
    try {
        const dir = path.dirname(managersConfigPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(managersConfigPath, JSON.stringify(managers, null, 2), 'utf8');
        return { success: true };
    } catch (error: any) {
        console.error(`CRITICAL: Could not write to managers file:`, error);
        return { success: false, error: `Failed to write to ${managersConfigPath}. Please check directory permissions.` };
    }
}

/**
 * Retrieves the currently logged-in user from the session cookie.
 */
export async function getLoggedInUser() {
  return cookies().get('session')?.value;
}

/**
 * Logs out the current manager by deleting the session cookie.
 */
export async function logout() {
  cookies().delete('session');
  redirect('/login');
}

/**
 * CLEAN AND SIMPLE LOGIN FUNCTION
 * Its only job is to validate credentials against the managers.json file.
 */
export async function login(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username and password are required.' };
  }

  let managers: any[] = [];
  try {
    managers = await readManagersFile();
  } catch (error: any) {
      console.error("Login Error: Failed to read managers file.", error);
      return { error: 'Server error: Could not read configuration.' };
  }
  
  if (managers.length === 0) {
      // This state should ideally not be hit if the main page logic works correctly
      return { error: 'No managers configured. Please load the main page first or contact support.' };
  }

  const manager = managers.find((m) => m.username === username && m.password === password);

  if (manager) {
    cookies().set('session', username, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    redirect('/');
  } else {
    return { error: 'Invalid username or password.' };
  }
}

// ====================================================================
// Superadmin Actions for Manager Management
// ====================================================================

/**
 * Checks if the given username is the owner (first manager in the list).
 */
async function isOwner(username: string): Promise<boolean> {
    const managers = await readManagersFile();
    return managers.length > 0 && managers[0].username === username;
}

export async function readManagers(): Promise<{ managers?: any[], error?: string }> {
    const loggedInUser = await getLoggedInUser();
    if (!loggedInUser) return { error: "Authentication required." };
    
    const managers = await readManagersFile();
    return { managers };
}

export async function addManager(prevState: any, formData: FormData): Promise<{ success: boolean; managers?: any[], error?: string }> {
    const loggedInUser = await getLoggedInUser();
    if (!loggedInUser) {
        return { success: false, error: "Authentication required." };
    }
    if(!await isOwner(loggedInUser)) {
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
    
    managers.push({ username, password });
    const result = await saveManagersFile(managers);
    
    if (result.success) {
      return { success: true, managers };
    } else {
      return { success: false, error: result.error, managers };
    }
}

export async function deleteManager(username: string): Promise<{ success: boolean; managers?: any[], error?: string }> {
    const loggedInUser = await getLoggedInUser();
    if (!loggedInUser) {
        return { success: false, error: "Authentication required." };
    }
    if(!await isOwner(loggedInUser)) {
        return { success: false, error: "Permission denied. Only the owner can delete managers." };
    }

    if (username === loggedInUser) {
        return { success: false, error: "The owner account cannot be deleted." };
    }
    
    const managers = await readManagersFile();
    const updatedManagers = managers.filter(m => m.username !== username);

    if (updatedManagers.length === managers.length) {
        return { success: false, error: "Manager not found." };
    }

    const result = await saveManagersFile(updatedManagers);

    if (result.success) {
      return { success: true, managers: updatedManagers };
    } else {
      return { success: false, error: result.error, managers: updatedManagers };
    }
}
