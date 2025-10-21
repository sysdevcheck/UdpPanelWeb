
// This is a server-side script to be run manually from the terminal.
// It finds an existing user by email and promotes them to 'owner'.

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
    const usersRef = firestore.collection('users');

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

    // Step 2: Set custom claim to make them an owner
    console.log(`Setting 'owner' custom claim for UID: ${userRecord.uid}`);
    await auth.setCustomUserClaims(userRecord.uid, { role: 'owner' });
    console.log("Custom claim set successfully.");


    // Step 3: Find or create the user document in Firestore 'users' collection
    const firestoreUserQuery = await usersRef.where('uid', '==', userRecord.uid).limit(1).get();

    if (!firestoreUserQuery.empty) {
        console.log("User document already exists in Firestore. Updating role and details...");
        const userDoc = firestoreUserQuery.docs[0];
        await userDoc.ref.update({
            role: 'owner',
            username: OWNER_USERNAME,
            email: OWNER_EMAIL,
            expiresAt: null, // Owner doesn't expire
            assignedServerId: null,
        });
        console.log("Firestore user document updated.");
    } else {
        console.log("User document not found in Firestore. Creating new one...");
        await usersRef.add({
            uid: userRecord.uid,
            username: OWNER_USERNAME,
            email: OWNER_EMAIL,
            role: 'owner',
            createdAt: new Date(),
            expiresAt: null,
            assignedServerId: null,
        });
        console.log("Firestore user document created.");
    }
    
    console.log("-----------------------------------------");
    console.log("✅ Success!");
    console.log(`User '${OWNER_EMAIL}' has been promoted to Owner.`);
    console.log("-----------------------------------------");
    console.log("You can now run 'npm run dev' and log in.");

  } catch (error) {
    console.error("❌ An error occurred while promoting the owner user:", error);
    process.exit(1);
  }
}

// Rename function call to reflect new purpose
promoteOwner().then(() => {
    process.exit(0);
});
