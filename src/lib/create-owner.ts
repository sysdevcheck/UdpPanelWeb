
import fs from 'fs/promises';
import path from 'path';

const CREDENTIALS_PATH = path.join(process.cwd(), 'data', 'credentials.json');

async function main() {
    try {
        await fs.mkdir(path.dirname(CREDENTIALS_PATH), { recursive: true });
        
        let credentials = [];
        try {
            const data = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
            credentials = JSON.parse(data);
        } catch (e: any) {
            if (e.code !== 'ENOENT') throw e;
        }

        const ownerExists = credentials.some((u: any) => u.role === 'owner');

        if (ownerExists) {
            console.log("An owner account already exists in data/credentials.json. No action taken.");
            return;
        }

        console.log("No owner found. Creating default owner account...");
        const defaultOwner = {
            id: 'user_admin_001',
            username: 'admin',
            password: 'password',
            role: 'owner',
            createdAt: new Date().toISOString(),
        };

        credentials.push(defaultOwner);
        await fs.writeFile(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), 'utf-8');
        
        console.log("Default owner account (admin/password) created successfully in data/credentials.json");

    } catch (error) {
        console.error("Failed to create owner:", error);
    }
}

main();
