
import fs from 'fs/promises';
import path from 'path';

// Define paths to data files
const dataDir = path.join(process.cwd(), 'data');
const credentialsPath = path.join(dataDir, 'credentials.json');
const serversPath = path.join(dataDir, 'servers.json');
const vpnUsersPath = path.join(dataDir, 'vpn-users.json');
export const backupsDir = path.join(dataDir, 'backups');


// Ensure directory exists
export async function ensureDir(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

// Ensure data directory and files exist
async function ensureFile(filePath: string, defaultContent: string = '[]') {
    try {
        await fs.access(filePath);
    } catch (error) {
        await ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, defaultContent, 'utf8');
    }
}

// Generic read function
async function readFile<T>(filePath: string): Promise<T> {
    await ensureFile(filePath);
    const data = await fs.readFile(filePath, 'utf8');
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error(`Error parsing JSON from ${filePath}. Returning empty array.`);
        return JSON.parse('[]');
    }
}

// Generic write function
async function writeFile<T>(filePath: string, data: T): Promise<void> {
    await ensureFile(filePath);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Specific functions for each data type
export const readCredentials = () => readFile<any[]>(credentialsPath);
export const writeCredentials = (data: any[]) => writeFile(credentialsPath, data);

export const readServers = () => readFile<any[]>(serversPath);
export const writeServers = (data: any[]) => writeFile(serversPath, data);

export const readVpnUsers = () => readFile<any[]>(vpnUsersPath);
export const writeVpnUsers = (data: any[]) => writeFile(vpnUsersPath, data);
