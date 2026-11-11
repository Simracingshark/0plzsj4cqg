"""Магазины на Shopify: открытый /products.json. Каждый вариант (цвет, рефил/котушка) —
отдельная позиция, потому что у них разные цены и наличие."""
import json

from common import get, text


def scrape(shop):
    base = shop["url"].rstrip("/")
    out = []
    for page in range(1, 50):
        prods = json.loads(get(f"{base}/products.json?limit=250&page={page}"))["products"]
        for p in prods:
            img = (p.get("images") or [{}])[0].get("src")
            if img:  # CDN Shopify отдаёт превью нужной ширины
                img += ("&" if "?" in img else "?") + "width=240"
            for v in p.get("variants") or []:
                vt = v.get("title") or ""
                title = text(p["title"]) + ("" if vt in ("", "Default Title") else f" ({vt})")
                out.append({
                    "id": f"{shop['id']}:{v['id']}",
                    "shop": shop["name"],
                    "title": title,
                    "brand": p.get("vendor"),
                    "price": float(v["price"]) if v.get("price") else None,
                    "stock": "in" if v.get("available") else "out",
                    "url": f"{base}/products/{p['handle']}?variant={v['id']}",
                    "image": img,
                    "price_old": float(v["compare_at_price"]) if v.get("compare_at_price") and
                    float(v["compare_at_price"]) > float(v.get("price") or 0) else None,
                })
        if len(prods) < 250:
            break
    return out
