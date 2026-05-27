# webos-moontv

LG webOS 4 TV app work for MoonTVPlus.

This repo now contains two deliverables:

1. A TV-optimized MoonTVPlus frontend intended to be hosted under the same MoonTVPlus origin, ideally at `/tv/index.html`.
2. An installable webOS launcher package that opens that hosted frontend on LG TVs.

This architecture is deliberate:

- MoonTVPlus authentication and playback APIs work best same-origin.
- A hosted frontend avoids fragile cross-origin cookie and proxy edge cases on webOS 4.
- The launcher still gives you a normal installable webOS app package.
- Cross-origin loading of the TV frontend is not a supported authenticated runtime for MoonTVPlus; deploy it under the MoonTVPlus origin.

## Structure

- `hosted/`: TV UI that talks to MoonTVPlus APIs.
- `launcher/`: webOS package files (`appinfo.json`, launcher page, icons).
- `scripts/build.mjs`: copies deliverables into `dist/`.
- `scripts/install-into-moontvplus.mjs`: installs the hosted UI into a local MoonTVPlus checkout.

## Build

```bash
npm run build
npm run verify
```

Outputs:

- `dist/hosted`
- `dist/moontvplus-public/tv`
- `dist/launcher`

If you want the launcher to ship with a prefilled hosted URL:

```bash
WEBOS_APP_URL="https://your-moontv-host/tv/index.html" npm run build
```

When `WEBOS_APP_URL` is set, the launcher package is built in auto-launch mode and opens that hosted frontend automatically after a short delay on startup.

If you do not set `WEBOS_APP_URL`, the packaged launcher starts with a blank URL field and expects the user to enter the hosted TV frontend address manually on first run.

## Deploy With MoonTVPlus

1. Build this repo:

```bash
npm run build
```

2. Copy the hosted TV frontend into a MoonTVPlus checkout:

```bash
npm run deploy:moontvplus -- /path/to/MoonTVPlus
npm run validate:deploy -- /path/to/MoonTVPlus
```

That installs the frontend into:

```text
/path/to/MoonTVPlus/public/tv
```

It also patches MoonTVPlus `src/middleware.ts` idempotently so `/tv/index.html`
stays publicly reachable and the TV frontend can load before the user signs in.

3. Deploy or restart MoonTVPlus.

4. Open the hosted frontend at:

```text
https://your-moontv-host/tv/index.html
```

## Package The LG webOS App

The launcher package lives in `dist/launcher` after build.

Using LG CLI tools:

```bash
npm run package:webos
```

This rebuilds `dist/launcher` first, then wraps `ares-package dist/launcher` and creates the installable `.ipk` package.

To bake in a production hosted URL while packaging:

```bash
WEBOS_APP_URL="https://your-moontv-host/tv/index.html" npm run package:webos
```

Then install it:

```bash
npm run install:webos -- <device-name>
```

Launch it:

```bash
npm run launch:webos -- <device-name>
```

To see configured devices, use:

```bash
./node_modules/.bin/ares-setup-device --help
./node_modules/.bin/ares-install -D
```

## Current Feature Scope

Implemented now:

- MoonTVPlus server URL configuration
- login against `/api/login`
- token/header-based authenticated API calls
- token refresh via `/api/auth/refresh`
- search via `/api/search`
- detail loading via `/api/source-detail`
- episode browsing
- HTML5 playback
- favorites sync UI via `/api/favorites`
- play history sync UI via `/api/playrecords`
- native subtitle track selection UI
- directional remote navigation with geometric focus movement
- installable webOS launcher
- local on-TV favorites/history fallback when MoonTVPlus storage mode does not support those sync APIs

Not fully implemented yet:

- advanced MoonTVPlus source switching and fallback heuristics
- HLS.js-based compatibility layer for TVs that need stricter `.m3u8` handling
- deeper webOS-specific focus graph and key-mapping refinements

## Verification

This repo currently verifies:

- file presence
- launcher manifest shape
- JavaScript syntax
- distribution build output
- hosted frontend smoke flow
- launcher smoke flow

Run:

```bash
npm run verify
```

## GitHub Actions

- Pull requests and pushes run syntax checks, package the webOS app, and run verification.
- Pushing a `v*` tag creates a GitHub release and attaches the built `.ipk` package.
- Release tags are validated against both `package.json` and `launcher/appinfo.json` versions.
- Set the repository variable `WEBOS_APP_URL` if release builds should auto-launch a hosted TV frontend by default.
