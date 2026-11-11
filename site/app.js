"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("uk-UA", { maximumFractionDigits: d });
const STOCK = { in: ["в наявності", "st-in"], order: ["під замовлення", "st-order"], out: ["немає", "st-out"], unknown: ["?", ""] };
const PAGE = 60;

// localStorage может быть недоступен (приватный режим) — всё оборачиваем
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

let DATA = { items: [], shops: [] }, HIST = null, shown = PAGE;
const favs = new Set(store.get("favs", []));
const settings = Object.assign({ city: "", del: 0, free: 0 }, store.get("settings", {}));
const byId = new Map();

/* ---------- загрузка ---------- */
async function load() {
  try {
    const r = await fetch("data/offers.json", { cache: "no-cache" });
    DATA = await r.json();
  } catch (e) {
    $("#count").textContent = "Не вдалося завантажити дані: " + e.message;
    return;
  }
  DATA.items.forEach(i => byId.set(i.id, i));
  const upd = new Date(DATA.updated);
  $("#updated").textContent = "оновлено " + upd.toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  fillSelect("#f-mat", countBy(DATA.items, "material"));
  fillSelect("#f-brand", countBy(DATA.items, "brand"));
  fillSelect("#f-shop", countBy(DATA.items, "shop"));
  restoreFilters();
  render(); renderBest(); renderShops();
}
async function history() {
  if (HIST) return HIST;
  try { HIST = await (await fetch("data/history.json", { cache: "no-cache" })).json(); } catch { HIST = {}; }
  return HIST;
}
function countBy(xs, k) {
  const m = new Map();
  xs.forEach(x => x[k] && m.set(x[k], (m.get(x[k]) || 0) + 1));
  return [...m].sort((a, b) => b[1] - a[1]);
}
function fillSelect(sel, pairs) {
  const el = $(sel);
  el.insertAdjacentHTML("beforeend", pairs.map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${n})</option>`).join(""));
}

/* ---------- список ---------- */
const F = ["q", "f-mat", "f-brand", "f-shop", "f-sort", "f-stock", "f-fav", "f-hot"];
function restoreFilters() {
  const s = store.get("filters", {});
  F.forEach(id => {
    const el = $("#" + id);
    if (!(id in s)) return;
    if (el.type === "checkbox") el.checked = s[id];
    else if (el.tagName !== "SELECT" || [...el.options].some(o => o.value === s[id])) el.value = s[id];
  });
}
function saveFilters() {
  const s = {};
  F.forEach(id => { const el = $("#" + id); s[id] = el.type === "checkbox" ? el.checked : el.value; });
  store.set("filters", s);
}
function filtered() {
  const words = $("#q").value.toLowerCase().split(/\s+/).filter(Boolean);
  const mat = $("#f-mat").value, br = $("#f-brand").value, sh = $("#f-shop").value;
  const inStock = $("#f-stock").checked, fav = $("#f-fav").checked, hot = $("#f-hot").checked;
  let xs = DATA.items.filter(i =>
    (!mat || i.material === mat) && (!br || i.brand === br) && (!sh || i.shop === sh) &&
    (!inStock || i.stock === "in") && (!fav || favs.has(i.id)) && (hot || i.src !== "hotline") &&
    words.every(w => (i.title + " " + (i.color || "") + " " + i.shop + " " + (i.material || "")).toLowerCase().includes(w)));
  const sort = $("#f-sort").value;
  const inf = v => v ?? Infinity;
  if (sort === "ppk") xs.sort((a, b) => inf(a.ppk) - inf(b.ppk) || inf(a.price) - inf(b.price));
  else if (sort === "price") xs.sort((a, b) => inf(a.price) - inf(b.price));
  else xs.sort((a, b) => a.title.localeCompare(b.title));
  return xs;
}
function card(i) {
  const [st, cls] = STOCK[i.stock] || STOCK.unknown;
  const price = i.price_max && i.price_max !== i.price ? `від ${num(i.price)} ₴` : `${num(i.price)} ₴`;
  const where = i.src === "hotline" ? `Hotline · ${i.offers} пропоз.` : esc(i.shop);
  return `<li class="item" data-id="${esc(i.id)}">
    <div class="t">${favs.has(i.id) ? '<span class="fav">★</span> ' : ""}${esc(i.title)}</div>
    <div class="p"><b>${i.price != null ? price : "—"}</b><span>${i.ppk ? num(i.ppk) + " ₴/кг" : i.weight ? "" : "вага ?"}</span></div>
    <div class="meta">${where} · <span class="${cls}">${st}</span>${i.weight ? " · " + num(i.weight, 2) + " кг" : ""}</div>
  </li>`;
}
function render(reset = true) {
  if (reset) shown = PAGE;
  const xs = filtered();
  $("#count").textContent = `Знайдено: ${xs.length}`;
  $("#list").innerHTML = xs.slice(0, shown).map(card).join("");
  $("#more").hidden = xs.length <= shown;
}

/* ---------- лучшее за кг ---------- */
function renderBest() {
  const hot = $("#b-hot").checked, best = new Map();
  for (const i of DATA.items) {
    if (i.stock !== "in" || !i.ppk || !i.material || i.material === "Other") continue;
    if (!hot && i.src === "hotline") continue;
    const b = best.get(i.material);
    if (!b || i.ppk < b.ppk) best.set(i.material, i);
  }
  const rows = [...best.values()].sort((a, b) => a.material.localeCompare(b.material));
  $("#best").innerHTML = `<tr><th>Матеріал</th><th>Товар</th><th class="n">₴/кг</th></tr>` +
    rows.map(i => `<tr data-id="${esc(i.id)}"><td><b>${esc(i.material)}</b></td>
      <td>${esc(i.title)}<div class="muted small">${esc(i.src === "hotline" ? "Hotline, мін. ціна" : i.shop)} · ${num(i.price)} ₴ / ${num(i.weight, 2)} кг</div></td>
      <td class="n"><b>${num(i.ppk)}</b></td></tr>`).join("");
}

/* ---------- карточка товара ---------- */
async function openItem(id) {
  const i = byId.get(id);
  if (!i) return;
  const [st, cls] = STOCK[i.stock] || STOCK.unknown;
  $("#sheet-body").innerHTML = `
    <div class="sheet-head"><h2 style="margin:0">${esc(i.title)}</h2><button aria-label="Закрити" id="x">✕</button></div>
    <dl class="kv">
      <dt>Де</dt><dd>${i.src === "hotline" ? `Hotline, ${i.offers} пропозицій` : esc(i.shop)}</dd>
      <dt>Наявність</dt><dd class="${cls}">${st}</dd>
      <dt>Ціна</dt><dd><b>${num(i.price)} ₴</b>${i.price_max && i.price_max !== i.price ? ` – ${num(i.price_max)} ₴` : ""}</dd>
      <dt>За кг</dt><dd>${i.ppk ? num(i.ppk) + " ₴" : "вагу не вказано"}</dd>
      <dt>Вага</dt><dd>${i.weight ? num(i.weight, 2) + " кг" : "—"}</dd>
      <dt>Матеріал</dt><dd>${esc(i.material || "—")}</dd>
      <dt>Бренд</dt><dd>${esc(i.brand || "—")}</dd>
      ${i.color ? `<dt>Колір</dt><dd>${esc(i.color)}</dd>` : ""}
    </dl>
    <div class="actions">
      <a class="btn" href="${esc(i.url)}" target="_blank" rel="noopener">${i.src === "hotline" ? "Усі магазини на Hotline" : "Відкрити в магазині"}</a>
      <button class="btn ghost" id="fav">${favs.has(i.id) ? "★ В обраному" : "☆ В обране"}</button>
      ${i.ppk ? `<button class="btn ghost" id="part">Порахувати деталь</button>` : ""}
      ${i.price && i.weight ? `<button class="btn ghost" id="tocmp">До порівняння</button>` : ""}
    </div>
    <h2>Ціна в часі</h2>
    <div class="chart" id="chart"><span class="muted small">Завантаження…</span></div>`;
  const dlg = $("#sheet");
  dlg.showModal();
  $("#x").onclick = () => dlg.close();
  $("#fav").onclick = e => {
    favs.has(i.id) ? favs.delete(i.id) : favs.add(i.id);
    store.set("favs", [...favs]);
    e.target.textContent = favs.has(i.id) ? "★ В обраному" : "☆ В обране";
    render(false);
  };
  if ($("#part")) $("#part").onclick = () => { $("#c-ppk").value = i.ppk; calc(); dlg.close(); go("calc"); };
  if ($("#tocmp")) $("#tocmp").onclick = () => {
    cmpRows.push({ n: i.shop + ": " + i.title.slice(0, 40), p: i.price, w: i.weight, d: "" });
    saveCmp(); renderCmp(); dlg.close(); go("calc");
  };
  const h = (await history())[i.id] || [];
  drawChart($("#chart"), h);
}
$("#sheet").addEventListener("click", e => { if (e.target.id === "sheet") e.target.close(); });

/* ---------- график: одна линия-ступенька, тултип по касанию ---------- */
function drawChart(box, pts) {
  if (pts.length < 2) {
    box.innerHTML = `<p class="muted small">${pts.length ? `Поки що одна точка: ${pts[0][0]}, ${num(pts[0][1])} ₴. Історія накопичується з кожним оновленням: нова точка зʼявляється, коли змінюється ціна або наявність.` : "Історії поки немає."}</p>`;
    return;
  }
  const t = pts.map(p => Date.parse(p[0])), now = Date.now();
  const xs = [...t, Math.max(now, t[t.length - 1])], ys = pts.map(p => p[1]);
  const W = 640, H = 220, L = 44, R = 10, T = 12, B = 26;
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = (hi - lo) * 0.15 || hi * 0.05 || 1; lo -= pad; hi += pad;
  const x = v => L + (v - xs[0]) / (xs[xs.length - 1] - xs[0] || 1) * (W - L - R);
  const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let d = `M${x(t[0])},${y(ys[0])}`;
  for (let k = 1; k < pts.length; k++) d += `H${x(t[k])}V${y(ys[k])}`;
  d += `H${x(xs[xs.length - 1])}`;
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const fmtD = v => new Date(v).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Історія ціни">
    ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`).join("")}
    <text class="ax" x="${L}" y="${H - 6}">${fmtD(xs[0])}</text>
    <text class="ax" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtD(xs[xs.length - 1])}</text>
    <path class="ln" d="${d}"/>
    <line class="cross" id="cx" y1="${T}" y2="${H - B}" visibility="hidden"/>
    <circle class="dot" id="cd" r="5" visibility="hidden"/>
    <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" id="hit"/>
  </svg><div class="tip" id="tip" hidden></div>`;
  const svg = $("svg", box), tip = $("#tip", box);
  const move = e => {
    const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W;
    let k = 0;
    for (let j = 0; j < t.length; j++) if (x(t[j]) <= vx) k = j;
    const px = Math.max(L, Math.min(vx, W - R));
    $("#cx", svg).setAttribute("x1", px); $("#cx", svg).setAttribute("x2", px);
    $("#cx", svg).setAttribute("visibility", "visible");
    const c = $("#cd", svg); c.setAttribute("cx", px); c.setAttribute("cy", y(ys[k])); c.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.style.left = (px / W * r.width) + "px";
    tip.textContent = `${pts[k][0]} · ${num(ys[k])} ₴ · ${["немає", "в наявності", "під замовлення"][pts[k][2]] ?? ""}`;
  };
  $("#hit", svg).addEventListener("pointermove", move);
  $("#hit", svg).addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", () => { tip.hidden = true; $("#cx", svg).setAttribute("visibility", "hidden"); $("#cd", svg).setAttribute("visibility", "hidden"); });
}

/* ---------- калькуляторы ---------- */
function calc() {
  const g = +$("#c-g").value, ppk = +$("#c-ppk").value, w = +$("#c-waste").value || 0;
  const cost = g * (1 + w / 100) / 1000 * ppk;
  $("#c-out").innerHTML = `${num(cost, 2)} ₴<small>${num(g * (1 + w / 100), 1)} г пластику із запасом · без запасу ${num(g / 1000 * ppk, 2)} ₴</small>`;
  const p = +$("#k-p").value, kw = +$("#k-w").value;
  $("#k-out").innerHTML = kw > 0 ? `${num(p / kw)} ₴/кг<small>${num(p / kw / 1000, 3)} ₴ за грам</small>` : "—";
  store.set("calc", { g: $("#c-g").value, ppk: $("#c-ppk").value, waste: $("#c-waste").value, p: $("#k-p").value, w: $("#k-w").value });
}
let cmpRows = store.get("cmp", [{ n: "Магазин 1", p: 650, w: 1, d: "" }, { n: "Магазин 2", p: 1700, w: 3, d: "" }]);
const saveCmp = () => store.set("cmp", cmpRows);
function renderCmp() {
  const res = cmpRows.map(r => {
    const del = r.d === "" ? (settings.free > 0 && +r.p >= settings.free ? 0 : +settings.del || 0) : +r.d;
    const total = +r.p + del;
    return { total, del, ppk: r.w > 0 ? total / r.w : null };
  });
  const best = Math.min(...res.map(r => r.ppk ?? Infinity));
  $("#cmp").innerHTML = `<tr><th>Що</th><th>Ціна ₴</th><th>Кг</th><th>Дост. ₴</th><th class="n">₴/кг</th><th></th></tr>` +
    cmpRows.map((r, k) => `<tr class="${res[k].ppk === best && isFinite(best) ? "best" : ""}">
      <td><input data-k="${k}" data-f="n" value="${esc(r.n)}"></td>
      <td><input data-k="${k}" data-f="p" type="number" inputmode="decimal" value="${esc(r.p)}"></td>
      <td><input data-k="${k}" data-f="w" type="number" inputmode="decimal" step="0.05" value="${esc(r.w)}"></td>
      <td><input data-k="${k}" data-f="d" type="number" inputmode="decimal" placeholder="${res[k].del}" value="${esc(r.d)}"></td>
      <td class="n"><b>${num(res[k].ppk)}</b><div class="muted small">разом ${num(res[k].total)}</div></td>
      <td><button class="btn ghost" style="margin:0;padding:4px 8px;min-height:0" data-del="${k}" aria-label="Видалити">✕</button></td></tr>`).join("");
}
$("#cmp").addEventListener("change", e => {
  const { k, f } = e.target.dataset;
  if (k == null) return;
  cmpRows[k][f] = f === "n" || e.target.value === "" ? e.target.value : +e.target.value;
  saveCmp(); renderCmp();
});
$("#cmp").addEventListener("click", e => {
  if (e.target.dataset.del == null) return;
  cmpRows.splice(+e.target.dataset.del, 1); saveCmp(); renderCmp();
});
$("#cmp-add").onclick = () => { cmpRows.push({ n: "Магазин " + (cmpRows.length + 1), p: "", w: 1, d: "" }); saveCmp(); renderCmp(); };

/* ---------- настройки ---------- */
function renderShops() {
  $("#shops").innerHTML = DATA.shops.map(s => `<li class="item" style="cursor:default">
    <div class="t">${esc(s.name)}</div>
    <div class="p"><b>${s.count}</b><span>товарів</span></div>
    <div class="meta">${s.ok ? '<span class="st-in">ок</span>' : `<span class="st-out">помилка</span> ${esc(s.error || "")}`} · ${s.at ? new Date(s.at).toLocaleString("uk-UA") : "—"}</div></li>`).join("");
}
function initSettings() {
  $("#s-city").value = settings.city; $("#s-del").value = settings.del; $("#s-free").value = settings.free;
  ["#s-city", "#s-del", "#s-free"].forEach(s => $(s).addEventListener("input", () => {
    settings.city = $("#s-city").value; settings.del = +$("#s-del").value || 0; settings.free = +$("#s-free").value || 0;
    store.set("settings", settings); renderCmp();
  }));
}

/* ---------- навигация ---------- */
const TITLES = { list: "Ціни", best: "Найкраще за кг", calc: "Калькулятори", set: "Налаштування" };
function go(v) {
  $$(".view").forEach(s => s.classList.toggle("active", s.id === "v-" + v));
  $$(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  $("#title").textContent = TITLES[v];
  store.set("tab", v);
  scrollTo(0, 0);
}
$$(".tabs button").forEach(b => b.onclick = () => go(b.dataset.v));
F.forEach(id => $("#" + id).addEventListener(id === "q" ? "input" : "change", () => { saveFilters(); render(); }));
$("#more").onclick = () => { shown += PAGE; render(false); };
$("#list").addEventListener("click", e => { const li = e.target.closest("[data-id]"); if (li) openItem(li.dataset.id); });
$("#best").addEventListener("click", e => { const tr = e.target.closest("[data-id]"); if (tr) openItem(tr.dataset.id); });
$("#b-hot").onchange = renderBest;

const cs = store.get("calc", null);
if (cs) { $("#c-g").value = cs.g; $("#c-ppk").value = cs.ppk; $("#c-waste").value = cs.waste; $("#k-p").value = cs.p; $("#k-w").value = cs.w; }
$$("#v-calc .form input").forEach(el => el.addEventListener("input", calc));
calc(); renderCmp(); initSettings(); go(store.get("tab", "list")); load();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
