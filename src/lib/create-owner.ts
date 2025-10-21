// This is a server-side script to be run manually from the terminal.
// It creates the initial 'owner' user in the Firestore database.

import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/firebase/admin';

// --- CONFIGURATION ---
const OWNER_USERNAME = 'admin';
const OWNER_PASSWORD = 'password'; // You should change this after your first login.
// ---------------------

async function createOwner() {
  try {
    console.log("Connecting to Firestore...");
    const firestore = getFirestore(adminApp);
    const usersRef = firestore.collection('users');

    console.log(`Checking for existing user: '${OWNER_USERNAME}'...`);
    const existingUserQuery = await usersRef.where('username', '==', OWNER_USERNAME).limit(1).get();

    if (!existingUserQuery.empty) {
      console.log(`User '${OWNER_USERNAME}' already exists.`);
      const ownerDoc = existingUserQuery.docs[0];
      await ownerDoc.ref.update({
        role: 'owner',
        password: OWNER_PASSWORD, // Ensure password and role are correct
      });
      console.log(`Updated user '${OWNER_USERNAME}' to ensure they have the 'owner' role.`);
      return;
    }

    console.log(`Creating owner user '${OWNER_USERNAME}'...`);
    await usersRef.add({
      username: OWNER_USERNAME,
      password: OWNER_PASSWORD, // Storing password in plain text as requested by the hybrid model.
      role: 'owner',
      createdAt: new Date(),
      expiresAt: null, // Owner does not expire.
      assignedServerId: null,
    });

    console.log("-----------------------------------------");
    console.log("✅ Success!");
    console.log(`Owner user created with credentials:`);
    console.log(`   Username: ${OWNER_USERNAME}`);
    console.log(`   Password: ${OWNER_PASSWORD}`);
    console.log("-----------------------------------------");
    console.log("You can now run 'npm run dev' and log in.");

  } catch (error) {
    console.error("❌ An error occurred while creating the owner user:", error);
    process.exit(1);
  }
}

createOwner().then(() => {
    // Manually exit the process to prevent hanging
    process.exit(0);
});
