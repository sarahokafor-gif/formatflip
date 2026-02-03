#!/bin/bash
# Build script for Cloudflare Pages deployment
# Generates firebase-config.js from environment variables

cat > firebase-config.js << FIREBASE
/**
 * Firebase Configuration for FormatFlip
 * Auto-generated from environment variables - do not commit
 */

const firebaseConfig = {
    apiKey: "${FIREBASE_API_KEY}",
    authDomain: "${FIREBASE_AUTH_DOMAIN}",
    projectId: "${FIREBASE_PROJECT_ID}",
    storageBucket: "${FIREBASE_STORAGE_BUCKET}",
    messagingSenderId: "${FIREBASE_MESSAGING_SENDER_ID}",
    appId: "${FIREBASE_APP_ID}",
    measurementId: "${FIREBASE_MEASUREMENT_ID}"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export auth instance
const auth = firebase.auth();
FIREBASE

echo "Firebase config generated successfully"
