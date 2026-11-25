const SERVICE_ORIGIN = "https://app.xpromptvs.ai";

function sharedServiceRoute({ method }, path) {
  if (path === "/pair") return method === "POST";
  if (path === "/turn-creds") return method === "GET";
  if (/^\/session\/[\w-]{1,64}$/.test(path)) return method === "GET";
  if (/^\/credential\/[\w-]{4,344}$/.test(path)) return method === "GET";
  return /^(?:GET|POST)$/.test(method) && /^\/directory\/[\w-]{43}(?:\/[a-z]+)?$/.test(path);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (sharedServiceRoute(request, url.pathname)) {
      const upstream = new URL(SERVICE_ORIGIN);
      upstream.pathname = url.pathname;
      upstream.search = url.search;
      const outgoing = new Request(upstream, request);
      // The browser URL can carry pairing credentials. Only send data the service protocol needs.
      outgoing.headers.delete("Referer");
      outgoing.headers.delete("Cookie");
      return fetch(outgoing, { redirect: "manual" });
    }

    if (url.pathname === "/app/") {
      url.pathname = "/app";
      return Response.redirect(url, 308);
    }
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/app") {
      url.pathname = "/";
      url.search = "";
      const asset = await env.ASSETS.fetch(new Request(url, request));
      const headers = new Headers(asset.headers);
      headers.set("Referrer-Policy", "no-referrer");
      return new Response(asset.body, { status: asset.status, headers });
    }

    return env.ASSETS.fetch(request);
  },
};
