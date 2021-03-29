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
let firestoreClient: FirebaseFirestore.Firestore | null = null;
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
const SUPPRESS_LOGS = process.env.SUPPRESS_LOGS && process.env.SUPPRESS_LOGS.toLowerCase() === "true"
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
            } else if (!SUPPRESS_LOGS) {
                console.log(data);
            }
        }
    }
}
