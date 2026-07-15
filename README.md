# Duely — Lending Ledger

A clean, offline-first mobile app for small lenders to track customers, daily collections, and balances — with a three-layer backup system (on-device, Firebase, Google Drive).

Built with **React Native (Expo SDK 56)** + **TypeScript**.

---

## Features

- **Customer & loan tracking** — deal amount, given amount, daily collection, progress, and balance due
- **Daily collection list** — see who's pending today, record payments fast
- **Automatic SMS receipts** — payment confirmation sent to the customer
- **Reports & cash-flow** — over any period (today → 1 year), export **PDF/CSV**
- **Offline-first** — all data lives on the device; the app works with no network
- **Three-layer backup & sync**
  1. On-device dated JSON snapshots
  2. **Firebase Firestore** — live cloud mirror + dated backups (chunked to beat the 1 MB doc limit)
  3. **Google Drive** — each user's own Drive (`drive.file` scope), auto folder + daily upload
- **One identity** — sign in once (Firebase email/password); daily unlock with **PIN / fingerprint**
- **Multi-language** — English · हिन्दी · తెలుగు
- **Secure** — device PIN + biometric lock, per-user isolated cloud data

---

## Architecture

```
        ┌──────────────────────────────────────────────┐
        │   LOCAL (AsyncStorage)  ← source of truth      │  instant, offline
        └───────────────┬──────────────┬─────────────────┘
                        │ every change  │ daily
          ┌─────────────▼─────┐   ┌─────▼──────────────┐
          │ FIREBASE Firestore │   │ on-device JSON      │
          │ live + dated, per  │   │ dated snapshots     │
          │ user (chunked)     │   └─────────────────────┘
          └─────────┬──────────┘
                    │ daily
              ┌─────▼──────────┐
              │ GOOGLE DRIVE    │  each user's own
              └─────────────────┘
```

**Local-first, cloud-mirror.** The UI always reads/writes local storage (fast, offline). A debounced sync engine mirrors changes to Firestore with last-write-wins by version, and pulls newer cloud data on sign-in. Backups are content-fingerprinted to skip redundant writes.

## Tech stack

| Area | Tech |
|---|---|
| Framework | React Native, Expo SDK 56, Expo Router |
| Language | TypeScript |
| State | Zustand |
| Cloud | Firebase (Auth + Firestore) |
| Backup | Google Drive REST (`@react-native-google-signin`), expo-file-system, expo-sharing |
| Auth | Firebase email/password + device PIN + expo-local-authentication (biometrics) |
| Lists | @shopify/flash-list |
| Animation | react-native-reanimated |
| Native module | Custom Expo module for direct SIM SMS |
| Testing | Jest (72 tests) |

## Highlights

- **Chunked cloud snapshots** — full dataset split across Firestore docs to bypass the 1 MB per-document limit, rejoined on restore (unit-tested for any size).
- **Cheap change-detection** — a rolling fingerprint avoids serializing thousands of records on every edit, keeping the UI smooth at scale.
- **Custom native module** (`modules/smsdirect`) — Android `SmsManager` wrapper exposed via Expo's native module API.
- **Locked Firestore rules** — per-user data isolation (`owners/{uid}`).

## Running locally

```bash
npm install
npx expo run:android   # native dev build (Expo Go not supported on SDK 56)
```

## Tests

```bash
npm test
```

---

*Made for lenders who collect in person, every day.*
