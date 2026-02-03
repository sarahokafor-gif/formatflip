/**
 * Firebase Configuration for FormatFlip
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to firebase-config.js
 * 2. Replace the placeholder values with your Firebase config
 * 
 * For Cloudflare Pages deployment:
 * - Set environment variables in Cloudflare Pages dashboard
 * - The build script will generate firebase-config.js automatically
 */

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export auth instance
const auth = firebase.auth();
