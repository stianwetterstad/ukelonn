# Firebase Cloud Functions for Ukelonn

Cloud Functions som håndterer push notifications til parent og child.

## Funksjoner

### 1. `onTaskPendingApproval`
- **Trigger**: Firestore dokument endring i `families/{familyId}/tasks/{taskId}`
- **Handling**: Når en oppgave markeres som "pending" for godkjenning
- **Action**: Sender push notification til alle parent-devices
  - Tittel: "Ny oppgave til godkjenning"
  - Body: "{oppgavenavn} er klar for godkjenning."

### 2. `onTaskReviewedByParent`
- **Trigger**: Firestore dokument endring i `families/{familyId}/tasks/{taskId}`
- **Handling**: Når approvalStatus endres til "approved" eller "rejected"
- **Action**: Sender push notification til child-devices
  - Tittel: "Oppgave godkjent ✅" eller "Oppgave trenger nytt forsok 🔁"
  - Body: "{oppgavenavn} ble godkjent." / "{oppgavenavn} ble ikke godkjent ennå."

### 3. `onWeeklyAllowanceUnlocked`
- **Trigger**: Firestore dokument endring i `families/{familyId}/tasks/{taskId}`
- **Handling**: Når alle weekly-oppgaver blir godkjent
- **Action**: Sender push notification til child-devices
  - Tittel: "Ukelonn opptjent 🎉"
  - Body: "Alle {antall} ukesoppgaver er godkjent. Bra jobbet!"

### 4. `weeklyReminderSunday`
- **Trigger**: Pubsub scheduled function
- **Schedule**: Søndag morgen kl. 08:00 (Oslo tid)
- **Action**: Sender push notification til alle parent-devices
  - Tittel: "Ny uke – gå gjennom oppgaver og nullstill"
  - Body: "Planlegg uka med barnet ditt."

### 5. `childDailyWeekdayReminder`
- **Trigger**: Pubsub scheduled function
- **Schedule**: Hverdager kl. 16:00 (Oslo tid)
- **Action**: Sender påminnelse til child-devices når dagens weekly-oppgaver gjenstår

### 6. `parentEveningPendingSummary`
- **Trigger**: Pubsub scheduled function
- **Schedule**: Hverdager kl. 19:00 (Oslo tid)
- **Action**: Sender kveldssammendrag til parent-devices når oppgaver venter godkjenning

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

- **Både parent og child devices får meldinger**: `where("role", "==", "parent"|"child")`
- **Ingen sending hvis ingen devices**: Sjekkes automatisk
- **Invalid tokens fjernes**: Hvis sending feiler, slettes tokenet fra Firestore
