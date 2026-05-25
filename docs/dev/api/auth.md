# Auth API

Статус: draft

## Назначение

Auth API отвечает за регистрацию, login/logout, выпуск access token, refresh через cookie, получение текущего auth context и смену пароля текущим пользователем.

## Base path

- `/api/v1/auth`
- Связанный профильный endpoint: `/api/v1/profile`

## Response format

Подтверждён единый успешный envelope backend:

```json
{
  "success": true,
  "data": {},
  "meta": null
}
```

Ошибка приходит в формате `success: false` / `error.code` / `error.message` / `error.details`.

## Auth / permissions

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` публичные.
- `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password`, `GET|PATCH /api/v1/profile` требуют `Authorization: Bearer <token>`.
- Access token выдаётся в body ответа.
- Refresh token хранится в cookie через `backend/src/lib/refreshTokenCookie.js`.
- Проверка access token выполняется в `backend/src/middleware/auth.js`.
- `GET /api/v1/auth/me` и `GET /api/v1/profile` возвращают auth context через `backend/src/services/auth/auth-context.service.js`.
- В auth context backend возвращает `user.role`, а для `affiliate` и `advertiser` дополнительно профиль и статус анкеты.

## Endpoint map

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/register` | public | `frontend/src/app/auth/register/page.tsx` | `backend/src/routes/auth.js` | `backend/src/services/auth/register.service.js` | `backend/tests/integration/register.test.js`, `backend/tests/integration/advertiser-foundation.test.js`, `backend/tests/integration/public-ids.test.js` |
| POST | `/api/v1/auth/login` | public | `frontend/src/app/auth/login/page.tsx`, `frontend/src/context/AuthContext.tsx` | `backend/src/routes/auth.js` | route-local login flow + `issueAuthPackage()` | `backend/tests/integration/critical-path.test.js`, `backend/tests/integration/manager-admin.test.js`, `backend/tests/integration/advertiser-foundation.test.js` |
| POST | `/api/v1/auth/refresh` | public with refresh cookie | `frontend/src/context/AuthContext.tsx` | `backend/src/routes/auth.js` | route-local refresh flow + `issueAuthPackage()` | TODO: уточнить отдельный test file |
| POST | `/api/v1/auth/logout` | public, если refresh cookie присутствует | `frontend/src/context/AuthContext.tsx` | `backend/src/routes/auth.js` | route-local logout flow | TODO: уточнить отдельный test file |
| GET | `/api/v1/auth/me` | authenticated | `frontend/src/context/AuthContext.tsx`, guard/redirect logic | `backend/src/routes/auth.js` | `backend/src/services/auth/auth-context.service.js` | `backend/tests/integration/auth-me.test.js`, `backend/tests/integration/questionnaires.test.js`, `backend/tests/integration/manager-admin.test.js`, `backend/tests/integration/advertiser-foundation.test.js` |
| POST | `/api/v1/auth/change-password` | authenticated | Frontend usage не найден | `backend/src/routes/auth.js` | `backend/src/services/managers.service.js` | `backend/tests/integration/manager-admin.test.js` |
| GET | `/api/v1/profile` | authenticated | `frontend/src/context/AuthContext.tsx` uses auth context equivalent, direct usage TODO: уточнить | `backend/src/app.js` | `backend/src/services/auth/auth-context.service.js` | `backend/tests/integration/critical-path.test.js` |
| PATCH | `/api/v1/profile` | authenticated | `frontend/src/lib/advertiser.api.ts` (`updateProfile`), partner/admin profile UI через TODO: уточнить | `backend/src/app.js` | `backend/src/services/profile.service.js` | TODO: уточнить отдельный test file |

## Detailed endpoints

## POST /api/v1/auth/login

### Назначение

Логин по email/password. Проверяет credentials, создаёт access token, создаёт refresh token и ставит refresh cookie.

### Роли

- `public`

### Query params

Нет.

### Path params

Нет.

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | Да | Email пользователя. |
| `password` | `string` | Да | Пароль пользователя. |

### Response

- Успех: `200 OK`
- В `data` возвращаются `token` и `user`.
- `user.role` подтверждён.
- Для `affiliate` и `advertiser` backend добавляет `affiliateId` / `advertiserId`.
- Refresh token отдельно ставится в cookie, а не в JSON body.

Подтверждённый пример структуры:

```json
{
  "token": "jwt",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Имя",
    "timezone": null,
    "createdAt": "2026-05-25T00:00:00.000Z",
    "role": "affiliate",
    "affiliateId": "uuid",
    "advertiserId": null
  }
}
```

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Validation error | Не передан `email` или `password`. |
| `401` + `INVALID_CREDENTIALS` | Invalid credentials | Пользователь с таким email не найден или `bcrypt.compare` вернул `false`. |
| `429` + `RATE_LIMITED` | Login rate limited | Срабатывает `loginRateLimiter`. TODO: уточнить точный payload ошибки по middleware. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/auth/login/page.tsx` | Форма входа. |
| `frontend/src/context/AuthContext.tsx` | Сохраняет access token и загружает текущий auth context. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/auth.js` | Route handler login. |
| `backend/src/middleware/rateLimit.js` | Ограничение частоты login. |
| `backend/src/models/userModel.js` | Поиск пользователя по email. |
| `backend/src/models/refreshTokenModel.js` | Создание refresh token. |
| `backend/src/lib/refreshTokenCookie.js` | Установка refresh cookie. |
| `backend/src/services/affiliates.service.js` | Добирает affiliate link при роли `affiliate`. |
| `backend/src/services/advertisers.service.js` | Добирает advertiser link при роли `advertiser`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Базовый login и дальнейший критичный flow. |
| `backend/tests/integration/manager-admin.test.js` | Login manager/admin и смена пароля. |
| `backend/tests/integration/advertiser-foundation.test.js` | Login advertiser и доступ в advertiser cabinet. |

## GET /api/v1/auth/me

### Назначение

Возвращает текущий auth context: `user`, `profile`, `questionnaire`.

### Роли

- `authenticated`

### Query params

Нет.

### Path params

Нет.

### Body

Нет.

### Response

- Успех: `200 OK`
- Структура собирается в `getAuthContext()`.
- `user` подтверждён для всех ролей.
- `profile` подтверждён для `affiliate` и `advertiser`; для admin/manager может быть `null`.
- `questionnaire.required` и `questionnaire.completed` подтверждены.

Подтверждённая укороченная структура:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "advertiser"
  },
  "profile": {
    "type": "advertiser",
    "id": "uuid"
  },
  "questionnaire": {
    "required": true,
    "completed": false
  }
}
```

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` + `AUTH_REQUIRED` | Missing bearer token | Нет заголовка `Authorization: Bearer ...`. |
| `401` + `TOKEN_INVALID` | Invalid token | JWT невалиден. |
| `401` + `TOKEN_EXPIRED` | Expired token | JWT истёк. |
| `404` + `NOT_FOUND` | User not found | Пользователь из токена не найден в БД. |
| `403` + `AFFILIATE_NOT_LINKED` | Affiliate profile linkage problem | TODO: уточнить, может всплывать при резолве affiliate-профиля. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/context/AuthContext.tsx` | Загружает текущего пользователя после login/refresh. |
| `frontend/src/lib/auth/routes.ts` | Косвенно участвует в role-based redirect через auth context. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/auth.js` | Route `/me`. |
| `backend/src/middleware/auth.js` | JWT authentication. |
| `backend/src/services/auth/auth-context.service.js` | Собирает `user/profile/questionnaire`. |
| `backend/src/services/questionnaires.service.js` | Проверяет completion state анкеты. |
| `backend/src/services/advertisers/advertiser-profile.service.js` | Собирает advertiser profile. |
| `backend/src/services/affiliates.service.js` | Собирает affiliate profile. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/auth-me.test.js` | Возврат данных текущего пользователя. |
| `backend/tests/integration/questionnaires.test.js` | Признаки required/completed для анкеты. |
| `backend/tests/integration/advertiser-foundation.test.js` | Возврат advertiser auth context. |

## POST /api/v1/auth/logout

### Назначение

Удаляет refresh token из хранилища, очищает refresh cookie, завершает logout на стороне backend.

### Роли

- `public`

### Query params

Нет.

### Path params

Нет.

### Body

Нет.

### Response

- Успех: `200 OK`

```json
{
  "message": "Выход выполнен"
}
```

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `200` | Logout without stored session | Endpoint специально идемпотентен: если cookie нет, просто очищает cookie и отвечает успехом. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/context/AuthContext.tsx` | Вызывает logout и очищает локальный access token. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/auth.js` | Route `/logout`. |
| `backend/src/models/refreshTokenModel.js` | Удаление refresh token. |
| `backend/src/lib/refreshTokenCookie.js` | Очистка cookie. |

### Tests

| Test file | Что проверяет |
|---|---|
| TODO: добавить/уточнить tests. |

## POST /api/v1/auth/register

### Назначение

Регистрирует пользователя и сразу выдаёт auth package. Для `affiliate` создаёт affiliate-профиль, для `advertiser` создаёт advertiser-профиль.

### Роли

- `public`

### Query params

Нет.

### Path params

Нет.

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | Да | Email нового пользователя. |
| `password` | `string` | Да | Пароль, минимум 8 символов. |
| `name` / `displayName` | `string` | Да | Отображаемое имя. Валидатор принимает `name ?? displayName`. |
| `accountType` | `string` | Да | Подтверждённые значения: из `ACCOUNT_TYPE_VALUES`; по коду используются `affiliate` и `advertiser`. |

### Response

- Успех: `201 Created`
- Ответ по структуре совпадает с login: `token` + `user`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Validation error | Пустой email, короткий пароль, пустое имя, неверный `accountType`. |
| `409` + `CONFLICT` | Email already exists | Уже существует `users.email`. |
| `409` + `CONFLICT` | Affiliate email already exists | Для `accountType=affiliate` уже существует `affiliates.email`. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/auth/register/page.tsx` | Форма регистрации. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/auth.js` | Route `/register`. |
| `backend/src/validators/users.js` | `validateRegisterDto`. |
| `backend/src/services/auth/register.service.js` | Создание user + affiliate/advertiser в транзакции. |
| `backend/src/models/userModel.js` | Создание user. |
| `backend/src/models/affiliateModel.js` | Создание affiliate profile. |
| `backend/src/models/advertiserModel.js` | Создание advertiser profile. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/register.test.js` | Регистрация и валидация register flow. |
| `backend/tests/integration/public-ids.test.js` | Public IDs после регистрации/создания сущностей. |
| `backend/tests/integration/advertiser-foundation.test.js` | Register advertiser и последующий advertiser profile/auth flow. |

## POST /api/v1/auth/refresh

### Назначение

Обновляет access token по refresh cookie, ротирует refresh token.

### Роли

- `public with refresh cookie`

### Query params

Нет.

### Path params

Нет.

### Body

Нет.

### Response

- `200 OK`
- Возвращает новый `token` и `user`, refresh cookie перевыпускается.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` + `TOKEN_INVALID` | Missing or invalid refresh token | Cookie отсутствует или token не найден в хранилище. |
| `401` + `TOKEN_EXPIRED` | Expired refresh token | Refresh token истёк. |
| `404` + `NOT_FOUND` | User not found | Владелец refresh token удалён. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/context/AuthContext.tsx` | Восстанавливает access token после reload. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/auth.js` | Route `/refresh`. |
| `backend/src/models/refreshTokenModel.js` | Поиск, удаление, перевыпуск refresh token. |
| `backend/src/lib/refreshTokenCookie.js` | Чтение и запись cookie. |

### Tests

| Test file | Что проверяет |
|---|---|
| TODO: добавить/уточнить tests. |

## POST /api/v1/auth/change-password

### Назначение

Смена пароля текущим авторизованным пользователем.

### Роли

- `authenticated`

### Query params

Нет.

### Path params

Нет.

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `currentPassword` | `string` | Да | Текущий пароль. |
| `newPassword` | `string` | Да | Новый пароль. |

### Response

```json
{
  "ok": true
}
```

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Validation error | Некорректное тело запроса. |
| `401` + `AUTH_REQUIRED` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | Auth error | Нет/некорректен bearer token. |
| TODO: уточнить | Invalid current password | Точный error code нужно сверить по `changeOwnPassword()`. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| Frontend usage не найден. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/auth.js` | Route `/change-password`. |
| `backend/src/validators/users.js` | `validateChangePasswordDto`. |
| `backend/src/services/managers.service.js` | `changeOwnPassword()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/manager-admin.test.js` | Смена пароля и повторный login. |

## GET /api/v1/profile

### Назначение

Альтернативный endpoint текущего auth context. Возвращает ту же структуру, что `/api/v1/auth/me`.

### Роли

- `authenticated`

### Query params

Нет.

### Path params

Нет.

### Body

Нет.

### Response

`TODO: уточнить, нужен ли этот endpoint отдельно для frontend или это legacy alias.` Структура по коду собирается тем же `getAuthContext()`.

### Errors

Такие же, как у `GET /api/v1/auth/me`.

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/lib/advertiser.api.ts` | Не использует. |
| `frontend/src/context/AuthContext.tsx` | TODO: уточнить, какой из двух endpoints фактически вызывается в текущей реализации. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/app.js` | Inline route registration. |
| `backend/src/services/auth/auth-context.service.js` | Сборка ответа. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Доступ к `/api/v1/profile` после login и `401` без токена. |

## Связанные разделы

- [Backend architecture](../architecture/03-backend.md)
- [Auth domain](../domains/auth.md)
- [Users domain](../domains/users.md)
- [Registration flow](../data-flow/registration-flow.md)
