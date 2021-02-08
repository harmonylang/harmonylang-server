import admin from 'firebase-admin';
import 'firebase/firestore';
import serviceAccount from "../../resource/harmonylang-server-firebase-adminsdk-q60bw-b1e17167ad.json";

const firebaseConfig = {
    apiKey: "AIzaSyA2rapCh3dOBlHckBh3SfHIqYHEOyvQ0Kc",
    authDomain: "harmonylang-server.firebaseapp.com",
    projectId: "harmonylang-server",
    storageBucket: "harmonylang-server.appspot.com",
    messagingSenderId: "455127114629",
    appId: "1:455127114629:web:7a10fe70630010fb3c5aec",
    measurementId: "G-RBD4SXWPS4",
    credential: admin.credential.cert(serviceAccount as any)
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
