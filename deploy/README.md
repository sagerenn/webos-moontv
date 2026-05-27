# Deployment Notes

## Recommended Topology

Use the hosted frontend and serve it from the same MoonTVPlus origin:

- MoonTVPlus main site: `https://moontv.example.com/`
- TV frontend: `https://moontv.example.com/tv/index.html`

Then configure the launcher to open:

```text
https://moontv.example.com/tv/index.html
```

## Why Same-Origin

MoonTVPlus has authenticated API routes and playback proxy routes such as:

- `/api/login`
- `/api/search`
- `/api/source-detail`
- `/api/auth/refresh`
- `/api/proxy/vod/m3u8`

Running the TV frontend same-origin avoids webOS browser differences around:

- cookies
- protected proxy endpoints
- cross-origin media fetching
- CORS behavior on streamed playback
- authenticated `/api/*` requests that otherwise need cross-origin `Authorization` preflights MoonTVPlus does not expose for this TV flow

## MoonTVPlus Integration

This repo copies static TV assets into MoonTVPlus `public/tv` and adds an
idempotent middleware bypass for `/tv` in `src/middleware.ts`, because the TV
frontend must be reachable before MoonTVPlus login redirects run:

```bash
npm run deploy:moontvplus -- /path/to/MoonTVPlus
```

If the MoonTVPlus backend is running in a storage mode where `/api/favorites`
or `/api/playrecords` are not usable, the TV frontend falls back to per-user
storage on the TV itself and keeps search/detail/playback working.
