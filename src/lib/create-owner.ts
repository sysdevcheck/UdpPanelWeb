
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

async function promoteOwner() {
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
            console.error(`❌ ERROR: User with email '${OWNER_EMAIL}' was not found in Firebase Authentication.`);
            console.error("Please create this user in the Firebase Console first, then run this script again.");
            process.exit(1);
        }
        throw error; // Re-throw other auth errors
    }

    // Step 2: Find or create the user document in Firestore 'users' collection
    // This script now sets a specific document ID for the owner for easy lookup.
    const ownerDocRef = firestore.collection('users').doc('owner');

    const ownerData = {
        uid: userRecord.uid,
        username: OWNER_USERNAME,
        email: OWNER_EMAIL,
        role: 'owner', // This field now clearly identifies the owner document.
        createdAt: new Date(),
        expiresAt: null,
        assignedServerId: null,
    };

    console.log(`Creating/updating the owner document in Firestore with UID: ${userRecord.uid}...`);
    await ownerDocRef.set(ownerData, { merge: true });
    console.log("Firestore owner document created/updated successfully.");
    
    console.log("-----------------------------------------");
    console.log("✅ Success!");
    console.log(`User '${OWNER_EMAIL}' is now set as the Owner in Firestore.`);
    console.log("-----------------------------------------");
    console.log("You can now run 'npm run dev' and log in.");

  } catch (error: any) {
    // Check if the error is due to Firestore permissions
    if (error.message.includes('permission-denied') || error.message.includes('PERMISSION_DENIED')) {
        console.error("❌ Firestore Permission Error: The script does not have permission to write to the 'users' collection.");
        console.error("Please check your Firestore Security Rules to allow writes from the server environment.");
    } else {
        console.error("❌ An unexpected error occurred:", error);
    }
    process.exit(1);
  }
}

promoteOwner().then(() => {
    process.exit(0);
});
