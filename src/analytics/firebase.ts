import admin from 'firebase-admin';
import 'firebase/firestore';
import config from "../config";


// Initialize Firebase
let firestoreClient: FirebaseFirestore.Firestore | null = null;
try {
    if (config.isProduction()) {
        const firebaseConfig = {
            apiKey: "AIzaSyA2rapCh3dOBlHckBh3SfHIqYHEOyvQ0Kc",
            authDomain: "harmonylang-server.firebaseapp.com",
            projectId: "harmonylang-server",
            storageBucket: "harmonylang-server.appspot.com",
            messagingSenderId: "455127114629",
            appId: "1:455127114629:web:7a10fe70630010fb3c5aec",
            measurementId: "G-RBD4SXWPS4",
            credential: admin.credential.cert(config.FIREBASE_CREDENTIALS as any)
        };
        admin.initializeApp(firebaseConfig);
        firestoreClient = admin.firestore();
        console.log("Successfully connected to Firebase. Logs will be written");
    } else {
        console.log("Currently in development mode. Logs will not be written to Firebase");
    }
} catch (error) {
    firestoreClient = null;
    console.log("Failed to connect to Firebase. Logs will not be written.", error);
}

const firebaseCollections: Record<string, admin.firestore.CollectionReference> = {};
export type RecordableValues = number | string | boolean | Date;
export type RecordableObject = Record<string, RecordableValues>;
type CollectionWriter<T extends RecordableObject> = {
    add(data: T): void;
}

export function makeCollection<T extends RecordableObject>(name: string): CollectionWriter<T> {
    if (firebaseCollections[name]) {
        throw new Error(`There is already collection named ${name}`);
    }
    if (firestoreClient) {
        firebaseCollections[name] = firestoreClient.collection(name);
    }
    return {
        add(data: T) {
            const collection = firebaseCollections[name]
            if (collection) {
                collection.add(data).catch(console.log);
            } else if (!config.SUPPRESS_LOGS) {
                console.log(data);
            }
        }
    }
}
