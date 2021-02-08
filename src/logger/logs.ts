import firebase from 'firebase/app';

import 'firebase/firestore';

import { Logger } from '@firebase/logger';

// TODO: Replace the following with your app's Firebase project configuration
// For Firebase JavaScript SDK v7.20.0 and later, `measurementId` is an optional field
const firebaseConfig = {
    apiKey: "AIzaSyA2rapCh3dOBlHckBh3SfHIqYHEOyvQ0Kc",
    authDomain: "harmonylang-server.firebaseapp.com",
    projectId: "harmonylang-server",
    storageBucket: "harmonylang-server.appspot.com",
    messagingSenderId: "455127114629",
    appId: "1:455127114629:web:7a10fe70630010fb3c5aec",
    measurementId: "G-RBD4SXWPS4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
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
