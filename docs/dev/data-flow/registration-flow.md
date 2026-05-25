# Registration Flow

Статус: draft

## Назначение

Документ описывает регистрацию пользователя, создание связанного профиля (`affiliate` или `advertiser`), выдачу сессии и обязательную анкету перед доступом к кабинету.

## Краткая схема

```txt
User opens /auth/register
  -> fills form
  -> POST /api/v1/auth/register
  -> validate email/password/name/accountType
  -> create user
  -> create affiliate or advertiser profile
  -> issue JWT + refresh token cookie
  -> frontend loads /auth/me
  -> questionnaire completion is checked
  -> user is redirected to role cabinet or questionnaire page
```

## Когда запускается flow

Публичная регистрация подтверждена.

Frontend:

- `frontend/src/app/auth/register/page.tsx`

Backend:

- `POST /api/v1/auth/register`

Дополнительный first-login/session flow:

- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `GET /api/v1/me/questionnaire`
- `PUT /api/v1/me/questionnaire/answers`

## Входные данные

| Поле / источник | Назначение | Обязательность | Где используется |
| --- | --- | --- | --- |
| `email` | логин пользователя | обязательно | `validateRegisterDto`, `createUser` |
| `password` | пароль | обязательно | `validatePassword`, `bcrypt.hash` |
| `name` / `displayName` | имя пользователя и display/profile name | обязательно | `validateRegisterDto`, `createAffiliate/createAdvertiser` |
| `accountType` | `affiliate` или `advertiser` | обязательно | `ensureAccountTypeAllowed`, `create role profile` |
| refresh token cookie | серверная сессия refresh | выдаётся backend | `refresh_tokens` |
| questionnaire answers | ответы анкеты | обязательно только если есть active required questionnaire | questionnaire services |

## Участники процесса

| Участник | Роль в flow |
| --- | --- |
| `frontend/src/app/auth/register/page.tsx` | регистрационная форма |
| `frontend/src/context/AuthContext.tsx` | вызывает `/auth/register`, хранит access token, затем грузит `/auth/me` |
| `backend/src/routes/auth.js` | register/login/refresh/me routes |
| `backend/src/validators/users.js` | validate register dto и password |
| `backend/src/services/auth/register.service.js` | создание user + profile rows |
| `backend/src/models/userModel.js` | `users` CRUD |
| `backend/src/models/affiliateModel.js` | создание affiliate profile |
| `backend/src/models/advertiserModel.js` | создание advertiser profile |
| `backend/src/models/refreshTokenModel.js` | refresh tokens |
| `backend/src/services/auth/auth-context.service.js` | формирует `/auth/me` context |
| `backend/src/services/questionnaires.service.js` | questionnaire requirement/completion |
| `backend/src/middleware/requireQuestionnaireCompletion.js` | блокирует доступ к protected area до заполнения анкеты |
| `backend/src/routes/me-questionnaire.routes.js` | загрузка и submit анкеты |

## Frontend entry points

| Файл / экран | Назначение |
| --- | --- |
| `frontend/src/app/auth/register/page.tsx` | публичная форма регистрации |
| `frontend/src/context/AuthContext.tsx` | после регистрации сохраняет access token и делает `/auth/me` |
| `frontend/src/components/questionnaires/UserQuestionnairePage.tsx` | заполнение анкеты для affiliate/advertiser |
| `frontend/src/app/partner/questionnaire/page.tsx` | questionnaire page for affiliate |
| `frontend/src/app/advertiser/questionnaire/page.tsx` | questionnaire page for advertiser |

## Backend entry points

| Route / файл | Метод / path | Назначение |
| --- | --- | --- |
| `backend/src/routes/auth.js` | `POST /api/v1/auth/register` | публичная регистрация |
| `backend/src/routes/auth.js` | `POST /api/v1/auth/login` | выдача access/refresh для существующего пользователя |
| `backend/src/routes/auth.js` | `POST /api/v1/auth/refresh` | перевыпуск access token |
| `backend/src/routes/auth.js` | `GET /api/v1/auth/me` | текущий auth context, включая questionnaire status |
| `backend/src/routes/me-questionnaire.routes.js` | `GET /api/v1/me/questionnaire` | загрузка анкеты по роли |
| `backend/src/routes/me-questionnaire.routes.js` | `PUT /api/v1/me/questionnaire/answers` | submit ответов |

## Validation

| Файл / схема | Что проверяет |
| --- | --- |
| `validateRegisterDto` | `email`, `password`, `name/displayName`, `accountType` |
| `validatePassword` | пароль не короче 8 символов |
| `validateEmail` из `validators/affiliates.js` | email format |
| `validateQuestionnaireAnswersDto` | структура answers payload |
| `validateAnswersAgainstQuestionnaire` в `questionnaires.service.js` | required fields, option values, multiselect/checkbox types |

Дополнительные бизнес-проверки в `register.service.js`:

- `users.email` не должен существовать
- для `affiliate` дополнительно проверяется отсутствие affiliate с тем же email
- `accountType` должен быть одним из `affiliate`, `advertiser`

## Business logic

| Файл / service | Ответственность |
| --- | --- |
| `registerUser` | transaction: create `users` + role profile |
| `issueAuthPackage` | подписывает JWT, создаёт refresh token, выставляет cookie |
| `getAuthContext` | возвращает user/profile/questionnaire status |
| `getQuestionnaireCompletionStateForUser` | вычисляет, требуется ли анкета и заполнена ли она |
| `submitMyQuestionnaireAnswers` | сохраняет answers row |

Публичная регистрация создаёт:

- `users.role = affiliate` или `advertiser`
- при `affiliate`: строка в `affiliates`
- при `advertiser`: строка в `advertisers`

После регистрации пользователь сразу получает:

- access token в response body
- refresh token cookie

Дальше фронтенд определяет домашний маршрут по роли.

## Database reads

| Таблица | Что читается | Зачем |
| --- | --- | --- |
| `users` | поиск по email/id | uniqueness и auth context |
| `affiliates` | поиск profile по user/email | affiliate registration/auth context |
| `advertisers` | поиск profile по user | advertiser registration/auth context |
| `registration_questionnaires` | active questionnaire по роли | gating доступа |
| `registration_questionnaire_answers` | answers пользователя | completion state |
| `refresh_tokens` | refresh session | session lifecycle |

## Database writes

| Таблица | Что записывается / обновляется | Когда |
| --- | --- | --- |
| `users` | пользователь с `email`, `password_hash`, `display_name`, `role` | register |
| `affiliates` | affiliate profile | register `accountType=affiliate` |
| `advertisers` | advertiser profile | register `accountType=advertiser` |
| `refresh_tokens` | refresh token row | register/login/refresh |
| `registration_questionnaire_answers` | answers пользователя | questionnaire submit |

## Redis / cache / locks

TODO: уточнить использование Redis/cache/locks в этом flow. В подтверждённом register/questionnaire code Redis не участвует.

## Queue / async events

TODO: уточнить queue / async events для этого flow. Асинхронные jobs на регистрацию/анкеты в подтверждённом коде не найдены.

## Statuses

Отдельных статусов регистрации нет.

Но есть важные состояния доступа:

| Состояние | Когда появляется | Что означает |
| --- | --- | --- |
| `questionnaire.required = true` | для роли есть active required questionnaire | нужен доп. шаг до полного доступа |
| `questionnaire.completed = false` | ответы не заполнены полностью | protected pages должны блокироваться |
| `questionnaire.completed = true` | required fields закрыты | доступ в кабинет открыт |

## Error cases

| Ошибка / ситуация | Где возникает | Что происходит | Что проверить |
| --- | --- | --- | --- |
| email already exists | `registerUser` | `409 CONFLICT` | `users.email` |
| affiliate with email already exists | `registerUser` | `409 CONFLICT` | `affiliates.email` |
| invalid password | `validatePassword` | `400` | password length |
| invalid accountType | validator/service | `400` | allowed account types |
| profile entity not created | transaction error | rollback | DB constraints |
| user exists but role entity missing | `issueAuthPackage` calls `requireAffiliateForUser` / `requireAdvertiserForUser` | `/auth/me` или login может упасть | profile consistency |
| questionnaire required but incomplete | `requireQuestionnaireCompletion` | `403 QUESTIONNAIRE_REQUIRED` | questionnaire config/answers |
| login successful but cabinet access restricted | middleware | user должен идти на questionnaire page | questionnaire completion |
| timezone missing | допустимо | `user.timezone = null` | profile settings, not register blocker |

## Idempotency / deduplication

Явной идемпотентности нет; повторная регистрация тем же email блокируется unique/business checks.

## Security / permissions

- публично можно зарегистрировать только `affiliate` и `advertiser`
- `admin` и `manager` self-registration через public form не подтверждена
- refresh token хранится в cookie, access token в response body и затем во frontend storage
- questionnaire routes доступны только authenticated `affiliate` и `advertiser`

## Observability / debugging

- смотреть `users`, `affiliates`, `advertisers`, `refresh_tokens`
- questionnaire debug: `registration_questionnaires`, `registration_questionnaire_answers`
- при проблемах доступа смотреть `/auth/me` payload: `user`, `profile`, `questionnaire`

## Tests

| Тест | Что проверяет |
| --- | --- |
| `backend/tests/integration/register.test.js` | registration flow |
| `backend/tests/integration/auth-me.test.js` | auth context |
| `backend/tests/integration/questionnaires.test.js` | questionnaire requirement/completion |
| `backend/tests/integration/advertiser-foundation.test.js` | advertiser-side auth foundation |

## Known limitations

- Публичная регистрация для `manager`/`admin` не реализована.
- TODO: отдельный “first login wizard” кроме questionnaire page не найден.
- TODO: проверка timezone при регистрации отсутствует; timezone заполняется позже через profile update.

## Связанные разделы

- [../domains/auth.md](../domains/auth.md)
- [../domains/users.md](../domains/users.md)
- [../domains/questionnaires.md](../domains/questionnaires.md)
- [../domains/affiliates.md](../domains/affiliates.md)
- [../domains/advertisers.md](../domains/advertisers.md)
- [../domains/managers.md](../domains/managers.md)
