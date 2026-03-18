# Offer Domain v2

## 1. Что есть сейчас

### Таблица `offers`
| Поле | Описание | Что делаем дальше |
| --- | --- | --- |
| `id` | UUID | оставить |
| `title` | название оффера | оставить |
| `advertiser_id` | владелец оффера | оставить |
| `target_url` | URL куда ведём клики | переименовать в `trackingUrl`, добавить `previewUrl` и `fallbackUrl` |
| `payout_rub` | выплата в рублях | перенести в `OfferGoal.payout` |
| `status` | `active` \| `inactive` | заменить на `active`/`paused`/`archived` |
| `postback_token` | токен для приёма постбеков | оставить |
| `created_at`, `updated_at` | аудитные поля | оставить |

Других связанных сущностей нет: payout хранится сразу в `offers`, целей несколько быть не может, таргетинга и списков аффилиатов нет. CRUD и валидаторы подразумевают монолитный оффер — create/update принимают один объект, а partner API просто отдаёт все активные офферы всем аффилиатам. На уровне конверсий `payout_rub` дублируется (значение копируется в момент создания конверсии). Цели, запросы доступа, таргетинг реализованы не были.

**Ответы на вопросы ревью:**
- Оффер монолитный объект, дополнительных таблиц для целей/таргетинга нет.
- `payout` хранится на уровне оффера (`offers.payout_rub`) и копируется в конверсию.
- Отдельной сущности goal нет.
- Visibility не настроена: любой affiliate видит все активные офферы (`partner.routes -> listPartnerOffers`).

## 2. Новая доменная модель

Ниже фиксируем сущности, которые придётся ввести к следующему этапу.

### Offer
| Поле | Тип | Комментарий |
| --- | --- | --- |
| `id` | UUID | PK |
| `advertiserId` | UUID | FK на advertisers |
| `title` | text | обязательное |
| `description` | text | markdown/plain, опционально |
| `trackingUrl` | text | обязательное, то что было `target_url` |
| `previewUrl` | text | опционально, ссылка для предпросмотра |
| `fallbackUrl` | text | опционально, куда редиректить при строгом таргетинге |
| `status` | `active`/`paused`/`archived` | влияет на показ и кэш |
| `visibilityMode` | `public`/`on_request`/`private` | режим доступности |
| `targetingStrict` | boolean | переключатель «только визуальный» vs «жёсткий редирект» |
| `defaultGoalId` | UUID | FK на OfferGoal; null, если goal ещё не выбран |
| `allowedGeo` | text[] | быстрая реализация на массиве до миграции в таблицу |
| `deniedGeo` | text[] | аналогично |
| `createdAt`, `updatedAt` | timestamptz | audit |
| `postbackToken` | text | без изменений |

### OfferGoal
| Поле | Тип | Комментарий |
| --- | --- | --- |
| `id` | UUID | PK |
| `offerId` | UUID | FK на offers |
| `name` | text | обязательное |
| `type` | `CPL`/`CPA`/`CPC` | enum |
| `revenue` | numeric(12,2) | сколько получаем от рекламодателя |
| `payout` | numeric(12,2) | сколько платим affiliate |
| `currency` | char(3) | ISO-4217 |
| `isDefault` | boolean | не больше одного true на оффер |
| `isActive` | boolean | нельзя использовать для новых конверсий, если false |
| `createdAt`, `updatedAt` | timestamptz | audit |

### OfferAffiliateAccess (единая связка)
| Поле | Тип | Комментарий |
| --- | --- | --- |
| `id` | UUID | PK |
| `offerId` | UUID | FK |
| `affiliateId` | UUID | FK |
| `accessType` | `allowed`/`rejected`/`excluded` | поведение, описано ниже |
| `source` | `manual`/`request_approved`/`request_rejected` | откуда взялась запись |
| `createdAt`, `updatedAt` | timestamptz | audit |

### OfferRequest
| Поле | Тип |
| --- | --- |
| `id` | UUID |
| `offerId` | UUID |
| `affiliateId` | UUID |
| `status` | `pending`/`approved`/`rejected` |
| `message` | text, nullable |
| `reviewedBy` | UUID, nullable |
| `reviewedAt` | timestamptz, nullable |
| `createdAt`, `updatedAt` | timestamptz |

### OfferGeoRule (предпочитаем отдельную таблицу)
| Поле | Тип | Комментарий |
| --- | --- | --- |
| `id` | UUID | PK |
| `offerId` | UUID | FK |
| `ruleType` | `allow`/`deny` | enum |
| `countryCode` | char(2) | ISO-3166 alpha-2 |
| `createdAt` | timestamptz | для аудита |

## 3. Правила поведения

### VisibilityMode
- `public`: оффер виден всем аффилиатам, кроме тех, кто в `excluded`.
- `on_request`: оффер виден в усечённом виде всем, кто не в `excluded`. Можно отправить запрос, после approve запись переезжает в `allowed`, после reject — в `rejected`.
- `private`: оффер скрыт для всех, кроме тех, кто явно в `allowed`.

### Конфликты списков
1. `excluded` сильнее любых других записей.
2. `rejected` сильнее `allowed` (нельзя использовать оффер, пока не удалим запись).
3. `private` без `allowed` никому не виден.
4. `on_request` + нет записи = карточка видна частично, можно запросить доступ.
5. `on_request` + `allowed` = полная карточка, ссылки выдаём.
6. `on_request` + `rejected` = запросы запрещены.
7. `public` + `excluded` = оффер скрыт.

### Правила целей
- У оффера минимум одна goal.
- `name`, `type`, `revenue`, `payout`, `currency` обязательны.
- Одновременно может быть только одна `isDefault = true`.
- `isActive = false` запрещает использовать goal в новых кликах/конверсиях; существующие конверсии хранят snapshot (`conversion.goalId`, `conversion.goalName`, ...), реализуем позже.

### Таргетинг
- `allowedGeo` пустой => разрешены все страны кроме перечисленных в `deniedGeo`.
- `allowedGeo` не пустой => разрешены только страны из списка.
- `deniedGeo` всегда выигрывает конфликт.
- `targetingStrict = false` => ограничение только визуальное (предупреждение аффилиату в UI/листинге).
- `targetingStrict = true` => при неразрешённом geo редиректим на `fallbackUrl`.
- Если одна страна одновременно в allow и deny — deny.

## 4. Контракт и подготовка валидаторов
- Create/Update offer должны принимать новые поля (`description`, `previewUrl`, `fallbackUrl`, `visibilityMode`, `targetingStrict`, `allowedGeo`, `deniedGeo`, `goals`).
- Goals передаются массивом объектов `{ id?, name, type, revenue, payout, currency, isDefault, isActive }`.
- Пока маршруты не используют эти поля — DTO-билдеры в `validators/offers.js` будут разделены: текущее прод-DTO (`dto`) остаётся без изменений, рядом появится `domainDraft` с полной схемой и TODO-меткой, чтобы этап миграций просто переключил `createOffer`/`updateOffer` на новую структуру.
- Константы для перечислений выносим в `backend/src/constants/offers.js` и используем в валидаторах/сервисах, чтобы не размазывать строки.

## 5. Проверка основных кейсов
- **Кейс 1**: Public + нет записей ⇒ `visibilityMode=public`, `access.list=[]` — виден всем.
- **Кейс 2**: Public + `excluded` ⇒ `OfferAffiliateAccess` содержит запись → оффер скрыт.
- **Кейс 3**: On-request + нет записи ⇒ `visibilityMode=on_request`, `access=[]` — виден частично, можно создать `OfferRequest` (`status=pending`).
- **Кейс 4**: On-request + approved ⇒ запись `accessType=allowed` ⇒ полная выдача.
- **Кейс 5**: Private + нет allow ⇒ ничего не покажем, пока ручной allow не появится.
- **Кейс 6**: Три goals ⇒ `OfferGoal` хранит несколько записей, конверсии смогут ссылаться на `goalId` (будущая миграция `conversions.goal_id`).
- **Кейс 7**: Strict targeting + denied geo ⇒ `targetingStrict=true`, `fallbackUrl` обязателен, `OfferGeoRule`/`deniedGeo` даёт список стран, логика редиректа будет знать куда слать.

## 6. Итог
- Новые сущности: `OfferGoal`, `OfferAffiliateAccess`, `OfferRequest`, `OfferGeoRule` (+ массивы allow/deny для MVP).
- Новые поля в offer: `description`, `trackingUrl`, `previewUrl`, `fallbackUrl`, `status(active|paused|archived)`, `visibilityMode`, `targetingStrict`, `defaultGoalId`, `allowedGeo`, `deniedGeo`.
- Новые enum'ы: `offerStatuses`, `offerVisibilityModes`, `offerAccessTypes`, `offerAccessSources`, `offerRequestStatuses`, `offerGoalTypes`, `offerGeoRuleTypes`.
- Правила конфликтов и таргетинга зафиксированы, допускаем быстрый старт на массивах со следующим шагом миграций.
