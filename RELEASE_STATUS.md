# Almost Human 8.3 release status

## Certified source

- Almost Human 8.3 **The Haven** product pass is implemented.
- Premium PWA remains local-first and cloud-restorable.
- The Expo SDK 54 iOS/Android shell is implemented with offline bundled content, haptics, safe areas, native share, local reminders, deep links, loading, and recovery states.
- The Step 7 mobile static preflight passed 73 checks four consecutive times.
- No Expo/EAS build credit has been used for Almost Human.

## Controlled TestFlight path

The exact source and two manual GitHub workflows are ready. Remaining external identity steps are intentionally unresolved rather than guessed:

1. Create the canonical empty GitHub repository `wscott2k26/AlmostHuman`.
2. Add the `EXPO_TOKEN` repository secret.
3. Upload this source to `main`.
4. Run `Almost Human Step 7 iOS Build` once with `BUILD_ONCE`.
5. Create the matching App Store Connect app record if Apple does not already have one.
6. Run `Submit Existing Almost Human Build to TestFlight` with the real numeric App Store Connect ID.

A successful EAS iOS build or TestFlight upload has **not** yet been claimed.
