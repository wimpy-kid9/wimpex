import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// FIREBASE_SERVICE_ACCOUNT holds the full service-account JSON (the file
// you download from Firebase Console → Project Settings → Service Accounts
// → Generate new private key), stored as a single-line env var. Same
// project as the google-services.json bundled into the Android app.
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

let app: App | null = null;

if (serviceAccountJson) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT', err);
  }
}

export const isFirebaseConfigured = Boolean(app);
export const messaging = app ? getMessaging(app) : null;

if (!isFirebaseConfigured) {
  console.warn('Firebase push is disabled: FIREBASE_SERVICE_ACCOUNT is not configured or could not be parsed.');
}
