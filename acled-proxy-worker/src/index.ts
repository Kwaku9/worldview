export interface Env {
  ACLED_EMAIL: string;
  ACLED_KEY: string; // password
}

// In-memory session cache (per Worker isolate)
let sessionCookie: string | null = null;
let sessionExpiry = 0;

async function getSessionCookie(env: Env): Promise<string> {
  if (sessionCookie && Date.now() < sessionExpiry) return sessionCookie;

  // Drupal session login
  const resp = await fetch("https://acleddata.com/user/login?_format=json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      name: env.ACLED_EMAIL,
      pass: env.ACLED_KEY,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ACLED login failed (${resp.status}): ${text.substring(0, 300)}`);
  }

  // Extract Set-Cookie header(s)
  const cookies = resp.headers.getAll?.("set-cookie") ?? [resp.headers.get("set-cookie") || ""];
  const sessionCookies = cookies
    .filter((c: string) => c.length > 0)
    .map((c: string) => c.split(";")[0])
    .join("; ");

  if (!sessionCookies) throw new Error("No session cookie returned from ACLED login");

  sessionCookie = sessionCookies;
  sessionExpiry = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
  return sessionCookie!;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" } });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    // Accept /acled/* — forward to ACLED API
    if (!url.pathname.startsWith("/acled")) {
      return new Response("Not found", { status: 404 });
    }

    try {
      const cookie = await getSessionCookie(env);

      // /acled/acled/read?... → https://acleddata.com/api/acled/read?...
      const apiPath = url.pathname.replace(/^\/acled/, "");
      const targetUrl = `https://acleddata.com/api${apiPath}?${url.searchParams.toString()}`;

      const resp = await fetch(targetUrl, {
        headers: {
          Cookie: cookie,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
      });

      const body = await resp.text();

      return new Response(body, {
        status: resp.status,
        headers: {
          "Content-Type": resp.headers.get("Content-Type") || "application/json",
          "Cache-Control": "public, max-age=3600",
          ...corsHeaders,
        },
      });
    } catch (err: any) {
      return Response.json(
        { error: err.message },
        { status: 502, headers: corsHeaders }
      );
    }
  },
};
