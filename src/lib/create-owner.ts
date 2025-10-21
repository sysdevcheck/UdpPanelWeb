// This is a server-side script to be run manually from the terminal.
// It finds an existing user by email and promotes them to 'owner' by creating a document in Firestore.

import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

// --- CONFIGURATION ---
// IMPORTANT: Make sure this user already exists in Firebase Authentication.
const OWNER_EMAIL = 'sysdevcheck@gmail.com';
const OWNER_USERNAME = 'sysdevcheck';
// ---------------------

async function createOwner() {
  try {
    console.log("Connecting to Firebase services...");
    const firestore = getFirestore(adminApp);
    const auth = getAuth(adminApp);
    
    let userRecord;

    // Step 1: Find the user in Firebase Auth by email
    try {
        console.log(`Looking for user with email '${OWNER_EMAIL}' in Firebase Auth...`);
        userRecord = await auth.getUserByEmail(OWNER_EMAIL);
        console.log(`User found (UID: ${userRecord.uid}).`);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.log(`User not found. Creating a new user with email '${OWNER_EMAIL}'...`);
            userRecord = await auth.createUser({
                email: OWNER_EMAIL,
                password: 'password', // Set a default temporary password
                displayName: OWNER_USERNAME,
            });
            console.log(`User created successfully (UID: ${userRecord.uid}). Please change the password.`);
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
    console.log(`User '${OWNER_EMAIL}' is now configured as the Owner.`);
    console.log("-----------------------------------------");
    console.log("You can now run 'npm run dev' and log in.");

  } catch (error: any) {
     console.error("❌ An error occurred while creating the owner user:", error);
     process.exit(1);
  }
}

createOwner().then(() => {
    process.exit(0);
});
