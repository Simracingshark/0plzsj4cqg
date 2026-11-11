"""Общий разбор schema.org Product из <script type="application/ld+json">."""
import json
import re

AVAIL = {
    "InStock": "in", "LimitedAvailability": "in", "OnlineOnly": "in",
    "PreOrder": "order", "BackOrder": "order", "PreSale": "order",
    "OutOfStock": "out", "SoldOut": "out", "Discontinued": "out",
}


def blocks(html):
    for raw in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(raw)
        except ValueError:
            continue
        yield from (d if isinstance(d, list) else d.get("@graph", [d]))


def find(html, typ):
    for d in blocks(html):
        if isinstance(d, dict) and d.get("@type") == typ:
            return d
    return None


def product(html):
    """-> dict(title, brand, material, color, price, stock, image) или None."""
    d = find(html, "Product")
    if not d:
        return None
    offers = d.get("offers") or []
    if isinstance(offers, dict):
        offers = offers.get("offers", [offers])
    # Оптовые ступени (eligibleQuantity) — берём розницу, т.е. минимальное количество.
    def qty(o):
        q = o.get("eligibleQuantity") or {}
        try:
            return float(q.get("value", 1))
        except (TypeError, ValueError):
            return 1
    offers = sorted(offers, key=qty)
    o = offers[0] if offers else {}
    av = str(o.get("availability", "")).rsplit("/", 1)[-1]
    b = d.get("brand")
    img = d.get("image")
    try:
        p = float(o.get("price") or o.get("lowPrice"))
    except (TypeError, ValueError):
        p = None
    return {
        "title": d.get("name", "").strip(),
        "brand": b.get("name") if isinstance(b, dict) else b,
        "material_raw": d.get("material"),
        "color_raw": d.get("color"),
        "price": p,
        "stock": AVAIL.get(av, "unknown"),
        "image": img[0] if isinstance(img, list) and img else img,
    }
