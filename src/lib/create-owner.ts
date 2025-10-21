// This is a server-side script to be run manually from the terminal.
// It creates the initial 'owner' user in Firebase Authentication and Firestore.

import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/firebase/admin';

// --- CONFIGURATION ---
const OWNER_EMAIL = 'admin@panel.com';
const OWNER_PASSWORD = 'password'; // You MUST change this after your first login.
const OWNER_USERNAME = 'admin';
// ---------------------

async function createOwner() {
  try {
    console.log("Connecting to Firebase services...");
    const firestore = getFirestore(adminApp);
    const auth = getAuth(adminApp);
    const usersRef = firestore.collection('users');

    let userRecord;

    // Check if user exists in Firebase Auth by email
    try {
        userRecord = await auth.getUserByEmail(OWNER_EMAIL);
        console.log(`User with email '${OWNER_EMAIL}' already exists in Firebase Auth (UID: ${userRecord.uid}).`);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.log(`User with email '${OWNER_EMAIL}' not found. Creating new user...`);
            userRecord = await auth.createUser({
                email: OWNER_EMAIL,
                password: OWNER_PASSWORD,
                displayName: OWNER_USERNAME,
            });
            console.log(`Successfully created new user in Firebase Auth (UID: ${userRecord.uid}).`);
        } else {
            throw error; // Re-throw other auth errors
        }
    }

    // Set custom claim to make them an owner
    console.log(`Setting 'owner' custom claim for UID: ${userRecord.uid}`);
    await auth.setCustomUserClaims(userRecord.uid, { role: 'owner' });
    console.log("Custom claim set successfully.");


    // Check if user exists in Firestore 'users' collection
    const firestoreUserQuery = await usersRef.where('uid', '==', userRecord.uid).limit(1).get();

    if (!firestoreUserQuery.empty) {
        console.log("User document already exists in Firestore. Updating role and details...");
        const userDoc = firestoreUserQuery.docs[0];
        await userDoc.ref.update({
            role: 'owner',
            username: OWNER_USERNAME,
            email: OWNER_EMAIL,
            expiresAt: null
        });
        console.log("Firestore user document updated.");
    } else {
        console.log("Creating user document in Firestore...");
        await usersRef.add({
            uid: userRecord.uid,
            username: OWNER_USERNAME,
            email: OWNER_EMAIL,
            role: 'owner',
            createdAt: new Date(),
            expiresAt: null, // Owner does not expire.
            assignedServerId: null,
        });
        console.log("Firestore user document created.");
    }
    
    console.log("-----------------------------------------");
    console.log("✅ Success!");
    console.log(`Owner user configured with credentials:`);
    console.log(`   Email: ${OWNER_EMAIL}`);
    console.log(`   Password: ${OWNER_PASSWORD}`);
    console.log("-----------------------------------------");
    console.log("You can now run 'npm run dev' and log in.");
    console.log("IMPORTANT: Please change the password immediately after your first login through the Firebase Console.");

  } catch (error) {
    console.error("❌ An error occurred while creating the owner user:", error);
    process.exit(1);
  }
}

createOwner().then(() => {
    process.exit(0);
});
