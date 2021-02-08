import admin from 'firebase-admin';
import 'firebase/firestore';

const credentials = {
    type: "service_account",
    project_id: "harmonylang-server",
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY,
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
};

const firebaseConfig = {
    apiKey: "AIzaSyA2rapCh3dOBlHckBh3SfHIqYHEOyvQ0Kc",
    authDomain: "harmonylang-server.firebaseapp.com",
    projectId: "harmonylang-server",
    storageBucket: "harmonylang-server.appspot.com",
    messagingSenderId: "455127114629",
    appId: "1:455127114629:web:7a10fe70630010fb3c5aec",
    measurementId: "G-RBD4SXWPS4",
    credential: admin.credential.cert(credentials as any)
};

// Initialize Firebase
admin.initializeApp(firebaseConfig);
const firestore = admin.firestore();
const firestoreLogs = firestore.collection("harmonylang-logs");

export const logClient = {
    INFO(message: string, kv?: Record<string, unknown>) {
        firestoreLogs.add(Object.assign(kv ?? {}, {
            message: message,
            service: "harmonylang-server",
            timestamp: new Date(),
            level: "INFO",
        })).catch(e => console.log(e));
        console.log(message);
    },
    WARN(message: string, kv?: Record<string, unknown>) {
        firestoreLogs.add(Object.assign(kv ?? {}, {
            message: message,
            service: "harmonylang-server",
            timestamp: new Date(),
            level: "WARN",
        })).catch(e => console.log(e));
    },
    ERROR(message: string, kv?: Record<string, unknown>) {
        firestoreLogs.add(Object.assign(kv ?? {}, {
            message: message,
            service: "harmonylang-server",
            timestamp: new Date(),
            level: "ERROR",
        })).catch(e => console.log(e));
    }
}
