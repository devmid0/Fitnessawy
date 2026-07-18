/* ============================================
   Fitnessawy — Auth Gateway (Firebase v10)
   Fail-safe: UI bootstraps FIRST, Firebase
   loads dynamically so a CDN failure cannot
   kill the entire auth gateway.
   ============================================ */

console.warn("SYSTEM ALIVE: JS is correctly linked to HTML.");
console.log('[Auth] Auth System Booting...');

/* ── Firebase (loaded dynamically) ─────── */

let auth = null;
let googleProvider = null;
let firebaseReady = false;

const firebaseConfig = {
  apiKey: "AIzaSyBSkk1IbeS-94MLAXZVnnhFYEeQkh9Yy50",
  authDomain: "fitnessawy-1.firebaseapp.com",
  projectId: "fitnessawy-1",
  storageBucket: "fitnessawy-1.firebasestorage.app",
  messagingSenderId: "783539288085",
  appId: "1:783539288085:web:89a587fbe936637f74761c"
};

async function loadFirebase() {
  console.log('[Auth] Loading Firebase from CDN...');
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const firebaseAuth = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

    const app = initializeApp(firebaseConfig);
    auth = firebaseAuth.getAuth(app);
    googleProvider = new firebaseAuth.GoogleAuthProvider();

    /* store refs for submit handlers */
    window.__forgeAuth = {
      signInWithEmailAndPassword: firebaseAuth.signInWithEmailAndPassword,
      createUserWithEmailAndPassword: firebaseAuth.createUserWithEmailAndPassword,
      updateProfile: firebaseAuth.updateProfile,
      updatePassword: firebaseAuth.updatePassword,
      deleteUser: firebaseAuth.deleteUser,
      sendPasswordResetEmail: firebaseAuth.sendPasswordResetEmail,
      signInWithPopup: firebaseAuth.signInWithPopup,
      onAuthStateChanged: firebaseAuth.onAuthStateChanged,
      signOut: firebaseAuth.signOut,
      getAuth: firebaseAuth.getAuth
    };

    firebaseReady = true;
    console.log('[Auth] Firebase loaded successfully.');
    initAuthListener();
  } catch (err) {
    console.error('[Auth] FAILED to load Firebase:', err);
    console.warn('[Auth] UI will still work. Firebase auth is unavailable.');
  }
}

/* ── DOM Refs ──────────────────────────── */

let gateway, appCore;
let loginForm, signUpForm;
let toggleBtns, toggleSlider;
let loginEmail, loginPass;
let signupName, signupEmail, signupPass, signupConfirm;
let loginEmailErr, loginPassErr;
let signupNameErr, signupEmailErr, signupPassErr, signupConfirmErr;
let btnLogin, btnSignUp;
let btnGoogleAuth, btnForgotPass;

function cacheDom() {
  console.log('[Auth] Caching DOM refs...');
  gateway          = document.getElementById('auth-gateway');
  appCore          = document.getElementById('app-core');
  loginForm        = document.getElementById('authLoginForm');
  signUpForm       = document.getElementById('authSignUpForm');
  toggleBtns       = document.querySelectorAll('.auth-toggle-btn');
  toggleSlider     = document.querySelector('.auth-toggle-slider');
  loginEmail       = document.getElementById('loginEmail');
  loginPass        = document.getElementById('loginPass');
  signupName       = document.getElementById('signupName');
  signupEmail      = document.getElementById('signupEmail');
  signupPass       = document.getElementById('signupPass');
  signupConfirm    = document.getElementById('signupConfirm');
  loginEmailErr    = document.getElementById('loginEmailError');
  loginPassErr     = document.getElementById('loginPassError');
  signupNameErr    = document.getElementById('signupNameError');
  signupEmailErr   = document.getElementById('signupEmailError');
  signupPassErr    = document.getElementById('signupPassError');
  signupConfirmErr = document.getElementById('signupConfirmError');
  btnLogin         = document.getElementById('btnLogin');
  btnSignUp        = document.getElementById('btnSignUp');
  btnGoogleAuth    = document.getElementById('btnGoogleAuth');
  btnForgotPass    = document.getElementById('btnForgotPass');

  console.log('[Auth] DOM refs cached.',
    'gateway:', !!gateway,
    'appCore:', !!appCore,
    'loginForm:', !!loginForm,
    'signUpForm:', !!signUpForm,
    'btnLogin:', !!btnLogin,
    'btnSignUp:', !!btnSignUp,
    'btnGoogleAuth:', !!btnGoogleAuth
  );
}

/* ──────────────────────────────────────────
   THE SHIELD — display toggle ONLY
   ────────────────────────────────────────── */

function initAuthListener() {
  if (!firebaseReady || !auth) {
    console.warn('[Auth] Cannot init auth listener — Firebase not ready.');
    return;
  }
  console.log('[Auth] Registering onAuthStateChanged listener...');
  window.__forgeAuth.onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('[Auth] User authenticated:', user.email);
      gateway.style.display = 'none';
      appCore.style.display = 'block';

      if (typeof window.bootMainApp === 'function') {
        window.bootMainApp(user);
      } else {
        console.error('[Auth] FATAL: window.bootMainApp is not defined. UI will not render.');
      }
    } else {
      console.log('[Auth] No user — showing gateway.');
      appCore.style.display = 'none';
      gateway.style.display = 'flex';
    }
  });
}

/* ── Tab Toggle ────────────────────────── */

function switchTab(tab) {
  console.log('[Auth] Toggle clicked — switching to:', tab);
  toggleBtns.forEach((b) => b.classList.remove('active'));

  const targetBtn = document.querySelector('.auth-toggle-btn[data-auth-tab="' + tab + '"]');
  if (targetBtn) targetBtn.classList.add('active');

  if (tab === 'login') {
    toggleSlider.style.transform = 'translateX(0)';
    loginForm.classList.add('active');
    signUpForm.classList.remove('active');
  } else {
    toggleSlider.style.transform = 'translateX(100%)';
    signUpForm.classList.add('active');
    loginForm.classList.remove('active');
  }

  clearAllErrors();
}

/* ── Validation Helpers ────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setError(el, msg) {
  el.textContent = msg;
  el.classList.add('visible');
  const input = el.previousElementSibling;
  if (input && input.classList.contains('form-input')) {
    input.classList.add('input-error');
  }
}

function clearError(el) {
  el.textContent = '';
  el.classList.remove('visible');
  const input = el.previousElementSibling;
  if (input && input.classList.contains('form-input')) {
    input.classList.remove('input-error');
  }
}

function clearAllErrors() {
  [loginEmailErr, loginPassErr, signupNameErr, signupEmailErr, signupPassErr, signupConfirmErr]
    .forEach(clearError);
}

/* ── Login Validation ──────────────────── */

function validateLogin() {
  let valid = true;
  clearAllErrors();

  const email = loginEmail.value.trim();
  if (!email) {
    setError(loginEmailErr, 'Email is required');
    valid = false;
  } else if (!EMAIL_RE.test(email)) {
    setError(loginEmailErr, 'Enter a valid email address');
    valid = false;
  }

  const pass = loginPass.value;
  if (!pass) {
    setError(loginPassErr, 'Password is required');
    valid = false;
  } else if (pass.length < 6) {
    setError(loginPassErr, 'Password must be at least 6 characters');
    valid = false;
  }

  return valid;
}

/* ── Sign Up Validation ────────────────── */

function validateSignUp() {
  let valid = true;
  clearAllErrors();

  const name = signupName.value.trim();
  if (!name) {
    setError(signupNameErr, 'Display name is required');
    valid = false;
  } else if (name.length < 2) {
    setError(signupNameErr, 'Name must be at least 2 characters');
    valid = false;
  }

  const email = signupEmail.value.trim();
  if (!email) {
    setError(signupEmailErr, 'Email is required');
    valid = false;
  } else if (!EMAIL_RE.test(email)) {
    setError(signupEmailErr, 'Enter a valid email address');
    valid = false;
  }

  const pass = signupPass.value;
  if (!pass) {
    setError(signupPassErr, 'Password is required');
    valid = false;
  } else if (pass.length < 6) {
    setError(signupPassErr, 'Password must be at least 6 characters');
    valid = false;
  }

  const confirm = signupConfirm.value;
  if (!confirm) {
    setError(signupConfirmErr, 'Please confirm your password');
    valid = false;
  } else if (confirm !== pass) {
    setError(signupConfirmErr, 'Passwords do not match');
    valid = false;
  }

  return valid;
}

/* ── Button Loading State ──────────────── */

function setLoading(btn, loading) {
  const label = btn.querySelector('.auth-btn-label');
  const spinner = btn.querySelector('.auth-btn-spinner');
  if (loading) {
    btn.disabled = true;
    btn.classList.add('loading');
    label.style.display = 'none';
    spinner.style.display = '';
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    label.style.display = '';
    spinner.style.display = 'none';
  }
}

/* ── Firebase Error Mapping ────────────── */

function firebaseErrorMessage(code) {
  const map = {
    'auth/user-not-found':            'No account found with this email.',
    'auth/wrong-password':            'Incorrect password. Please try again.',
    'auth/invalid-credential':        'Invalid email or password.',
    'auth/email-already-in-use':      'An account with this email already exists.',
    'auth/weak-password':             'Password must be at least 6 characters.',
    'auth/invalid-email':             'Enter a valid email address.',
    'auth/too-many-requests':         'Too many attempts. Please try again later.',
    'auth/network-request-failed':    'Network error. Check your connection.',
    'auth/popup-closed-by-user':      'Sign-in popup was closed. Try again.',
    'auth/cancelled-popup-request':   'Sign-in cancelled.',
    'auth/popup-blocked':             'Popup was blocked. Allow popups for this site.'
  };
  return map[code] || 'Something went wrong. Please try again.';
}

/* ──────────────────────────────────────────
   FIREBASE AUTH — isolated event handlers
   ────────────────────────────────────────── */

async function onLoginSubmit(e) {
  e.preventDefault();
  console.log('[Auth] Login button clicked, attempting Firebase auth...');

  if (!validateLogin()) {
    console.log('[Auth] Login validation failed.');
    return;
  }

  if (!firebaseReady) {
    console.error('[Auth] Firebase not loaded — cannot authenticate.');
    setError(loginPassErr, 'Authentication service unavailable. Please reload.');
    return;
  }

  setLoading(btnLogin, true);

  try {
    console.log('[Auth] Calling signInWithEmailAndPassword...');
    await window.__forgeAuth.signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPass.value);
    console.log('[Auth] Login successful.');
  } catch (err) {
    console.error('[Auth] Login failed:', err.code, err.message);
    setError(loginPassErr, firebaseErrorMessage(err.code));
  } finally {
    setLoading(btnLogin, false);
  }
}

async function onSignUpSubmit(e) {
  e.preventDefault();
  console.log('[Auth] Sign Up button clicked, attempting Firebase auth...');

  if (!validateSignUp()) {
    console.log('[Auth] Sign Up validation failed.');
    return;
  }

  if (!firebaseReady) {
    console.error('[Auth] Firebase not loaded — cannot create account.');
    setError(signupEmailErr, 'Authentication service unavailable. Please reload.');
    return;
  }

  setLoading(btnSignUp, true);

  try {
    console.log('[Auth] Calling createUserWithEmailAndPassword...');
    const cred = await window.__forgeAuth.createUserWithEmailAndPassword(
      auth,
      signupEmail.value.trim(),
      signupPass.value
    );
    console.log('[Auth] Account created. Setting display name...');
    await window.__forgeAuth.updateProfile(cred.user, { displayName: signupName.value.trim() });
    console.log('[Auth] Sign up complete.');
  } catch (err) {
    console.error('[Auth] Sign up failed:', err.code, err.message);
    setError(signupEmailErr, firebaseErrorMessage(err.code));
  } finally {
    setLoading(btnSignUp, false);
  }
}

async function onGoogleAuth() {
  console.log("⏳ Google Auth Initiated...");
  try {
    const result = await window.__forgeAuth.signInWithPopup(auth, googleProvider);
    console.log("✅ Google Auth Success:", result.user.email);
  } catch (error) {
    console.error("❌ GOOGLE AUTH FATAL ERROR:", error.code, error.message);
    await window.ForgeDialog.alert('Google Login Failed', error.message);
  }
}

function onForgotPassword() {
  console.log('[Auth] Forgot password clicked.');
  const email = loginEmail.value.trim();
  if (!email) {
    window.ForgeDialog.alert('Email Required', 'Please enter your email address in the field first.').then(() => {
      loginEmail.focus();
    });
    return;
  }
  if (!window.__forgeAuth || !firebaseReady || !auth) {
    window.ForgeDialog.alert('Unavailable', 'Firebase is not available. Please try again later.');
    return;
  }
  window.__forgeAuth.sendPasswordResetEmail(auth, email)
    .then(() => {
      window.ForgeDialog.alert('Reset Link Sent', 'A real password reset link has been sent to your email. Check your spam folder if necessary.');
      btnForgotPass.textContent = 'Reset link sent!';
      btnForgotPass.classList.add('sent');
      setTimeout(() => {
        btnForgotPass.textContent = 'Forgot Password?';
        btnForgotPass.classList.remove('sent');
      }, 3000);
    })
    .catch((err) => {
      console.error('[Auth] sendPasswordResetEmail failed:', err);
      window.ForgeDialog.alert('Reset Failed', err.message || 'Failed to send reset link. Please check your email and try again.');
    });
}

/* ── Inline Validation on Blur ─────────── */

function bindBlurValidation() {
  loginEmail.addEventListener('blur', function () {
    const v = this.value.trim();
    clearError(loginEmailErr);
    if (v && !EMAIL_RE.test(v)) setError(loginEmailErr, 'Enter a valid email address');
  });

  loginPass.addEventListener('blur', function () {
    clearError(loginPassErr);
    if (this.value && this.value.length < 6) setError(loginPassErr, 'Password must be at least 6 characters');
  });

  signupName.addEventListener('blur', function () {
    const v = this.value.trim();
    clearError(signupNameErr);
    if (v && v.length < 2) setError(signupNameErr, 'Name must be at least 2 characters');
  });

  signupEmail.addEventListener('blur', function () {
    const v = this.value.trim();
    clearError(signupEmailErr);
    if (v && !EMAIL_RE.test(v)) setError(signupEmailErr, 'Enter a valid email address');
  });

  signupPass.addEventListener('blur', function () {
    clearError(signupPassErr);
    if (this.value && this.value.length < 6) setError(signupPassErr, 'Password must be at least 6 characters');
    if (signupConfirm.value && signupConfirm.value !== this.value) {
      setError(signupConfirmErr, 'Passwords do not match');
    }
  });

  signupConfirm.addEventListener('blur', function () {
    clearError(signupConfirmErr);
    if (this.value && this.value !== signupPass.value) {
      setError(signupConfirmErr, 'Passwords do not match');
    }
  });
}

/* ── Clear errors on input ─────────────── */

function bindInputClear() {
  const pairs = [
    [loginEmail, loginEmailErr],
    [loginPass, loginPassErr],
    [signupName, signupNameErr],
    [signupEmail, signupEmailErr],
    [signupPass, signupPassErr],
    [signupConfirm, signupConfirmErr]
  ];

  pairs.forEach(([input, err]) => {
    input.addEventListener('input', () => clearError(err));
  });
}

/* ──────────────────────────────────────────
   EVENT BINDING — runs FIRST, always works
   ────────────────────────────────────────── */

function bindEvents() {
  console.log('[Auth] Binding UI event listeners...');

  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.authTab));
  });

  btnLogin.addEventListener('click', onLoginSubmit);
  btnSignUp.addEventListener('click', onSignUpSubmit);
  btnGoogleAuth.addEventListener('click', onGoogleAuth);
  btnForgotPass.addEventListener('click', onForgotPassword);

  /* Enter key triggers the relevant button click */
  loginForm.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); btnLogin.click(); }
  });
  signUpForm.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); btnSignUp.click(); }
  });

  bindBlurValidation();
  bindInputClear();

  console.log('[Auth] All UI event listeners bound.');
}

/* ──────────────────────────────────────────
   INIT — UI first, Firebase second
   ────────────────────────────────────────── */

function init() {
  console.log('[Auth] init() fired — document.readyState:', document.readyState);
  cacheDom();
  bindEvents();
  loadFirebase();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
