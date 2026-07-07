# Runbook — Mobile dev build (EAS)

Grid's mobile app now uses **native modules** (LiveKit video, Sentry, RevenueCat IAP)
that don't exist in Expo Go. From here the app runs in a **custom dev-client build**,
not Expo Go. This is a one-way workflow change (the code degrades gracefully in Expo Go
— chat works, video/IAP/Sentry are no-ops — but to exercise the native features you
need a dev build).

## One-time setup

```sh
npm i -g eas-cli
cd apps/mobile
eas login                 # the owner's Expo account
eas build:configure       # links the project (writes the EAS project id)
```

Set the mobile env for builds (EAS secrets or the `eas.json` profile `env`):

```sh
eas secret:create --name EXPO_PUBLIC_API_URL       --value https://<your-api-host>
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN     --value <sentry dsn>
eas secret:create --name EXPO_PUBLIC_REVENUECAT_KEY --value <appl_/goog_ sdk key>
```

## Build & install the dev client

```sh
# Android APK you can sideload on your phone (same network as the API):
eas build --profile development --platform android
# → download the APK from the EAS link, install it, then:
npx expo start --dev-client     # scan the QR with the dev client (not Expo Go)
```

For a physical Android device talking to a laptop API, set the dev profile's
`EXPO_PUBLIC_API_URL` to the laptop LAN IP (`http://192.168.x.x:3001`), not localhost.
The `10.0.2.2` default in `eas.json` is the Android emulator's host alias.

iOS dev builds need an Apple Developer account (`eas build --profile development
--platform ios`) + a registered device UDID.

## What each native piece needs to actually work

| Feature            | Also requires                                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LiveKit video**  | Nothing extra — `LIVEKIT_*` already set on the API; the dev build renders the stage.                                                                                                                                                                                          |
| **Sentry**         | `EXPO_PUBLIC_SENTRY_DSN` (reuse the API's project or a new one).                                                                                                                                                                                                              |
| **RevenueCat IAP** | Products/entitlements in RevenueCat + App Store Connect / Play Console, the platform SDK key (`EXPO_PUBLIC_REVENUECAT_KEY`), and `REVENUECAT_WEBHOOK_AUTH` on the API set to the dashboard webhook secret. Diamonds are credited by the **server webhook**, never the client. |

## Preview / production

```sh
eas build --profile preview     --platform android   # internal APK
eas build --profile production   # store builds
eas submit  --profile production                       # upload to the stores
```

OTA JS-only updates ship via `eas update` on the matching channel (dev/preview/production).
