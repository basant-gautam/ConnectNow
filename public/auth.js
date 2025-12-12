// DOM Elements
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');
const usernameSpan = document.getElementById('username');

// Validation
function validatePassword(password) {
    if (password.length < 6) {
        return 'Password must be at least 6 characters long';
    }
    return null;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return 'Please enter a valid email address';
    }
    return null;
}

function validateUsername(username) {
    if (username.length < 3) {
        return 'Username must be at least 3 characters long';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
}

// Show/Hide Forms
function showLogin() {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginError.classList.add('hidden');
}

function showSignup() {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    signupError.classList.add('hidden');
}

// Show Error Message
function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
}

// Check Authentication Status
async function checkAuth() {
    try {
        const response = await fetch('/api/user', {
            credentials: 'include'
        });

        if (response.ok) {
            const user = await response.json();
            showApp(user);
        } else {
            showAuth();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showAuth();
    }
}

// Show App or Auth Container
function showAuth() {
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
}

function showApp(user) {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    if (user && user.username) {
        usernameSpan.textContent = user.username;
    }
}

// Handle Login
async function handleLogin(event) {
    event.preventDefault();
    loginError.classList.add('hidden');
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    // Validate input
    const emailError = validateEmail(email);
    if (emailError) {
        showError(loginError, emailError);
        return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
        showError(loginError, passwordError);
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                showError(loginError, data.error || 'Login failed');
            } else {
                showError(loginError, 'Server error. Please try again later.');
            }
            return;
        }

        const data = await response.json();
        showApp(data.user);
    } catch (error) {
        console.error('Login failed:', error);
        showError(loginError, 'Network error. Please check your connection.');
    }
}

// Handle Signup
async function handleSignup(event) {
    event.preventDefault();
    signupError.classList.add('hidden');
    
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    
    // Validate input
    const usernameError = validateUsername(username);
    if (usernameError) {
        showError(signupError, usernameError);
        return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
        showError(signupError, emailError);
        return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
        showError(signupError, passwordError);
        return;
    }
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, email, password })
        });

        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                showError(signupError, data.error || 'Signup failed');
            } else {
                showError(signupError, 'Server error. Please try again later.');
            }
            return;
        }

        const data = await response.json();
        showApp(data.user);
    } catch (error) {
        console.error('Signup failed:', error);
        showError(signupError, 'Network error. Please check your connection.');
    }
}

// Handle Logout
async function handleLogout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('Logout failed:', await response.text());
        }
        
        showAuth();
    } catch (error) {
        console.error('Logout failed:', error);
        showAuth();
    }
}

// Check auth status when page loads
document.addEventListener('DOMContentLoaded', checkAuth); 