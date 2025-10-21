// This is a server-side script to be run manually from the terminal.
// It finds an existing user by email and promotes them to 'owner' by creating a document in Firestore.

import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

// --- CONFIGURATION ---
// IMPORTANT: Make sure this user already exists in Firebase Authentication.
const OWNER_EMAIL = 'admin@example.com'; // Dummy email for auth
const OWNER_USERNAME = 'admin';
const OWNER_PASSWORD = 'password';
// ---------------------

async function createOwner() {
  try {
    console.log("Connecting to Firebase services...");
    const firestore = getFirestore(adminApp);
    const auth = getAuth(adminApp);
    
    let userRecord;

    // Step 1: Find the user in Firebase Auth by email or create them
    try {
        console.log(`Looking for user with email '${OWNER_EMAIL}' in Firebase Auth...`);
        userRecord = await auth.getUserByEmail(OWNER_EMAIL);
        console.log(`User found (UID: ${userRecord.uid}). Updating password and claims.`);
        await auth.updateUser(userRecord.uid, { password: OWNER_PASSWORD });

    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.log(`User not found. Creating a new user with email '${OWNER_EMAIL}'...`);
            userRecord = await auth.createUser({
                email: OWNER_EMAIL,
                password: OWNER_PASSWORD,
                displayName: OWNER_USERNAME,
            });
            console.log(`User created successfully (UID: ${userRecord.uid}).`);
        } else {
            throw error; // Re-throw other auth errors
        }
    }
    
    // Step 2: Set custom claim for the user
    try {
        await auth.setCustomUserClaims(userRecord.uid, { role: 'owner' });
        console.log(`Custom claim { role: 'owner' } set for user ${userRecord.uid}.`);
    } catch(e) {
        console.error("Failed to set custom claims. Please check IAM permissions.", e)
    }


    // Step 3: Create the owner document in Firestore 'users' collection with a specific ID 'owner'
    const ownerDocRef = firestore.collection('users').doc('owner');

    const ownerData = {
        uid: userRecord.uid,
        username: OWNER_USERNAME,
        password: OWNER_PASSWORD, // Storing password for direct login
        email: OWNER_EMAIL,
        role: 'owner',
        createdAt: new Date(),
        expiresAt: null, // Owners do not expire
        assignedServerId: null,
    };

    console.log(`Creating/updating the owner document in Firestore with UID: ${userRecord.uid}...`);
    await ownerDocRef.set(ownerData, { merge: true });
    console.log("Firestore owner document created/updated successfully.");
    
    console.log("-----------------------------------------");
    console.log("✅ Success!");
    console.log(`User '${OWNER_USERNAME}' is now configured as the Owner.`);
    console.log("-----------------------------------------");
    console.log("You can now run 'npm run dev' and log in with username 'admin' and password 'password'.");

  } catch (error: any) {
     console.error("❌ An error occurred while creating the owner user:", error);
     process.exit(1);
  }
}

createOwner().then(() => {
    process.exit(0);
});
