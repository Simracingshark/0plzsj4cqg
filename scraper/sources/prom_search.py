"""Поиск по Prom (все продавцы): товары лежат в JSON состояния страницы
как {"product":{"id":..,"__typename":"Product",...}}, ~29 на страницу.
Конфиг: queries — фразы поиска, pages — сколько страниц на фразу."""
import json
import re
import urllib.parse

from common import get, text

PRESENCE = {"avail": "in", "order": "order", "wait": "order", "not_avail": "out"}
SEARCH = "https://prom.ua/ua/search?"
START = re.compile(r'"product":(?=\{"id":\d+,"__typename":"Product")')


def parse(shop, page):
    dec, out = json.JSONDecoder(), []
    for m in START.finditer(page):
        try:
            p, _ = dec.raw_decode(page, m.end())
        except ValueError:
            continue
        if not p.get("name") or not p.get("canShowPrice", True):
            continue
        pres = (p.get("presence") or {}).get("presence")
        try:
            cost = float(p.get("discountedPrice") or p.get("price"))
        except (TypeError, ValueError):
            cost = None
        out.append({
            "id": f"{shop['id']}:{p['id']}",
            "shop": shop["name"],
            "seller": ((p.get("company") or {}).get("name") or "").strip() or None,
            "title": text(p["name"]),
            "price": cost,
            "stock": PRESENCE.get(pres, "unknown"),
            "url": f"https://prom.ua/ua/p{p['id']}-{p.get('urlText') or 'item'}.html",
            "image": p.get("image"),
            "price_old": float(p["price"]) if p.get("hasDiscount") and p.get("price") and
            cost and float(p["price"]) > cost else None,
        })
    return out


def scrape(shop):
    """queries — поисковые фразы; по каждой pages страниц (страница 2 категории Prom
    без JS отдаёт ту же первую, а поиск честно листается через &page=N)."""
    out, seen = [], set()
    for q in shop["queries"]:
        for n in range(1, shop.get("pages", 5) + 1):
            args = {"search_term": q, **({"page": n} if n > 1 else {})}
            got = [o for o in parse(shop, get(SEARCH + urllib.parse.urlencode(args)))
                   if o["id"] not in seen]
            seen.update(o["id"] for o in got)
            out += got
            if not got:
                break
    return out
