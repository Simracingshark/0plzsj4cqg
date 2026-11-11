"""Магазины на WooCommerce: открытый Store API /wp-json/wc/store/v1/products.
Цена в минимальных единицах валюты (currency_minor_unit). Вариативные товары (цвета) —
один товар с price_range, наличие общее."""
import json

from common import get, text, weight_kg


def scrape(shop):
    base = shop["url"].rstrip("/") + "/wp-json/wc/store/v1/products?per_page=100"
    if shop.get("category"):
        base += f"&category={shop['category']}"
    out = []
    for page in range(1, 100):
        batch = json.loads(get(f"{base}&page={page}"))
        for p in batch:
            pr = p.get("prices") or {}
            k = 10 ** int(pr.get("currency_minor_unit") or 0)
            rng = pr.get("price_range") or {}
            lo = rng.get("min_amount") or pr.get("price")
            hi = rng.get("max_amount")
            w = None
            for a in p.get("attributes") or []:
                for t in a.get("terms") or []:
                    w = w or weight_kg(t.get("name", ""))
            name = text(p.get("name", ""))
            imgs = p.get("images") or []
            out.append({
                "id": f"{shop['id']}:{p['id']}",
                "shop": shop["name"],
                "title": name,
                "weight": weight_kg(name) or w,
                "price": int(lo) / k if lo else None,
                "price_max": int(hi) / k if hi and hi != lo else None,
                "stock": "in" if p.get("is_in_stock") else "out",
                "url": p.get("permalink"),
                "image": imgs[0].get("thumbnail") if imgs else None,
            })
        if len(batch) < 100:
            break
    return out
