# Архитектура

## Схема
```
GitHub Actions (.github/workflows/scrape.yml, cron "17 */6 * * *" UTC + ручной запуск)
  └─ python scraper/run.py → site/data/offers.json + site/data/history.json → коммит в main
  └─ публикует папку site/ на GitHub Pages
site/  — PWA без сборки (vanilla JS), ставится на телефон, офлайн через sw.js
```
- Репо: https://github.com/Simracingshark/0plzsj4cqg (публичное, ветка `main`).
- Сайт: https://simracingshark.github.io/0plzsj4cqg/
- Git в репо: `user.email = 34916749+Simracingshark@users.noreply.github.com` (локально в репо). Actions коммитят от `github-actions[bot]`.
- Сборщик только на stdlib Python (urllib, re, json), зависимостей нет. В Actions Python 3.12, локально 3.14.

## Структура
```
scraper/run.py            главный скрипт; аргументы — id магазинов (пусто = все)
scraper/shops.json        список источников: id, name, type, url
scraper/common.py         HTTP (пауза 1 с между запросами), нормализация: материал, вес, бренд, цвет, диаметр, фильтр не-филамента
scraper/sources/hotline.py      каталог Hotline, 27 стр. x 48
scraper/sources/opencart.py     магазины OpenCart/Journal (3ddevice)
scraper/sources/prom_seller.py  продавец Prom: ItemList со страницы компании + ld+json каждого товара
scraper/sources/ldjson.py       разбор schema.org Product/ItemList
scraper/sources/woocommerce.py  WooCommerce Store API /wp-json/wc/store/v1/products (цена в копейках)
scraper/sources/shopify.py      Shopify /products.json, каждый вариант — отдельная позиция
scraper/sources/cards.py        универсальный парсер HTML-карточек (маркер карточки + шаблон страниц)
scraper/sources/ld_listing.py   Product/Offer из ld+json на страницах категорий (сайты на Prom, 3D4U, Allo, Rozetka; ищет Product на любой глубине)
scraper/sources/prom_search.py  поиск Prom: JSON товаров в состоянии страницы, &page=N
scraper/sources/monofilament.py MonoFilament: карточка mfil-catalog-card, активный вариант = вес
site/                     PWA: index.html, app.js, style.css, sw.js, manifest, иконки
tools/make_icons.py       генерит icon-192/512.png без библиотек
.claude/launch.json       локальный сервер: python -m http.server 8765 -d site
```

## Добавить источник
- Продавец Prom: строка в `scraper/shops.json` с `"type": "prom_seller"` и URL страницы компании `https://prom.ua/ua/cNNN-name.html`.
- Магазин на OpenCart с темой Journal: `"type": "opencart"` + URL категории.
- WooCommerce: `"type": "woocommerce"`, `url` сайта, `category` — id категории филамента (из `/wp-json/wc/store/v1/products/categories`).
- Shopify: `"type": "shopify"`, `url` сайта.
- Любой другой сайт со списком карточек: `"type": "cards"`, `urls` категорий, `card` — начало карточки в HTML (`re:` = regex), `page` — шаблон пагинации (`?page={n}`, `/page-{n}`), опц. `price` (regex), `stock: "class"`. 404 на странице >1 = конец пагинации.
- Сайт с ld+json Product в списке: `"type": "ld_listing"`, `urls`, `page`.
- `every_h` — не чаще, чем раз в N часов (Hotline, Tucans).
- Другой движок: новый модуль в `scraper/sources/` с функцией `scrape(shop) -> list[dict]`, зарегистрировать в `TYPES` в run.py.

## Формат данных
`offers.json`: `{updated, shops:[{id,name,ok,count,at,error?}], items:[...]}`.
Поля товара: `id` (`источник:ключ`), `src`, `shop`, `title`, `brand`, `material`, `color`, `weight` (кг), `price` (₴, мин.), `price_max` (только Hotline), `offers` (только Hotline), `stock` (`in`/`order`/`out`/`unknown`), `ppk` (₴/кг), `url`, `weight_est` (1 = вес не указан, для Bambu Lab взят 1 кг; в UI «≈»), `seller` (продавец Prom), `image` (адрес превью у магазина, сами картинки не храним), `price_old` (зачёркнутая цена, где магазин её отдаёт: Woo, Shopify, Prom, MonoFilament, 3DDevice), `tags` (подтипы: matte, silk, hs, cf, gf, glow, marble, transp, multi, metal, refill), `group` (ключ склейки одинаковых товаров: бренд|материал|вес|значимые слова названия, только точное совпадение), `new` (появился ≤14 дней назад, не в первый сбор), `drop` (% ниже максимума за 30 дней).
Ключи id: длинные слаги через `common.short_key` (обрезка + crc32), в cards один адрес с разными вариантами получает `~2`, `~3`.
`history.json`: `{id: [[YYYY-MM-DD, цена, наличие 1/2/0], ...]}`; новая точка только при изменении цены или наличия.
Если источник упал, остаются его товары из прошлого запуска, в `shops[]` `ok:false`.

## Источники (проверено 2026-11-11)
| Источник | Что даёт | Ограничения |
|---|---|---|
| Hotline `/ua/computer/rashodnye-materialy-dlya-3d-printerov/?p=N` | ~1230 товаров с предложениями: мин–макс цена, число предложений, материал, вес | Цены по отдельным магазинам Hotline намеренно прячет (цены-приманки в HTML, настоящие собираются скриптом). Не обходим. |
| 3ddevice.com.ua `/en/shop/3d-plastics/?page=N` | ~340 позиций, бренд, цена; нет цены у товаров не в наличии | Наличие определяем по классу `out-of-stock` карточки (TENTATIVE) |
| Prom, продавец PlastFill `c3804832-plastfill` | 29 позиций (22 филамента), цена, наличие из ld+json | По просьбе пользователя |
| ek.ua | — | 403 Cloudflare |

Профильные магазины (локальный прогон 2026-11-11, позиций после фильтра): UA3D 780 (woo), BambuLab UA bambulab.net.ua 717 (woo), Тірапласт 156 (woo), DC Print 154 (woo), PYD 187 (shopify), 3DPlast 127, Filament Shop 30, BOZE 73, Bambu UA bambu.net.ua 276, ALL3DP 254, SUNLU3D 168 (cards), 3D4U 12, PBL 8, UA3D.Pro 807, U3DF 9 (ld_listing). Маркетплейсы и др.: Rozetka 5434 (ld_listing, вся категория «Витратні матеріали для 3D-принтерів» c4671751, до 150 стр.), Allo 606 (ld_listing, `/p-{n}/`), Prom 900 (prom_search: поиск по 10 фразам × 5 стр., у товара поле `seller`), MonoFilament 223 (свой модуль monofilament.py).
Убраны/не подключены: Tucans — 403 и с моего IP, и из Actions; Polydream (polydreamshop.co.ua, Shop-Express) — цены подгружаются скриптом, в HTML их нет; Novator — своего магазина не нашёл, есть на Prom/Bigl.
Список магазинов брал в том числе с агрегатора de-filament.com.ua (только как подсказку, его не парсим).
Магазины, которые встречаются в предложениях Hotline (выборка из 60 товаров): Enko, Brain, ITbox, EXE.ua, MTA.UA, ELMIR, CAN.UA, Q-TECHNO, MALLPRIX, dp-shop, Comtrading, iCom, FunOpt, NBPLAZA, Comfy, Rozetka не замечен. В основном это магазины электроники, профильных магазинов среди них почти нет.
