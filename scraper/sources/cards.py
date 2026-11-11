"""Универсальный парсер HTML-карточек товара в списке категории.

Конфиг магазина в shops.json:
  urls   — список страниц категорий
  card   — строка, с которой начинается каждая карточка (по ней режем HTML); "re:..." — regex
  page   — шаблон пагинации, например "?page={n}" или "/page-{n}/" (без него — одна страница)
  price  — необязательный regex цены с группой 1, если первая цена в карточке не та
Название — самый длинный текст ссылки в карточке (или alt картинки), цена — первая
«N грн/₴» после удаления старых/оптовых цен, наличие — по ключевым словам."""
import re
import urllib.error
import urllib.parse

from common import get, price, short_key, text, weight_kg

DROP = re.compile(r'<(\w+)[^>]*class="[^"]*(?:old|wholesale|special-old|price-old|tier-discount)[^"]*"[^>]*>.*?</\1>', re.S | re.I)
HIDDEN = re.compile(r'<(\w+)[^>]*class="[^"]*(?:hidden|d-none)[^"]*"[^>]*>.*?</\1>', re.S | re.I)
# тысячи — только группами по 3 цифры, иначе склеиваются соседние числа (рейтинг, отзывы)
PRICE = re.compile(r"(\d{1,3}(?:[\s  ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:грн|₴|UAH)", re.I)
PRICE_BOX = re.compile(r'class="[^"]*price[^"]*"', re.I)
ORDER = re.compile(r"передзамовл|під замовлення|под заказ|очікуєт|ожидает|pre-?order|backorder|предзаказ", re.I)
OUT = re.compile(r"немає в наявності|нема в наявності|нет в наличии|закінчив|закончил|out-?of-?stock|outofstock|відсутн|отсутств|not available|повідомити про наявність|сповістити про наявність", re.I)


def parse(shop, html, base):
    out = []
    mk = shop["card"]
    parts = re.split(mk[3:], html) if mk.startswith("re:") else html.split(mk)
    for c in parts[1:]:
        c = c[:20000]
        links = [(h, text(t)) for h, t in re.findall(r'<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', c, re.S)]
        links = [(h, t) for h, t in links if len(t) >= 6 and not h.startswith(("javascript", "mailto", "tel"))]
        if not links:
            continue
        href, title = max(links, key=lambda x: len(x[1]))
        alt = re.search(r'<img[^>]+alt="([^"]{8,})"', c)
        if alt and len(alt.group(1)) > len(title) + 10:
            title = text(alt.group(1))
        clean = HIDDEN.sub(" ", DROP.sub(" ", c))
        if shop.get("price"):
            m = re.search(shop["price"], clean, re.S)
        else:
            box = PRICE_BOX.search(clean)
            m = (box and PRICE.search(text(clean[box.start():box.start() + 800]))) or PRICE.search(text(clean))
        p = price(m.group(1)) if m else None
        if not p:
            continue  # подкатегории и баннеры, попавшие под маркер карточки
        t = text(clean)
        if shop.get("stock") == "class":  # наличие только по классам самой карточки
            head = c[:300]
            if ORDER.search(head):
                stock = "order"
            elif re.search(r"out-of-stock|outofstock", head):
                stock = "out"
            else:
                stock = "in"
        else:
            stock = "order" if ORDER.search(clean) else "out" if OUT.search(clean) else "in"
        if "stock_in" in shop and stock == "in" and not re.search(shop["stock_in"], c, re.I):
            stock = "out"
        url = urllib.parse.urljoin(base, href)
        img = re.search(r'<img[^>]+(?:data-src|src)="([^"]+\.(?:jpe?g|png|webp)[^"]*)"', c)
        out.append({
            "id": f"{shop['id']}:{short_key(urllib.parse.urlparse(url).path.strip('/').rsplit('/', 1)[-1])}",
            "shop": shop["name"],
            "title": title,
            "weight": weight_kg(title) or weight_kg(t[:400]),
            "price": p,
            "stock": stock,
            "url": url,
            "image": urllib.parse.urljoin(base, img.group(1)) if img else None,
        })
    return out


def scrape(shop):
    out, seen = [], set()
    for url in shop["urls"]:
        for n in range(1, 80):
            if n > 1 and not shop.get("page"):
                break
            u = url
            if n > 1:
                p = shop["page"].format(n=n)
                u = url.rstrip("/") + p if p.startswith("/") else url + p
            try:
                html = get(u)
            except urllib.error.HTTPError as e:
                if n > 1 and e.code == 404:  # страницы закончились
                    break
                raise
            got = []
            for o in parse(shop, html, u):
                sig = (o["title"], o["price"])
                if sig in seen:  # тот же товар второй раз (в другой категории или на странице дважды)
                    continue
                seen.add(sig)
                k, n = o["id"], 2
                while o["id"] in seen:  # один адрес, разные варианты (вес) — разные id
                    o["id"] = f"{k}~{n}"
                    n += 1
                seen.add(o["id"])
                got.append(o)
            out += got
            if not got:
                break
    return out
