export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = "/phonetic-transcriber/proxy";

    if (!url.pathname.startsWith(prefix)) {
      return new Response("Not found", { status: 404 });
    }

    const targetPath = url.pathname.slice(prefix.length) || "/";
    const targetUrl = "https://phonetic-transcriber-production.up.railway.app" + targetPath + url.search;

    const headers = new Headers(request.headers);
    headers.set("x-api-key", env.API_KEY);
    headers.delete("host");

    const resp = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    });

    return new Response(resp.body, resp);
  }
}
