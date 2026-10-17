# Privacy Policy — Duely

**Last updated: 17 October 2026**

Duely (Android package `com.duely.app`, "the app") is a lending-ledger app for small lenders to record customers, loans, and daily repayments. This policy explains what data the app handles, where it is stored, and why it needs each permission.

## Who controls your data
You, the lender using the app, control all data you enter. The developer does not access, sell, or share your data or your customers' information.

## What data the app handles
- **Customer and loan records you enter:** names, phone numbers, optional address and photo, loan/deal amounts, repayment history, dates, and notes.
- **Your profile:** your name and the email address you sign in with.
- **App PIN:** the 4-digit PIN you create to unlock the app. It is kept only in the app's private storage on your phone and is never uploaded.
- **Fingerprint / face unlock:** handled entirely by Android. The app only receives a "verified" or "not verified" result; it never sees or stores your fingerprint or face data.

## Where your data is stored
1. **On your device:** the main copy, in the app's private storage. The app also keeps a daily backup copy on the device.
2. **Cloud sync (when you sign in):** your records are synced to **Google Firebase (Cloud Firestore)**, with dated daily backups, in a private space tied to your account so you can recover them on a new phone. Sign-in uses **Firebase Authentication** (email and password). Security rules allow only you, signed in to your account, to read or write this data.
3. **Google Drive (optional):** if you connect Google Drive, a backup copy is saved to a "Duely Backups" folder in **your own** Drive. The app uses the `drive.file` scope, so it can only see files it created, not your other Drive files.

## Permissions and why they are needed
- **Contacts (read):** to let you pick a contact when adding a customer. Contacts are read on your device only; your contacts list is never uploaded. Only the details of customers you add are saved.
- **Send SMS:** to send a payment receipt (in Telugu and English) from your SIM to a customer when you record a payment or clear a balance. The app does **not** read, collect, or store any SMS messages.
- **Phone state:** only to list the SIM cards in your phone so you can choose which SIM sends receipts. The app does not read your phone number, call logs, or calls.
- **Biometric (fingerprint / face):** to unlock the app and to confirm before a customer is deleted.
- **Notifications:** to show collection reminders you set up.
- **Internet:** for cloud sync and optional Google Drive backup.
- **Vibrate:** for touch feedback.

## What we do NOT do
- We do **not** sell, rent, or share your data with third parties.
- We do **not** read your SMS messages, call logs, or your full contacts list off the device.
- We do **not** use advertising, analytics, or tracking services.

## Data retention and deletion
- Data on your phone stays until you clear it (Profile → Clear all data) or uninstall the app.
- Cloud and Drive data stays in your accounts until you delete it. You can disconnect cloud sync in the app, and delete Drive backups from your Google Drive at any time.
- To delete your Duely cloud account and all of its cloud data, email us at the address below and we will delete it.

## Children
Duely is not intended for children under 13.

## Changes
We may update this policy. The "Last updated" date above will change when we do.

## Contact
For privacy questions or deletion requests: **alamurvennela2007@gmail.com**
