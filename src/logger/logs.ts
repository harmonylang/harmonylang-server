import admin from 'firebase-admin';
import 'firebase/firestore';

const credentials = {
    type: "service_account",
    project_id: "harmonylang-server",
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
};

// Initialize Firebase
let firestoreLogs: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData> | null = null;
try {
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
    admin.initializeApp(firebaseConfig);
    firestoreLogs = admin.firestore().collection("harmonylang-logs");
    console.log("Successfully connected to Firebase. Logs will be written");
} catch (error) {
    firestoreLogs = null;
    console.log("Failed to connect to Firebase. Logs will not be written.", error);
}

export const logClient = {
    INFO(message: string, kv?: Record<string, unknown>) {
        firestoreLogs?.add(Object.assign(kv ?? {}, {
            message: message,
            service: "harmonylang-server",
            timestamp: new Date(),
            level: "INFO",
        }))?.catch(e => console.log(e));
    },
    WARN(message: string, kv?: Record<string, unknown>) {
        firestoreLogs?.add(Object.assign(kv ?? {}, {
            message: message,
            service: "harmonylang-server",
            timestamp: new Date(),
            level: "WARN",
        }))?.catch(e => console.log(e));
    },
    ERROR(message: string, kv?: Record<string, unknown>) {
        firestoreLogs?.add(Object.assign(kv ?? {}, {
            message: message,
            service: "harmonylang-server",
            timestamp: new Date(),
            level: "ERROR",
        }))?.catch(e => console.log(e));
    }
}
