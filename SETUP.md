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

- `expo-sms` opens the native SMS composer. User taps send. Uses device SIM — free.
- Direct send (no composer) needs a dev build + `SEND_SMS` permission grant on Android. MVP uses composer.
- iOS always uses composer (Apple restriction).

## Production build

When ready for real device install / Play Store:

```bash
npx expo install expo-dev-client
eas build --profile development --platform android
```
