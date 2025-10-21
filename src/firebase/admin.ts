import { initializeApp, getApps, App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

// This is a server-side only file.

// Create a singleton instance of the Firebase Admin App
let adminApp: App;

if (!getApps().length) {
  adminApp = initializeApp({
    credential: credential.applicationDefault(),
  });
} else {
  adminApp = getApps()[0];
}

export { adminApp };
