import { initializeApp, getApps, App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

// This is a server-side only file.

export function initializeAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  
  // This will use the GOOGLE_APPLICATION_CREDENTIALS environment variable
  // automatically provided by Firebase App Hosting.
  return initializeApp();
}
