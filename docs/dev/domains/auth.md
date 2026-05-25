# Авторизация

Статус: draft

## Назначение

Домен отвечает за регистрацию, логин, refresh/logout, выдачу JWT access token, хранение refresh token, получение текущего auth context и смену собственного пароля.

## Основные пользовательские сценарии

- пользователь регистрируется как `affiliate` или `advertiser`;
- пользователь логинится по email и паролю;
- frontend получает `/api/v1/auth/me` и строит ролевой редирект;
- access token истекает, frontend запрашивает `/api/v1/auth/refresh`;
- пользователь выходит через `/api/v1/auth/logout`;
- аутентифицированный пользователь меняет свой пароль через `/api/v1/auth/change-password`.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/auth/login/page.tsx` | форма логина, отправляет запрос на auth API |
| `frontend/src/app/auth/register/page.tsx` | форма регистрации с выбором account type |
| `frontend/src/components/AuthStatus.tsx` | показывает текущий auth state, ссылки на login/register/logout |
| `frontend/src/lib/auth/routes.ts` | маппинг роли в домашний route: `admin`/`manager` -> `/dashboard`, `affiliate` -> `/partner`, `advertiser` -> `/advertiser` |
| `frontend/src/lib/auth/roles.ts` | frontend-проверки ролей, в том числе `canAccessAdminArea`, `getHomePathByRole` |
| `frontend/src/components/questionnaires/UserQuestionnairePage.tsx` | использует auth context и строит `next`/redirect для обязательной анкеты |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `POST /api/v1/auth/register` (`backend/src/routes/auth.js`) | регистрация пользователя и связанной affiliate/advertiser сущности | публичный |
| `POST /api/v1/auth/login` (`backend/src/routes/auth.js`) | логин по email/password, выдача access token и refresh cookie | публичный |
| `POST /api/v1/auth/refresh` (`backend/src/routes/auth.js`) | перевыпуск access token по refresh token cookie | публичный |
| `POST /api/v1/auth/logout` (`backend/src/routes/auth.js`) | удаление refresh token и очистка cookie | публичный |
| `GET /api/v1/auth/me` (`backend/src/routes/auth.js`) | текущий auth context: user + profile + questionnaire state | любой аутентифицированный |
| `POST /api/v1/auth/change-password` (`backend/src/routes/auth.js`) | смена собственного пароля | любой аутентифицированный |
| `GET /api/v1/profile` (`backend/src/app.js`) | дублирующий current profile endpoint через `getAuthContext` | любой аутентифицированный |
| `PATCH /api/v1/profile` (`backend/src/app.js`) | обновление собственного профиля/таймзоны/telegram через общий profile service | любой аутентифицированный |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/users.js#validateRegisterDto` | регистрация: email, password, name/displayName, `accountType` |
| `backend/src/validators/users.js#validatePassword` | минимальная длина пароля |
| `backend/src/validators/users.js#validateChangePasswordDto` | payload для смены пароля |
| `backend/src/validators/users.js#validateUpdateProfileDto` | обновление timezone/telegram в собственном профиле |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/auth/register.service.js` | регистрация user + affiliate/advertiser в одной транзакции |
| `backend/src/services/auth/auth-context.service.js` | сбор auth context для `/me`: user, профиль, состояние анкеты |
| `backend/src/services/profile.service.js` | обновление собственного профиля для affiliate/advertiser/admin/manager |
| `backend/src/services/managers.service.js#changeOwnPassword` | смена собственного пароля |
| `backend/src/services/affiliates.service.js#requireAffiliateForUser` | принудительное разрешение affiliate link для роли affiliate |
| `backend/src/services/advertisers.service.js#requireAdvertiserForUser` | принудительное разрешение advertiser link для роли advertiser |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/userModel.js` | создание пользователя, поиск по email/id, обновление пароля и профиля |
| `backend/src/models/refreshTokenModel.js` | хранение hash refresh token, поиск, удаление, TTL |
| `backend/src/models/affiliateModel.js` | поиск affiliate по `user_id` / `email` для auth context |
| `backend/src/models/advertiserModel.js` | поиск advertiser по `user_id` для auth context |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `users` | базовая учётная запись | `role`, `email`, `password_hash`, `timezone` |
| `refresh_tokens` | refresh token storage | `user_id -> users.id`, хранится `token_hash`, `expires_at` |
| `affiliates` | affiliate-профиль для роли affiliate | `user_id -> users.id`, `affiliates_user_id_unique` |
| `advertisers` | advertiser-профиль для роли advertiser | `user_id -> users.id` |
| `registration_questionnaire_answers` | состояние анкеты пользователя | `user_id -> users.id`, влияет на `QUESTIONNAIRE_REQUIRED` |

## Main data flow

```txt
Register page
  -> POST /api/v1/auth/register
  -> validateRegisterDto
  -> registerUser
  -> userModel.createUser
  -> affiliateModel.createAffiliate / advertiserModel.createAdvertiser
  -> issueAuthPackage
  -> refreshTokenModel.createRefreshTokenForUser
  -> set refresh_token cookie
  -> access token + user payload

Login page
  -> POST /api/v1/auth/login
  -> findUserByEmail
  -> bcrypt.compare
  -> issueAuthPackage
  -> JWT access token + refresh cookie

Authenticated page load
  -> GET /api/v1/auth/me
  -> authenticate middleware (Bearer JWT)
  -> getAuthContext
  -> userModel.findUserById
  -> role-specific profile resolve
  -> questionnaire completion state
  -> response to frontend
```

## Permissions / roles

- Публично доступны только `register`, `login`, `refresh`, `logout`.
- `authenticate` в `backend/src/middleware/auth.js` требует Bearer token и возвращает `TOKEN_EXPIRED` или `TOKEN_INVALID`.
- JWT payload содержит `userId`, `role`, `affiliateId`, `advertiserId`.
- Role-based redirect на frontend задаётся в `frontend/src/lib/auth/routes.ts`.
- `admin` и `manager` ведут в `/dashboard`, но `manager` не получает полный admin CRUD: ограничения дальше проверяются роутами и `accessControl`.
- Для `affiliate` и `advertiser` доступ к части кабинета после логина может блокироваться `requireQuestionnaireCompletion`.

## Edge cases

- неверный email/password -> `INVALID_CREDENTIALS`, HTTP 401;
- пользователь не найден при `/me` или `/refresh` -> 404;
- отсутствует Bearer token -> `AUTH_REQUIRED`, HTTP 401;
- access token истёк -> `TOKEN_EXPIRED`, HTTP 401;
- refresh token отсутствует/просрочен/не найден -> `TOKEN_INVALID` или `TOKEN_EXPIRED`, cookie очищается;
- роль `affiliate` без связанного affiliate record -> `requireAffiliateForUser` бросает 404;
- роль `advertiser` без связанного advertiser record -> `requireAdvertiserForUser` бросает 404;
- регистрация с неподдерживаемым `accountType` -> validation error;
- duplicate email при регистрации -> `CONFLICT`, HTTP 409;
- доступ к кабинету после логина может быть заблокирован из-за незаполненной анкеты.

## Known limitations

- В проекте нет отдельного session store для access token: access token stateless, revoke делается только через refresh token.
- В коде нет подтверждения email / reset password flow в runtime routes этого этапа, хотя переменные окружения и миграции на токены есть. TODO: уточнить фактическую реализацию email verification/reset.
- Frontend опирается на `/auth/me` и `/profile`; дублирование endpoints стоит учитывать при рефакторинге.
- Отдельный logout для access token blacklist не реализован.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/auth-me.test.js` | `/auth/me` для affiliate/admin и требование auth |
| `backend/tests/integration/register.test.js` | регистрация affiliate/advertiser, link сущностей, duplicate email |
| `backend/tests/integration/advertiser-foundation.test.js` | auth payload и `/auth/me` для advertiser |
| `backend/tests/integration/manager-admin.test.js` | логин manager и использование auth payload в admin-area |

## Связанные разделы

- [Users](./users.md)
- [Questionnaires](./questionnaires.md)
- [Backend Architecture](../architecture/03-backend.md)
- [Frontend Architecture](../architecture/02-frontend.md)
