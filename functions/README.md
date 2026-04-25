# Firebase Cloud Functions for Ukelonn

Cloud Functions som håndterer push notifications til parent.

## Funksjoner

### 1. `onTaskPendingApproval`
- **Trigger**: Firestore dokument endring i `families/{familyId}/tasks/{taskId}`
- **Handling**: Når en oppgave markeres som "pending" for godkjenning
- **Action**: Sender push notification til alle parent-devices
  - Tittel: "Oppgaver venter på godkjenning"
  - Body: "Åpne appen for å godkjenne."

### 2. `weeklyReminderSunday`
- **Trigger**: Pubsub scheduled function
- **Schedule**: Søndag morgen kl. 08:00 (Oslo tid)
- **Action**: Sender push notification til alle parent-devices
  - Tittel: "Ny uke – gå gjennom oppgaver og nullstill"
  - Body: "Planlegg uka med barnet ditt."

## Deployment

### Forutsetninger
- Node.js 20+
- Firebase CLI installert: `npm install -g firebase-tools`
- Authenticert: `firebase login`

### Deploy functions
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### Testing
```bash
# Vis live logs
firebase functions:log

# Test med Firebase Emulator
firebase emulators:start --only functions
```

## Firestore struktur

### Devices collection
```
families/
  family-default/
    devices/
      {token}/
        - token (string)
        - role ("parent" | "child")
        - platform ("web")
        - lastSeen (timestamp)
```

### Tasks collection
```
families/
  family-default/
    tasks/
      {taskId}/
        - approvalStatus ("none" | "pending" | "approved" | "rejected")
        - checkedByChild (boolean)
        - ... (other fields)
```

## Advarsel

- **Kun parent devices får meldinger**: `where("role", "==", "parent")`
- **Ingen sending hvis ingen devices**: Sjekkes automatisk
- **Invalid tokens fjernes**: Hvis sending feiler, slettes tokenet fra Firestore
