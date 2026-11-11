"""Списки категорий, где каждый товар лежит в ld+json как Product с Offer
(сайты магазинов на движке Prom, 3D4U). Конфиг: urls, page (шаблон пагинации)."""
import re
import urllib.parse

from common import get
from sources import ldjson
from sources.ldjson import AVAIL


def products_in(lst):
    for li in lst.get("itemListElement") or []:
        it = li.get("item", li) if isinstance(li, dict) else None
        if isinstance(it, dict) and it.get("@type") == "Product":
            yield it


def products(html):
    for d in ldjson.blocks(html):
        if not isinstance(d, dict):
            continue
        if d.get("@type") == "Product":
            yield d
        for li in d.get("itemListElement") or []:
            it = li.get("item", li) if isinstance(li, dict) else None
            if isinstance(it, dict) and it.get("@type") == "Product":
                yield it
        main = d.get("mainEntity")
        if isinstance(main, dict) and main.get("@type") == "ItemList":
            yield from products_in(main)


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
        for n in range(1, 80):
            if n > 1 and not shop.get("page"):
                break
            u = url if n == 1 else url.rstrip("/") + shop["page"].format(n=n)
            got = [o for o in parse(shop, get(u), u) if o["id"] not in seen]
            for o in got:
                seen.add(o["id"])
            out += got
            if not got:
                break
    return out
