"""HTTP и нормализация названий филамента: материал, вес, бренд, цвет, диаметр."""
import html
import re
import time
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
DELAY = 1.0  # пауза между запросами к одному сайту, чтобы не долбить магазины


class Blocked(Exception):
    """Сайт показал капчу/антибот. Источник помечаем как упавший и оставляем прошлые данные."""


def get(url, tries=3, delay=None):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA, "Accept-Language": "uk,ru;q=0.8,en;q=0.5"})
            with urllib.request.urlopen(req, timeout=40) as r:
                body = r.read().decode("utf-8", "replace")
            time.sleep(DELAY if delay is None else delay)
            return body
        except (urllib.error.URLError, TimeoutError) as e:
            if i == tries - 1:
                raise
            time.sleep(5 * (i + 1))
    return ""


def text(s):
    """HTML-фрагмент -> чистый текст в одну строку."""
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def price(s):
    """'₴1 495.00', '820', '1&nbsp;769 ₴' -> 1495.0"""
    s = html.unescape(s).replace("\xa0", "").replace(" ", "").replace(",", ".")
    m = re.search(r"\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


# Порядок важен: более конкретные материалы раньше общих.
MATERIALS = [
    ("PLA-CF", r"\bPLA[\s-]*(?:\+\s*)?CF\d*\b|\bPLA\b.*\b(?:carbon|карбон)"),
    ("PETG-CF", r"\bPETG[\s-]*CF\d*\b|\bPETG\b.*\b(?:carbon|карбон)"),
    ("PA-CF", r"\b(?:PA\d*|PPA|PAHT|PA6|PA12|nylon|нейлон)[\s-]*(?:CF|GF)\d*\b|\bPPS[\s-]*CF"),
    ("PCTG", r"\bPCTG\b"),
    ("CoPET", r"\bCo-?PET\b|\bCoPE\b|\bPETT\b"),
    ("PETG", r"\bPETG\b|\bPET-G\b"),
    ("PET", r"\bPET\b"),
    ("PLA+", r"\bPLA\s*\+|\bPLA[\s-]*plus\b|\bPLA[\s-]*Pro\b"),
    ("PLA", r"\bH?PLA\b|\bFiberSilk\b|\bSilk\b"),  # «Silk» без материала — шовковий PLA
    ("ABS", r"\bABS\b"),
    ("ASA", r"\bASA\b"),
    ("TPU", r"\bTPU\b|\bTPEE?\b|\bflex\b|\belastan\b|гнучк|флекс"),
    ("PA", r"\bPA\d*\b|\bnylon\b|нейлон|\bPAHT\b"),
    ("PC", r"\bPC\b|\bpolycarbonate\b|полікарбонат|поликарбонат"),
    ("HIPS", r"\bHIPS\b"),
    ("PVA", r"\bPVA\b|\bBVOH\b"),
    ("PP", r"\bPP\b|поліпропілен|полипропилен"),
    ("PEEK", r"\bPEEK\b|\bPEI\b|\bPEKK\b"),
    ("PBT", r"\bPBT\b"),
    ("Wood", r"\bwood|дерев"),
]

# кириллические написания материалов: ПЛА, ПЕТГ, АБС, ТПУ
_NC = "(?<![А-Яа-яІіЇїЄє]){}(?![А-Яа-яІіЇїЄє])"
CYR = [(_NC.format(ua), en) for ua, en in (("ПЛА", "PLA"), ("ПЕТГ", "PETG"), ("АБС", "ABS"), ("ТПУ", "TPU"),
                                          ("со[РP][ЕE][ТT]", "CoPET"))]  # «соРЕТ» набрано кириллицей


def material(name):
    # eSUN пишет ePLA/ePETG/eABS, а \b внутри слова не срабатывает: убираем префикс
    name = re.sub(r"(?<![A-Za-z])e(?=(?:PLA|PETG|ABS|ASA|TPU|PC|PA)(?![a-z]))", "", name, flags=re.I)
    name = re.sub(r"(?<=[A-Z])(?=\d+A\b)", " ", name)  # TPU95A -> TPU 95A
    name = re.sub(r"\b(PLA|PETG|ABS|ASA|TPU)(?=\d)", r"\1 ", name, flags=re.I)  # ABS1.75, TPU90
    name = re.sub(r"\bEco(?=PETG|PLA|ABS)", "", name)  # EcoPETG -> PETG
    for ua, en in CYR:
        name = re.sub(ua, en, name, flags=re.I)
    for mat, rx in MATERIALS:
        if re.search(rx, name, re.I):
            return mat
    return "Other"


def weight_kg(name):
    """Вес катушки в кг из названия. None если не найден."""
    n = name.replace(",", ".")
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:кг|kg|кило)", n, re.I)
    if m:
        v = float(m.group(1))
        return v if 0.1 <= v <= 50 else None
    m = re.search(r"(\d{2,5})\s*(?:г|гр|g|gr)\b", n, re.I)
    if m:
        v = float(m.group(1)) / 1000
        return v if 0.05 <= v <= 50 else None
    return None


def diameter(name):
    n = name.replace(",", ".")
    if re.search(r"\b2\.85\b|\b3(?:\.0)?\s*мм|\b3(?:\.0)?\s*mm", n, re.I):
        return 2.85
    if re.search(r"\b1\.75\b", n):
        return 1.75
    return None  # не указан: обычно 1.75, но помечаем как неизвестный


BRANDS = ["Bambu Lab", "Creality", "eSUN", "Esun", "SUNLU", "Sunlu", "Elegoo", "ELEGOO",
          "Anycubic", "Polymaker", "Prusament", "Prusa", "Plexiwire", "MonoFilament",
          "Monofilament", "3Dplast", "3DPlast", "Kingroon", "Jayo", "JAYO", "Eryone",
          "Geeetech", "Flashforge", "FlashForge", "Qidi", "QIDI", "Fiberlogy", "Spectrum",
          "Devil Design", "Overture", "Tinmorry", "Kexcelled", "Rosa3D", "Formfutura",
          "Ultimaker", "Raise3D", "Snapmaker", "Voxelab", "Artillery", "Tronxy",
          "Zortrax", "Verbatim", "ColorFabb", "colorFabb", "Filamentum", "Azurefilm",
          "U3Print", "Gembird", "Pochatok", "3DESYGN", "Ender", "Anet", "R3D", "Giantarm",
          "JAMG", "The Filament", "Тірапласт", "Tiraplast", "Professional Lab", "Smart Print",
          "3Doodler", "Farm 3D", "Intamsys", "Fillamentum", "Bestfilament", "Nobufil",
          "Filamentarno", "Tianse", "Kingroon", "Ziro", "Deeplee", "Duramic", "Hello3D"]
_BRAND_NORM = {b.lower(): b for b in BRANDS}
_BRAND_NORM.update({"esun": "eSUN", "sunlu": "SUNLU", "elegoo": "Elegoo", "prusa": "Prusament",
                    "monofilament": "MonoFilament", "3dplast": "3Dplast", "jayo": "JAYO",
                    "flashforge": "Flashforge", "qidi": "QIDI", "colorfabb": "colorFabb",
                    "ender": "Creality", "tiraplast": "Тірапласт"})


def brand(name):
    for b in sorted(_BRAND_NORM, key=len, reverse=True):
        if re.search(r"(?<![\w])" + re.escape(b) + r"(?![\w])", name, re.I):
            return _BRAND_NORM[b]
    return None


COLORS = [
    ("Чорний", r"black|чорн|черн"), ("Білий", r"white|біл|бел(?!ь)"),
    ("Сірий", r"gr[ae]y|сір|сер(?!ед)|silver|срібл|серебр"),
    ("Червоний", r"\bred\b|червон|красн"), ("Синій", r"blue|син|блакит|голуб"),
    ("Зелений", r"green|зелен"), ("Жовтий", r"yellow|жовт|желт"),
    ("Помаранчевий", r"orange|помаранч|оранж"), ("Фіолетовий", r"purple|violet|фіолет|фиолет"),
    ("Рожевий", r"pink|рожев|розов"), ("Коричневий", r"brown|коричн"),
    ("Прозорий", r"transparent|clear|natural|натурал|прозор"),
    ("Золотий", r"gold|золот"), ("Бежевий", r"beige|ivory|беж|tan\b"),
]


def color(name):
    for c, rx in COLORS:
        if re.search(rx, name, re.I):
            return c
    return None


def is_filament(name):
    """Отсекаем принтеры, сопла, смолу, сушилки и прочее из категорий."""
    bad = r"resin|HALOT|LCD|High Precision|Freeprint|swatch|^котушка|котушка для філамент|багаторазов\w* котушк|\bклей\b|стінки котушк|стенки катушк|reusable spool|empty spool|порожня котушк|зразк|образц|палітра кольор|Surgical Guide|3D Pens|Rod Set|стрижн|стержн|смол|фотополімер|фотополимер|сушил|dryer|сопло|nozzle|ручк|\bpen\b|запчаст|\bстіл\b|\bстол\b"
    if re.search(bad, name, re.I):
        return False
    # «для/до 3D(3Д) принтера» — это пластик, а «3D принтер Creality ...» — сам принтер
    n = re.sub(r"\b(?:для|до|for)\s+(?:3[DdДд][- ]?)?(?:принтер|printer)\w*", "", name, flags=re.I)
    return not re.search(r"принтер|\bprinter\b(?!.*filament)", n, re.I)


def normalize(o):
    """Дополняет оффер полями material/brand/color/weight/diameter/ppk."""
    n = o["title"]
    o.setdefault("material", material(n))
    # бренд из названия; если магазин дал свой («BAMBU LAB») — приводим к общему написанию
    o["brand"] = brand(o.get("brand") or "") or o.get("brand") or brand(n)
    o.setdefault("color", color(n))
    if not o.get("weight"):
        o["weight"] = weight_kg(n)
    # у Bambu Lab вес в названии часто не пишут: стандартная катушка 1 кг (оценка)
    if not o.get("weight") and (o.get("brand") or "").startswith("Bambu") \
            and not re.search(r"support|PVA|набір|набор|\bset\b|комплект", n, re.I):
        o["weight"], o["weight_est"] = 1.0, 1
    o.setdefault("diameter", diameter(n))
    p, w = o.get("price"), o.get("weight")
    o["ppk"] = round(p / w) if p and w else None
    return o
