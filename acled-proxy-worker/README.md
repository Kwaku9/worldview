# ACLED proxy

ACLED publishes conflict and protest event data, and it is the one source in
WorldView with no API key. Access is a **Drupal session**: you POST an email and
password to `acleddata.com/user/login`, keep the cookie, and send it with each
query.

That cannot live in the browser — CORS blocks it, and your password would be
readable in the bundle — and it cannot live in nginx either, which has nowhere
to hold a session. So it needs a small service. This is one.

It logs in on first use, caches the cookie for 12 hours, and forwards
`/acled/*` to ACLED's API. Nothing about it is Cloudflare-specific; it is a
Worker only because that is free and needs no server.

## Deploy

1. Register at <https://acleddata.com/register/> and confirm the account is
   approved — ACLED gates access, and an unapproved account authenticates fine
   then returns **403 Access denied** on every query, which reads like a bug.
2. Set your credentials as secrets. They never enter the repo:

   ```
   npx wrangler secret put ACLED_EMAIL
   npx wrangler secret put ACLED_KEY      # your ACLED password
   ```

3. `npx wrangler deploy`
4. Put the resulting URL in WorldView's `.env` as `VITE_ACLED_PROXY_URL`.

## Checking it

`GET /health` returns `{"status":"ok"}` **without touching ACLED** — it proves
the Worker is up, nothing more. To test the actual data path:

```
curl "https://<your-worker>/acled/acled/read?limit=5&region=11"
```

A `403` here means the Worker reached ACLED and ACLED refused the session —
expired or unapproved credentials — rather than the Worker being broken. The two
failures look identical from the app, which is why the layer reports them
differently.

The doubled `/acled/acled/` is not a typo: the first segment routes to this
Worker, the second is ACLED's own path.
