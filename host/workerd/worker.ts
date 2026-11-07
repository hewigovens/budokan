// Runs the Worker under workerd on a server in Japan, where enjoy-live answers.
// workerd has no KV, static-asset layer or cron, so this entry supplies all three around the unchanged app.
import app from "../../src/index";

interface HostEnv {
  STORE: Fetcher; // writable disk service holding one file per KV key
  PUBLIC: Fetcher; // read-only disk service over public/
}

// Only the systemd timer reaches this host name, over the loopback socket.
const REFRESH_HOST = "refresh.internal";

const TYPES: Record<string, string> = {
  png: "image/png", svg: "image/svg+xml", js: "text/javascript; charset=utf-8", txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8", webmanifest: "application/manifest+json",
};

// The subset of Workers' _headers syntax this project uses: a path pattern (`*` wildcard) and indented headers.
type Rule = { pattern: RegExp; headers: [string, string][] };
let rules: Promise<Rule[]> | undefined;
const parseRules = (text: string) => text.split("\n").reduce<Rule[]>((acc, line) => {
  if (!line.trim() || line.startsWith("#")) return acc;
  if (!/^\s/.test(line)) acc.push({ pattern: new RegExp(`^${line.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`), headers: [] });
  else acc.at(-1)?.headers.push(line.trim().split(/:\s*/, 2) as [string, string]);
  return acc;
}, []);

function kv(store: Fetcher): KVNamespace {
  const url = (key: string) => `http://store/${encodeURIComponent(key)}`;
  return {
    async get(key: string) {
      const res = await store.fetch(url(key));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`store get ${key} → HTTP ${res.status}`);
      return res.json();
    },
    async put(key: string, value: string) {
      const res = await store.fetch(url(key), { method: "PUT", body: value });
      if (!res.ok) throw new Error(`store put ${key} → HTTP ${res.status}`);
    },
  } as unknown as KVNamespace;
}

async function asset(env: HostEnv, path: string): Promise<Response | undefined> {
  if (path === "/" || path.endsWith("/") || path === "/_headers") return;
  const res = await env.PUBLIC.fetch(`http://public${path}`);
  if (!res.ok) return;
  const headers = new Headers({ "content-type": TYPES[path.split(".").pop()!] ?? "application/octet-stream" });
  rules ??= env.PUBLIC.fetch("http://public/_headers").then(async (r) => r.ok ? parseRules(await r.text()) : []);
  for (const rule of await rules) if (rule.pattern.test(path)) for (const [k, v] of rule.headers) headers.set(k, v);
  return new Response(res.body, { headers });
}

export default {
  async fetch(req: Request, env: HostEnv): Promise<Response> {
    const appEnv = { EVENTS: kv(env.STORE) };
    const url = new URL(req.url);
    if (url.hostname === REFRESH_HOST) {
      if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
      let pending: Promise<unknown> = Promise.resolve();
      await app.scheduled!({} as ScheduledController, appEnv, { waitUntil: (p: Promise<unknown>) => { pending = p; } } as ExecutionContext);
      await pending;
      return new Response("refreshed\n");
    }
    if (req.method === "GET" || req.method === "HEAD") {
      const res = await asset(env, url.pathname);
      if (res) return res;
    }
    return app.fetch!(req as Request<unknown, IncomingRequestCfProperties>, appEnv);
  },
};
