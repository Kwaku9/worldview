# Data terms

The MIT licence in `LICENSE` covers **this source code**. It does not, and
cannot, cover the data this software retrieves.

Every upstream sets its own terms, and they differ sharply:

- Several are free **only for non-commercial use**.
- At least one (ACLED) requires **registration and approval** before you may
  query it at all.
- One (airplanes.live) requires **written approval by email**, and refuses
  everyone else.
- Public-sector feeds — USGS, NASA FIRMS, CelesTrak, state transport cameras —
  are generally open, but attribution expectations vary.

Before you switch a layer on, read that provider's terms. The signup and
documentation links for every source are in `.env.example`, next to the
variable that enables it.

Rate limits are part of those terms. The anonymous tiers used here are a
courtesy, not an entitlement — poll on a timer, cache what you can, and do not
make a shared free service pay for your traffic.
