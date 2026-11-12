// Оболочка приложения — из кэша; данные — сначала сеть, без сети последняя копия.
const CACHE = "ft-v17";
const WATCH = "ft-watch";  // обране и последние цены для уведомлений, не чистится при обновлении
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icon.svg", "icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== WATCH).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // цены: сразу копия с телефона, свежий файл качаем в фоне; если он новее — говорим странице
  if (url.pathname.endsWith("/data/offers.json")) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(e.request, { ignoreSearch: true });
      const tag = r => r && (r.headers.get("etag") || r.headers.get("last-modified"));
      const net = fetch(e.request).then(async r => {
        if (r.ok) {
          await c.put(e.request, r.clone());
          if (hit && tag(r) !== tag(hit)) (await self.clients.matchAll()).forEach(cl => cl.postMessage("data-updated"));
        }
        return r;
      });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    }));
    return;
  }
  // остальное — сеть первой: так обновления сайта прилетают сразу
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

/* ---------- уведомления: обране подешевшало или снова в наличии ---------- */
async function readWatch() {
  const r = await (await caches.open(WATCH)).match("watch.json");
  return r ? r.json() : { ids: [], base: {} };
}
async function writeWatch(w) {
  await (await caches.open(WATCH)).put("watch.json", new Response(JSON.stringify(w), { headers: { "Content-Type": "application/json" } }));
}
// по каждой отмеченной катушке (вся склейка магазинов) — самая низкая цена, лучше в наличии
async function checkPrices() {
  const w = await readWatch();
  if (!w.ids.length) return;
  let d;
  try { d = await (await fetch("data/offers.json", { cache: "no-cache" })).json(); } catch { return; }
  const want = new Set(w.ids), keys = new Set(), cur = new Map();
  for (const i of d.items) if (want.has(i.id)) keys.add(i.group || i.id);
  for (const i of d.items) {
    const k = i.group && keys.has(i.group) ? i.group : keys.has(i.id) ? i.id : null;
    if (!k || i.price == null) continue;
    const c = cur.get(k) || { p: Infinity, in: false }, inS = i.stock === "in";
    if ((inS && !c.in) || (inS === c.in && i.price < c.p)) Object.assign(c, { p: i.price, in: inS, t: i.title, id: i.id });
    cur.set(k, c);
  }
  for (const [k, c] of cur) {
    const b = w.base[k];
    if (b && c.in && (!b.in || c.p < b.p * 0.99)) {
      const title = b.in ? `Подешевшало на ${Math.round((1 - c.p / b.p) * 100)}%` : "Знову в наявності";
      await self.registration.showNotification(title, {
        body: `${c.t}\n${b.in ? `${Math.round(b.p)} ₴ → ` : ""}${Math.round(c.p)} ₴`, tag: k,
        icon: "icon-192.png", badge: "icon-192.png", data: { id: c.id },
      });
    }
    w.base[k] = { p: c.p, in: c.in };
  }
  await writeWatch(w);
}
self.addEventListener("periodicsync", e => { if (e.tag === "prices") e.waitUntil(checkPrices()); });
self.addEventListener("message", e => {
  if (e.data && e.data.type === "watch")
    e.waitUntil(readWatch().then(w => writeWatch({ ids: e.data.ids, base: w.base })).then(checkPrices));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.id;
  e.waitUntil(self.clients.openWindow("./" + (id ? "#item=" + encodeURIComponent(id) : "")));
});
