// FormatFlip Authentication Module

class AuthManager {
    constructor() {
        this.user = null;
        this.init();
    }

    init() {
        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            console.warn('Firebase not loaded - running in demo mode');
            return;
        }

        // Listen for auth state changes
        firebase.auth().onAuthStateChanged((user) => {
            this.user = user;
            this.updateUI(user);
        });
    }

    updateUI(user) {
        const loginBtn = document.getElementById('loginBtn');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');

        if (user) {
            // User is signed in
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            if (userName) userName.textContent = user.displayName || user.email.split('@')[0];

            // Close auth modal if open
            this.closeAuthModal();
        } else {
            // User is signed out
            if (loginBtn) loginBtn.style.display = 'flex';
            if (userInfo) userInfo.style.display = 'none';
        }
    }

    async login(email, password) {
        try {
            const result = await firebase.auth().signInWithEmailAndPassword(email, password);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    async register(name, email, password) {
        try {
            const result = await firebase.auth().createUserWithEmailAndPassword(email, password);

            // Update display name
            await result.user.updateProfile({
                displayName: name
            });

            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    async loginWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await firebase.auth().signInWithPopup(provider);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    async logout() {
        try {
            await firebase.auth().signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async resetPassword(email) {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            return { success: true };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    getErrorMessage(code) {
        const messages = {
            'auth/email-already-in-use': 'This email is already registered. Please sign in.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/popup-closed-by-user': 'Sign in was cancelled.',
            'auth/network-request-failed': 'Network error. Please check your connection.'
        };
        return messages[code] || 'An error occurred. Please try again.';
    }

    showAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    isLoggedIn() {
        return this.user !== null;
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// DOM Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => authManager.showAuthModal());
    }

    // Close modal button
    const closeAuthModal = document.getElementById('closeAuthModal');
    if (closeAuthModal) {
        closeAuthModal.addEventListener('click', () => authManager.closeAuthModal());
    }

    // Close modal on background click
    const authModal = document.getElementById('authModal');
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authManager.closeAuthModal();
            }
        });
    }

    // Tab switching
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetForm = tab.dataset.tab;

            // Update tabs
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update forms
            document.querySelectorAll('.auth-form').forEach(form => {
                form.classList.remove('active');
            });
            document.getElementById(targetForm + 'Form')?.classList.add('active');
        });
    });

    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorDiv = document.getElementById('loginError');

            const result = await authManager.login(email, password);
            if (!result.success) {
                errorDiv.textContent = result.error;
                errorDiv.style.display = 'block';
            }
        });
    }

    // Register form submission
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const errorDiv = document.getElementById('registerError');

            const result = await authManager.register(name, email, password);
            if (!result.success) {
                errorDiv.textContent = result.error;
                errorDiv.style.display = 'block';
            }
        });
    }

    // Google sign in buttons
    document.querySelectorAll('.google-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const result = await authManager.loginWithGoogle();
            if (!result.success) {
                alert(result.error);
            }
        });
    });

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => authManager.logout());
    }

    // Forgot password link
    const forgotPassword = document.getElementById('forgotPassword');
    if (forgotPassword) {
        forgotPassword.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            if (!email) {
                alert('Please enter your email address first.');
                return;
            }
            const result = await authManager.resetPassword(email);
            if (result.success) {
                alert('Password reset email sent. Please check your inbox.');
            } else {
                alert(result.error);
            }
        });
    }
});
