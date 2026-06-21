// ============================================================
// RENVA - Authentication Module
// ============================================================

const RENVA_AUTH = (() => {
  const PROTECTED_PAGES = ['dashboard.html', 'settings.html', 'invoices.html', 'reports.html', 'clients.html'];
  const LOGIN_PAGE      = 'login.html';
  const HOME_PAGE       = 'dashboard.html';

  // ── Route Guard ──────────────────────────────────────────
  function guardRoute() {
    const page = window.location.pathname.split('/').pop() || 'index.html';

    auth.onAuthStateChanged(user => {
      const isProtected = PROTECTED_PAGES.some(p => page.includes(p));
      const isLoginPage  = page.includes(LOGIN_PAGE) || page === '' || page === 'index.html';

      if (!user && isProtected) {
        window.location.href = LOGIN_PAGE;
      } else if (user && isLoginPage) {
        window.location.href = HOME_PAGE;
      }

      // Trigger page-ready event so modules can initialize
      document.dispatchEvent(new CustomEvent('RENVA:authReady', { detail: { user } }));
    });
  }

  // ── Login ─────────────────────────────────────────────────
  async function login(email, password) {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    return auth.signInWithEmailAndPassword(email, password);
  }

  // ── Logout ────────────────────────────────────────────────
  async function logout() {
    await auth.signOut();
    window.location.href = LOGIN_PAGE;
  }

  // ── Forgot Password ───────────────────────────────────────
  async function sendPasswordReset(email) {
    return auth.sendPasswordResetEmail(email);
  }

  // ── Current User ─────────────────────────────────────────
  function currentUser() {
    return auth.currentUser;
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    guardRoute();

    // Wire login form if present
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const btn      = document.getElementById('loginBtn');
        const errBox   = document.getElementById('loginError');

        setLoading(btn, true);
        errBox.textContent = '';
        errBox.classList.remove('show');

        try {
          await login(email, password);
          // onAuthStateChanged in guardRoute will redirect
        } catch (err) {
          errBox.textContent = translateAuthError(err.code);
          errBox.classList.add('show');
          setLoading(btn, false);
        }
      });
    }

    // Wire forgot-password form if present
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
      resetForm.addEventListener('submit', async e => {
        e.preventDefault();
        const email  = document.getElementById('resetEmail').value.trim();
        const btn    = document.getElementById('resetBtn');
        const msg    = document.getElementById('resetMessage');

        setLoading(btn, true);
        msg.textContent = '';
        msg.className   = 'form-message';

        try {
          await sendPasswordReset(email);
          msg.textContent = RENVA_I18N.t('auth.resetSent');
          msg.classList.add('success');
        } catch (err) {
          msg.textContent = translateAuthError(err.code);
          msg.classList.add('error');
        } finally {
          setLoading(btn, false);
        }
      });
    }

    // Wire logout buttons
    document.querySelectorAll('[data-action="logout"]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); logout(); });
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function setLoading(btn, state) {
    if (!btn) return;
    btn.disabled = state;
    btn.classList.toggle('loading', state);
  }

  function translateAuthError(code) {
    const map = {
      'auth/user-not-found':    RENVA_I18N.t('auth.userNotFound'),
      'auth/wrong-password':    RENVA_I18N.t('auth.wrongPassword'),
      'auth/invalid-email':     RENVA_I18N.t('auth.invalidEmail'),
      'auth/too-many-requests': RENVA_I18N.t('auth.tooManyRequests'),
      'auth/user-disabled':     RENVA_I18N.t('auth.userDisabled'),
      'auth/invalid-credential':RENVA_I18N.t('auth.wrongPassword'),
    };
    return map[code] || RENVA_I18N.t('auth.genericError');
  }

  return { init, login, logout, sendPasswordReset, currentUser, guardRoute };
})();
