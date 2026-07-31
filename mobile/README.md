# Almost Human Mobile — Step 7

This directory contains the Expo SDK 54 native shell for Almost Human 8.3.

## Local gates

```bash
npm install
npm run doctor
npm run typecheck
npm run lint
npm run preflight:quadruple
npx expo export --platform ios --output-dir dist-ios
npx expo export --platform android --output-dir dist-android
```

The canonical PWA is compiled into `assets/almost-human.html` and `src/almostHumanHtml.ts` by:

```bash
cd ..
node scripts/build-inline.mjs
```

Never edit `src/almostHumanHtml.ts` by hand.

## Native features

- Offline bundled life experience
- Native safe area and cinematic first-light loader
- Native haptics and share sheet
- Optional local Haven reminder
- Deep links: `almost-human://home`, `almost-human://talk`, `almost-human://grow`, `almost-human://memories`, `almost-human://haven`, `almost-human://settings`
- WebView crash recovery and pull-to-refresh

## Release

Use the two manual workflows in the repository root. The build workflow requires the exact phrase `BUILD_ONCE` and refuses a duplicate after a successful build record exists.
