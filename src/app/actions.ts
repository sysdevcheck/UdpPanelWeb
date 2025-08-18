'use server';

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

// The path to the configuration file on the server.
// IMPORTANT: The process running this Next.js app needs read/write permissions for this path.
const configPath = '/etc/zivpn/config.json';

// A default configuration to use if the file doesn't exist or is empty.
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
 * Executes a shell command, in this case to restart the VPN service.
 * This requires the node process user to have passwordless sudo permissions.
 */
async function restartVpnService(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    exec('sudo systemctl restart zivpn', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error restarting zivpn service: ${error.message}`);
        // Often, stderr has more specific details from the command itself.
        const errorMessage = stderr || error.message;
        resolve({ success: false, error: `Failed to restart VPN service: ${errorMessage}` });
        return;
      }
      if (stderr) {
        // Some commands output to stderr for warnings, not necessarily errors.
        console.warn(`Stderr while restarting zivpn service: ${stderr}`);
      }
      console.log(`zivpn service restarted successfully: ${stdout}`);
      resolve({ success: true });
    });
  });
}


/**
 * Reads the configuration from the JSON file.
 * Returns a default configuration if the file doesn't exist.
 * It also filters out expired users and saves the updated config.
 */
export async function readConfig(): Promise<any> {
  let config;
  try {
    const data = await fs.readFile(configPath, 'utf8');
    config = data.trim() ? JSON.parse(data) : defaultConfig;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`Config file not found at ${configPath}. Using default config.`);
      await saveConfig(defaultConfig);
      return defaultConfig;
    }
    console.error(`Error reading config file at ${configPath}:`, error);
    throw new Error('Could not read configuration file.');
  }

  const now = new Date();
  const users = config.auth?.config || [];
  const validUsers = users.filter((user: any) => user.expiresAt && new Date(user.expiresAt) > now);

  // If there are expired users, update the config file and restart the service
  if (validUsers.length < users.length) {
    console.log(`Removing ${users.length - validUsers.length} expired users.`);
    config.auth.config = validUsers;
    const saveResult = await saveConfig(config);
    if(saveResult.success) {
        await restartVpnService();
    }
  }

  return config;
}


/**
 * Saves the provided data to the JSON configuration file.
 * The data is prettified for readability.
 */
export async function saveConfig(data: any): Promise<{ success: boolean; error?: string }> {
  try {
    const dir = path.dirname(configPath);
    // Ensure directory exists, create if not.
    await fs.mkdir(dir, { recursive: true });
    
    // Write the file, prettifying the JSON with 2-space indentation.
    await fs.writeFile(configPath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (error: any) {
    console.error(`Error writing config file at ${configPath}:`, error);
    return { success: false, error: error.message || 'An unknown error occurred' };
  }
}

/**
 * Adds a new user to the configuration with creation and expiration dates.
 */
export async function addUser(username: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    if (!username) {
        return { success: false, error: "Username cannot be empty." };
    }
    try {
        const config = await readConfig();
        const users = config.auth?.config || [];

        if (users.some((user: any) => user.username === username)) {
            return { success: false, error: "User already exists.", users };
        }
        
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        const newUser = {
            username,
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
        };

        const newUsers = [...users, newUser];
        config.auth.config = newUsers;
        
        const result = await saveConfig(config);
        if (result.success) {
            const restartResult = await restartVpnService();
            if (!restartResult.success) {
                return { success: false, error: restartResult.error, users: newUsers };
            }
            return { success: true, users: newUsers };
        } else {
            return { success: false, error: result.error, users };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to add user.' };
    }
}


/**
 * Deletes a user from the configuration.
 */
export async function deleteUser(username: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
     if (!username) {
        return { success: false, error: "Username cannot be empty." };
    }
    try {
        const config = await readConfig();
        const users = config.auth?.config || [];
        if (!users.some((user: any) => user.username === username)) {
            return { success: false, error: "User not found.", users };
        }
        const newUsers = users.filter((user: any) => user.username !== username);
        config.auth.config = newUsers;
        const result = await saveConfig(config);
        if (result.success) {
            const restartResult = await restartVpnService();
            if (!restartResult.success) {
                return { success: false, error: restartResult.error, users: newUsers };
            }
            return { success: true, users: newUsers };
        } else {
            return { success: false, error: result.error, users };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to delete user.' };
    }
}

/**
 * Edits a user's username in the configuration.
 */
export async function editUser(oldUsername: string, newUsername: string): Promise<{ success: boolean; users?: any[], error?: string }> {
    if (!oldUsername || !newUsername) {
        return { success: false, error: "Old and new usernames cannot be empty." };
    }
    if (oldUsername === newUsername) {
        return { success: false, error: "New username cannot be the same as the old one." };
    }

    try {
        const config = await readConfig();
        const users = config.auth?.config || [];

        const userIndex = users.findIndex((user: any) => user.username === oldUsername);
        if (userIndex === -1) {
            return { success: false, error: `User "${oldUsername}" not found.`, users };
        }

        if (users.some((user: any) => user.username === newUsername)) {
            return { success: false, error: `User "${newUsername}" already exists.`, users };
        }
        
        const updatedUsers = [...users];
        updatedUsers[userIndex] = { ...updatedUsers[userIndex], username: newUsername };
        
        config.auth.config = updatedUsers;

        const result = await saveConfig(config);
        if (result.success) {
             const restartResult = await restartVpnService();
            if (!restartResult.success) {
                return { success: false, error: restartResult.error, users: updatedUsers };
            }
            return { success: true, users: updatedUsers };
        } else {
            return { success: false, error: result.error, users };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to edit user.' };
    }
}

/**
 * Renews a user's subscription for another 30 days from today.
 */
export async function renewUser(username: string): Promise<{ success: boolean; users?: any[]; error?: string }> {
    if (!username) {
        return { success: false, error: "Username cannot be empty." };
    }
    try {
        const config = await readConfig();
        const users = config.auth?.config || [];

        const userIndex = users.findIndex((user: any) => user.username === username);
        if (userIndex === -1) {
            return { success: false, error: `User "${username}" not found.`, users };
        }

        const now = new Date();
        const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        const updatedUsers = [...users];
        updatedUsers[userIndex] = { ...updatedUsers[userIndex], expiresAt: newExpiresAt.toISOString() };

        config.auth.config = updatedUsers;
        
        const result = await saveConfig(config);
        if (result.success) {
            const restartResult = await restartVpnService();
            if (!restartResult.success) {
                return { success: false, error: restartResult.error, users: updatedUsers };
            }
            return { success: true, users: updatedUsers };
        } else {
            return { success: false, error: result.error, users };
        }
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to renew user.' };
    }
}
