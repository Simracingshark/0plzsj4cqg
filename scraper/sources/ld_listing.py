"""Списки категорий, где каждый товар лежит в ld+json как Product с Offer
(сайты магазинов на движке Prom, 3D4U). Конфиг: urls, page (шаблон пагинации)."""
import re
import urllib.error
import urllib.parse

from common import get
from sources import ldjson
from sources.ldjson import AVAIL


def walk(d):
    """Все Product на любой глубине: ItemList, mainEntity, mainContentOfPage (Allo) и т.п."""
    if isinstance(d, list):
        for x in d:
            yield from walk(x)
    elif isinstance(d, dict):
        if d.get("@type") == "Product":
            yield d
            return
        for v in d.values():
            if isinstance(v, (dict, list)):
                yield from walk(v)


def products(html):
    for d in ldjson.blocks(html):
        yield from walk(d)


def parse(shop, html, base=""):
    out = []
    for d in products(html):
        o = d.get("offers") or {}
        if isinstance(o, list):
            o = o[0] if o else {}
        try:
            p = float(o.get("price") or o.get("lowPrice"))
        except (TypeError, ValueError):
            p = None
        if not d.get("name"):
            continue
        # 3D4U не кладёт ссылку на товар — тогда ведём на страницу категории, ключ — по названию
        own = o.get("url") or d.get("url")
        url = urllib.parse.urljoin(base, own) if own else base
        b = d.get("brand")
        img = d.get("image")
        key = re.search(r"/p(\d+)-", url)
        if key:
            key = key.group(1)
        elif own:
            key = url.rstrip("/").rsplit("/", 1)[-1][:80]
        else:
            key = re.sub(r"\W+", "-", d["name"].lower())[:80]
        out.append({
            "id": f"{shop['id']}:{key}",
            "shop": shop["name"],
            "title": d["name"].strip(),
            "brand": b.get("name") if isinstance(b, dict) else b,
            "price": p,
            "stock": AVAIL.get(str(o.get("availability", "")).rsplit("/", 1)[-1], "unknown"),
            "url": url,
            "image": img[0] if isinstance(img, list) and img else img,
        })
    return out


def scrape(shop):
    out, seen = [], set()
    for url in shop["urls"]:
        for n in range(1, shop.get("max_pages", 80) + 1):
            if n > 1 and not shop.get("page"):
                break
            u = url if n == 1 else url.rstrip("/") + shop["page"].format(n=n)
            try:
                html = get(u)
            except urllib.error.HTTPError as e:
                if n > 1 and e.code == 404:  # страницы закончились
                    break
                raise
            got = [o for o in parse(shop, html, u) if o["id"] not in seen]
            for o in got:
                seen.add(o["id"])
            out += got
            if not got:
                break
    return out
