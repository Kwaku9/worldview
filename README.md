# WorldView

A real-time geospatial intelligence globe in a browser. Live aircraft, orbiting
satellites, earthquakes, weather radar, thousands of traffic cameras, wildfire
detections, shipping, conflict events and lunar trajectories, drawn on a
photorealistic 3D Earth with CRT, night-vision and thermal display modes.

CesiumJS, TypeScript, no framework. Containerised.

---

## Run it

```bash
git clone <this repo> && cd worldview
docker compose --profile prod up --build
```

Open <http://localhost:8080>.

That is the whole thing. **No API keys, no accounts, no signup.**

With an empty configuration you get, verified on a clean build:

| Layer | Working with zero keys | Source |
|---|---:|---|
| Traffic cameras | 13,711 across 10 cities | six state DOT feeds |
| Satellites | 420 | CelesTrak orbital elements |
| Borders | 333 | bundled |
| Earthquakes | 102 | USGS |
| Aircraft | live | adsb.lol (OpenSky fallback) |
| Weather radar | global | RainViewer |

Plus the globe itself, using imagery bundled with Cesium.

## Then add keys, if you want more

Copy `.env.example` to `.env` and fill in whatever you care about. Every value
is optional and every one is documented in that file, including where to get it.

The one worth having is **Google Maps Platform**: without it the globe uses
Natural Earth II, which looks right from orbit and goes featureless as you zoom
in. Every data layer keeps working at any altitude — it is the ground beneath
them that loses detail.

`.env.example` also explains the distinction that catches people out: `VITE_*`
values are inlined by Vite at **build** time and end up readable in the bundle,
so they must be keys you can restrict. Everything else is read server-side and
never reaches the browser.

## What will not work, and why

Three things cannot be fixed by adding a key, and the app tells you so rather
than failing silently:

- **Conflict events (ACLED).** ACLED issues no API key — access is a login
  session — so this layer needs a small service that can hold one. One is
  included in `acled-proxy-worker/`; you supply the account.
- **Maritime and Threats.** Both read from companion services rather than public
  APIs. Absent, their routes return 502 and the layers stay empty. Point
  `AIS_RELAY_URL` and `THREATS_URL` at your own equivalents to enable them.

## Development

```bash
npm install
npm run dev          # http://localhost:5173, hot reload
npm run gen:nginx    # regenerate nginx.conf after changing routes
npx tsc --noEmit     # typecheck
```

### Adding a data source

Declare it once, in **`proxy-routes.mjs`**. Both the dev server and the
production nginx config are generated from that file.

This matters more than it looks. The two used to be maintained separately and
drifted until the container served a third of the routes the dev server did —
and nobody noticed, because production was accidentally running the dev target.
Editing `nginx.conf` by hand recreates that bug; it is generated, and says so at
the top.

```js
{ path: '/api/yourthing', target: 'https://api.example.com', rewriteTo: '',
  why: 'one line, ends up as a comment in the generated config' }
```

Then `npm run gen:nginx` and rebuild.

### Layout

```
src/globe/      viewer, camera, points of interest
src/layers/     one directory per data layer — the bulk of the app
src/ui/         panels, HUD, controls
src/net/        request orchestration and rate budgeting
proxy-routes.mjs   every upstream, in one table
scripts/gen-nginx.mjs   that table -> nginx.conf
```

## Hosting it publicly

See **[HOSTING.md](HOSTING.md)** — the tunnel, TLS, and intrusion-prevention
pattern the reference deployment uses, including the trusted-IP mistake that
makes CrowdSec silently ban nobody.

## Where this came from

WorldView was reverse-engineered from a YouTube demo on 1 March 2026, in a day.
A transcript went through a custom `reverse_engineer_project` prompt to produce
a buildable specification; the first containerised version with three data
layers was running the same day. It has fourteen layers now.

## Credits and terms

Every data source belongs to somebody. Several are free only for
non-commercial use, and at least one requires you to register before querying
it. Check the terms of anything you switch on — the links are in
`.env.example`. Built on [CesiumJS](https://cesium.com/platform/cesiumjs/).
