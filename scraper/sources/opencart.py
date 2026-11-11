"""Магазины на OpenCart (тема Journal): карточки товаров в списке категории.
Сейчас: 3ddevice.com.ua."""
import re

from common import get, price, text


def scrape(shop):
    out, seen = [], set()
    url = shop["url"]
    for page in range(1, 60):
        html = get(url if page == 1 else f"{url}?page={page}")
        cards = html.split('<div class="product-layout')[1:]
        got = 0
        for c in cards:
            m = re.search(r'<div class="name">\s*<a href="([^"]+)">(.*?)</a>', c, re.S)
            if not m or m.group(1) in seen:
                continue
            seen.add(m.group(1))
            prices = [price(x) for x in re.findall(r'price-(?:normal|new)">([^<]*)<', c)]
            prices = [p for p in prices if p]
            cls = c[:c.find('"')]
            b = re.search(r'Brand:</span>\s*<span>\s*<a[^>]*>([^<]+)</a>', c) or \
                re.search(r'Бренд:</span>\s*<span>\s*<a[^>]*>([^<]+)</a>', c)
            img = re.search(r'<img src="([^"]+)"', c)
            slug = m.group(1).rstrip("/").rsplit("/", 1)[-1]
            out.append({
                "id": f"{shop['id']}:{slug}",
                "source": shop["id"],
                "shop": shop["name"],
                "title": text(m.group(2)),
                "brand": b.group(1).strip() if b else None,
                "price": min(prices) if prices else None,
                "stock": "out" if "out-of-stock" in cls else ("in" if prices else "unknown"),
                "url": m.group(1),
                "image": img.group(1) if img else None,
            })
            got += 1
        if not got or f"page={page + 1}" not in html:
            break
    return out
