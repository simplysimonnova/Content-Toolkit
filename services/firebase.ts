import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Fix: Standardizing the modular import for getAuth to ensure correct resolution from the Firebase SDK
import { getAuth } from "firebase/auth";

/**
 * These values match the "Content Toolkit" Web App registered in the 
 * "content-toolkit" Firebase project as shown in the user's setup screenshot.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBvpzieVJMTCpGBlm9c7g2WHZVrvbi5TSg",
  authDomain: "content-toolkit.firebaseapp.com",
  projectId: "content-toolkit",
  storageBucket: "content-toolkit.firebasestorage.app",
  messagingSenderId: "25542085498",
  appId: "1:25542085498:web:ad70614315b134f23ee4c3",
  measurementId: "G-0XMY897TLZ"
};

// Robust initialization check
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;