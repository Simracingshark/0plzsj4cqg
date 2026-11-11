"""Отдельный продавец на Prom: список товаров со страницы компании, цена и наличие со страницы товара."""
import re

from common import get
from sources import ldjson


def scrape(shop):
    base = shop["url"].removesuffix(".html")
    urls = []
    for page in range(1, 30):
        html = get(shop["url"] if page == 1 else f"{base}/page_{page}.html")
        lst = ldjson.find(html, "ItemList") or {}
        new = [i["url"] for i in lst.get("itemListElement", []) if i.get("url") not in urls]
        urls += new
        if not new or len(urls) >= int(lst.get("numberOfItems") or 0):
            break
    out = []
    for u in urls:
        p = ldjson.product(get(u))
        if not p or not p["title"]:
            continue
        p.update(shop=shop["name"], source="prom", url=u,
                 id="prom:" + re.search(r"/p(\d+)-", u).group(1))
        out.append(p)
    return out
