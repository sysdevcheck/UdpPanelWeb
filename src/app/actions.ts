'use server';

import fs from 'fs/promises';
import path from 'path';

// The path to the configuration file on the server.
// IMPORTANT: The process running this Next.js app needs read/write permissions for this path.
const configPath = '/etc/zivpn/config.json';

// A default configuration to use if the file doesn't exist or is empty.
const defaultConfig = {
  users: [
    {
      name: 'example-user-1',
      uuid: 'a1b2c3d4-e5f6-a7b8-c9d0-e1f2a3b4c5d6',
      active: true,
    },
     {
      name: 'example-user-2',
      uuid: 'b1c2d3e4-f5a6-b7c8-d9e0-f1a2b3c4d5e6',
      active: false,
    }
  ],
  settings: {
    port: 443,
    protocol: 'tcp',
    tunnels: ['dns', 'http'],
  },
  version: 1.0,
  enabled: true
};

/**
 * Reads the configuration from the JSON file.
 * Returns a default configuration if the file doesn't exist.
 */
export async function readConfig(): Promise<any> {
  try {
    // In a real environment, this will read from the absolute path.
    const data = await fs.readFile(configPath, 'utf8');
    // Handle case where file is empty
    if (!data.trim()) {
      return defaultConfig;
    }
    return JSON.parse(data);
  } catch (error: any) {
    // If the file doesn't exist (ENOENT), return the default config.
    // This allows the app to function on first run.
    if (error.code === 'ENOENT') {
      console.log(`Config file not found at ${configPath}. Using default config.`);
      return defaultConfig;
    }
    // For other errors, log them and re-throw.
    console.error(`Error reading config file at ${configPath}:`, error);
    throw new Error('Could not read configuration file.');
  }
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
