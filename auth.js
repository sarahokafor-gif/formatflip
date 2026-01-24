// FormatFlip Authentication Module

class AuthManager {
    constructor() {
        this.user = null;
        this.isLoginMode = true;
        this.init();
    }

    init() {
        // Check if Firebase is loaded
        if (typeof firebase === 'undefined') {
            console.warn('Firebase not loaded - running in demo mode');
            this.hideAuthModal();
            return;
        }

        // Listen for auth state changes
        firebase.auth().onAuthStateChanged((user) => {
            this.user = user;
            if (user) {
                // User is signed in - hide modal and show app
                this.hideAuthModal();
                this.updateUserUI(user);
            } else {
                // User is signed out - show auth modal
                this.showAuthModal();
            }
        });
    }

    updateUserUI(user) {
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userEmail = document.getElementById('userEmail');
        const userInitial = document.querySelector('.user-initial');

        if (userMenuBtn) userMenuBtn.classList.remove('hidden');
        if (userEmail) userEmail.textContent = user.email;
        if (userInitial) userInitial.textContent = (user.displayName || user.email)[0].toUpperCase();
    }

    async login(email, password) {
        try {
            const result = await firebase.auth().signInWithEmailAndPassword(email, password);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, error: this.getErrorMessage(error.code) };
        }
    }

    async register(email, password) {
        try {
            const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
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
            'auth/email-already-in-use': 'This email is already registered. Please log in.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/invalid-credential': 'Invalid email or password. Please try again.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.'
        };
        return messages[code] || 'An error occurred. Please try again.';
    }

    showAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    hideAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        const authTitle = document.getElementById('authTitle');
        const authSubtitle = document.getElementById('authSubtitle');
        const authSubmitBtn = document.getElementById('authSubmitBtn');
        const authSwitchText = document.getElementById('authSwitchText');
        const authSwitchBtn = document.getElementById('authSwitchBtn');
        const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
        const disclaimerBox = document.getElementById('disclaimerBox');
        const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

        if (this.isLoginMode) {
            if (authTitle) authTitle.textContent = 'Welcome Back';
            if (authSubtitle) authSubtitle.textContent = 'Log in to access FormatFlip';
            if (authSubmitBtn) authSubmitBtn.textContent = 'Log In';
            if (authSwitchText) authSwitchText.textContent = "Don't have an account?";
            if (authSwitchBtn) authSwitchBtn.textContent = 'Register for free';
            if (confirmPasswordGroup) confirmPasswordGroup.classList.add('hidden');
            if (disclaimerBox) disclaimerBox.classList.add('hidden');
            if (forgotPasswordBtn) forgotPasswordBtn.classList.remove('hidden');
        } else {
            if (authTitle) authTitle.textContent = 'Create Account';
            if (authSubtitle) authSubtitle.textContent = 'Register for free access';
            if (authSubmitBtn) authSubmitBtn.textContent = 'Register';
            if (authSwitchText) authSwitchText.textContent = 'Already have an account?';
            if (authSwitchBtn) authSwitchBtn.textContent = 'Log in';
            if (confirmPasswordGroup) confirmPasswordGroup.classList.remove('hidden');
            if (disclaimerBox) disclaimerBox.classList.remove('hidden');
            if (forgotPasswordBtn) forgotPasswordBtn.classList.add('hidden');
        }

        // Clear any errors
        const authError = document.getElementById('authError');
        if (authError) authError.classList.add('hidden');
    }

    isLoggedIn() {
        return this.user !== null;
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// DOM Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Auth form submission
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;
            const authError = document.getElementById('authError');
            const submitBtn = document.getElementById('authSubmitBtn');

            // Disable button during auth
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = authManager.isLoginMode ? 'Logging in...' : 'Registering...';
            }

            let result;
            if (authManager.isLoginMode) {
                result = await authManager.login(email, password);
            } else {
                // Check confirm password
                const confirmPassword = document.getElementById('authConfirmPassword').value;
                if (password !== confirmPassword) {
                    if (authError) {
                        authError.textContent = 'Passwords do not match.';
                        authError.classList.remove('hidden');
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Register';
                    }
                    return;
                }

                // Check terms checkbox
                const termsCheckbox = document.getElementById('termsCheckbox');
                if (termsCheckbox && !termsCheckbox.checked) {
                    if (authError) {
                        authError.textContent = 'Please accept the terms to continue.';
                        authError.classList.remove('hidden');
                    }
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Register';
                    }
                    return;
                }

                result = await authManager.register(email, password);
            }

            if (!result.success) {
                if (authError) {
                    authError.textContent = result.error;
                    authError.classList.remove('hidden');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = authManager.isLoginMode ? 'Log In' : 'Register';
                }
            }
            // If success, onAuthStateChanged will handle hiding modal
        });
    }

    // Switch between login and register
    const authSwitchBtn = document.getElementById('authSwitchBtn');
    if (authSwitchBtn) {
        authSwitchBtn.addEventListener('click', () => authManager.toggleMode());
    }

    // Forgot password
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener('click', () => {
            document.getElementById('loginRegisterView').classList.add('hidden');
            document.getElementById('resetPasswordView').classList.remove('hidden');
        });
    }

    // Back to login from reset
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => {
            document.getElementById('resetPasswordView').classList.add('hidden');
            document.getElementById('loginRegisterView').classList.remove('hidden');
        });
    }

    // Reset password form
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('resetEmail').value;
            const resetError = document.getElementById('resetError');
            const resetSuccess = document.getElementById('resetSuccess');

            const result = await authManager.resetPassword(email);
            if (result.success) {
                if (resetSuccess) {
                    resetSuccess.textContent = 'Password reset email sent. Check your inbox.';
                    resetSuccess.classList.remove('hidden');
                }
                if (resetError) resetError.classList.add('hidden');
            } else {
                if (resetError) {
                    resetError.textContent = result.error;
                    resetError.classList.remove('hidden');
                }
                if (resetSuccess) resetSuccess.classList.add('hidden');
            }
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => authManager.logout());
    }

    // User menu toggle
    const userMenuTrigger = document.querySelector('.user-menu-trigger');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuTrigger && userDropdown) {
        userMenuTrigger.addEventListener('click', () => {
            userDropdown.classList.toggle('hidden');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                userDropdown.classList.add('hidden');
            }
        });
    }
});
