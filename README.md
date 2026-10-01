# Life Arc

1. Create a GitHub repo and upload everything in this folder (keep the `.github` folder).
2. Open the repo > Actions > "Build Life Arc APK" > Run workflow (it also runs on every push). Takes about 5 minutes.
3. Open the repo > Releases. Download `LifeArc.apk` directly. Permanent link to the newest build:
   `https://github.com/<you>/<repo>/releases/latest/download/LifeArc.apk`

Keep updates installable: without secrets, every build gets a new signing key and Android will ask you to uninstall first.
To keep one key, run once:
`keytool -genkeypair -keystore release.jks -alias lifearc -keyalg RSA -keysize 2048 -validity 10000`
then add repo secrets `KEYSTORE_B64` (output of `base64 -w0 release.jks`) and `KEYSTORE_PASSWORD` (use the same password for store and key). Never commit release.jks.

## Launch screen
Every app start shows a full-screen black splash for 1 second: the cover image at icon size, centred, with the tagline under it (`src/Splash.jsx`). The native Android launch screen (black + same logo, `resources/splash/`) appears before it, so Capacitor's default image never shows.

## Challenge (friends comparison) — one-time Firebase setup
1. console.firebase.google.com -> Add project (Google Analytics can be off).
2. Build -> Authentication -> Get started -> Sign-in method -> **Anonymous** -> Enable -> Save.
3. Build -> Firestore Database -> Create database -> location `asia-south1` (Mumbai) -> **Production mode**.
4. Firestore -> **Rules** tab -> replace everything with the contents of `firestore.rules` -> Publish.
5. Project settings (gear) -> Your apps -> add a **Web** app (`</>`) -> copy `apiKey`, `authDomain`, `projectId`, `appId` into `src/firebase-config.js`.
6. Optional: put your GitHub Releases link in `APP_LINK` (it is added to the WhatsApp invite).
7. Commit and push. GitHub builds the new APK.

Friends see only daily percentages, only after they accept. Max 6 friends per person.

## Auto backup (phone number + PIN, no OTP) and previous days
- Profile (top-right circle) > "Backup with your phone number": enter the 10-digit phone, choose a 6-digit PIN, tap **Turn on backup**. Do this once. The Today tab shows a red reminder until it is on.
- After that it is fully automatic: a few seconds after every change, whenever you leave or reopen the app, when the internet comes back, and every 2 minutes as a retry. A change made offline is kept and sent later, even if you close the app first.
- Profile shows "Last saved ... ago". **Back up now** forces a save.
- The first save of each day keeps the previous cloud copy as an **older copy**. If you delete something by mistake, open Profile > **Older copy** to go back to it.
- After a reinstall: open Profile, enter the same phone and PIN, tap **Restore**.
- Firestore rules: **no change needed** for auto backup or the older copy (they use the same `backups` section and fields). If you have never published the current `firestore.rules`, publish it once or backup shows "Firebase blocked this".
- Today tab: tap any of the last 14 days to check or fix that day's habits.
- Not backed up: custom ringtone files (local to the phone) and Challenge friends (a reinstall creates a new Challenge ID, so add friends again).
