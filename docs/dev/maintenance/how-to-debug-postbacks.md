# How to Debug Postbacks

Статус: draft

## Назначение

Инструкция помогает разбирать ошибки в advertiser postback flow: валидация токена, click id, goal, signature, idempotency и появление conversion.

## Когда использовать

- postback не создаёт conversion;
- backend отвечает `400/401/403/404/409`;
- conversion создаётся, но stats/history не обновляются;
- postback logs показывают `failed` или `duplicate`.

## Перед началом

- Проверить route: `backend/src/routes/tracking.routes.js`.
- Проверить validator: `backend/src/validators/postback.js`.
- Проверить service: `backend/src/services/postback/conversions.service.js`.
- Проверить модели `postback_logs`, `conversions`, `conversion_status_history`.

## Шаги

1. Проверить URL postback endpoint.
   Реальный flow идёт через `/track/postback` в `tracking.routes.js`.
2. Проверить метод.
   В route есть и `POST`, и `GET` обработка postback.
3. Проверить обязательные поля.
   По validator обязательны `token`, `clickId`/`click_id`, `goalId`/`goal_id`, `signature`/`sig`.
4. Проверить token.
   Token ищет оффер через `findOfferForPostbackByToken()`.
5. Проверить click id.
   Сервис требует существующий click через `getClickByClickId()`.
6. Проверить, что offer из token совпадает с offer у click.
7. Проверить goal.
   `goalId` обязателен и должен быть UUID.
8. Проверить status.
   Допустимые статусы определяются `CONVERSION_STATUS_VALUES`.
9. Проверить payout/revenue.
   `payoutRub` опционален, но должен быть неотрицательным числом, если передаётся.
10. Проверить external transaction id и idempotency.
    Дубликаты ловятся через индексы на `conversions` и через бизнес-логику.
11. Проверить postback logs.
    Lifecycle лог создаётся в `postback_logs`.
12. Проверить conversion record.
13. Проверить conversion status history.
14. Проверить queue/stat rollup.
    После успешной conversion может enqueue'иться `postback.event` с `type=conversion_created`.
15. Проверить backend и worker logs.

## Что изменить

| Слой | Где менять | Что менять |
|---|---|---|
| Route | `backend/src/routes/tracking.routes.js` | Parsing GET/POST payload |
| Validation | `backend/src/validators/postback.js` | Обязательные поля и формат |
| Postback service | `backend/src/services/postback/conversions.service.js` | Token/signature/idempotency logic |
| Logs | `backend/src/models/postback-logs.model.js` | Lifecycle logging |
| Conversion model | `backend/src/models/conversions.model.js` и связанные модели | Сохранение conversion/status history |
| Queue | `backend/src/workers/registerJobs.js` | Async rollup после conversion |

## Debug checklist

- [ ] Проверить URL postback endpoint.
- [ ] Проверить method: GET/POST.
- [ ] Проверить обязательные params/body fields.
- [ ] Проверить token, если используется.
- [ ] Проверить click id / canonical click id.
- [ ] Проверить, что click существует.
- [ ] Проверить offer по click.
- [ ] Проверить goal.
- [ ] Проверить status.
- [ ] Проверить amount/payout/revenue, если передаётся.
- [ ] Проверить external transaction id / idempotency.
- [ ] Проверить postback logs.
- [ ] Проверить conversion record.
- [ ] Проверить conversion status history.
- [ ] Проверить stats update / async events.
- [ ] Проверить backend logs.

## Проверка

Пример GET smoke-test:

```bash
curl -i "http://localhost:4000/track/postback?token=<token>&clickId=<click-id>&goalId=<goal-uuid>&status=approved&signature=<sig>"
```

Пример POST smoke-test:

```bash
curl -i -X POST "http://localhost:4000/track/postback" \
  -H "Content-Type: application/json" \
  -d '{"token":"<token>","clickId":"<click-id>","goalId":"<goal-uuid>","status":"approved","signature":"<sig>"}'
```

Что смотреть:

- HTTP статус;
- `postback_logs.status`;
- запись в `conversions`;
- запись в `conversion_status_history`;
- worker logs для `conversion_created`.

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| `clickId` не передан | Нет обязательного поля | Исправить advertiser payload |
| `clickId` неверный | Клик не существует | Проверить источник click id |
| Click не найден | Рекламодатель сохранил не тот идентификатор | Использовать реальный `clickId` из tracking redirect |
| Goal не найден | Передан чужой или несуществующий `goalId` | Проверить offer goals |
| Status некорректный | Передан статус вне допустимого списка | Проверить `CONVERSION_STATUS_VALUES` |
| Token неверный | Оффер не находится по token или token не совпадает с click.offer | Проверить offer settings |
| Postback отправлен на неправильный URL | Ошибка в `/track/postback` или nginx | Проверить endpoint и proxy |
| Duplicate postback | Уже есть conversion для этого click/goal/external transaction id | Проверить idempotency keys |
| Conversion уже существует | Сработали unique index или бизнес-проверка | Проверить `conversions` и индексы |
| Stats ещё не обновились | Worker не обработал async job | Проверить queue/worker/Redis |
| Nginx не проксирует endpoint | `location /track` настроен неверно | Проверить nginx config |
| Body/query формат не совпадает с backend | Поля пришли под другими именами | Сверить с `validatePostbackParams()` |

## Definition of Done

- [ ] Воспроизведён запрос GET или POST
- [ ] Понятен HTTP ответ
- [ ] Проверены token, click, offer, goal, status
- [ ] Проверены `postback_logs`
- [ ] Проверены `conversions`
- [ ] Проверена `conversion_status_history`
- [ ] Проверен async rollup / worker
- [ ] Найдена точка отказа

## Связанные разделы

- [Postback Flow](../data-flow/postback-flow.md)
- [Conversion Flow](../data-flow/conversion-flow.md)
- [Tracking API](../api/tracking.md)
- [Postbacks and Conversions Domain](../domains/postbacks-conversions.md)
- [Offer Goals Domain](../domains/offer-goals.md)
- [Nginx](../infra/nginx.md)
- [Queues](../infra/queues.md)
