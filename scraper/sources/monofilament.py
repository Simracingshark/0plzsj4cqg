"""MonoFilament (OpenCart со своей карточкой mfil-catalog-card).
В карточке один цвет; активная «таблетка» варианта = вес/диаметр, к ней относится цена.
Конфиг: urls — категории, пагинация ?page=N."""
import html
import re
import urllib.error

from common import get, price, text

CARD = 'class="product-thumb mfil-catalog-card'


def parse(shop, page):
    out = []
    for c in page.split(CARD)[1:]:
        name = re.search(r"<h4><a href=\"([^\"]+)\">(.*?)</a>", c, re.S)
        pill = re.search(r'class="mfil-catalog-variant-pill active([^"]*)"[^>]*href="([^"]+)"[^>]*>'
                         r'<span[^>]*>(.*?)</span>', c, re.S)
        cost = re.search(r'<p class="price">(.*?)</p>', c, re.S)
        if not name or not cost:
            continue
        url = html.unescape(pill.group(2) if pill else name.group(1))
        variant = text(pill.group(3)) if pill else ""
        slug = re.search(r"o(\d)(\d+)mm-vaga(\d)(\d+)kg", url)
        if not variant and slug:  # активной таблетки нет — берём диаметр/вес из адреса
            variant = "Ø{},{}мм / {},{}кг".format(*slug.groups())
        # цена со скидкой: <span class="price-new">
        new = re.search(r'price-new[^>]*>([^<]*)', cost.group(1))
        out.append({
            "id": f"{shop['id']}:{url.rstrip('/').rsplit('/', 1)[-1]}",
            "shop": shop["name"],
            "title": f"MonoFilament {text(name.group(2))} {variant}".strip(),
            "brand": "MonoFilament",
            "price": price(new.group(1) if new else text(cost.group(1))),
            "stock": "out" if pill and "out-of-stock" in pill.group(1) else "in",
            "url": url,
        })
    return out


def scrape(shop):
    out, seen = [], set()
    for url in shop["urls"]:
        for n in range(1, 40):
            try:
                page = get(url if n == 1 else f"{url}?page={n}")
            except urllib.error.HTTPError as e:
                if n > 1 and e.code == 404:
                    break
                raise
            got = [o for o in parse(shop, page) if o["id"] not in seen]
            seen.update(o["id"] for o in got)
            out += got
            if not got:
                break
    return out
