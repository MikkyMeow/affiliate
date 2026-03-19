# Tracking Services

Этот пакет описывает границы hot-path сервиса кликов. На текущем этапе реализованы только модели/контракты — боевого `/click` эндпоинта ещё нет.

## Clicks service contract

`clicks.service.js` предоставляет единую точку входа для sync операций с кликами:

- `generateClickId()` — выдает UUIDv4 для будущего редиректа. Используется на краю (UI/ссылки) и внутри hot path, чтобы обеспечить идемпотентность.
- `prepareClick(input, options)` — проверяет существование `offerId`/`affiliateId`, убеждается что оба в статусе `active`, тянет geo rules оффера, генерирует `click_id`, определяет redirect (target/fallback/internal) и возвращает его вместе с собранным кликом.
- `registerClick(input, options)` — вызывает `prepareClick`, записывает строку в таблицу `clicks` и возвращает `clickId`, `redirectUrl` + метаданные об исходе (outcome/reason/destination).
- `getClickByClickId(clickId)` — лёгкий lookup для downstream сервисов (постбеки, отчёты). Запрос использует уникальный индекс и не требует сканов.

### Sync vs async

- **Sync (hot path)**: генерация `click_id`, валидация входных UUID, одиночный `INSERT` в `clicks`, короткие SELECT по `click_id`.
- **Async**: enrichment, антифрод, вебхуки и т.д. должны выполняться вне этого слоя, чтобы не блокировать редирект.

### Состав данных

Таблица `clicks` хранит:
`offer_id`, `affiliate_id`, `click_id`, `created_at`, request метаданные (`ip`, `user_agent`, `referer`), пять произвольных `sub` полей, а также geo/redirect контекст (`country_code`, `targeting_strict`, `redirect_outcome`, `redirect_reason`, `destination_type`). Индексы обеспечивают быстрый поиск по `click_id`, `offer_id`, `affiliate_id`, `created_at`.

`redirect_outcome` фиксирует итог решения (`allowed_target_redirect`, `fallback_redirect`, `internal_unavailable_redirect`), `destination_type` хранит тип назначения (`target`, `fallback`, `internal_unavailable`), а `redirect_reason` описывает причину деная (`country_denied`, `not_in_allow_list`, `unknown_country`).

### Ошибки

Сервис поднимает `ApiError` с кодами:
- `VALIDATION_ERROR` — отсутствие обязательных идентификаторов.
- `CONFLICT` — повторный `click_id` (уникальный индекс).
- `NOT_FOUND` — запрос несуществующего клика.

Таким образом слой трекинга готов к подключению HTTP-эндпойнта: остаётся реализовать парсинг URL и редирект, не меняя модель данных.
