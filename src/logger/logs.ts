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
    if (!process.env.IS_DEVELOPMENT) {
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
    } else {
        console.log("Currently in development mode. Logs will not be written");
    }
} catch (error) {
    firestoreLogs = null;
    console.log("Failed to connect to Firebase. Logs will not be written.", error);
}

export type HarmonyLogger = {
    INFO(message: string, kv?: Record<string, number | string | boolean>): void,
    WARN(message: string, kv?: Record<string, number | string | boolean>): void
    ERROR(message: string, kv?: Record<string, number | string | boolean>): void
    WITH(kv: Record<string, number | string | boolean>): HarmonyLogger
}

export function makeLogger(kv?: Record<string, unknown>): HarmonyLogger {
    const keyValues = Object.assign({}, kv);
    return {
        INFO(message: string, kv?: Record<string, unknown>) {
            const logBody = {
                ...keyValues,
                ...kv ?? {},
                message: message,
                service: "harmonylang-server",
                timestamp: new Date(),
                level: "INFO",
            };
            if (firestoreLogs) {
                firestoreLogs.add(logBody).catch(e => console.log(e));
            } else {
                console.log(logBody);
            }
        },
        WARN(message: string, kv?: Record<string, unknown>) {
            const logBody = {
                ...keyValues,
                ...kv ?? {},
                message: message,
                service: "harmonylang-server",
                timestamp: new Date(),
                level: "WARN",
            };
            if (firestoreLogs) {
                firestoreLogs.add(logBody).catch(e => console.log(e));
            } else {
                console.log(logBody);
            }
        },
        ERROR(message: string, kv?: Record<string, unknown>) {
            const logBody = {
                ...keyValues,
                ...kv ?? {},
                message: message,
                service: "harmonylang-server",
                timestamp: new Date(),
                level: "ERROR",
            };
            if (firestoreLogs) {
                firestoreLogs.add(logBody).catch(e => console.log(e));
            } else {
                console.log(logBody);
            }
        },
        WITH(kv: Record<string, unknown>) {
            return makeLogger({
                ...keyValues,
                ...kv
            });
        }
    }
}

export const logClient = makeLogger();
