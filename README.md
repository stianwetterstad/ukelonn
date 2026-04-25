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
- `npm run firebase:deploy` – build app and deploy everything to Firebase

## Cloud Functions

See [functions/README.md](functions/README.md) for details on push notification functions.
