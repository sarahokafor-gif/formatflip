/**
 * Firebase Configuration for FormatFlip
 * Uses same Firebase project as Court Bundle Builder, Chronology Builder, and SplitSmart
 * Users can log in with the same account for all apps
 */

const firebaseConfig = {
    apiKey: "AIzaSyCyImZnSeMTv4LUuHMW4eTsl5CK80SjoEA",
    authDomain: "court-bundle-builder.firebaseapp.com",
    projectId: "court-bundle-builder",
    storageBucket: "court-bundle-builder.firebasestorage.app",
    messagingSenderId: "726821679089",
    appId: "1:726821679089:web:19efdaf18b05eb3f1e1e50",
    measurementId: "G-M64BBWRBYC"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export auth instance
const auth = firebase.auth();
