
'use server';

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Paths to configuration files
const configPath = '/etc/zivpn/config.json';
const managersConfigPath = '/etc/zivpn/managers.json';

// Default configuration for zivpn if the file doesn't exist.
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

/**
 * Executes a shell command to restart the VPN service.
 * Requires the node process user to have passwordless sudo permissions.
 */
async function restartVpnService(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    exec('sudo systemctl restart zivpn', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error restarting zivpn service: ${error.message}`);
        const errorMessage = stderr || error.message;
        resolve({ success: false, error: `Failed to restart VPN service: ${errorMessage}` });
        return;
      }
      if (stderr) {
        console.warn(`Stderr while restarting zivpn service: ${stderr}`);
      }
      console.log(`zivpn service restarted successfully: ${stdout}`);
      resolve({ success: true });
    });
  });
}

/**
 * Reads the VPN user configuration from the JSON file.
 * Filters out expired users and saves the updated config if needed.
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
 * Reads the configuration visible to the currently logged-in manager.
 * It also filters out expired users from the main config file.
 */
export async function readConfig(): Promise<any> {
  const managerUsername = await getLoggedInUser();
  if (!managerUsername) {
    redirect('/login');
  }

  let config;
  try {
    config = await readRawConfig();
  } catch (error: any) {
    console.error(`Error reading config file at ${configPath}:`, error);
    throw new Error('Could not read configuration file.');
  }

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

/**
 * Saves the provided data to the JSON configuration file.
 */
export async function saveConfig(data: any): Promise<{ success: boolean; error?: string }> {
  try {
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (error: any) {
    console.error(`Error writing config file at ${configPath}:`, error);
    return { success: false, error: `Failed to write to ${configPath}. Check permissions.` };
  }
}

/**
 * Adds a new VPN user, associating it with the logged-in manager.
 */
export async function addUser(username: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const managerUsername = await getLoggedInUser();
    if (!managerUsername) return { success: false, error: "Authentication required." };
    if (!username) return { success: false, error: "Username cannot be empty." };

    try {
        const config = await readRawConfig();
        const users = config.auth?.config || [];

        if (users.some((user: any) => user.username === username)) {
            return { success: false, error: "User already exists." };
        }
        
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const newUser = {
            username,
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            createdBy: managerUsername, // Link user to the manager
        };

        config.auth.config.push(newUser);
        
        const result = await saveConfig(config);
        if (result.success) {
            await restartVpnService();
            const managerUsers = config.auth.config.filter((u: any) => u.createdBy === managerUsername);
            return { success: true, users: managerUsers };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to add user.' };
    }
}

/**
 * Deletes a user, ensuring the manager has permission.
 */
export async function deleteUser(username: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const managerUsername = await getLoggedInUser();
    if (!managerUsername) return { success: false, error: "Authentication required." };
    if (!username) return { success: false, error: "Username cannot be empty." };

    try {
        const config = await readRawConfig();
        const users = config.auth?.config || [];
        const userToDelete = users.find((user: any) => user.username === username);

        if (!userToDelete) return { success: false, error: "User not found." };
        if (userToDelete.createdBy !== managerUsername) return { success: false, error: "Permission denied." };
        
        config.auth.config = users.filter((user: any) => user.username !== username);
        const result = await saveConfig(config);
        if (result.success) {
            await restartVpnService();
            const managerUsers = config.auth.config.filter((u: any) => u.createdBy === managerUsername);
            return { success: true, users: managerUsers };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to delete user.' };
    }
}

/**
 * Edits a user's username, ensuring the manager has permission.
 */
export async function editUser(oldUsername: string, newUsername: string): Promise<{ success: boolean; users?: any[], error?: string }> {
    const managerUsername = await getLoggedInUser();
    if (!managerUsername) return { success: false, error: "Authentication required." };
    if (!oldUsername || !newUsername) return { success: false, error: "Usernames cannot be empty." };
    if (oldUsername === newUsername) return { success: false, error: "New username is the same as the old one." };

    try {
        const config = await readRawConfig();
        const users = config.auth?.config || [];
        const userIndex = users.findIndex((user: any) => user.username === oldUsername);

        if (userIndex === -1) return { success: false, error: `User "${oldUsername}" not found.` };
        if (users[userIndex].createdBy !== managerUsername) return { success: false, error: "Permission denied." };
        if (users.some((user: any) => user.username === newUsername)) return { success: false, error: `User "${newUsername}" already exists.` };
        
        users[userIndex].username = newUsername;
        config.auth.config = users;

        const result = await saveConfig(config);
        if (result.success) {
            await restartVpnService();
            const managerUsers = config.auth.config.filter((u: any) => u.createdBy === managerUsername);
            return { success: true, users: managerUsers };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to edit user.' };
    }
}

/**
 * Renews a user's subscription, ensuring the manager has permission.
 */
export async function renewUser(username: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    const managerUsername = await getLoggedInUser();
    if (!managerUsername) return { success: false, error: "Authentication required." };
    if (!username) return { success: false, error: "Username cannot be empty." };

    try {
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
            await restartVpnService();
            const managerUsers = config.auth.config.filter((u: any) => u.createdBy === managerUsername);
            return { success: true, users: managerUsers };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to renew user.' };
    }
}


// --- Authentication and Manager Actions ---

async function readManagersFile(): Promise<any[]> {
    try {
        await fs.access(managersConfigPath);
        const data = await fs.readFile(managersConfigPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // This is not a warning, it's an expected case for the first run.
        return [];
    }
}

async function saveManagersFile(managers: any[]): Promise<{success: boolean, error?: string}> {
    try {
        const dir = path.dirname(managersConfigPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(managersConfigPath, JSON.stringify(managers, null, 2), 'utf8');
        return { success: true };
    } catch (error: any) {
        console.error(`Error saving managers file:`, error);
        return { success: false, error: `Failed to write to ${managersConfigPath}. Please check directory permissions.` };
    }
}

/**
 * Attempts to log in a manager.
 */
export async function login(prevState: any, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username and password are required.' };
  }

  try {
    let managers = await readManagersFile();
    
    // First run scenario: create default admin and ask user to try again.
    if (managers.length === 0) {
        console.log('No managers file found. Creating a default admin user.');
        const defaultManager = { username: 'admin', password: 'password' };
        const result = await saveManagersFile([defaultManager]);
        
        if (!result.success) {
            // Return specific file write error if saving fails
            return { error: result.error };
        }
        
        // Inform the user that the default account was created and they should log in.
        return { error: 'A default user (admin/password) was created. Please sign in.' };
    }
    
    // Normal login scenario
    const manager = managers.find((m: any) => m.username === username && m.password === password);

    if (manager) {
      cookies().set('session', username, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      redirect('/');
    } else {
      return { error: 'Invalid credentials.' };
    }
  } catch (error: any) {
    console.error('Error during login process:', error);
    return { error: 'An unexpected error occurred during login. Check server logs.' };
  }
}

/**
 * Logs out the current manager.
 */
export async function logout() {
  cookies().delete('session');
  redirect('/login');
}

/**
 * Retrieves the currently logged-in user from the session cookie.
 */
export async function getLoggedInUser() {
  return cookies().get('session')?.value;
}


// --- Superadmin (Owner) Actions for Manager Management ---

export async function readManagers(): Promise<{ managers?: any[], error?: string }> {
    const loggedInUser = await getLoggedInUser();
    if (!loggedInUser) return { error: "Authentication required." };
    
    try {
        const managers = await readManagersFile();
        return { managers };
    } catch (error: any) {
        return { error: 'Could not read managers file.' };
    }
}

async function isOwner(username: string): Promise<boolean> {
    const managers = await readManagersFile();
    return managers.length > 0 && managers[0].username === username;
}

export async function addManager(formData: FormData): Promise<{ success: boolean; managers?: any[], error?: string }> {
    const loggedInUser = await getLoggedInUser();
    if (!loggedInUser) return { success: false, error: "Authentication required." };
    if (!await isOwner(loggedInUser)) return { success: false, error: "Permission denied. Only the owner can add managers." };
    
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    if (!username || !password) return { success: false, error: "Username and password are required." };

    try {
        const managers = await readManagersFile();
        if (managers.some(m => m.username === username)) {
            return { success: false, error: "Manager username already exists." };
        }
        
        managers.push({ username, password });
        const result = await saveManagersFile(managers);
        if (!result.success) {
            return { success: false, error: result.error };
        }
        
        return { success: true, managers };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to add manager.' };
    }
}

export async function deleteManager(username: string): Promise<{ success: boolean; managers?: any[], error?: string }> {
    const loggedInUser = await getLoggedInUser();
    if (!loggedInUser) return { success: false, error: "Authentication required." };

    const managers = await readManagersFile();
    const ownerUsername = managers.length > 0 ? managers[0].username : null;

    if (loggedInUser !== ownerUsername) {
        return { success: false, error: "Permission denied. Only the owner can delete managers." };
    }

    if (username === ownerUsername) {
        return { success: false, error: "The owner account cannot be deleted." };
    }
    
    const updatedManagers = managers.filter(m => m.username !== username);
    if (updatedManagers.length === managers.length) {
        return { success: false, error: "Manager not found." };
    }

    try {
        const result = await saveManagersFile(updatedManagers);
        if (!result.success) {
            return { success: false, error: result.error };
        }
        return { success: true, managers: updatedManagers };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to delete manager.' };
    }
}
    

    
