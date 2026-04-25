# Push Notifications Implementation Guide

## Overview

Push notifications for parent devices er implementert med Firebase Cloud Messaging (FCM) og Cloud Functions.

## Arkitektur

```
Frontend (Next.js PWA)
  ↓
  └─ Requests notification permission
  └─ Registers FCM token
  └─ Sends token to Firestore (families/family-default/devices/{token})
  
Backend (Firebase Cloud Functions)
  ↓
  ├─ onTaskPendingApproval (Firestore trigger)
  │   ↓
  │   └─ Queries: role="parent" devices
  │   └─ Sends: "Oppgaver venter på godkjenning"
  │
  └─ weeklyReminderSunday (Scheduled - Sundays 08:00)
      ↓
      └─ Sends: "Ny uke – gå gjennom oppgaver"
      
Firebase Cloud Messaging
  ↓
  └─ Service Worker (background messages)
  └─ Browser notification (foreground messages)
```

## Implementation Details

### 1. Frontend: Device Registration

**File**: `src/lib/fcm.ts`

```typescript
// Requests Notification permission
// Gets FCM token with VAPID key
// Saves token to Firestore with role/platform metadata
```

**Triggered from**: `src/app/FCMInitializer.tsx` when app loads (production only)

**Firestore structure**:
```
families/family-default/devices/{token}
├─ token: string (FCM token)
├─ role: "parent" | "child"
├─ platform: "web"
└─ lastSeen: timestamp
```

### 2. Service Workers

**Public Service Worker**: `public/sw.js`
- Listens for `push` events
- Displays notifications with title/body
- Handles notification clicks → focuses app

**Firebase Service Worker**: `public/firebase-messaging-sw.js`
- Handles FCM background messages
- Called by Firebase SDK automatically

### 3. Cloud Functions

**File**: `functions/src/index.ts`

#### Function 1: `onTaskPendingApproval`
- **Trigger**: Firestore write to `families/{familyId}/tasks/{taskId}`
- **Logic**:
  - Detects when `approvalStatus` changes from non-"pending" to "pending"
  - Queries all devices where `role="parent"`
  - Sends multicast message to all tokens
  - Auto-removes invalid tokens on failure

#### Function 2: `weeklyReminderSunday`
- **Trigger**: Pubsub scheduled (Sundays 08:00 Europe/Oslo)
- **Logic**:
  - Gets all parent devices
  - Sends reminder message to all tokens

**Helper**: `sendPushToParents(title, body)`
- Queries parent devices
- Uses Admin SDK for multicast messaging
- Handles token cleanup on failure

## Deployment

### Step 1: Build Frontend
```bash
npm run build
```

### Step 2: Deploy Cloud Functions
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

Or use the convenience script:
```bash
npm run firebase:deploy
```

### Step 3: Verify Deployment

Check logs:
```bash
firebase functions:log
```

Expected output after deployment:
```
✔  Deploy complete!

✔  functions[onTaskPendingApproval(us-central1)] Successful
✔  functions[weeklyReminderSunday(us-central1)] Successful
```

## Testing

### Manual Test 1: Approval Notification

1. Open app as **child** → mark a task as completed
2. App should transition to "pending approval" status
3. Open app as **parent** → should receive notification
   - Title: "Oppgaver venter på godkjenning"
   - Body: "Åpne appen for å godkjenne."

### Manual Test 2: Weekly Reminder

1. Go to Firebase Console → Cloud Functions → `weeklyReminderSunday`
2. Click "..." → "Execute function"
3. Should receive notification:
   - Title: "Ny uke – gå gjennom oppgaver og nullstill"
   - Body: "Planlegg uka med barnet ditt."

### Manual Test 3: Custom Push (Firebase Console)

1. Get FCM token from browser console
2. Firebase Console → Cloud Messaging → Send message
3. Enter token → send
4. Notification appears

## Configuration

### VAPID Key

Located in `src/lib/fcm.ts`:
```typescript
const FCM_VAPID_KEY = "BOIiLlVL5_Gfyu8Vxc82z3aE8zKDRfB_c8WcVvYPCsXz5o2I8kGvFYbxP0FnLT6V-M9FBPbLLN4r7eHPqGqYoNw";
```

To regenerate:
1. Firebase Console → Project settings → Cloud Messaging
2. Copy the VAPID key

### Timezone

In `functions/src/index.ts`:
```typescript
.timeZone("Europe/Oslo") // Change as needed
```

### Push Message Content

Edit in Cloud Functions:
```typescript
await sendPushToParents(
  "Your title here",
  "Your body here"
);
```

## Error Handling

### Invalid Tokens
- Automatically detected when `sendMulticast` fails
- Failed tokens are deleted from Firestore
- User won't receive future notifications until token is re-registered

### No Parent Devices
- Function checks `devicesSnap.empty`
- Logs warning but doesn't error
- Safe to call even if no devices exist

### Cloud Functions Errors
- Logged to Firebase Console
- Check with: `firebase functions:log`
- Most common: permission issues (see below)

## Permissions

Ensure Firebase has required permissions:

1. **Firestore**: Read/write to `families/{familyId}/devices` and `tasks`
   ```
   match /families/{familyId}/devices/{token} {
     allow read, write: if true;
   }
   ```

2. **Cloud Messaging**: Already provided by Admin SDK

See `firebase.json` for hosting/functions configuration.

## Production Checklist

- [ ] Cloud Functions deployed and tested
- [ ] VAPID key configured in frontend
- [ ] Service Workers properly registered
- [ ] Firestore security rules configured
- [ ] Test approval flow (child → parent)
- [ ] Test weekly reminder (check logs)
- [ ] Monitor `firebase functions:log` for errors

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Token not saving to Firestore | Check browser console, verify Firestore rules |
| Notification not received | Check FCM permission, verify token in devices collection |
| Cloud Function not triggering | Check logs: `firebase functions:log` |
| "Invalid argument" error | Verify VAPID key matches Firebase project |
| Sunday reminder not firing | Check Cloud Functions timezone setting |

## Links

- [Firebase Console](https://console.firebase.google.com/project/ukelonn-1cdbf)
- [Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [FCM Best Practices](https://firebase.google.com/docs/cloud-messaging/concept-options)
