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
        console.log(`Config file not found or empty at ${configPath}. Using default config.`);
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
    return { success: false, error: error.message || 'An unknown error occurred' };
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


// --- Authentication Actions ---

/**
 * Attempts to log in a manager.
 */
export async function login(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'Username and password are required.' };
  }

  try {
    const data = await fs.readFile(managersConfigPath, 'utf8');
    const managers = JSON.parse(data);
    const manager = managers.find((m: any) => m.username === username && m.password === password);

    if (manager) {
      cookies().set('session', username, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      redirect('/');
    } else {
      return { error: 'Invalid credentials.' };
    }
  } catch (error) {
    console.error('Error reading managers file:', error);
    // Create a default managers file if it doesn't exist
    await fs.writeFile(managersConfigPath, JSON.stringify([{username: 'admin', password: 'password'}], null, 2), 'utf8');
    return { error: 'Login failed. A default admin user has been created. Use username "admin" and password "password". Please change the password.' };
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
