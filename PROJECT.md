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
site/                     PWA: index.html, app.js, style.css, sw.js, manifest, иконки
tools/make_icons.py       генерит icon-192/512.png без библиотек
.claude/launch.json       локальный сервер: python -m http.server 8765 -d site
```

## Добавить источник
- Продавец Prom: строка в `scraper/shops.json` с `"type": "prom_seller"` и URL страницы компании `https://prom.ua/ua/cNNN-name.html`.
- Магазин на OpenCart с темой Journal: `"type": "opencart"` + URL категории.
- Другой движок: новый модуль в `scraper/sources/` с функцией `scrape(shop) -> list[dict]`, зарегистрировать в `TYPES` в run.py.

## Формат данных
`offers.json`: `{updated, shops:[{id,name,ok,count,at,error?}], items:[...]}`.
Поля товара: `id` (`источник:ключ`), `src`, `shop`, `title`, `brand`, `material`, `color`, `weight` (кг), `price` (₴, мин.), `price_max` (только Hotline), `offers` (только Hotline), `stock` (`in`/`order`/`out`/`unknown`), `ppk` (₴/кг), `url`, `image`.
`history.json`: `{id: [[YYYY-MM-DD, цена, наличие 1/2/0], ...]}`; новая точка только при изменении цены или наличия.
Если источник упал, остаются его товары из прошлого запуска, в `shops[]` `ok:false`.

## Источники (проверено 2026-11-11)
| Источник | Что даёт | Ограничения |
|---|---|---|
| Hotline `/ua/computer/rashodnye-materialy-dlya-3d-printerov/?p=N` | ~1230 товаров с предложениями: мин–макс цена, число предложений, материал, вес | Цены по отдельным магазинам Hotline намеренно прячет (цены-приманки в HTML, настоящие собираются скриптом). Не обходим. |
| 3ddevice.com.ua `/en/shop/3d-plastics/?page=N` | ~340 позиций, бренд, цена; нет цены у товаров не в наличии | Наличие определяем по классу `out-of-stock` карточки (TENTATIVE) |
| Prom, продавец PlastFill `c3804832-plastfill` | 29 позиций (22 филамента), цена, наличие из ld+json | По просьбе пользователя |
| ek.ua | — | 403 Cloudflare |
Магазины, которые встречаются в предложениях Hotline (выборка из 60 товаров): Enko, Brain, ITbox, EXE.ua, MTA.UA, ELMIR, CAN.UA, Q-TECHNO, MALLPRIX, dp-shop, Comtrading, iCom, FunOpt, NBPLAZA, Comfy, Rozetka не замечен. В основном это магазины электроники, профильных магазинов среди них почти нет.
