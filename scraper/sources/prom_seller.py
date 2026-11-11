"""Отдельный продавец на Prom: все товары со страницы компании, листаем ?page=N.
Товары лежат в JSON состояния страницы, как в поиске (разбор из prom_search).
Конфиг: brand — бренд, если в названии его нет (бренда в JSON Prom нет)."""
from common import brand, get
from sources import prom_search


def scrape(shop):
    out, seen = [], set()
    for n in range(1, 40):
        got = [o for o in prom_search.parse(shop, get(shop["url"] + (f"?page={n}" if n > 1 else "")))
               if o["id"] not in seen]
        if not got:
            break
        seen.update(o["id"] for o in got)
        out += got
    for o in out:
        o["id"] = "prom:" + o["id"].split(":", 1)[1]  # прежний формат id, чтобы не терять историю
        o["seller"] = None
        if shop.get("brand") and not brand(o["title"]):
            o["brand"] = shop["brand"]
    return out
