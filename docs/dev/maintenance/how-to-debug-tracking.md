# How to Debug Tracking

Статус: draft

## Назначение

Инструкция помогает разбирать проблемы с tracking click, редиректом, GEO-фильтрацией, dedupe и записью клика в БД.

## Когда использовать

- `/track/click` отвечает не тем кодом;
- пользователь не попадает на target URL;
- клик не появляется в списке clicks/statistics;
- возникает неожиданный fallback redirect.

## Перед началом

- Проверить endpoint: `backend/src/routes/tracking.routes.js`, route `GET /track/click`.
- Проверить валидатор: `backend/src/validators/tracking.js`.
- Проверить сервис: `backend/src/services/tracking/clicks.service.js`.
- Проверить связанные модели `clicks`, offer visibility и GEO rules.

## Шаги

1. Сформировать реальный tracking URL.
   Базовый URL задаётся через `NEXT_PUBLIC_TRACKING_BASE`. Реальный backend route: `/track/click`.
2. Проверить обязательные параметры.
   Нужны `offerId` и `affiliateId`, оба должны быть UUID.
3. Проверить offer.
   `findActiveOffer()` требует, чтобы оффер существовал и имел `status='active'`.
4. Проверить affiliate.
   `findActiveAffiliate()` требует существующего активного партнёра.
5. Проверить доступ affiliate к offer.
   Используется `getPartnerOfferVisibilityState()` и `canPartnerAccessOffer()`.
6. Проверить GEO.
   Запрос проходит через `detectRequestCountry()` и `resolveOfferGeoAccess()`.
7. Проверить fallback URL.
   Если `targeting_strict=true` и GEO запрещён, сервис может отправить на `offer.fallbackUrl` или `/track/unavailable`.
8. Проверить dedupe.
   Включение duplicate protection зависит от offer settings и fingerprint логики.
9. Проверить запись в БД.
   Клик сохраняется через `createClick()` в таблицу `clicks`.
10. Проверить async side effects.
    После сохранения может enqueue'иться `postback.event` с `type=click_created`.
11. Проверить redirect response и structured logs.

## Что изменить

| Слой | Где менять | Что менять |
|---|---|---|
| Route | `backend/src/routes/tracking.routes.js` | Если проблема в parsing request |
| Validation | `backend/src/validators/tracking.js` | Если меняются обязательные params |
| Tracking service | `backend/src/services/tracking/clicks.service.js` | Бизнес-логика redirect/dedupe |
| Visibility/GEO | `backend/src/services/offer-visibility.service.js`, `backend/src/lib/resolveOfferGeoAccess.js` | Правила доступа и GEO |
| DB | `backend/src/models/clicks.model.js` | Сохранение click |

## Debug checklist

- [ ] Проверить формат tracking URL.
- [ ] Проверить обязательные query params.
- [ ] Проверить, что offer существует.
- [ ] Проверить, что offer активен.
- [ ] Проверить, что affiliate существует.
- [ ] Проверить, что affiliate имеет доступ к offer.
- [ ] Проверить GEO rules.
- [ ] Проверить fallback URL.
- [ ] Проверить dedupe/canonical click id.
- [ ] Проверить запись в clicks table.
- [ ] Проверить redirect response.
- [ ] Проверить Redis/rate limit, если применимо.
- [ ] Проверить backend logs.

## Проверка

Пример smoke-test:

```bash
curl -i "http://localhost:4000/track/click?offerId=<offer-uuid>&affiliateId=<affiliate-uuid>"
```

Что смотреть:

- код ответа `302` для успешного redirect;
- `Location` header;
- логи `track_click`;
- запись в `clicks`;
- при повторном запросе признаки dedupe: `canonicalClickId`, `isDuplicate`.

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| Неправильный `offerId` | Передан не UUID или несуществующий оффер | Проверить URL и `offers` |
| Неправильный `affiliateId` | Передан не UUID или несуществующий партнёр | Проверить URL и `affiliates` |
| Offer выключен | `status != active` | Активировать оффер или использовать другой |
| Нет доступа | Visibility rules запрещают affiliate доступ | Проверить offer access/hidden/request state |
| GEO запрещён | Strict targeting + deny rules | Проверить `allowedGeo`/`deniedGeo` и fallback |
| Fallback URL отсутствует | Strict targeting без `fallbackUrl` | Сервис уйдёт на `/track/unavailable` |
| Redis/rate limit/dedupe | Redis недоступен или rate limit сработал | Проверить Redis и `rateLimit.js` |
| Nginx неправильно проксирует `/track` | Ошибка в `location /track` | Проверить `services/nginx/default.conf` |
| Redirect URL неправильный | Проблема в `buildRedirectUrl()` или `offer.targetUrl` | Проверить offer и сервис tracking |

## Definition of Done

- [ ] URL воспроизводится локально или на staging
- [ ] Понятен код ответа и `Location`
- [ ] Проверены offer и affiliate
- [ ] Проверены GEO и visibility rules
- [ ] Найдена или исключена запись в `clicks`
- [ ] Проверены dedupe и async side effects
- [ ] Проверены backend logs

## Связанные разделы

- [Click Flow](../data-flow/click-flow.md)
- [Tracking API](../api/tracking.md)
- [Tracking Clicks Domain](../domains/tracking-clicks.md)
- [Offer Access Domain](../domains/offer-access.md)
- [GEO Targeting Domain](../domains/geo-targeting.md)
- [Nginx](../infra/nginx.md)
