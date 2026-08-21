# Hosting WorldView on the public internet

**You probably do not need this.** WorldView is a static bundle plus a proxy
tier; `docker compose --profile prod up` gives you the whole thing on
`localhost:8080` and every layer works. Read on only if you want it reachable
from outside your machine.

What follows is the pattern the reference deployment uses, with its hostnames,
zone and credentials removed. It is one way, not the way — but it is a way that
has survived real traffic, and the failure modes below were all paid for once
already.

---

## The shape

```
visitor ──► Cloudflare edge ──► tunnel ──► cloudflared ──► Traefik ──► worldview
                                (outbound)                  :443        :80
```

The host opens **no inbound ports at all**. `cloudflared` dials *out* to
Cloudflare and traffic returns down that connection. Consequences worth
understanding before you copy it:

- Works behind NAT, CGNAT, or a residential connection with no static IP.
- Your origin address is never published, so it cannot be attacked directly.
- Volumetric attacks are absorbed at the edge, not by your host.
- **It also means nothing can reach you that you did not dial out for** — which
  is a real constraint, not just a benefit. Anything needing genuine inbound
  connectivity (WebRTC media, for instance) will not work over this.

If you would rather not use a tunnel, publish `:443` and skip `cloudflared`;
everything below still applies except the trusted-IP section, which gets
*simpler*, not harder.

---

## TLS

The reference uses a **wildcard certificate via the DNS-01 challenge**, not
HTTP-01. That is not a preference — with a tunnel there is no inbound path for
an HTTP-01 challenge to arrive on, so DNS-01 is the only option that works.

You need an API token from your DNS provider with permission to **edit DNS
records for that zone only**. Scope it to the single zone. A token that can edit
every zone on the account is not necessary here and will eventually be pasted
somewhere it should not be.

```yaml
# traefik.yml (static)
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint: { to: websecure, scheme: https, permanent: true }
  websecure:
    address: ":443"
    http:
      tls:
        certResolver: dns-provider
        domains:
          - main: "example.com"
            sans: ["*.example.com"]
```

A wildcard means adding a second service later is a DNS record and a router,
with no new certificate issuance and no rate-limit risk.

---

## The trap that makes CrowdSec useless

This is the one to read twice.

Behind a tunnel, every request arrives at Traefik from **the tunnel container**,
not from the visitor. So unless you say otherwise:

- your access log records the same private address for every request
- real source IPs and countries are invisible
- and CrowdSec, which whitelists private ranges by default, decides that
  **100% of your traffic is internal and bans nobody, ever**

It does not error. It does not warn. You get a security control that appears
installed, appears healthy, and does nothing. The reference deployment ran that
way until someone asked why the ban count was zero.

The fix is to tell Traefik which upstream is allowed to speak for the client:

```yaml
  websecure:
    address: ":443"
    forwardedHeaders:
      trustedIPs:
        - "10.89.0.0/24"     # the container network your tunnel runs on
        - "127.0.0.1/32"
```

**This is only safe because `:443` is not reachable from the internet.** The
tunnel is the sole path in, so nothing outside can forge `X-Forwarded-For`. If
you publish `:443` directly, do **not** blanket-trust a subnet — trust only your
actual proxy addresses, or you have handed every visitor the ability to claim
any source IP they like, including ones on your allowlist.

Verify it rather than believing it: make a request from a phone on mobile data
and confirm the access log shows the phone's address, not a `10.x` one.

---

## CrowdSec

Two moving parts, and they are easy to confuse:

1. **The engine (LAPI)** reads Traefik's access log, matches behaviour against
   scenarios, and writes decisions.
2. **The bouncer** enforces them. Here it is a Traefik plugin, so blocking
   happens at the edge of your stack rather than inside the app.

```yaml
# traefik dynamic config
http:
  middlewares:
    crowdsec:
      plugin:
        crowdsec-bouncer:
          enabled: true
          crowdsecLapiScheme: http
          crowdsecLapiHost: "crowdsec:8080"
          crowdsecLapiKey: "<bouncer key — generate with cscli, keep it out of git>"
          crowdsecMode: stream          # poll decisions periodically
          updateIntervalSeconds: 60
          clientTrustedIPs:             # never ban these, whatever they do
            - "10.89.0.0/24"
            - "127.0.0.0/8"
```

`stream` mode pulls the decision list on a timer instead of asking the engine
about every single request. It costs you up to `updateIntervalSeconds` of delay
before a new ban applies, and buys you an engine outage that degrades to
"nothing is blocked" rather than "nothing is served".

For the engine to see anything, Traefik's access log must be a file CrowdSec can
read — a shared volume between the two containers — and CrowdSec needs the
Traefik parser collection installed.

**Check it works before you trust it.** `cscli decisions list` after deliberately
tripping a scenario is the only proof. A running container is not evidence.

---

## Routing WorldView itself

Nothing special — one router, one service:

```yaml
http:
  routers:
    worldview:
      rule: "Host(`geo.example.com`)"
      entryPoints: [websecure]
      service: worldview
      tls: {}
      middlewares: [crowdsec]
  services:
    worldview:
      loadBalancer:
        servers:
          - url: "http://worldview:80"
```

Point it at the **`prod`** container (nginx, port 80). The reference deployment
spent months pointing at the `dev` target — a Vite dev server with hot reload
and the source tree mounted — without noticing, because it worked. It meant the
production nginx config was never exercised and had silently rotted. Check what
your router actually resolves to.

---

## Two failure modes this deployment actually hit

**Containers that die stay dead.** A container removed by hand, or an image
reaped by `podman image prune -af`, does not come back on reboot unless
something is responsible for starting it. WorldView vanished this way: the
router still resolved, the upstream port had nothing listening, and every
request became a 502. If your process manager does not own the container,
assume it will be gone one day.

**A healthy proxy is not a healthy app.** Every route returning 502 while a
different hostname on the same Traefik returned 200 is what proved the edge was
fine and the app was missing. Keep one known-good route to compare against —
diagnosis with no control is guesswork.

---

## What not to copy

- Trusted-IP ranges: they describe *this* container network. Use yours.
- The bouncer key, tunnel token and DNS token: generate your own, and keep them
  out of the repo. Ansible Vault, Docker secrets or `wrangler secret` are all
  fine; a `.env` committed "temporarily" is not.
- Access policies: the reference sits some hostnames behind an identity proxy
  and leaves others public. That decision is yours and depends on what you are
  exposing.
