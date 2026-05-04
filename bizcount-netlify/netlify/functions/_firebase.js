/**
 * BizCount — Firebase Admin SDK initializer
 * Used by all Netlify Functions
 *
 * SETUP:
 * 1. Go to Firebase Console → Project Settings → Service Accounts
 * 2. Click "Generate new private key" → download JSON
 * 3. In Netlify dashboard → Site Settings → Environment Variables, add:
 *
 *   FIREBASE_PROJECT_ID     = your-project-id
 *   FIREBASE_CLIENT_EMAIL   = firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
 *   FIREBASE_PRIVATE_KEY    = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
 *   JWT_SECRET              = any_long_random_string_change_this_abc123xyz789
 *
 *   MPESA_CONSUMER_KEY      = YOUR_CONSUMER_KEY_HERE
 *   MPESA_CONSUMER_SECRET   = YOUR_CONSUMER_SECRET_HERE
 *   MPESA_SHORTCODE         = YOUR_SHORTCODE_HERE
 *   MPESA_PASSKEY           = YOUR_PASSKEY_HERE
 *   MPESA_CALLBACK_URL      = https://your-site.netlify.app/api/mpesa-callback
 *   MPESA_ENV               = sandbox
 *
 *   WEEKLY_PRICE            = 200
 *   TRIAL_DAYS              = 7
 */

const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return admin;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : null;

  if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
    throw new Error(
      'Missing Firebase environment variables. ' +
      'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Netlify.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  privateKey,
    }),
  });

  initialized = true;
  return admin;
}

function getDb() {
  const a = initFirebase();
  return a.firestore();
}

// CORS headers for all responses
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function ok(data) { return respond(200, { success: true, ...data }); }
function err(msg, code = 400) { return respond(code, { success: false, error: msg }); }

// Verify JWT token from Authorization header
const jwt = require('jsonwebtoken');

function verifyToken(event) {
  const auth = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'bizcount_secret_change_me');
  } catch {
    return null;
  }
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'bizcount_secret_change_me', { expiresIn: '30d' });
}

// Format M-Pesa phone number to 2547XXXXXXXX
function formatMpesaPhone(phone) {
  phone = phone.replace(/\D/g, '');
  if (phone.length === 10 && phone[0] === '0') phone = '254' + phone.slice(1);
  if (phone.length === 9) phone = '254' + phone;
  return phone;
}

// Firestore timestamp to ISO string
function tsToIso(ts) {
  if (!ts) return null;
  if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
  if (ts.toDate) return ts.toDate().toISOString();
  return ts;
}

module.exports = { initFirebase, getDb, respond, ok, err, verifyToken, signToken, formatMpesaPhone, tsToIso, CORS_HEADERS };
