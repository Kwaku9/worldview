# How WorldView happened

Reconstructed from the working sessions that produced it, which were recorded as
they happened. Dates and details are from that record, not from memory.

The short version: **a YouTube video became a running OSINT platform in a single
day**, then spent five months accumulating layers, and one afternoon being
rescued from the machine it had only ever existed on.

---

## Day one — 1 March 2026

### The video

It started with someone else's demo. A YouTube video showed a Palantir-flavoured
3D globe — the pitch was *"what if Google Earth and Palantir had a baby"* — built
by an ex-Google PM who had worked on Maps 3D.

Rather than watch it and take notes, the transcript was pulled and run through a
prompt written for exactly this: **`reverse_engineer_project`**, a custom Fabric
pattern whose brief is to extract every technical detail from a demo and emit a
document someone could build from. Its instructions are explicit about the thing
that makes such a document trustworthy — separate what was *stated* from what is
being *inferred*, and say which is which.

The output was a specification: one-line summary, complete tech stack with
reasoning for each inference, every feature catalogued, every data source
identified, the architecture, and what runs where.

**This is the part worth stealing.** Not the globe — the move of turning a
capability you have watched into a capability you can build, in one pass, with a
tool you wrote once and reuse.

### The build

The specification became a plan, and the plan was executed the same day:

- **CesiumJS 1.138**, vanilla TypeScript, deliberately no framework
- **Vite 6**
- Google Photorealistic 3D Tiles as the globe surface
- Post-processing shaders for CRT, night-vision and thermal display modes
- **Containerised from day one** — which is the reason this could be packaged at
  all, five months later

By the end of the day: three data layers — civil flights, military flights,
satellites — behind a domain, with TLS.

### The same day, again

Two more sessions followed before the day ended. One reviewed the deployment and
planned what came next. The other took the layer count from **three to eight**,
working from twenty-one reference screenshots and the original transcript:
earthquakes, expanded satellites from CelesTrak, street traffic, weather radar
and public traffic cameras.

---

## The next four days

**3 March — "Aegis Globe."** A larger enhancement pass: live ISS tracking, ACLED
conflict data, NASA FIRMS thermal anomalies, retractable panels. The dashboard
stopped being a demo and became a command centre.

**4 March — the threat map.** A request arrived mid-conversation: show attacks on
this host as they arrive, animate them, colour-code by exploit type, and let me
click an attacker to pull OSINT on them. That became the Threats layer, fed from
the intrusion-prevention system already running on the box.

**5 March — the first architectural correction.** The weather layer did not work,
and the reason was structural: the viewer runs with `globe: false` because the
globe *is* Google's 3D tiles, and NOAA's WMS overlay needs a conventional imagery
layer to draw on. It was rewritten against RainViewer, which serves tiles.
Camera coverage was widened the same day with Caltrans and Florida 511 feeds.

**7 March** — a reboot took the stack down; WorldView joined the deployment
summary so it would come back with everything else.

---

## Then it lived

**19 March** — points of interest turned out to be saved camera positions rather
than a data layer, and a `/add-poi` skill was written to add them. It wrote to a
local staging copy that did not reach the live source, which is the first
recorded instance of the problem that defined this project's later life: **the
box was the only real copy.**

**13 April** — the host pegged at 99.99% CPU during a deploy. WorldView survived
on one retry after a quoting fix.

**23 May** — the CrowdSec threat dashboard gained a geomap whose markers link
into WorldView filtered by country. Two tools that grew separately were wired
together.

**26 June** — the globe went blank. Every secret in the live `.env` was the
literal string `VAULT_OVERRIDE`, so tiles were requested with
`?key=VAULT_OVERRIDE`, Google returned **HTTP 400**, and because the viewer has
no fallback surface when Google fails, the result was a black void rather than an
error. Fixed, and the fallback added — which is why an empty configuration now
yields Natural Earth imagery instead of nothing.

**30 July** — an infrastructure audit flagged that the running container was
hand-made and that the deployment role would replace it, calling it *"the top
redeploy risk."* The same session could not verify the globe actually rendered,
because the site sits behind an identity proxy.

That warning was correct, and it aged badly.

---

## 21 August 2026 — the rescue

The container was gone. Not stopped — **absent**, along with its image, most
likely reaped by an image prune. The router still resolved, nothing listened on
the port, and every request returned 502.

Nothing was lost, because the source was still on disk. But it had **never been
in version control**: 8,304 lines of TypeScript across 51 files and 14 layers,
developed over SSH directly on a host, with the only copies being that directory
and a partial sync. One `rm -rf` from gone.

Packaging it revealed what five months of working-on-the-box had accumulated:

- The dev server had **19 proxy routes** and the production nginx config had
  **six** — and nobody had noticed, because production was running the *dev*
  target, so the production config was never exercised.
- A route ending in `.json` never reached its upstream at all: an nginx regex
  location outranks a prefix location, so the static-asset rule was answering
  camera requests from the filesystem.
- The `docker compose` production profile passed **no configuration whatsoever** —
  no build arguments, no environment — so it produced a keyless build regardless
  of what was configured.
- The aircraft feed had been dead since airplanes.live moved to approval-only in
  August. Restoring it meant switching to OpenSky — which the module had been
  *named* after all along, having been quietly rewritten at some point to call
  somewhere else.
- The conflict layer pointed at a personal Cloudflare Worker whose URL was
  hardcoded in the client, so any copy of this would call someone else's
  infrastructure.

None of these were visible from the running site. All of them were visible the
moment something tried to run it from a clean clone.

---

## What the record shows

Two things, mainly.

**The reverse-engineering step was the leverage.** Video to buildable
specification to running container, in a day, because the hard part — extracting
a design from a demonstration — had been turned into a tool instead of an
afternoon.

**Everything that later broke was a copy problem, not a code problem.** A staging
file that never synced. A production config never exercised because production
was running something else. A container nothing owned. A source tree that existed
in one place. The globe was fine the whole time; what rotted was every assumption
about *where it lived*.

Which is what this package is: the same capability, in a form that does not
depend on one machine remembering it.
