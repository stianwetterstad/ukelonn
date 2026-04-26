# Family Allowance App (Next.js PWA Starter)

This repository contains a minimal **Next.js + TypeScript** starter for a family allowance app.

## Features

- **Progressive Web App (PWA)** – installable on mobile/desktop
- **Real-time Firestore sync** – changes reflect instantly across devices
- **Firebase Cloud Messaging** – push notifications for parents
- **Cloud Functions** – automated reminders and notifications

## Included starter pages

- `/parent` – parent/admin dashboard view
- `/child` – child checklist view

## Data layer

The app uses Firestore for data persistence:

- Tasks and approvals in real-time
- Device tokens for push notifications
- Family settings and balances

## Push Notifications (Parent)

### Features
1. **Task approval reminders** – parent is notified when child submits a task
2. **Weekly reminder** – every Sunday morning at 08:00 (Oslo time)

### Setup

1. **Frontend**: Token is automatically registered when app opens (production only)
   - Stored in `families/family-default/devices/{token}`
   - Contains: token, role ("parent"), platform ("web"), lastSeen

2. **Backend**: Deploy Cloud Functions for push delivery
   ```bash
   cd functions
   npm install
   npm run build
   firebase deploy --only functions
   ```

### Testing Push Notifications

1. **Get FCM token** from browser console (look for "FCM initialized successfully" log)
2. Go to [Firebase Console](https://console.firebase.google.com/project/ukelonn-1cdbf)
3. Navigate to **Cloud Messaging** → **Send message**
4. Select **Devices** as target
5. Paste the token and send

For automated testing:
- Mark a task as "pending" from child view → parent should receive notification
- Wait for Sunday 08:00 → weekly reminder should be sent

## Getting started

1. Install dependencies:

   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

## Available scripts

- `npm run dev` – start development server
- `npm run lint` – run ESLint
- `npm run build` – create production build
- `npm run start` – run production server
- `npm run functions:build` – compile Cloud Functions
- `npm run functions:deploy` – deploy Cloud Functions to Firebase

## Cloud Functions

See [functions/README.md](functions/README.md) for details on push notification functions.

## Production Deployment

### Production URL

The app frontend is deployed to GitHub Pages at:
**https://stianwetterstad.github.io/ukelonn/**

Note: The app uses `basePath: "/ukelonn"` for routing, so all app routes are served under this path.

Firebase is used only for backend services such as Firestore, Auth, Cloud Messaging, and Cloud Functions.
The web app itself is not hosted on Firebase.

### How to Deploy

#### Automatic Deployment (Recommended)

The app automatically builds and deploys to GitHub Pages when you push to `main`:

1. Push changes to `main` branch:
   ```bash
   git push origin main
   ```

2. GitHub Actions workflow runs automatically:
   - Installs dependencies (`npm ci`)
   - Builds static export (`npm run build`)
   - Uploads build artifacts
   - Deploys to GitHub Pages
   - Verifies deployment (manifest, icons, service workers, pages)

3. Check deployment status in the **Actions** tab
4. View the deployment summary in the workflow run details

#### Manual Deployment

To manually trigger a deployment without pushing code:

1. Go to **Actions** tab
2. Select **Build and Deploy to GitHub Pages** workflow
3. Click **Run workflow** → **main** branch
4. Click **Run workflow**

The deployment will start immediately and follow the same build and verification steps.

#### Deployment Verification

Each deployment automatically verifies the following URLs (non-200 → workflow fails):

**Required PWA assets**
| Asset | URL |
|---|---|
| `manifest.webmanifest` | `/ukelonn/manifest.webmanifest` |
| `icon-192.png` | `/ukelonn/icon-192.png` |
| `icon-512.png` | `/ukelonn/icon-512.png` |
| `sw.js` | `/ukelonn/sw.js` |
| `firebase-messaging-sw.js` | `/ukelonn/firebase-messaging-sw.js` |

**App pages**
| Page | URL |
|---|---|
| Home | `/ukelonn/` |
| Parent | `/ukelonn/parent/` |
| Child | `/ukelonn/child/` |

The full checklist is written to the **workflow run summary** (Actions tab → select run → Summary).

### Prod Sanity Checklist

Before considering the production deployment complete, verify PWA and push notifications:

**Quick Checklist** (run in browser console at **https://stianwetterstad.github.io/ukelonn/**):

```javascript
(async () => {
  console.log("🔍 PWA & FCM Verification Checklist\n");
  
  // 1. HTTPS
  const isSecure = window.location.protocol === 'https:' || 
                   window.location.hostname === 'localhost';
  console.log(`${isSecure ? '✅' : '❌'} HTTPS/localhost`);
  
  // 2. Service Worker
  const regs = await navigator.serviceWorker.getRegistrations();
  const activeReg = regs.find(r => r.active && r.scope.includes('ukelonn'));
  console.log(`${activeReg ? '✅' : '❌'} SW registered: ${activeReg?.scope || 'Not found'}`);
  
  // 3. Manifest
  const manifest = document.querySelector('link[rel="manifest"]');
  const manifestOk = await fetch(manifest?.href || '').then(r => r.ok);
  console.log(`${manifestOk ? '✅' : '❌'} Manifest loads`);
  
  // 4. Icons
  const iconCheck = await fetch(window.location.origin + '/ukelonn/icon-192.png')
    .then(r => r.ok);
  console.log(`${iconCheck ? '✅' : '❌'} Icons accessible`);
  
  // 5. Notification Permission
  const permission = Notification.permission;
  console.log(`${permission === 'granted' ? '✅' : '⚠️ '} Notification: ${permission}`);
  
  console.log("\n✨ All ✅ = Production ready\n");
  console.log("📚 Full test steps: see PUSH_NOTIFICATIONS.md → Prod Test Steps");
})();
```

**Full verification steps available in** [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md#prod-test-steps)

You can also use the debug page at **/debug** to view live PWA and FCM status (available on all environments).
