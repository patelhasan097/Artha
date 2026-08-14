const Auth = {
  _setupPin: '',
  _setupStep: 'create',
  _lockAttempts: 0,
  _lockInput: '',

  async signInGoogle() {
    try { Utils.showLoader(); const provider = new firebase.auth.GoogleAuthProvider(); await auth.signInWithPopup(provider); }
    catch (e) { Utils.hideLoader(); Utils.toast(e.message || 'Google sign-in failed', 'error'); }
  },

  async signInEmail(email, pass) {
    try { Utils.showLoader(); await auth.signInWithEmailAndPassword(email, pass); }
    catch (e) { Utils.hideLoader(); this._showAuthError(e.code); }
  },

  async createAccount(email, pass) {
    try { Utils.showLoader(); await auth.createUserWithEmailAndPassword(email, pass); }
    catch (e) { Utils.hideLoader(); this._showAuthError(e.code); }
  },

  async signOut() {
    if (!Utils.confirm('Sign out of Artha?')) return;
    StockAPI.stopAutoRefresh();
    if (Portfolio.listener) Portfolio.listener();
    if (Watchlist.listener) Watchlist.listener();
    localStorage.removeItem('artha_pin_' + auth.currentUser?.uid);
    await auth.signOut();
    location.reload();
  },

  _showAuthError(code) {
    const msgs = {
      'auth/user-not-found': 'No account with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/email-already-in-use': 'Email already registered.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email.',
    };
    const el = Utils.el('auth-error');
    el.textContent = msgs[code] || 'Authentication failed. Try again.';
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 4000);
  },

  // ─── PIN SETUP ───
  initSetupPad() {
    this._setupPin = ''; this._setupStep = 'create';
    this._updateSetupDots('');
    Utils.el('setup-title').textContent = 'Create your PIN';
    Utils.el('setup-subtitle').textContent = 'Choose 6 digits — this locks the app every time you open it.';
    Utils.el('setup-pad').querySelectorAll('.pin-btn[data-n]').forEach(btn => { btn.onclick = () => this._onSetupDigit(btn.dataset.n); });
    Utils.el('setup-del').onclick = () => this._onSetupDel();
    Utils.el('btn-skip-pin').onclick = () => App.showMainApp(auth.currentUser);
  },

  _onSetupDigit(n) {
    if (this._setupPin.length >= 6) return;
    navigator.vibrate && navigator.vibrate(10);
    this._setupPin += n;
    this._updateSetupDots(this._setupPin);
    if (this._setupPin.length === 6) {
      if (this._setupStep === 'create') {
        setTimeout(() => {
          this.__tempPin = this._setupPin;
          this._setupPin = ''; this._setupStep = 'confirm'; this._updateSetupDots('');
          Utils.el('setup-title').textContent = 'Confirm your PIN';
          Utils.el('setup-subtitle').textContent = 'Enter the same 6 digits to confirm.';
        }, 200);
      } else {
        setTimeout(() => this._finishSetup(this._setupPin), 200);
      }
    }
  },

  _onSetupDel() { this._setupPin = this._setupPin.slice(0, -1); this._updateSetupDots(this._setupPin); },

  async _finishSetup(confirmPin) {
    if (confirmPin !== this.__tempPin) {
      this._shakeSetupDots();
      Utils.toast('PINs did not match — try again', 'error');
      this._setupPin = ''; this._setupStep = 'create'; this.__tempPin = ''; this._updateSetupDots('');
      Utils.el('setup-title').textContent = 'Create your PIN';
      Utils.el('setup-subtitle').textContent = 'Choose 6 digits — this locks the app every time you open it.';
      return;
    }
    const uid = auth.currentUser.uid;
    const hash = await Utils.sha256(confirmPin + uid);
    localStorage.setItem('artha_pin_' + uid, hash);
    try { await db.collection('users').doc(uid).set({ pinHash: hash, updatedAt: new Date() }, { merge: true }); } catch (_) {}
    Utils.toast('PIN created successfully', 'success');

    const bioAvail = await this.checkBiometricSupport();
    if (bioAvail && confirm('Enable biometric login (Face ID / Fingerprint)?')) await this.setupBiometric(uid);
    App.showMainApp(auth.currentUser);
  },

  _updateSetupDots(pin) {
    Utils.el('setup-dots').querySelectorAll('.pin-dot').forEach((d, i) => {
      d.classList.toggle('filled', i < pin.length);
      d.classList.toggle('active', i === pin.length);
    });
  },
  _shakeSetupDots() { Utils.el('setup-dots').querySelectorAll('.pin-dot').forEach(d => { d.classList.add('error'); setTimeout(() => d.classList.remove('error'), 600); }); },

  // ─── PIN LOCK ───
  initLockPad() {
    this._lockInput = ''; this._lockAttempts = 0;
    this._updateLockDots('');

    const user = auth.currentUser;
    const firstName = (user?.displayName || user?.email?.split('@')[0] || '').split(' ')[0];
    Utils.el('lock-greeting').textContent = firstName ? `Hi, ${firstName}` : 'Welcome back';

    const bioBtnEl = Utils.el('btn-biometric');
    const uid = auth.currentUser?.uid;
    const bioEnabled = uid && localStorage.getItem('artha_bio_' + uid) === 'true';
    bioBtnEl.classList.toggle('hidden', !bioEnabled);
    if (bioEnabled) bioBtnEl.onclick = () => this.verifyBiometric(uid);
    Utils.el('lock-pad').querySelectorAll('.pin-btn[data-n]').forEach(btn => { btn.onclick = () => this._onLockDigit(btn.dataset.n); });
    Utils.el('lock-del').onclick = () => { this._lockInput = this._lockInput.slice(0, -1); this._updateLockDots(this._lockInput); };
    Utils.el('btn-lock-signout').onclick = () => this.signOut();
  },

  _onLockDigit(n) {
    if (this._lockInput.length >= 6) return;
    navigator.vibrate && navigator.vibrate(10);
    this._lockInput += n;
    this._updateLockDots(this._lockInput);
    if (this._lockInput.length === 6) setTimeout(() => this._verifyLock(this._lockInput), 150);
  },

  async _verifyLock(pin) {
    const uid = auth.currentUser.uid;
    const stored = localStorage.getItem('artha_pin_' + uid);
    const hash = await Utils.sha256(pin + uid);
    if (hash === stored) { App.showMainApp(auth.currentUser); return; }

    this._lockAttempts++;
    navigator.vibrate && navigator.vibrate([100, 50, 100]);
    this._shakeLockDots();
    this._lockInput = ''; this._updateLockDots('');
    const remain = 5 - this._lockAttempts;
    Utils.el('lock-msg').textContent = remain > 0 ? `Wrong PIN — ${remain} attempt${remain === 1 ? '' : 's'} left` : 'Too many attempts. Please sign out and sign in again.';
    if (this._lockAttempts >= 5) { Utils.el('lock-pad').style.pointerEvents = 'none'; Utils.el('lock-pad').style.opacity = '0.3'; }
  },

  _updateLockDots(pin) {
    Utils.el('lock-dots').querySelectorAll('.pin-dot').forEach((d, i) => {
      d.classList.toggle('filled', i < pin.length);
      d.classList.toggle('active', i === pin.length);
    });
  },
  _shakeLockDots() { Utils.el('lock-dots').querySelectorAll('.pin-dot').forEach(d => { d.classList.add('error'); setTimeout(() => d.classList.remove('error'), 600); }); },

  // ─── BIOMETRIC ───
  async checkBiometricSupport() {
    if (!window.PublicKeyCredential) return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (_) { return false; }
  },

  async setupBiometric(uid) {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge, rp: { name: APP_NAME },
          user: { id: Uint8Array.from(uid, c => c.charCodeAt(0)), name: auth.currentUser.email, displayName: auth.currentUser.displayName || 'User' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
        },
      });
      if (cred) {
        localStorage.setItem('artha_bio_' + uid, 'true');
        localStorage.setItem('artha_cred_' + uid, JSON.stringify(Array.from(new Uint8Array(cred.rawId))));
        try { await db.collection('users').doc(uid).set({ bioEnabled: true }, { merge: true }); } catch (_) {}
        Utils.toast('Biometric enabled', 'success');
        return true;
      }
    } catch (e) { Utils.toast('Biometric setup failed: ' + e.message, 'error'); }
    return false;
  },

  async verifyBiometric(uid) {
    try {
      const credIdArr = JSON.parse(localStorage.getItem('artha_cred_' + uid) || 'null');
      if (!credIdArr) { Utils.toast('No biometric registered', 'error'); return; }
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = await navigator.credentials.get({
        publicKey: { challenge, allowCredentials: [{ type: 'public-key', id: new Uint8Array(credIdArr) }], userVerification: 'required', timeout: 60000 },
      });
      if (assertion) App.showMainApp(auth.currentUser);
    } catch (_) { Utils.toast('Biometric failed — enter PIN instead', 'error'); }
  },
};
