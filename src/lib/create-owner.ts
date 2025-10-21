import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { getSdks } from '@/firebase';

// This script should be run via tsx from the command line.
// It is not part of the application's runtime.

async function main() {
    try {
        const { firestore } = getSdks();
        const credentialsCollection = collection(firestore, 'credentials');

        const q = query(credentialsCollection, where('role', '==', 'owner'));
        const ownerQuerySnap = await getDocs(q);

        if (!ownerQuerySnap.empty) {
            console.log("An owner account already exists in Firestore. No action taken.");
            return;
        }

        console.log("No owner found. Creating default owner account...");

        const ownerUsername = process.env.OWNER_USERNAME || 'admin';
        const ownerPassword = process.env.OWNER_PASSWORD || 'password';

        if (ownerUsername === 'admin' && ownerPassword === 'password') {
            console.warn("\nWARNING: You are using default credentials for the owner account.");
            console.warn("It's highly recommended to set OWNER_USERNAME and OWNER_PASSWORD in your .env file for better security.\n");
        }
        
        const defaultOwner = {
            username: ownerUsername,
            // The actual password check is against env variables during login.
            // Storing a dummy value or the actual one here doesn't impact security for the owner.
            password: ownerPassword,
            role: 'owner',
            createdAt: new Date().toISOString(),
        };

        await addDoc(credentialsCollection, defaultOwner);
        
        console.log(`Default owner account ("${ownerUsername}") created successfully in Firestore.`);

    } catch (error) {
        console.error("Failed to create owner:", error);
        // Ensure the process exits with an error code if it fails
        process.exit(1);
    }
}

main().then(() => {
    // Manually exit the process if everything is successful
    process.exit(0);
}).catch((e) => {
    console.error(e);
    process.exit(1);
});
