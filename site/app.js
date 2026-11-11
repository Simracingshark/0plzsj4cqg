"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => v == null || isNaN(v) ? "—" : Number(v).toLocaleString("uk-UA", { maximumFractionDigits: d });
const STOCK = { in: "в наявності", order: "під замовлення", out: "немає", unknown: "невідомо" };
const MAT_NAME = m => m === "Other" ? "Інше" : m;
const PAGE = 50;

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
function swatch(i) {
  const s = (i.color || "") + " " + i.title;
  for (const [rx, c] of COLORS) if (rx.test(s)) return c === "clear" ? `<i class="sw clear"></i>` : `<i class="sw" style="--c:${c}"></i>`;
  return `<i class="sw unknown"></i>`;
}

let DATA = { items: [], shops: [] }, HIST = null, shown = PAGE;
const BEST = new Map();
const favs = new Set(store.get("favs", []));
const settings = Object.assign({ city: "", del: 0, free: 0 }, store.get("settings", {}));
const F = Object.assign({ q: "", mat: "", brand: "", shop: "", sort: "ppk", stock: true, fav: false, hot: true, weight: "" }, store.get("f2", {}));
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
  computeBest();
  const shops = new Set(DATA.items.filter(i => i.src !== "hotline").map(i => i.shop)).size;
  const when = new Date(DATA.updated).toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  $("#stats").textContent = `${num(DATA.items.length)} позицій · ${shops} магазинів · ${when}`;
  fillSelect("#f-brand", countBy(DATA.items, "brand"));
  fillSelect("#f-shop", countBy(DATA.items, "shop"));
  renderMats(); syncFilterUI(); render(); renderBest(); renderShops();
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
  $(sel).insertAdjacentHTML("beforeend", pairs.map(([v, n]) => `<option value="${esc(v)}">${esc(v)} · ${n}</option>`).join(""));
}
function computeBest() {
  BEST.clear();
  for (const i of DATA.items) {
    if (i.stock !== "in" || !i.ppk || i.src === "hotline") continue;
    const b = BEST.get(i.material);
    if (!b || i.ppk < b) BEST.set(i.material, i.ppk);
  }
}

/* ---------- фильтры ---------- */
function saveF() { store.set("f2", F); }
function renderMats() {
  const counts = countBy(DATA.items.filter(i => !F.stock || i.stock === "in"), "material");
  $("#mats").innerHTML = `<button class="chip ${F.mat ? "" : "on"}" data-m="">Усі</button>` +
    counts.map(([m, n]) => `<button class="chip ${F.mat === m ? "on" : ""}" data-m="${esc(m)}">${esc(MAT_NAME(m))} <small>${n}</small></button>`).join("");
}
$("#mats").addEventListener("click", e => {
  const b = e.target.closest("[data-m]");
  if (!b) return;
  F.mat = b.dataset.m; saveF(); renderMats(); render();
});
let qTimer;
$("#q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { F.q = e.target.value; saveF(); render(); }, 150); });

const SORTS = { ppk: "₴ за кг ↑", price: "₴ за штуку ↑", name: "за назвою" };
function syncFilterUI() {
  $("#q").value = F.q;
  $$("#f-sort button").forEach(b => b.classList.toggle("on", b.dataset.s === F.sort));
  $$("#f-weight button").forEach(b => b.classList.toggle("on", b.dataset.w === F.weight));
  $("#f-stock").checked = F.stock; $("#f-fav").checked = F.fav; $("#f-hot").checked = F.hot;
  if ([...$("#f-brand").options].some(o => o.value === F.brand)) $("#f-brand").value = F.brand;
  if ([...$("#f-shop").options].some(o => o.value === F.shop)) $("#f-shop").value = F.shop;
  $("#sort-btn").textContent = "Сортування: " + SORTS[F.sort];
  const n = [F.brand, F.shop, F.fav, !F.hot, F.weight, !F.stock].filter(Boolean).length;
  $("#fcount").hidden = !n; $("#fcount").textContent = n;
}
$("#open-filters").onclick = () => { syncFilterUI(); $("#filters").showModal(); };
$("#sort-btn").onclick = () => {
  const ks = Object.keys(SORTS); F.sort = ks[(ks.indexOf(F.sort) + 1) % ks.length];
  saveF(); syncFilterUI(); render();
};
$$("#f-sort button").forEach(b => b.onclick = () => $$("#f-sort button").forEach(x => x.classList.toggle("on", x === b)));
$$("#f-weight button").forEach(b => b.onclick = () => $$("#f-weight button").forEach(x => x.classList.toggle("on", x === b)));
$("#f-apply").onclick = () => {
  F.sort = $("#f-sort .on").dataset.s; F.weight = $("#f-weight .on").dataset.w;
  F.stock = $("#f-stock").checked; F.fav = $("#f-fav").checked; F.hot = $("#f-hot").checked;
  F.brand = $("#f-brand").value; F.shop = $("#f-shop").value;
  saveF(); syncFilterUI(); renderMats(); render(); $("#filters").close();
};
$("#f-reset").onclick = () => {
  Object.assign(F, { brand: "", shop: "", sort: "ppk", stock: true, fav: false, hot: true, weight: "" });
  $("#f-brand").value = ""; $("#f-shop").value = "";
  syncFilterUI();
};

function filtered() {
  const words = F.q.toLowerCase().split(/\s+/).filter(Boolean);
  const wOk = w => !F.weight || (w && (F.weight === "lt1" ? w < 0.95 : F.weight === "1" ? w >= 0.95 && w <= 1.05 : w > 1.05));
  const xs = DATA.items.filter(i =>
    (!F.mat || i.material === F.mat) && (!F.brand || i.brand === F.brand) && (!F.shop || i.shop === F.shop) &&
    (!F.stock || i.stock === "in") && (!F.fav || favs.has(i.id)) && (F.hot || i.src !== "hotline") && wOk(i.weight) &&
    words.every(w => (i.title + " " + (i.color || "") + " " + i.shop + " " + (i.material || "") + " " + (i.brand || "")).toLowerCase().includes(w)));
  const inf = v => v ?? Infinity;
  if (F.sort === "ppk") xs.sort((a, b) => inf(a.ppk) - inf(b.ppk) || inf(a.price) - inf(b.price));
  else if (F.sort === "price") xs.sort((a, b) => inf(a.price) - inf(b.price));
  else xs.sort((a, b) => a.title.localeCompare(b.title, "uk"));
  return xs;
}

/* ---------- список ---------- */
function card(i) {
  const hot = i.src === "hotline";
  const price = i.price == null ? "—" : (i.price_max && i.price_max !== i.price ? "від " : "") + num(i.price) + " ₴";
  const isBest = i.stock === "in" && i.ppk && !hot && BEST.get(i.material) === i.ppk;
  return `<li class="item" data-id="${esc(i.id)}">
    ${swatch(i)}
    <div class="t">${esc(i.title)}</div>
    <div class="p"><b>${price}</b>${i.ppk ? `<span>${num(i.ppk)} ₴/кг</span>` : `<span class="na">вага ?</span>`}</div>
    <div class="meta">
      <span class="shop">${hot ? `Hotline · ${i.offers} пропоз.` : esc(i.shop)}</span>
      <span class="st st-${i.stock || "unknown"}">${STOCK[i.stock] || STOCK.unknown}</span>
      ${i.weight ? `<span${i.weight_est ? ' title="вага не вказана, оцінка"' : ""}>${i.weight_est ? "≈" : ""}${num(i.weight, 2)} кг</span>` : ""}
      ${isBest ? `<span class="tag best">найдешевше</span>` : ""}
      ${favs.has(i.id) ? `<span class="tag fav">★</span>` : ""}
    </div>
  </li>`;
}
function render(reset = true) {
  if (reset) shown = PAGE;
  const xs = filtered();
  $("#count").textContent = `Знайдено ${num(xs.length)}`;
  $("#list").innerHTML = xs.length ? xs.slice(0, shown).map(card).join("") :
    `<li class="empty">Нічого не знайдено.<br>Спробуй прибрати фільтри або змінити пошук.</li>`;
  $("#more").hidden = xs.length <= shown;
}
$("#more").onclick = () => { shown += PAGE; render(false); };
$("#list").addEventListener("click", e => { const li = e.target.closest("[data-id]"); if (li) openItem(li.dataset.id); });

/* ---------- найкраще ---------- */
let bestMode = "all";
function renderBest() {
  const best = new Map();
  for (const i of DATA.items) {
    if (i.stock !== "in" || !i.ppk || !i.material || i.material === "Other") continue;
    if (bestMode === "shops" && i.src === "hotline") continue;
    const b = best.get(i.material);
    if (!b || i.ppk < b.ppk) best.set(i.material, i);
  }
  const order = ["PLA", "PLA+", "PETG", "ABS", "ASA", "TPU"];
  const rows = [...best.values()].sort((a, b) => {
    const x = order.indexOf(a.material), y = order.indexOf(b.material);
    return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || a.material.localeCompare(b.material);
  });
  $("#best").innerHTML = rows.map(i => `<div class="best-card" data-id="${esc(i.id)}">
    <div class="mat">${esc(i.material)}</div>
    <div class="big">${num(i.ppk)} <small>₴/кг</small></div>
    <div class="name">${esc(i.title)}</div>
    <div class="where">${i.src === "hotline" ? "Hotline · мін. ціна" : esc(i.shop)} · ${num(i.price)} ₴</div>
  </div>`).join("") || `<div class="empty">Немає даних</div>`;
}
$$("#best-mode button").forEach(b => b.onclick = () => {
  bestMode = b.dataset.m; $$("#best-mode button").forEach(x => x.classList.toggle("on", x === b)); renderBest();
});
$("#best").addEventListener("click", e => { const c = e.target.closest("[data-id]"); if (c) openItem(c.dataset.id); });

/* ---------- карточка товара ---------- */
async function openItem(id) {
  const i = byId.get(id);
  if (!i) return;
  const hot = i.src === "hotline";
  const props = [i.material && MAT_NAME(i.material), i.brand, i.color, i.weight && (i.weight_est ? "≈" : "") + num(i.weight, 2) + " кг" + (i.weight_est ? " (оцінка)" : "")].filter(Boolean);
  $("#sheet-body").innerHTML = `
    <div class="d-hero">${swatch(i)}<div><h2>${esc(i.title)}</h2>
      <div class="sub">${hot ? `Hotline · ${i.offers} пропозицій` : esc(i.shop)} · <span class="st st-${i.stock}">${STOCK[i.stock] || ""}</span></div></div></div>
    <div class="d-stats">
      <div class="d-stat"><span>${i.price_max && i.price_max !== i.price ? "Ціна від" : "Ціна"}</span><b>${num(i.price)} ₴</b></div>
      <div class="d-stat"><span>За кг</span><b>${i.ppk ? num(i.ppk) + " ₴" : "—"}</b></div>
      <div class="d-stat"><span>${hot ? "Ціна до" : "За грам"}</span><b>${hot ? num(i.price_max) + " ₴" : i.ppk ? num(i.ppk / 1000, 2) + " ₴" : "—"}</b></div>
    </div>
    <div class="d-props">${props.map(p => `<span>${esc(p)}</span>`).join("")}</div>
    <div class="d-actions">
      <a class="btn" href="${esc(i.url)}" target="_blank" rel="noopener">${hot ? "Усі магазини на Hotline ↗" : "Відкрити в магазині ↗"}</a>
      <button class="btn ghost" id="fav">${favs.has(i.id) ? "★ В обраному" : "☆ В обране"}</button>
      ${i.ppk ? `<button class="btn ghost" id="part">Порахувати деталь</button>` : `<button class="btn ghost" disabled>Вага невідома</button>`}
      ${i.price && i.weight ? `<button class="btn ghost" id="tocmp" style="grid-column:span 2">До порівняння з доставкою</button>` : ""}
    </div>
    <h3 class="sec">Ціна в часі</h3>
    <div class="chart" id="chart"><div class="empty-c">Завантаження…</div></div>`;
  const dlg = $("#sheet");
  dlg.showModal();
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
  drawChart($("#chart"), (await history())[i.id] || []);
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
let cmpRows = store.get("cmp", [{ n: "Магазин 1", p: 650, w: 1, d: "" }, { n: "Магазин 2", p: 1700, w: 3, d: "" }]);
const saveCmp = () => store.set("cmp", cmpRows);
function cmpCalc(r) {
  const del = r.d === "" ? (settings.free > 0 && +r.p >= settings.free ? 0 : +settings.del || 0) : +r.d;
  const total = +r.p + del;
  return { total, del, ppk: r.w > 0 ? total / r.w : null };
}
function renderCmp() {
  const res = cmpRows.map(cmpCalc);
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
function initSettings() {
  $("#s-city").value = settings.city; $("#s-del").value = settings.del || ""; $("#s-free").value = settings.free || "";
  ["#s-city", "#s-del", "#s-free"].forEach(s => $(s).addEventListener("input", () => {
    settings.city = $("#s-city").value; settings.del = +$("#s-del").value || 0; settings.free = +$("#s-free").value || 0;
    store.set("settings", settings); renderCmp();
  }));
}

/* ---------- навигация ---------- */
const TITLES = { list: "Філамент", best: "Найкраще", calc: "Калькулятор", set: "Налаштування" };
function go(v) {
  $$(".view").forEach(s => s.classList.toggle("active", s.id === "v-" + v));
  $$(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  $("#title").textContent = TITLES[v];
  $("#search-row").hidden = $("#mats").hidden = v !== "list";
  store.set("tab", v);
  scrollTo(0, 0);
}
$$(".tabs button").forEach(b => b.onclick = () => go(b.dataset.v));

const cs = store.get("calc", null);
if (cs) { $("#c-g").value = cs.g; $("#c-ppk").value = cs.ppk; $("#c-waste").value = cs.waste; $("#k-p").value = cs.p; $("#k-w").value = cs.w; }
$$("#v-calc .panel:not(:last-child) input").forEach(el => el.addEventListener("input", calc));
calc(); renderCmp(); initSettings(); go(store.get("tab", "list")); load();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
