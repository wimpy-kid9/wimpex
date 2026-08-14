# WIMPEX mobile app — Capacitor setup

This wraps the live WIMPEX site in a native shell for the App Store and
Play Store. Because WIMPEX has real server-side API routes (Supabase auth,
WebRTC signaling, uploads), the shell points at your deployed URL
(`capacitor.config.ts` → `server.url`) rather than bundling a static
export — the app you ship is the same app running at wimpex.app, just
inside a native wrapper with real native capabilities layered on top.

Everything in this repo (`capacitor.config.ts`, `www/index.html`, the
`package.json` scripts) is already set up. Everything below needs your own
machine — Xcode and Android Studio aren't available in a sandboxed
environment, so these steps can't be run for you.

## Prerequisites

- **Node.js** (already required for the rest of the project)
- **For Android:** [Android Studio](https://developer.android.com/studio), a free [Google Play Console account](https://play.google.com/console/signup) ($25 one-time)
- **For iOS:** a Mac with [Xcode](https://apps.apple.com/us/app/xcode/id497799835), an [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year)

If you're not on a Mac, you can still do all the Android steps yourself
and either borrow/rent a Mac (MacStadium, Codemagic, GitHub Actions macOS
runners) or have someone else run the iOS half — the config in this repo
doesn't change either way.

## 1. Install dependencies

```bash
npm install
```

This pulls in the Capacitor packages already added to `package.json`
(`@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`,
`@capacitor/push-notifications`, `@capacitor/assets`).

## 2. Confirm your production URL

Open `capacitor.config.ts` and check `PRODUCTION_URL` resolves to your
real deployed domain (it defaults to `NEXT_PUBLIC_SITE_URL`, falling back
to `https://wimpex.app`). If your live URL is different, either set
`NEXT_PUBLIC_SITE_URL` in your environment or just hardcode it in the file.

## 3. Add the native projects

```bash
npm run cap:add:ios
npm run cap:add:android
```

This generates `ios/` and `android/` folders — real Xcode and Android
Studio projects — in your repo root. They're checked into git normally
(Capacitor's convention, unlike React Native's more ephemeral native
folders).

Anytime you change `capacitor.config.ts` or install a new Capacitor
plugin, run:

```bash
npm run cap:sync
```

You do **not** need to re-run this for ordinary app changes (new features,
bug fixes, UI tweaks) — those live on your deployed site and the shell
picks them up automatically on next launch, same as a browser.

## 4. Add required permissions

Your app uses camera, microphone, and WebRTC (posting videos, calls) —
both platforms require explicit permission declarations or the app will
either crash or get rejected in review.

**iOS** — open `ios/App/App/Info.plist` and add:

```xml
<key>NSCameraUsageDescription</key>
<string>WIMPEX needs camera access to record videos and make video calls.</string>
<key>NSMicrophoneUsageDescription</key>
<string>WIMPEX needs microphone access to record audio and make calls.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>WIMPEX needs access to save photos and videos you create.</string>
```

**Android** — open `android/app/src/main/AndroidManifest.xml` and add
(inside `<manifest>`, before `<application>`):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

`INTERNET` is usually already present in the generated manifest — check
before duplicating it. Camera/mic permissions still need to be requested
at runtime on Android 6+; the browser's own `getUserMedia` permission
prompt (which your app already triggers for calls) handles this
automatically inside the WebView.

## 5. Icons and splash screen

Create a 1024×1024 `icon.png` and a 2732×2732 `splash.png` in an
`assets/` folder at the repo root (reuse `public/wimpex-logo-512.png` as
your source, upscaled, or export a fresh 1024px version), then run:

```bash
npm run cap:assets
```

This generates every required icon/splash size for both platforms
automatically.

## 6. Test on simulators and real devices

```bash
npm run cap:open:ios       # opens Xcode
npm run cap:open:android   # opens Android Studio
```

Run on a simulator first, then a real device before submitting —
specifically test:

- Signing up / logging in
- Posting a video (camera access)
- Starting and receiving a call (mic + camera permission prompts, audio
  actually playing — see the CallWindow fix from earlier)
- Push notification prompt appears (once step 7 below is wired up)

## 7. (Optional, recommended) Native push notifications

Your app already has web-push set up for the PWA, but web push is
unreliable on iOS while the app is backgrounded inside a WebView. For
real push notifications:

1. Add `@capacitor/push-notifications` handling in your app (already
   installed) — register for a token on launch, send it to a new
   `/api/push/register-device` endpoint.
2. **Android:** create a Firebase project, add `google-services.json` to
   `android/app/`.
3. **iOS:** enable Push Notifications capability in Xcode, create an APNs
   key in your Apple Developer account.
4. On your server, send pushes via FCM (Android) and APNs (iOS) instead
   of/alongside the existing web-push subscriptions.

This is a real feature addition, not just config — happy to build it out
with you when you're ready. It also meaningfully strengthens your App
Store review odds (see step 9).

## 8. Build, sign, and submit — Google Play

1. In Android Studio: **Build → Generate Signed Bundle / APK** → Android
   App Bundle.
2. Create a new keystore the first time (**back it up somewhere safe
   outside git** — losing it means you can never publish an update to
   this app again under the same listing).
3. Produces a `.aab` file.
4. In [Play Console](https://play.google.com/console): create the app,
   fill in the store listing (screenshots, description, a **privacy
   policy URL is required** since you handle calls/video/messages), set
   content rating, upload the `.aab`, submit for review.
5. Review is typically a few hours to a couple of days.

## 9. Build, sign, and submit — App Store

1. In Xcode, set your Team under **Signing & Capabilities**.
2. **Product → Archive**, then upload via the Organizer (or Transporter).
3. In [App Store Connect](https://appstoreconnect.apple.com): create the
   app listing, fill out the **Privacy Nutrition Label** (you collect
   camera, microphone, and messages data — be accurate here, Apple checks
   this against actual app behavior), add screenshots, submit for review.
4. Apple scrutinizes apps that are "just a wrapped website"
   ([Guideline 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)).
   Push notifications, native permission prompts, and the calling feature
   all count as real native functionality and help here — a bare
   read-only wrapper is the kind of thing that gets rejected.
5. Review is typically 1–3 days, sometimes longer for a first submission.

## Updating the app after launch

Because this is hosted mode, most updates (new features, bug fixes, UI
changes) ship the moment you deploy — no store review needed, since
users are just loading your live site inside the shell. You only need to
submit a **new build** to the stores when you change something in the
native layer itself: permissions, the Capacitor config, native plugins,
or the app icon/name.
