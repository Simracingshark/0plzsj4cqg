"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("uk-UA", { maximumFractionDigits: d });
const STOCK = { in: "в наявності", order: "під замовлення", out: "немає", unknown: "невідомо" };
const MAT_NAME = m => m === "Other" ? "Інше" : m;
const PAGE = 40;
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };

// localStorage может быть недоступен (приватный режим) — всё оборачиваем
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

/* цвет кружка по названию/цвету товара */
const COLORS = [
  [/прозор|transparent|clear|natural|натурал/i, "clear"], [/чорн|черн|black/i, "#1c1c20"], [/біл|бел(?!ь)|white|ivory|айвор/i, "#f3f2ee"],
  [/сір|сер(?!ед)|gr[ae]y|антрацит|anthracite|графіт|graphite/i, "#8b8e95"], [/срібл|серебр|silver/i, "#c3c6cc"],
  [/червон|красн|\bred\b|бордо|burgundy/i, "#d63b3b"], [/помаранч|оранж|orange/i, "#f08a24"], [/жовт|желт|yellow/i, "#f2c230"],
  [/золот|gold/i, "#d4a637"], [/салат|lime|лайм/i, "#9ccc3d"], [/койот|coyote|пісоч|sand/i, "#b89a6e"], [/зелен|green|олив|olive|хакі|khaki/i, "#3f9d5a"],
  [/бірюз|бирюз|turquoise|teal|cyan/i, "#2bb3b1"], [/блакит|голуб|sky|light blue/i, "#6cb8f0"], [/син|blue|navy/i, "#2f62d4"],
  [/фіолет|фиолет|purple|violet|лаванд|lavender/i, "#8a55d6"], [/рожев|розов|pink|magenta|маджент/i, "#ee77ad"],
  [/коричн|brown|шокол|chocolate|wood|дерев/i, "#8a5a3b"], [/беж|beige|пісоч|sand|tan\b|крем|cream/i, "#e0cca4"],
  [/мідн|медн|copper|бронз|bronze/i, "#b8723e"],
];
const colorOf = s => { for (const [rx, c] of COLORS) if (rx.test(s)) return c; return null; };
function swatch(i) {
  const c = colorOf((i.color || "") + " " + i.title);
  return c === "clear" ? `<i class="sw clear"></i>` : c ? `<i class="sw" style="--c:${c}"></i>` : `<i class="sw unknown"></i>`;
}
// фото магазина поверх кружка цвета; если картинка не загрузилась — остаётся кружок
const photo = (i, cls = "ph") => `<span class="${cls}">${swatch(i)}${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</span>`;

/* катушка в SVG, окрашенная в цвет материала */
const MAT_HUE = { "PLA": 265, "PLA+": 295, "PETG": 210, "ABS": 30, "ASA": 50, "TPU": 150, "CoPET": 185, "PCTG": 225,
  "PLA-CF": 0, "PETG-CF": 0, "PA-CF": 0, "PA": 330, "PC": 240, "PET": 175, "PVA": 100, "HIPS": 70, "PP": 120, "PEEK": 60, "PBT": 280, "Wood": 55 };
function spool(m, size = 84) {
  const h = MAT_HUE[m], cf = m.endsWith("-CF") || h == null;
  const c1 = cf ? "#7a7b83" : `oklch(.84 .12 ${h})`, c2 = cf ? "#45464d" : `oklch(.64 .16 ${h})`,
    c3 = cf ? "#222328" : `oklch(.44 .14 ${h})`;
  const id = "sp" + m.replace(/\W/g, "") + (++spool.n);  // id уникален: градиент из скрытого блока не рисуется
  // катушка лежит, смотрим сверху-сбоку: нижняя щёчка, цилиндр намотки, верхняя щёчка с окном и втулкой
  return `<svg class="spool" viewBox="0 0 120 100" width="${size}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:${c3}"/>
      <stop offset=".3" style="stop-color:${c1}"/><stop offset=".6" style="stop-color:${c2}"/><stop offset="1" style="stop-color:${c3}"/></linearGradient>
    <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#55565e"/><stop offset="1" stop-color="#1c1d22"/></linearGradient>
    <pattern id="${id}w" width="120" height="3" patternUnits="userSpaceOnUse"><rect width="120" height="1.1" fill="#000" opacity=".14"/></pattern></defs>
    <ellipse cx="60" cy="80" rx="46" ry="15" fill="#0d0e11"/>
    <ellipse cx="60" cy="77" rx="46" ry="15" fill="url(#${id}f)"/>
    <path d="M22 30v46a38 12.5 0 0 0 76 0V30z" fill="url(#${id})"/><path d="M22 30v46a38 12.5 0 0 0 76 0V30z" fill="url(#${id}w)"/>
    <ellipse cx="60" cy="27" rx="46" ry="15" fill="#0d0e11"/>
    <ellipse cx="60" cy="24" rx="46" ry="15" fill="url(#${id}f)"/>
    <ellipse cx="60" cy="24" rx="37" ry="11.5" fill="url(#${id})" opacity=".75"/>
    <ellipse cx="60" cy="24" rx="17" ry="5.6" fill="url(#${id}f)"/>
    <ellipse cx="60" cy="24.6" rx="8" ry="2.7" fill="#050506"/>
    <ellipse cx="60" cy="24" rx="45.3" ry="14.4" fill="none" stroke="#fff" stroke-opacity=".16"/>
  </svg>`;
}

spool.n = 0;

const TAG_NAME = { matte: "Matte", silk: "Silk", hs: "High Speed", cf: "Карбон CF", gf: "Скловолокно GF", glow: "Світиться",
  marble: "Мармур", transp: "Прозорий", multi: "Багатоколірний", metal: "Металік", refill: "Рефіл" };
const WEIGHTS = [["s", "≤ 0,5 кг", w => w <= .55], ["m", "0,6–0,9 кг", w => w > .55 && w < .95], ["1", "1 кг", w => w >= .95 && w <= 1.05],
  ["l", "1,1–1,5 кг", w => w > 1.05 && w <= 1.6], ["xl", "2–3 кг", w => w > 1.6 && w <= 3.2], ["xxl", "від 4 кг", w => w > 3.2]];
const MAT_ORDER = ["PLA", "PETG", "PLA+", "ABS", "TPU", "ASA", "CoPET", "PLA-CF", "PETG-CF", "PA-CF", "PA", "PC", "PCTG", "PET", "PVA", "HIPS", "PP", "PEEK", "PBT", "Wood", "Other"];
const NOBRAND = /без бренд|no ?name|noname|unbranded|generic/i;
const matRank = m => { const k = MAT_ORDER.indexOf(m); return k < 0 ? 98 : k; };

let DATA = { items: [], shops: [] }, HIST = null, shown = PAGE;
const BEST = new Map(), MST = new Map(), GROUPS = new Map();
const favs = new Set(store.get("favs", []));
const settings = Object.assign({ city: "", del: 0, free: 0 }, store.get("settings", {}));
const F0 = () => ({ q: "", mat: "", tags: [], colors: [], brands: [], shop: "", w: [], stock: "in", fav: false, hot: true,
  group: true, sale: false, ppkMin: "", ppkMax: "", pMin: "", pMax: "", sort: "ppk" });
const F = Object.assign(F0(), store.get("f3", {}));
const byId = new Map();

/* ---------- тема ---------- */
const THEMES = ["auto", "dark", "light"];
function applyTheme(t) {
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = t;
  store.set("theme", t);
}
applyTheme(store.get("theme", "auto"));
$("#theme").onclick = () => applyTheme(THEMES[(THEMES.indexOf(store.get("theme", "auto")) + 1) % 3]);

/* ---------- загрузка ---------- */
async function load() {
  $("#list").innerHTML = Array(6).fill('<li class="skel"></li>').join("");
  try {
    DATA = await (await fetch("data/offers.json", { cache: "no-cache" })).json();
  } catch (e) {
    $("#list").innerHTML = `<li class="empty">Не вдалося завантажити дані.<br>${esc(e.message)}</li>`;
    return;
  }
  DATA.items.forEach(i => byId.set(i.id, i));
  computeStats();
  const shops = new Set(DATA.items.filter(i => i.src !== "hotline").map(i => i.shop)).size;
  const brands = new Set(DATA.items.map(i => i.brand).filter(Boolean)).size;
  const when = new Date(DATA.updated).toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  $("#stats").textContent = `${num(DATA.items.length)} позицій · ${shops} магазинів · ${when}`;
  $("#h-upd").textContent = "Ціни оновлено " + when;
  $("#h-stats").innerHTML = [[DATA.items.length, "позицій"], [shops, "магазинів"], [brands, "брендів"]]
    .map(([n, t]) => `<div><b>${num(n)}</b><span>${t}</span></div>`).join("");
  fillShops();
  renderHome(); renderMats(); render(); renderShops();
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
function fillShops() {
  $("#f-shop").insertAdjacentHTML("beforeend", countBy(DATA.items, "shop").map(([v, n]) => `<option value="${esc(v)}">${esc(v)} · ${n}</option>`).join(""));
}
// по каждому материалу: минимум, медиана, 90-й перцентиль ₴/кг (в наличии, без Hotline); группы одинаковых товаров
function computeStats() {
  BEST.clear(); MST.clear(); GROUPS.clear();
  const by = new Map();
  for (const i of DATA.items) {
    if (i.group) (GROUPS.get(i.group) || GROUPS.set(i.group, []).get(i.group)).push(i);
    if (i.stock !== "in" || !i.ppk || i.src === "hotline") continue;
    const b = BEST.get(i.material);
    if (!b || i.ppk < b) BEST.set(i.material, i.ppk);
    (by.get(i.material) || by.set(i.material, []).get(i.material)).push(i.ppk);
  }
  for (const [m, xs] of by) {
    xs.sort((a, b) => a - b);
    const q = p => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
    MST.set(m, { min: xs[0], med: q(.5), p90: q(.9), n: xs.length });
  }
}
const matDot = m => m in MAT_HUE ? `<i class="mdot" style="--h:${MAT_HUE[m]}"${m.endsWith("-CF") ? " data-cf" : ""}></i>` : "";
const shopName = i => i.src === "hotline" ? `Hotline · ${i.offers} пропоз.` : esc(i.shop) + (i.seller ? ` · ${esc(i.seller)}` : "");
// на сколько процентов ₴/кг ниже медианы материала
function deal(i) {
  const st = MST.get(i.material);
  if (!st || !i.ppk || i.src === "hotline" || st.n < 5) return 0;
  return Math.round((1 - i.ppk / st.med) * 100);
}
const sale = i => i.price_old && i.price ? Math.round((1 - i.price / i.price_old) * 100) : 0;
const disc = i => Math.max(sale(i), i.drop || 0);

/* ---------- главная ---------- */
function renderHome() {
  const inStock = DATA.items.filter(i => i.stock === "in");
  const mats = countBy(inStock, "material").filter(([m]) => m !== "Other" && MST.has(m))
    .sort((a, b) => matRank(a[0]) - matRank(b[0])).slice(0, 12);
  $("#h-mats").innerHTML = mats.map(([m, n]) => `<button class="mat-tile" data-mat="${esc(m)}">
    ${spool(m)}<span class="mt-n">${esc(m)}</span>
    <span class="mt-p">від <b>${num(MST.get(m).min)}</b> ₴/кг</span><span class="mt-c">${num(n)} у наявності</span></button>`).join("");

  const tc = new Map();
  inStock.forEach(i => (i.tags || []).forEach(t => tc.set(t, (tc.get(t) || 0) + 1)));
  $("#h-tags").innerHTML = Object.keys(TAG_NAME).filter(t => tc.get(t)).map(t =>
    `<button class="tagchip" data-tag="${t}">${esc(TAG_NAME[t])}<small>${num(tc.get(t))}</small></button>`).join("");

  const deals = inStock.filter(i => i.src !== "hotline" && disc(i) >= 5).sort((a, b) => disc(b) - disc(a));
  const seen = new Set();
  const top = deals.filter(i => { const k = i.group || i.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 16);
  $("#h-deals-h").hidden = $("#h-deals").hidden = !top.length;
  $("#h-deals").innerHTML = top.map(i => `<button class="deal-card" data-id="${esc(i.id)}">
    ${photo(i, "ph big")}<span class="badge sale">−${disc(i)}%</span>
    <span class="dc-t">${esc(i.title)}</span>
    <span class="dc-p"><b>${num(i.price)} ₴</b>${i.price_old ? `<s>${num(i.price_old)}</s>` : ""}</span>
    <span class="dc-s">${shopName(i)}</span></button>`).join("");

  const brands = countBy(inStock, "brand").filter(([b]) => !NOBRAND.test(b)).slice(0, 12);
  $("#h-brands").innerHTML = brands.map(([b, n]) => {
    const ppk = Math.min(...inStock.filter(i => i.brand === b && i.ppk && i.src !== "hotline").map(i => i.ppk));
    return `<button class="brand-tile" data-brand="${esc(b)}"><span class="mono" style="--h:${[...b].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}">${esc(b.slice(0, 2))}</span>
      <span class="bt-n">${esc(b)}</span><span class="bt-c">${num(n)} · від ${isFinite(ppk) ? num(ppk) : "—"} ₴/кг</span></button>`;
  }).join("");
}
function openCatalog(patch) {
  Object.assign(F, F0(), { group: F.group, hot: F.hot, sort: F.sort }, patch);
  saveF(); renderMats(); render(); go("list");
}
$("#h-mats").addEventListener("click", e => { const b = e.target.closest("[data-mat]"); if (b) openCatalog({ mat: b.dataset.mat }); });
$("#h-tags").addEventListener("click", e => { const b = e.target.closest("[data-tag]"); if (b) openCatalog({ tags: [b.dataset.tag] }); });
$("#h-brands").addEventListener("click", e => { const b = e.target.closest("[data-brand]"); if (b) openCatalog({ brands: [b.dataset.brand] }); });
$("#h-deals").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) openItem(b.dataset.id); });
$("#h-allbrands").onclick = () => { go("list"); openFilters("f-brands"); };
$$("[data-goto]").forEach(b => b.onclick = () => go(b.dataset.goto));
$("#hq").addEventListener("keydown", e => { if (e.key === "Enter") { openCatalog({ q: e.target.value }); e.target.blur(); } });

/* ---------- фильтры ---------- */
function saveF() { store.set("f3", F); }
function renderMats() {
  const counts = countBy(DATA.items.filter(i => stockOk(i)), "material").sort((a, b) => matRank(a[0]) - matRank(b[0]));
  $("#mats").innerHTML = `<button class="chip ${F.mat ? "" : "on"}" data-m="">Усі</button>` +
    counts.map(([m, n]) => `<button class="chip ${F.mat === m ? "on" : ""}" data-m="${esc(m)}">${matDot(m)}${esc(MAT_NAME(m))} <small>${n}</small></button>`).join("");
  $("#q").value = F.q;
  $("#sort-btn").textContent = "↕ " + SORTS[F.sort];
  const n = activeFilters().length - (F.mat ? 1 : 0) - (F.q ? 1 : 0);
  $("#fcount").hidden = !n; $("#fcount").textContent = n;
  $("#active-f").innerHTML = activeFilters().map(([k, label]) => `<button class="af" data-k="${esc(k)}">${esc(label)} <span>✕</span></button>`).join("");
}
$("#mats").addEventListener("click", e => {
  const b = e.target.closest("[data-m]");
  if (!b) return;
  F.mat = b.dataset.m; saveF(); renderMats(); render();
});
let qTimer;
$("#q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { F.q = e.target.value; saveF(); renderMats(); render(); }, 150); });

const SORTS = { ppk: "₴/кг ↑", ppk_d: "₴/кг ↓", price: "за котушку ↑", disc: "знижка", new: "нові", name: "назва" };
// активные фильтры в виде снимаемых «пилюль» над списком
function activeFilters() {
  const a = [];
  if (F.q) a.push(["q", `«${F.q}»`]);
  if (F.mat) a.push(["mat", MAT_NAME(F.mat)]);
  F.tags.forEach(t => a.push(["tags:" + t, TAG_NAME[t]]));
  F.colors.forEach(c => a.push(["colors:" + c, c]));
  F.brands.forEach(b => a.push(["brands:" + b, b]));
  F.w.forEach(w => a.push(["w:" + w, WEIGHTS.find(x => x[0] === w)?.[1] || w]));
  if (F.shop) a.push(["shop", F.shop]);
  if (F.stock !== "in") a.push(["stock", F.stock === "all" ? "з відсутніми" : "+ під замовлення"]);
  if (F.ppkMin || F.ppkMax) a.push(["ppk", `${F.ppkMin || 0}–${F.ppkMax || "∞"} ₴/кг`]);
  if (F.pMin || F.pMax) a.push(["p", `${F.pMin || 0}–${F.pMax || "∞"} ₴`]);
  if (F.sale) a.push(["sale", "зі знижкою"]);
  if (F.fav) a.push(["fav", "★ обране"]);
  if (!F.hot) a.push(["hot", "без Hotline"]);
  return a;
}
$("#active-f").addEventListener("click", e => {
  const b = e.target.closest("[data-k]");
  if (!b) return;
  const [k, v] = b.dataset.k.split(/:(.*)/s);
  if (v !== undefined) F[k] = F[k].filter(x => x !== v);
  else if (k === "ppk") F.ppkMin = F.ppkMax = "";
  else if (k === "p") F.pMin = F.pMax = "";
  else F[k] = F0()[k];
  saveF(); renderMats(); render();
});
$("#sort-btn").onclick = () => {
  const ks = Object.keys(SORTS); F.sort = ks[(ks.indexOf(F.sort) + 1) % ks.length];
  saveF(); renderMats(); render();
};

/* шторка фильтров: всё применяется сразу, кнопка показывает число найденного */
const toggleIn = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
function renderFilterSheet() {
  const base = DATA.items.filter(stockOk);
  const pills = (el, opts, isOn, attr) => $(el).innerHTML = opts.map(([v, label, n]) =>
    `<button data-${attr}="${esc(v)}" class="${isOn(v) ? "on" : ""}">${label}${n != null ? ` <small>${num(n)}</small>` : ""}</button>`).join("");
  $$("#f-sort button").forEach(b => b.classList.toggle("on", b.dataset.s === F.sort));
  $$("#f-stock button").forEach(b => b.classList.toggle("on", b.dataset.v === F.stock));
  pills("#f-mat", [["", "Усі"], ...countBy(base, "material").sort((a, b) => matRank(a[0]) - matRank(b[0]))
    .map(([m, n]) => [m, matDot(m) + esc(MAT_NAME(m)), n])], v => v === F.mat, "m");
  const tc = new Map(); base.forEach(i => (i.tags || []).forEach(t => tc.set(t, (tc.get(t) || 0) + 1)));
  pills("#f-tags", Object.keys(TAG_NAME).filter(t => tc.get(t)).map(t => [t, esc(TAG_NAME[t]), tc.get(t)]), v => F.tags.includes(v), "t");
  $("#f-colors").innerHTML = countBy(base, "color").slice(0, 24).map(([c, n]) => {
    const hex = colorOf(c);
    return `<button data-c="${esc(c)}" class="${F.colors.includes(c) ? "on" : ""}" title="${esc(c)}">
      <i class="sw ${hex === "clear" ? "clear" : hex ? "" : "unknown"}" ${hex && hex !== "clear" ? `style="--c:${hex}"` : ""}></i><span>${esc(c)}</span></button>`;
  }).join("");
  const bq = $("#f-brand-q").value.toLowerCase();
  pills("#f-brands", countBy(base, "brand").filter(([b]) => !bq || b.toLowerCase().includes(bq) || F.brands.includes(b))
    .map(([b, n]) => [b, esc(b), n]), v => F.brands.includes(v), "b");
  pills("#f-weight", WEIGHTS.map(([k, label, fn]) => [k, label, base.filter(i => i.weight && fn(i.weight)).length]), v => F.w.includes(v), "w");
  $("#f-ppk-min").value = F.ppkMin; $("#f-ppk-max").value = F.ppkMax; $("#f-p-min").value = F.pMin; $("#f-p-max").value = F.pMax;
  $("#f-shop").value = F.shop;
  $("#f-group").checked = F.group; $("#f-sale").checked = F.sale; $("#f-fav").checked = F.fav; $("#f-hot").checked = F.hot;
  $("#f-apply").textContent = `Показати ${num(rows().length)}`;
}
function fChanged() { saveF(); renderMats(); render(); renderFilterSheet(); }
function openFilters(scrollTo) {
  renderFilterSheet(); $("#filters").showModal();
  if (scrollTo) $("#" + scrollTo).scrollIntoView({ block: "center" });
}
$("#open-filters").onclick = () => openFilters();
$("#filters").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b || !$("#filters").contains(b)) return;
  const d = b.dataset;
  if (d.s) F.sort = d.s;
  else if (b.parentNode.id === "f-stock") F.stock = d.v;
  else if (d.m !== undefined) F.mat = d.m;
  else if (d.t) F.tags = toggleIn(F.tags, d.t);
  else if (d.c) F.colors = toggleIn(F.colors, d.c);
  else if (d.b) F.brands = toggleIn(F.brands, d.b);
  else if (d.w) F.w = toggleIn(F.w, d.w);
  else return;
  fChanged();
});
$("#f-brand-q").addEventListener("input", renderFilterSheet);
[["#f-ppk-min", "ppkMin"], ["#f-ppk-max", "ppkMax"], ["#f-p-min", "pMin"], ["#f-p-max", "pMax"]].forEach(([s, k]) =>
  $(s).addEventListener("change", e => { F[k] = e.target.value; fChanged(); }));
$("#f-shop").onchange = e => { F.shop = e.target.value; fChanged(); };
[["#f-group", "group"], ["#f-sale", "sale"], ["#f-fav", "fav"], ["#f-hot", "hot"]].forEach(([s, k]) =>
  $(s).onchange = e => { F[k] = e.target.checked; fChanged(); });
$("#f-apply").onclick = () => $("#filters").close();
$("#f-reset").onclick = () => { Object.assign(F, F0()); $("#f-brand-q").value = ""; fChanged(); };

const stockOk = i => F.stock === "all" || i.stock === "in" || (F.stock === "avail" && i.stock === "order");
function filtered() {
  const words = F.q.toLowerCase().split(/\s+/).filter(Boolean);
  const wfn = F.w.map(k => WEIGHTS.find(x => x[0] === k)?.[2]).filter(Boolean);
  const lim = (v, lo, hi) => (lo === "" || (v != null && v >= +lo)) && (hi === "" || (v != null && v <= +hi));
  return DATA.items.filter(i =>
    (!F.mat || i.material === F.mat) && stockOk(i) && (F.hot || i.src !== "hotline") &&
    (!F.tags.length || F.tags.every(t => (i.tags || []).includes(t))) &&
    (!F.colors.length || F.colors.includes(i.color)) && (!F.brands.length || F.brands.includes(i.brand)) &&
    (!F.shop || i.shop === F.shop) && (!wfn.length || (i.weight && wfn.some(fn => fn(i.weight)))) &&
    lim(i.ppk, F.ppkMin, F.ppkMax) && lim(i.price, F.pMin, F.pMax) &&
    (!F.sale || disc(i) > 0) && (!F.fav || favs.has(i.id)) &&
    words.every(w => (i.title + " " + (i.color || "") + " " + i.shop + " " + (i.seller || "") + " " + (i.material || "") + " " + (i.brand || "")).toLowerCase().includes(w)));
}
// строки списка: одинаковые товары разных магазинов склеены, ведущий — самый дешёвый
function rows() {
  const xs = filtered(), out = [], at = new Map();
  for (const i of xs) {
    if (F.group && i.group) {
      const r = at.get(i.group);
      if (r) { r.items.push(i); continue; }
      at.set(i.group, out[out.push({ items: [i] }) - 1]);
    } else out.push({ items: [i] });
  }
  const inf = v => v ?? Infinity;
  for (const r of out) {
    r.items.sort((a, b) => inf(a.ppk) - inf(b.ppk) || inf(a.price) - inf(b.price));
    r.lead = r.items[0];
  }
  const by = {
    ppk: (a, b) => inf(a.lead.ppk) - inf(b.lead.ppk) || inf(a.lead.price) - inf(b.lead.price),
    ppk_d: (a, b) => (b.lead.ppk ?? -1) - (a.lead.ppk ?? -1),
    price: (a, b) => inf(a.lead.price) - inf(b.lead.price),
    disc: (a, b) => Math.max(...b.items.map(disc)) - Math.max(...a.items.map(disc)) || inf(a.lead.ppk) - inf(b.lead.ppk),
    new: (a, b) => (b.items.some(i => i.new) - a.items.some(i => i.new)) || inf(a.lead.ppk) - inf(b.lead.ppk),
    name: (a, b) => a.lead.title.localeCompare(b.lead.title, "uk"),
  };
  return out.sort(by[F.sort] || by.ppk);
}

/* ---------- список ---------- */
function badges(r) {
  // в списке одна метка, самая полезная; остальное видно в карточке
  const i = r.lead, d = Math.max(...r.items.map(disc));
  const fav = r.items.some(x => favs.has(x.id)) ? `<span class="tag fav">★</span>` : "";
  const one = d > 0 ? `<span class="tag sale">−${d}%</span>` :
    r.items.some(x => x.drop) ? `<span class="tag drop">↓ ціна впала</span>` :
    r.items.some(x => x.new) ? `<span class="tag new">новинка</span>` : "";
  return one + fav;
}
// название без повторов: материал, вес и «пластик для 3D принтера» уже видны отдельно
const L = String.raw`[\p{L}\d]`, NOISE = new RegExp(String.raw`(?<!${L})(?:філамент|филамент|filament|пластик|plastic|нитка|пруток)(?!${L})|(?:для|до|for)\s+(?:3[DdДд][- ]?)?(?:друк\p{L}*|печат\p{L}*|принтер\p{L}*|printer\p{L}*)|3[DdДд][- ]?(?:принтер|printer)\p{L}*|(?<![\w-])Ø?\s*1[.,]75\s*(?:mm|мм)?(?![\d-])|(?<!${L})\d+(?:[.,]\d+)?\s*(?:kg|кг)(?!${L})|(?<!${L})\d+\s*(?:м|m)(?!${L})|вага:?|діаметр:?|\([^)]{40,}\)|\([^)\s]*\d[^)\s]*\)`, "giu");
function shortTitle(i) {
  const t = i.title.replace(NOISE, " ").replace(/\s*\|\s*/g, ", ").replace(/\s*([,|/])(?:\s*[,|/—-])+/g, "$1").replace(/\s+([,|])/g, "$1")
    .replace(/^[\s,|/·—-]+|[\s,|/·—-]+$/g, "").replace(/\s{2,}/g, " ").trim();
  return t.length >= 6 ? t : i.title;
}
function card(r) {
  // как у kotushkin по смыслу: одна строка = один факт, внизу крупно ₴/кг
  const i = r.lead, hot = i.src === "hotline", many = r.items.length > 1;
  const shops = new Set(r.items.map(x => x.shop + (x.seller || ""))).size;
  const from = many || (i.price_max && i.price_max !== i.price) ? "від " : "";
  const br = i.brand && !NOBRAND.test(i.brand) && !i.title.toLowerCase().includes(i.brand.toLowerCase()) ? i.brand + " " : "";
  const where = many ? `<b class="nshops">${shops} ${plural(shops, "магазин", "магазини", "магазинів")}</b>` :
    hot ? `Hotline · ${i.offers} пропоз.` : esc(shopName(i));
  const spec = [`${matDot(i.material)}${esc(MAT_NAME(i.material))}`,
    i.weight ? `${i.weight_est ? "≈" : ""}${num(i.weight, 2)} кг` : ""].filter(Boolean).join('<i class="sep">·</i>');
  const c = i.color ? colorOf(i.color + " " + i.title) : null;
  const big = i.ppk ? `${from}${num(i.ppk)}<small> ₴/кг</small>` : i.price == null ? "—" : `${from}${num(i.price)}<small> ₴</small>`;
  const tot = i.ppk && i.price != null ? `${i.price_old && !many ? `<s>${num(i.price_old)}</s> ` : ""}${from}${num(i.price)} ₴${i.weight ? ` за ${num(i.weight, 2)} кг` : ""}` :
    i.ppk ? "" : `<span class="na">вага невідома</span>`;
  return `<li class="item" data-id="${esc(i.id)}">
    ${badges(r) ? `<div class="rib">${badges(r)}</div>` : ""}
    ${photo(i)}
    <div class="info">
      <div class="t">${esc(br + shortTitle(i))}</div>
      <div class="ln">${spec}</div>
      ${i.color ? `<div class="ln"><i class="cdot${c === "clear" ? " clear" : ""}" style="--c:${c && c !== "clear" ? c : "transparent"}"></i>${esc(i.color)}</div>` : ""}
      <div class="ln">${where}${i.stock !== "in" ? `<i class="sep">·</i><span class="st st-${i.stock || "unknown"}">${STOCK[i.stock] || STOCK.unknown}</span>` : ""}</div>
    </div>
    <div class="bot"><span class="big">${big}</span><span class="tot">${tot}</span></div>
  </li>`;
}
let ROWS = [];
function render(reset = true) {
  if (reset) shown = PAGE;
  ROWS = rows();
  const n = ROWS.reduce((a, r) => a + r.items.length, 0);
  $("#count").textContent = ROWS.length === n ? `Знайдено ${num(n)}` : `${num(ROWS.length)} товарів · ${num(n)} пропозицій`;
  $("#list").innerHTML = ROWS.length ? ROWS.slice(0, shown).map(card).join("") : empty();
  $("#more").hidden = ROWS.length <= shown;
}
// пусто, но есть товары под заказ / без наличия — предложить их показать
function empty() {
  let hidden = 0;
  if (F.stock !== "all") { const st = F.stock; F.stock = "all"; hidden = filtered().length; F.stock = st; }
  return hidden ? `<li class="empty">У наявності нічого немає.<br>Під замовлення або відсутніх: ${num(hidden)}.
      <br><button class="btn-stock" data-show-all>Показати їх</button></li>` :
    `<li class="empty">Нічого не знайдено.<br>Спробуй прибрати фільтри або змінити пошук.</li>`;
}
$("#list").addEventListener("click", e => { if (e.target.closest("[data-show-all]")) { F.stock = "all"; fChanged(); } });
$("#more").onclick = () => { shown += PAGE; render(false); };
$("#list").addEventListener("click", e => { const li = e.target.closest("[data-id]"); if (li) openItem(li.dataset.id); });

/* ---------- карточка товара ---------- */
async function openItem(id) {
  const i = byId.get(id);
  if (!i) return;
  const hot = i.src === "hotline";
  const offers = (i.group ? GROUPS.get(i.group) : [i]).slice().sort((a, b) => (a.stock !== "in") - (b.stock !== "in") || (a.ppk ?? 1e9) - (b.ppk ?? 1e9));
  const props = [i.material && MAT_NAME(i.material), i.brand, i.color, i.weight && (i.weight_est ? "≈" : "") + num(i.weight, 2) + " кг" + (i.weight_est ? " (оцінка)" : ""),
    ...(i.tags || []).map(t => TAG_NAME[t])].filter(Boolean);
  $("#sheet-body").innerHTML = `
    <div class="d-hero">${photo(i, "ph hero")}<div><h2>${esc(i.title)}</h2>
      <div class="sub">${hot ? `Hotline · ${i.offers} пропозицій` : shopName(i)} · <span class="st st-${i.stock}">${STOCK[i.stock] || ""}</span></div></div></div>
    <div class="d-stats">
      <div class="d-stat"><span>${i.price_max && i.price_max !== i.price ? "Ціна від" : "Ціна"}</span><b>${num(i.price)} ₴</b>${i.price_old ? `<s>${num(i.price_old)} ₴</s>` : ""}</div>
      <div class="d-stat"><span>За кг</span><b>${i.ppk ? num(i.ppk) + " ₴" : "—"}</b></div>
      <div class="d-stat"><span>${hot ? "Ціна до" : "За грам"}</span><b>${hot ? num(i.price_max) + " ₴" : i.ppk ? num(i.ppk / 1000, 2) + " ₴" : "—"}</b></div>
    </div>
    <div class="d-props">${props.map(p => `<span>${esc(p)}</span>`).join("")}</div>
    ${offers.length > 1 ? `<h3 class="sec">Де купити · ${offers.length} ${plural(offers.length, "пропозиція", "пропозиції", "пропозицій")}</h3>
      <div class="offers">${offers.map(o => `<a class="offer ${o.id === i.id ? "cur" : ""}" href="${esc(o.url)}" target="_blank" rel="noopener">
        <span class="o-s"><b>${shopName(o)}</b><small class="st st-${o.stock}">${STOCK[o.stock] || ""}</small></span>
        <span class="o-p"><b>${num(o.price)} ₴</b><small>${o.ppk ? num(o.ppk) + " ₴/кг" : ""}</small></span><span class="o-go">↗</span></a>`).join("")}</div>` : ""}
    ${!hot && i.price && i.weight ? `<div class="np-line" id="npline">${settings.cityRef ? "Рахую доставку…" :
      `Вкажи місто в Налаштуваннях — покажу ціну з доставкою Новою Поштою.`}</div>` : ""}
    ${gauge(i)}
    <div class="d-actions">
      <a class="btn" href="${esc(i.url)}" target="_blank" rel="noopener">${hot ? "Усі магазини на Hotline ↗" : "Відкрити в магазині ↗"}</a>
      <button class="btn ghost" id="fav">${favs.has(i.id) ? "★ В обраному" : "☆ В обране"}</button>
      ${i.ppk ? `<button class="btn ghost" id="part">Порахувати деталь</button>` : `<button class="btn ghost" disabled>Вага невідома</button>`}
      ${i.price && i.weight ? `<button class="btn ghost" id="tocmp" style="grid-column:span 2">До порівняння з доставкою</button>` : ""}
    </div>
    <h3 class="sec">Ціна в часі</h3>
    <div class="chart" id="chart"><div class="empty-c">Завантаження…</div></div>
    ${alts(i)}`;
  const dlg = $("#sheet");
  if (!dlg.open) dlg.showModal();
  $("#sheet-body").scrollTop = 0; dlg.scrollTop = 0;
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
  $$("#sheet-body .alt").forEach(a => a.onclick = () => openItem(a.dataset.id));
  if ($("#npline") && settings.cityRef) (freeShip(i.price) ? Promise.resolve(0) : npFetch(i.weight, i.price)).then(d => {
    if (!$("#npline")) return;
    $("#npline").innerHTML = d == null ? "Нова Пошта не відповіла." : `<span>🚚 Доставка до ${esc(settings.city.split(",")[0])} ${d ? "≈ " + num(d) + " ₴" : "безкоштовна"}</span>
      <b>разом ${num(i.price + d)} ₴ · ${num((i.price + d) / i.weight)} ₴/кг</b>`;
  });
  drawChart($("#chart"), (await history())[i.id] || []);
}
/* шкала: где эта цена за кг среди предложений материала (мин … 90-й перцентиль) */
function gauge(i) {
  const st = MST.get(i.material);
  if (!st || !i.ppk || st.n < 5 || st.p90 <= st.min) return "";
  const pos = v => Math.max(0, Math.min(100, (v - st.min) / (st.p90 - st.min) * 100));
  const d = deal(i);
  const verdict = d >= 10 ? `<b class="good">на ${d}% дешевше</b> за медіану` : d <= -10 ? `<b class="bad">на ${-d}% дорожче</b> за медіану` : "близько до медіани";
  return `<div class="gauge">
    <div class="g-head"><span>${esc(i.material)} · ${num(st.n)} пропозицій</span><span>${verdict}</span></div>
    <div class="g-track"><i class="g-med" style="left:${pos(st.med)}%"></i><i class="g-pin" style="left:${pos(i.ppk)}%"></i></div>
    <div class="g-scale"><span>${num(st.min)} ₴</span><span>медіана ${num(st.med)} ₴</span><span>${num(st.p90)} ₴+</span></div>
  </div>`;
}
/* дешевле за кг: тот же материал и цвет, в наличии, не та же группа */
function alts(i) {
  if (!i.ppk || !i.material || i.material === "Other") return "";
  const seen = new Set([i.group || i.id]);
  const xs = DATA.items.filter(x => x.material === i.material && x.stock === "in" && x.ppk && x.ppk < i.ppk &&
    x.src !== "hotline" && (!i.color || x.color === i.color)).sort((a, b) => a.ppk - b.ppk)
    .filter(x => { const k = x.group || x.id; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5);
  if (!xs.length) return "";
  return `<h3 class="sec">Дешевше за кг${i.color ? ` · ${esc(i.color.toLowerCase())}` : ""}</h3>
    <div class="alts">${xs.map(x => `<button class="alt" data-id="${esc(x.id)}">${photo(x, "ph sm")}
      <span class="a-t"><span>${esc(x.title)}</span><small>${shopName(x)}</small></span>
      <span class="a-p"><b>${num(x.ppk)} ₴/кг</b><small>−${Math.round((1 - x.ppk / i.ppk) * 100)}%</small></span></button>`).join("")}</div>`;
}
$$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

/* ---------- график: одна линия-ступенька с заливкой, тултип по касанию ---------- */
function drawChart(box, pts) {
  if (pts.length < 2) {
    box.innerHTML = `<div class="empty-c">${pts.length ? `Поки одна точка: ${pts[0][0]}, ${num(pts[0][1])} ₴. Нова точка зʼявляється, коли змінюється ціна або наявність.` : "Історії поки немає."}</div>`;
    return;
  }
  const t = pts.map(p => Date.parse(p[0])), ys = pts.map(p => p[1]);
  const t1 = Math.max(Date.now(), t[t.length - 1]);
  const W = 640, H = 210, L = 48, R = 12, T = 14, B = 26;
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = (hi - lo) * 0.2 || hi * 0.05 || 1; lo -= pad; hi += pad;
  const x = v => L + (v - t[0]) / (t1 - t[0] || 1) * (W - L - R);
  const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let d = `M${x(t[0])},${y(ys[0])}`;
  for (let k = 1; k < pts.length; k++) d += `H${x(t[k])}V${y(ys[k])}`;
  d += `H${x(t1)}`;
  const area = d + `V${H - B}H${x(t[0])}Z`;
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  const fmtD = v => new Date(v).toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Історія ціни">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`).join("")}
    <text class="ax" x="${L}" y="${H - 6}">${fmtD(t[0])}</text>
    <text class="ax" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtD(t1)}</text>
    <path class="area" d="${area}"/><path class="ln" d="${d}"/>
    <line class="cross" id="cx" y1="${T}" y2="${H - B}" visibility="hidden"/>
    <circle class="dot" id="cd" r="6" visibility="hidden"/>
    <rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" id="hit"/>
  </svg><div class="tip" id="tip" hidden></div>`;
  const svg = $("svg", box), tip = $("#tip", box), cx = $("#cx", svg), cd = $("#cd", svg);
  const move = e => {
    const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W;
    const px = Math.max(L, Math.min(vx, W - R));
    let k = 0;
    for (let j = 0; j < t.length; j++) if (x(t[j]) <= px) k = j;
    cx.setAttribute("x1", px); cx.setAttribute("x2", px); cx.setAttribute("visibility", "visible");
    cd.setAttribute("cx", px); cd.setAttribute("cy", y(ys[k])); cd.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.style.left = Math.max(60, Math.min(r.width - 60, px / W * r.width)) + 8 + "px";
    tip.textContent = `${pts[k][0]} · ${num(ys[k])} ₴ · ${["немає", "в наявності", "під замовлення"][pts[k][2]] ?? ""}`;
  };
  $("#hit", svg).addEventListener("pointermove", move);
  $("#hit", svg).addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", () => { tip.hidden = true; cx.setAttribute("visibility", "hidden"); cd.setAttribute("visibility", "hidden"); });
}

/* ---------- калькуляторы ---------- */
function calc() {
  const g = +$("#c-g").value, ppk = +$("#c-ppk").value, w = +$("#c-waste").value || 0;
  const grams = g * (1 + w / 100);
  $("#c-out").innerHTML = `<b>${num(grams / 1000 * ppk, 2)} ₴</b><small>${num(grams, 1)} г із запасом · без запасу ${num(g / 1000 * ppk, 2)} ₴</small>`;
  const p = +$("#k-p").value, kw = +$("#k-w").value;
  $("#k-out").innerHTML = kw > 0 ? `<b>${num(p / kw)} ₴/кг</b><small>${num(p / kw / 1000, 3)} ₴ за грам</small>` : "<b>—</b>";
  store.set("calc", { g: $("#c-g").value, ppk: $("#c-ppk").value, waste: $("#c-waste").value, p: $("#k-p").value, w: $("#k-w").value });
}
/* ---------- Нова Пошта: тариф по API без ключа (поиск города и getDocumentPrice) ---------- */
const NP_URL = "https://api.novaposhta.ua/v2.0/json/", KYIV = "8d5a980d-391c-11dd-90d9-001a92567626";
const npCache = store.get("np", {}), npWait = new Map();
async function npCall(model, method, props) {
  const r = await fetch(NP_URL, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: "", modelName: model, calledMethod: method, methodProperties: props }) });
  const d = await r.json();
  if (!d.success) throw new Error((d.errors || [])[0] || "NP");
  return d.data;
}
// отправитель — Київ (большинство магазинов там; точный город магазина не знаем), вес +0,2 кг упаковки,
// шаг 0,5 кг и 500 ₴ оценки; кэш на месяц
function npKey(w, cost) {
  return `${new Date().toISOString().slice(0, 7)}|${settings.cityRef}|${Math.ceil((w + .2) * 2) / 2}|${Math.max(500, Math.ceil(cost / 500) * 500)}`;
}
const npCost = (w, cost) => settings.cityRef && w > 0 ? npCache[npKey(w, cost)] ?? null : null;
function npFetch(w, cost) {
  if (!settings.cityRef || !(w > 0)) return Promise.resolve(null);
  const k = npKey(w, cost);
  if (k in npCache) return Promise.resolve(npCache[k]);
  if (!npWait.has(k)) {
    const [, , kg, c] = k.split("|");
    npWait.set(k, npCall("InternetDocumentGeneral", "getDocumentPrice", { CitySender: KYIV, CityRecipient: settings.cityRef,
      Weight: kg, ServiceType: "WarehouseWarehouse", Cost: c, CargoType: "Parcel", SeatsAmount: "1" })
      .then(d => { npCache[k] = +d[0].Cost; store.set("np", npCache); return npCache[k]; }).catch(() => null));
  }
  return npWait.get(k);
}
const freeShip = price => settings.free > 0 && price >= settings.free;

let cmpRows = store.get("cmp", [{ n: "Магазин 1", p: 650, w: 1, d: "" }, { n: "Магазин 2", p: 1700, w: 3, d: "" }]);
const saveCmp = () => store.set("cmp", cmpRows);
function cmpCalc(r) {
  const auto = freeShip(+r.p) ? 0 : npCost(+r.w, +r.p);
  const del = r.d === "" ? auto ?? 0 : +r.d;
  const total = +r.p + del;
  return { total, del, ppk: r.w > 0 ? total / r.w : null };
}
function renderCmp() {
  const res = cmpRows.map(cmpCalc);
  const miss = cmpRows.filter(r => r.d === "" && !freeShip(+r.p) && settings.cityRef && +r.w > 0 && npCost(+r.w, +r.p) == null);
  if (miss.length) Promise.all(miss.map(r => npFetch(+r.w, +r.p))).then(v => { if (v.some(x => x != null)) renderCmp(); });
  const best = Math.min(...res.map(r => r.ppk ?? Infinity));
  $("#cmp").innerHTML = cmpRows.map((r, k) => `<div class="cmp-row ${res[k].ppk === best && isFinite(best) && cmpRows.length > 1 ? "best" : ""}">
    <div class="r1"><input data-k="${k}" data-f="n" value="${esc(r.n)}" aria-label="Назва"><button class="x" data-del="${k}" aria-label="Видалити">✕</button></div>
    <div class="r2">
      <label>Ціна<div class="inp"><input data-k="${k}" data-f="p" type="number" inputmode="decimal" value="${esc(r.p)}"><i>₴</i></div></label>
      <label>Вага<div class="inp"><input data-k="${k}" data-f="w" type="number" inputmode="decimal" step="0.05" value="${esc(r.w)}"><i>кг</i></div></label>
      <label>Доставка<div class="inp"><input data-k="${k}" data-f="d" type="number" inputmode="decimal" placeholder="${res[k].del}" value="${esc(r.d)}"><i>₴</i></div></label>
    </div>
    <div class="r3"><span>разом ${num(res[k].total)} ₴</span><b>${num(res[k].ppk)} ₴/кг</b></div>
  </div>`).join("");
}
$("#cmp").addEventListener("change", e => {
  const { k, f } = e.target.dataset;
  if (k == null) return;
  cmpRows[k][f] = f === "n" || e.target.value === "" ? e.target.value : +e.target.value;
  saveCmp(); renderCmp();
});
$("#cmp").addEventListener("click", e => {
  const b = e.target.closest("[data-del]");
  if (!b) return;
  cmpRows.splice(+b.dataset.del, 1); saveCmp(); renderCmp();
});
$("#cmp-add").onclick = () => { cmpRows.push({ n: "Магазин " + (cmpRows.length + 1), p: "", w: 1, d: "" }); saveCmp(); renderCmp(); };

/* ---------- настройки ---------- */
function renderShops() {
  $("#shops").innerHTML = DATA.shops.map(s => `<li>
    <span class="st st-${s.ok ? "in" : "out"}"></span>
    <span class="n">${esc(s.name)}${s.ok ? "" : `<span class="err">помилка: ${esc(s.error || "")}</span>`}</span>
    <span class="c">${num(s.count)} · ${s.at ? new Date(s.at).toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span></li>`).join("");
}
function npInfo() {
  if (!settings.cityRef) { $("#s-np").textContent = "Обери місто зі списку — доставку Новою Поштою порахую сам."; return; }
  Promise.all([npFetch(1, 600), npFetch(3, 1500)]).then(([a, b]) => {
    $("#s-np").textContent = a == null ? "Нова Пошта не відповіла, спробую пізніше." :
      `Нова Пошта з Києва, відділення → відділення: 1 кг ≈ ${num(a)} ₴, 3 кг ≈ ${num(b)} ₴. Враховується в картці товару й порівнянні.`;
  });
}
function initSettings() {
  $("#s-city").value = settings.city; $("#s-free").value = settings.free || "";
  let t, found = [];
  $("#s-city").addEventListener("input", e => {
    const q = e.target.value.trim(), hit = found.find(c => c.label === q);
    if (hit) {
      Object.assign(settings, { city: hit.label, cityRef: hit.ref }); store.set("settings", settings); npInfo(); renderCmp();
      return;
    }
    clearTimeout(t);
    if (q.length < 2) return;
    t = setTimeout(async () => {
      try {
        const d = await npCall("Address", "getCities", { FindByString: q, Limit: "8" });
        found = d.map(c => ({ label: c.Description + (c.AreaDescription && !c.Description.includes("обл") ? `, ${c.AreaDescription} обл.` : ""), ref: c.Ref }));
        $("#s-cities").innerHTML = found.map(c => `<option value="${esc(c.label)}">`).join("");
      } catch { /* без сети — просто нет подсказок */ }
    }, 300);
  });
  $("#s-free").addEventListener("input", () => { settings.free = +$("#s-free").value || 0; store.set("settings", settings); renderCmp(); });
  // город вписан руками в прошлой версии — ищем его у НП по точному названию
  if (settings.city && !settings.cityRef) npCall("Address", "getCities", { FindByString: settings.city.trim(), Limit: "8" }).then(d => {
    const c = d.find(x => x.Description.toLowerCase() === settings.city.trim().toLowerCase());
    if (c) { settings.cityRef = c.Ref; store.set("settings", settings); npInfo(); renderCmp(); }
  }).catch(() => {});
  npInfo();
}

/* ---------- навигация ---------- */
const TITLES = { home: "Філамент UA", list: "Каталог", calc: "Калькулятор", set: "Налаштування" };
function go(v) {
  if (!TITLES[v]) v = "home";
  $$(".view").forEach(s => s.classList.toggle("active", s.id === "v-" + v));
  $$(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  $("#title").textContent = TITLES[v];
  $("#search-row").hidden = $("#mats").hidden = v !== "list";
  $("#stats").hidden = v === "home";
  store.set("tab", v);
  scrollTo(0, 0);
}
$$(".tabs button").forEach(b => b.onclick = () => go(b.dataset.v));

const cs = store.get("calc", null);
if (cs) { $("#c-g").value = cs.g; $("#c-ppk").value = cs.ppk; $("#c-waste").value = cs.waste; $("#k-p").value = cs.p; $("#k-w").value = cs.w; }
$$("#v-calc .panel:not(:last-child) input").forEach(el => el.addEventListener("input", calc));
calc(); renderCmp(); initSettings(); go(store.get("tab", "home")); load();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
