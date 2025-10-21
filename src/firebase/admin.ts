import { initializeApp, getApps, App, applicationDefault } from 'firebase-admin/app';

// This is a server-side only file.

let adminApp: App;

if (!getApps().length) {
  // This initializes the Admin SDK using the service account credentials
  // automatically provided by the App Hosting environment.
  adminApp = initializeApp({
    credential: applicationDefault(),
  });
} else {
  adminApp = getApps()[0];
}

export { adminApp };
