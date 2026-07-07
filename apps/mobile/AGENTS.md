# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

This app is pinned to **SDK 54** on purpose: the owner previews on a physical phone with
the Play Store build of Expo Go, which supports SDK 54 only (SDK 55+ requires sideloading
from https://expo.dev/go). Do not bump the Expo SDK without confirming the store build
supports it.

## Now a dev-client build (not Expo Go)

The app uses native modules — LiveKit (video), Sentry, RevenueCat (IAP) — that Expo Go
can't load. It runs in a custom EAS dev build; the native pieces are lazy-loaded and
degrade to no-ops in Expo Go (chat still works). To exercise video/IAP/Sentry, build the
dev client — see docs/runbooks/mobile-dev-build.md. Native deps are pinned to Expo SDK 54.
