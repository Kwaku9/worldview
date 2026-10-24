# Data terms

The MIT licence in `LICENSE` covers **this source code**. It does not, and
cannot, cover the data this software retrieves.

Every upstream sets its own terms, and they differ sharply:

- Several are free **only for non-commercial use**.
- At least one (ACLED) requires **registration and approval** before you may
  query it at all.
- Aircraft come from adsb.lol, whose data is licensed **ODbL**: attribution
  and share-alike apply to the data.
- Public-sector feeds — USGS, NASA FIRMS, CelesTrak, state transport cameras —
  are generally open, but attribution expectations vary.

Before you switch a layer on, read that provider's terms. The signup and
documentation links for every source are in `.env.example`, next to the
variable that enables it.

Rate limits are part of those terms. The anonymous tiers used here are a
courtesy, not an entitlement — poll on a timer, cache what you can, and do not
make a shared free service pay for your traffic.

# Third-party code

`src/globe/icons.ts` ports the aircraft silhouettes and type-aware aircraft
classifier from God's Eye View (https://github.com/bilawalsidhu/gods-eye-view,
MIT, Copyright (c) 2026 Bilawal Sidhu), which in turn adapts glyphs and ICAO
type sets from skylight (https://github.com/cpaczek/skylight, MIT). The lock-on
and share-link behaviour follows God's Eye View's design; that code is
original to this repository. The full MIT permission notice is reproduced at
the top of `src/globe/icons.ts`.
