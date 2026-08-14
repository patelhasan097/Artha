// ═══════════════════════════════════════════════════════════════
//  TEMPLATE — for local testing only. Copy this to js/config.js
//  (which is gitignored — see .gitignore) and fill in your real values
//  there. Never put real keys in THIS file; it's the one that gets
//  committed to GitHub.
//
//  For your deployed app, you don't need to touch js/config.js at all —
//  the GitHub Actions workflow (.github/workflows/deploy.yml) builds it
//  automatically from your repo's Secrets at deploy time. See README.md.
// ═══════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "PASTE_YOUR_apiKey_HERE",
  authDomain:        "PASTE_YOUR_authDomain_HERE",
  projectId:         "PASTE_YOUR_projectId_HERE",
  storageBucket:     "PASTE_YOUR_storageBucket_HERE",
  messagingSenderId: "PASTE_YOUR_messagingSenderId_HERE",
  appId:             "PASTE_YOUR_appId_HERE"
};

const PROXY_BASE_URL = "";  // e.g. "https://artha-proxy.yourname.workers.dev"

firebase.initializeApp(FIREBASE_CONFIG);
const db   = firebase.firestore();
const auth = firebase.auth();

const APP_NAME    = 'Artha';
const APP_VERSION = '2.1.0';
const PIN_SALT    = 'artha_secure_salt_v2';
