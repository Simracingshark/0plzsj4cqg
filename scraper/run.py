"""Обходит все источники из shops.json и пишет data/offers.json + data/history.json.

Запуск: python scraper/run.py [id_магазина ...]
"""
import json
import re
import pathlib
import sys
import time
import traceback
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import diameter, is_filament, material, normalize  # noqa: E402
from sources import cards, hotline, ld_listing, opencart, prom_seller, shopify, woocommerce  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"
TYPES = {"hotline": hotline, "opencart": opencart, "prom_seller": prom_seller, "cards": cards,
         "ld_listing": ld_listing, "woocommerce": woocommerce, "shopify": shopify}
KEEP = ("id", "shop", "title", "brand", "material", "color", "weight", "price",
        "price_max", "offers", "stock", "ppk", "url", "weight_est")


def load(name, default):
    p = DATA / name
    return json.loads(p.read_text("utf-8")) if p.exists() else default


def clean(o):
    raw = o.pop("material_raw", None)
    if raw:
        o["material"] = material(raw) if material(raw) != "Other" else material(o["title"])
    craw = o.pop("color_raw", None)
    if craw:
        o["color"] = craw.split(",")[0].strip().capitalize()
    normalize(o)
    return {k: o[k] for k in KEEP if o.get(k) is not None}


FILAMENT_WORD = re.compile(r"філамент|филамент|filament|пластик|plastic|нитк|пруток", re.I)


def keep(o):
    if o.get("kind") and "філамент" not in o["kind"].lower():
        return False
    # без распознанного материала оставляем только то, что прямо названо пластиком/филаментом
    if material(o["title"]) == "Other" and not FILAMENT_WORD.search(o["title"]):
        return False
    return is_filament(o["title"]) and diameter(o["title"]) != 2.85


def main(only):
    shops = json.loads((ROOT / "scraper" / "shops.json").read_text("utf-8"))
    prev = load("offers.json", {"items": [], "shops": []})
    items, status = [], []
    for shop in shops:
        last = next((s for s in prev["shops"] if s["id"] == shop["id"]), {})
        # Источники с every_h (Hotline) опрашиваем реже, чем идёт cron
        fresh = last.get("ok") and last.get("at") and \
            hours_since(last["at"]) < shop.get("every_h", 0)
        if (only and shop["id"] not in only) or (not only and fresh):
            items += [i for i in prev["items"] if i.get("src") == shop["id"]]
            status += [s for s in prev["shops"] if s["id"] == shop["id"]]
            continue
        t0 = time.time()
        try:
            got = [clean(o) for o in TYPES[shop["type"]].scrape(shop) if keep(o)]
            for g in got:
                g["src"] = shop["id"]
            items += got
            status.append({"id": shop["id"], "name": shop["name"], "ok": True,
                           "count": len(got), "at": now()})
            print(f"{shop['id']}: {len(got)} за {time.time() - t0:.0f} с")
        except Exception as e:  # один сломанный магазин не валит остальные
            traceback.print_exc()
            old = [i for i in prev["items"] if i.get("src") == shop["id"]]
            items += old
            status.append({"id": shop["id"], "name": shop["name"], "ok": False,
                           "count": len(old), "at": last.get("at"), "error": str(e)[:200]})

    # старые записи могли сохраниться с полями, которых уже нет в KEEP
    items = [{k: v for k, v in i.items() if k in KEEP or k == "src"} for i in items]
    DATA.mkdir(exist_ok=True)
    (DATA / "offers.json").write_text(json.dumps(
        {"updated": now(), "shops": status, "items": items},
        ensure_ascii=False, separators=(",", ":")), "utf-8")
    update_history(items)


def update_history(items):
    """История: {id: [[YYYY-MM-DD, цена, наличие], ...]}. Новая точка только при изменении."""
    hist = load("history.json", {})
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    stock = {"in": 1, "order": 2, "out": 0}
    for i in items:
        if i.get("price") is None:
            continue
        pt = [day, i["price"], stock.get(i.get("stock"), 1)]
        h = hist.setdefault(i["id"], [])
        if h and h[-1][1:] == pt[1:]:
            continue
        if h and h[-1][0] == day:
            h[-1] = pt
        else:
            h.append(pt)
    (DATA / "history.json").write_text(json.dumps(
        hist, ensure_ascii=False, separators=(",", ":")), "utf-8")


def hours_since(iso):
    t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - t).total_seconds() / 3600


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
