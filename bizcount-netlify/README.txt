═══════════════════════════════════════════════════════════════
  BizCount — Netlify + Firebase Edition
  Version 2.0.0 | Runs 100% FREE on Netlify
═══════════════════════════════════════════════════════════════

TECH STACK
──────────
  Frontend:  HTML, CSS, JavaScript (Vanilla)
  Backend:   Netlify Functions (Node.js serverless)
  Database:  Firebase Firestore (NoSQL cloud database)
  Auth:      JWT tokens (stored in localStorage)
  Payments:  M-Pesa Daraja API (via Netlify Function)
  Hosting:   Netlify (free tier)

═══════════════════════════════════════════════════════════════
  FILE STRUCTURE
═══════════════════════════════════════════════════════════════

  bizcount-netlify/
  ├── netlify.toml                    → Netlify build config & redirects
  ├── package.json                    → Node.js dependencies
  ├── public/                         → Static frontend files
  │   ├── index.html                  → Homepage
  │   ├── css/style.css               → All styles (dark/light)
  │   ├── js/app.js                   → All frontend logic & API calls
  │   └── pages/
  │       ├── register.html           → Owner registration
  │       ├── login.html              → Login (owner + staff)
  │       ├── dashboard.html          → Owner dashboard shell
  │       └── staff.html              → Staff portal shell
  └── netlify/functions/
      ├── _firebase.js                → Firebase + helpers (shared)
      ├── auth.js                     → Register, login, profile
      ├── sales.js                    → Sales CRUD
      ├── products.js                 → Products & stock
      ├── expenses.js                 → Expense tracker
      ├── staff.js                    → Staff management
      ├── tasks.js                    → Task assignment
      ├── reports.js                  → Analytics & charts data
      ├── subscription.js             → Subscription status
      ├── mpesa-pay.js                → M-Pesa STK Push
      └── mpesa-callback.js           → M-Pesa payment callback


═══════════════════════════════════════════════════════════════
  STEP 1 — SET UP FIREBASE (Free)
═══════════════════════════════════════════════════════════════

  1. Go to https://console.firebase.google.com
  2. Click "Add project" → name it "bizcount" → Create
  3. Go to "Firestore Database" → Create database
     → Choose "Start in production mode" → Select region (e.g. europe-west1)
  4. Go to Project Settings (gear icon) → "Service Accounts" tab
  5. Click "Generate new private key" → Download the JSON file
  6. Open the JSON file — you'll need these values:
       - project_id
       - client_email
       - private_key


═══════════════════════════════════════════════════════════════
  STEP 2 — DEPLOY TO NETLIFY (Free)
═══════════════════════════════════════════════════════════════

  OPTION A — GitHub (Recommended for auto-deploy):
  ─────────────────────────────────────────────────
  1. Create a free GitHub account at github.com
  2. Create a new repository (e.g. "bizcount")
  3. Upload all files in this folder to the repository
  4. Go to https://netlify.com → Log in → "Add new site"
  5. Choose "Import from Git" → Connect GitHub → Select your repo
  6. Build settings:
       Publish directory: public
       Build command:     npm install
  7. Click "Deploy site"

  OPTION B — Drag & Drop (Quickest):
  ────────────────────────────────────
  1. Go to https://netlify.com → Log in
  2. Go to "Sites" → Drag the entire bizcount-netlify folder into the browser
  3. Wait for deploy to complete
  ⚠ Note: Netlify Functions won't work with drag & drop.
    You MUST use GitHub for functions to work.


═══════════════════════════════════════════════════════════════
  STEP 3 — SET ENVIRONMENT VARIABLES IN NETLIFY
═══════════════════════════════════════════════════════════════

  Go to: Netlify Dashboard → Your Site → Site Settings
         → Environment Variables → Add variable

  Add these one by one:

  ┌─────────────────────────┬──────────────────────────────────────┐
  │ Variable Name           │ Value                                │
  ├─────────────────────────┼──────────────────────────────────────┤
  │ FIREBASE_PROJECT_ID     │ your-firebase-project-id             │
  │ FIREBASE_CLIENT_EMAIL   │ firebase-adminsdk-xxx@....com        │
  │ FIREBASE_PRIVATE_KEY    │ -----BEGIN PRIVATE KEY-----\n...     │
  │ JWT_SECRET              │ any_random_64_char_string            │
  │ MPESA_CONSUMER_KEY      │ YOUR_CONSUMER_KEY_HERE               │
  │ MPESA_CONSUMER_SECRET   │ YOUR_CONSUMER_SECRET_HERE            │
  │ MPESA_SHORTCODE         │ YOUR_SHORTCODE_HERE                  │
  │ MPESA_PASSKEY           │ YOUR_PASSKEY_HERE                    │
  │ MPESA_CALLBACK_URL      │ https://your-site.netlify.app/       │
  │                         │   api/mpesa-callback                 │
  │ MPESA_ENV               │ sandbox  (or production when live)   │
  │ WEEKLY_PRICE            │ 200                                  │
  │ TRIAL_DAYS              │ 7                                    │
  │ SUBSCRIPTION_DAYS       │ 7                                    │
  └─────────────────────────┴──────────────────────────────────────┘

  ⚠ FIREBASE_PRIVATE_KEY tip:
    Copy the private_key value from the JSON file.
    Replace actual newlines with \n before pasting.
    It should look like: -----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n


═══════════════════════════════════════════════════════════════
  STEP 4 — SET UP FIRESTORE SECURITY RULES
═══════════════════════════════════════════════════════════════

  In Firebase Console → Firestore → Rules, paste this:

  ─────────────────────────────────────────────
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      // All access goes through Netlify Functions (Admin SDK)
      // Block all direct client access for security
      match /{document=**} {
        allow read, write: if false;
      }
    }
  }
  ─────────────────────────────────────────────

  Click "Publish". This forces all data access through
  your Netlify Functions (which use the Admin SDK).


═══════════════════════════════════════════════════════════════
  STEP 5 — CONFIGURE M-PESA DARAJA
═══════════════════════════════════════════════════════════════

  1. Register at https://developer.safaricom.co.ke
  2. Create an app → Get Consumer Key & Secret
  3. For sandbox testing:
     - Use test credentials from the Daraja portal
     - Set MPESA_ENV = sandbox
  4. For production:
     - Apply for Go-Live on Daraja portal
     - Set MPESA_ENV = production
  5. Set MPESA_CALLBACK_URL to:
     https://your-site.netlify.app/api/mpesa-callback
     (This URL is automatically created by Netlify Functions)


═══════════════════════════════════════════════════════════════
  STEP 6 — REDEPLOY & TEST
═══════════════════════════════════════════════════════════════

  After adding environment variables:
  1. Go to Netlify → Deploys → "Trigger deploy" → "Deploy site"
  2. Wait for deploy to finish
  3. Visit your site URL (e.g. https://bizcount.netlify.app)
  4. Click "Start Free Trial" and register
  5. You'll be taken to the dashboard with 7-day trial
  6. Test all features: sales, products, staff, reports
  7. Test M-Pesa payment (use sandbox mode first)


═══════════════════════════════════════════════════════════════
  HOW THE APP WORKS (No PHP/MySQL)
═══════════════════════════════════════════════════════════════

  User visits site → HTML/CSS/JS loads from Netlify CDN
       ↓
  User registers/logs in → Netlify Function (auth.js) handles it
       ↓
  JWT token stored in localStorage (acts like a session)
       ↓
  Dashboard loads → JS fetches data from Netlify Functions
       ↓
  All data stored in Firebase Firestore (cloud database)
       ↓
  M-Pesa payment → mpesa-pay.js → Safaricom API
       ↓
  Safaricom sends callback → mpesa-callback.js → Updates Firestore


═══════════════════════════════════════════════════════════════
  FREE TIER LIMITS (No cost to start)
═══════════════════════════════════════════════════════════════

  Netlify Free:
    ✓ 100GB bandwidth/month
    ✓ 125,000 function invocations/month
    ✓ Unlimited sites

  Firebase Free (Spark Plan):
    ✓ 1GB Firestore storage
    ✓ 50,000 reads/day
    ✓ 20,000 writes/day
    ✓ More than enough for hundreds of businesses


═══════════════════════════════════════════════════════════════
  CUSTOM DOMAIN (Optional)
═══════════════════════════════════════════════════════════════

  To use your own domain (e.g. bizcount.co.ke):
  1. Buy domain from Truehost Kenya or Namecheap
  2. Netlify → Domain Settings → Add custom domain
  3. Point your domain's nameservers to Netlify
  4. SSL certificate is auto-issued (free!)


═══════════════════════════════════════════════════════════════
  TROUBLESHOOTING
═══════════════════════════════════════════════════════════════

  PROBLEM: "Failed to fetch" errors in browser
  SOLUTION: Check that Netlify Functions are deployed.
            Go to Netlify → Functions tab and verify they appear.

  PROBLEM: Firebase error in function logs
  SOLUTION: Check FIREBASE_PRIVATE_KEY has \n not actual newlines.
            Verify FIREBASE_PROJECT_ID matches your Firebase project.

  PROBLEM: Login returns "User not found"
  SOLUTION: Make sure you registered first. Firestore data can be
            viewed in Firebase Console → Firestore → users collection.

  PROBLEM: M-Pesa STK push not received
  SOLUTION: Use sandbox credentials for testing.
            Check MPESA_ENV = sandbox and use Daraja test numbers.

  PROBLEM: Page shows but dashboard is blank
  SOLUTION: Open browser DevTools (F12) → Console tab.
            Look for errors and share them for support.

═══════════════════════════════════════════════════════════════
  BizCount v2.0.0 Netlify Edition — Free Forever to Host!
═══════════════════════════════════════════════════════════════
