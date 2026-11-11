"""Hotline: каталог филамента. Берём то, что Hotline показывает открыто в списке:
название, характеристики, вилку цен и число предложений. Цены по отдельным магазинам
Hotline прячет от парсинга, их не трогаем — магазины парсим напрямую."""
import re

from common import Blocked, brand, get, price, text

URL = "https://hotline.ua/ua/computer/rashodnye-materialy-dlya-3d-printerov/"


def parse_card(c):
    m = re.search(r'href="(/ua/computer-rashodnye-materialy-dlya-3d-printerov/([^"?/]+)/)"[^>]*class="item-title[^"]*"[^>]*>(.*?)</a>', c, re.S)
    if not m:
        return None
    href, slug, title = m.group(1), m.group(2), text(m.group(3))
    kind = re.search(r'<span class="spec-item[^"]*"[^>]*>(?:<!---->)?\s*([^<]+?)\s*<', c)
    specs = {"Тип": text(kind.group(1))} if kind else {}
    for k, v in re.findall(r'<span class="text-gray"[^>]*>([^<]+):</span>(.*?)</span>', c, re.S):
        specs[text(k)] = text(v)
    pm = re.search(r'list-item__value-price[^>]*>(.*?)</div>', c, re.S)
    lo = hi = None
    if pm:
        nums = [price(x) for x in re.split(r"–|-", text(pm.group(1)).replace("₴", ""))]
        nums = [x for x in nums if x]
        if nums:
            lo, hi = min(nums), max(nums)
    om = re.search(r"Всі пропозиції \((\d+)\)", c)
    img = re.search(r'<img src="(/img/[^"]+)"', c)
    w = None
    wm = re.search(r"(\d+(?:[.,]\d+)?)\s*(кг|г)", specs.get("Маса", ""))
    if wm:
        w = float(wm.group(1).replace(",", "."))
        w = w / 1000 if wm.group(2) == "г" else w
    return {
        "id": "hotline:" + slug,
        "source": "hotline",
        "shop": "Hotline",
        "title": title,
        "brand": brand(title) or title.split()[0],
        "material_raw": specs.get("Матеріал"),
        "kind": specs.get("Тип") or "",
        "weight": w,
        "price": lo,
        "price_max": hi,
        "offers": int(om.group(1)) if om else (1 if lo else 0),
        "stock": "in" if lo else "out",
        "url": "https://hotline.ua" + href,
        "image": "https://hotline.ua" + img.group(1) if img else None,
    }


def scrape(shop):
    out, seen = [], set()
    for page in range(1, 80):
        # Hotline быстро включает капчу, поэтому ходим медленно
        html = get(URL if page == 1 else f"{URL}?p={page}", delay=4)
        if "list-item--row" not in html and "captcha" in html:
            raise Blocked(f"капча на странице {page}")
        body = html[html.find("<body"):html.find("window.__NUXT__")]
        cards = body.split('class="list-item list-item--row"')[1:]
        got = 0
        for c in cards:
            o = parse_card(c)
            if o and o["id"] not in seen:
                seen.add(o["id"])
                out.append(o)
                got += 1
        if not got or f"?p={page + 1}" not in html:
            break
    return out
