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
