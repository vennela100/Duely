# FinanceLedger — Setup

Stack: Expo SDK 56, expo-router, Firebase, TypeScript.

## Firebase setup (one-time, in Firebase Console)

Project: `finance-6efdb` (already wired in `services/firebase.ts`).

1. Open https://console.firebase.google.com/project/finance-6efdb
2. **Authentication** → Sign-in method → enable **Email/Password**
3. **Authentication** → Users → add test user (e.g. `owner@test.com` / `password123`)
4. **Firestore Database** → Create database → Production mode → region `asia-south1` (Mumbai)
5. Firestore → Rules → paste contents of `firestore.rules` → Publish

## Run

```bash
npm start
```

Scan QR with **Expo Go** app on phone (iOS / Android).

## SMS notes

- Android direct SMS runs in a development or production build, not Expo Go. Grant SMS permission when asked.
- On dual-SIM Android phones, choose the sending line in the collection sheet. Duely asks for Phone state permission to list active SIM labels; if denied, Android's configured default SMS SIM is used.
- iOS and Expo Go do not include the direct-SMS module. The receipt SMS toggle is unavailable there unless an SMS gateway is configured.

## Production build

When ready for real device install / Play Store:

```bash
npx expo install expo-dev-client
eas build --profile development --platform android
```
