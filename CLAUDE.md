# Filament Tracker — точка входа

Личный трекер цен и наличия пластика для 3D-печати в Украине. Телефон в первую очередь (PWA).

## Правила работы
- Обращение к пользователю только на «ты», по-русски, неформально.
- Диск C не занимать: venv, кэши, node_modules держать в проекте на G.
- Только филамент 1.75 мм. Интерфейс сайта — на украинском.
- Сайт: https://simracingshark.github.io/0plzsj4cqg/ , репо `Simracingshark/0plzsj4cqg` (публичное, личных данных не класть).
- Hotline не долбить: при разведке быстро даёт капчу.
- Локально: `python scraper/run.py [id ...]`, превью `python -m http.server 8765 -d site`.
- Неподтверждённое помечать UNKNOWN / TENTATIVE.

## Документы
| Файл | Что там |
|---|---|
| `PROJECT.md` | архитектура, источники, формат данных |
| `PROGRESS.md` | статус и следующие шаги |
| `DECISIONS.md` | решения и причины |
| `CHANGELOG.md` | существенные изменения |
| `graphify-out/GRAPH_REPORT.md` | граф кода и заметок (graphify; не в git). Вопросы: `G:\dev\graphify\bin\graphify.exe query "..."`, обновить: `/graphify . --update` |
