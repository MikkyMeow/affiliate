# Пользователи

Статус: draft

## Назначение

Базовый user-домен описывает учётную запись в таблице `users`, её роль, email, display name, timezone и связи с доменными сущностями `affiliate` и `advertiser`.

## Основные пользовательские сценарии

- система создаёт user при self-registration affiliate/advertiser;
- администратор создаёт user для уже существующего affiliate через `/users`;
- администратор создаёт manager user;
- администратор создаёт advertiser user вместе с advertiser entity;
- пользователь обновляет свой timezone и telegram через профиль;
- backend разрешает role-specific linkage для affiliate/advertiser в auth context.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/profile/page.tsx` | профиль в admin/manager зоне, использует `/api/v1/profile` |
| `frontend/src/app/partner/profile/page.tsx` | профиль affiliate |
| `frontend/src/app/advertiser/profile/page.tsx` | профиль advertiser |
| `frontend/src/lib/auth/roles.ts` | frontend-логика ролей и label |
| `frontend/src/components/AuthStatus.tsx` | вывод email/role/profile links |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `POST /api/v1/users` (`backend/src/routes/users.routes.js`) | создать user и привязать его к существующему affiliate | `admin` |
| `GET /api/v1/profile` (`backend/src/app.js`) | получить auth context пользователя | любой аутентифицированный |
| `PATCH /api/v1/profile` (`backend/src/app.js`) | обновить timezone/telegram в своём профиле | любой аутентифицированный |
| `POST /api/v1/admin/managers` (`backend/src/routes/admin-managers.routes.js`) | создать manager user | `admin` |
| `PATCH /api/v1/admin/managers/:id` (`backend/src/routes/admin-managers.routes.js`) | обновить manager user | `admin` |
| `DELETE /api/v1/admin/managers/:id` (`backend/src/routes/admin-managers.routes.js`) | удалить manager user | `admin` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/users.js#validateCreateAffiliateUserDto` | создание user для существующего affiliate |
| `backend/src/validators/users.js#validateUpdateProfileDto` | `timezone`, `telegram` в self-profile |
| `backend/src/validators/users.js#validateCreateManagerDto` | создание manager user |
| `backend/src/validators/users.js#validateUpdateManagerDto` | обновление email/displayName manager |
| `backend/src/validators/users.js#validateManagerListQuery` | фильтры и пагинация списка managers |
| `backend/src/validators/users.js#validateTimeZoneValue` | IANA timezone |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/users.service.js` | createAffiliateUser и link к existing affiliate |
| `backend/src/services/profile.service.js` | обновление timezone в `users`, telegram в affiliate/advertiser |
| `backend/src/services/managers.service.js` | manager CRUD, password reset/change |
| `backend/src/services/auth/auth-context.service.js` | материализация user + profile |
| `backend/src/services/affiliates.service.js#linkAffiliateToUser` | связь existing affiliate с user |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/userModel.js` | основной data access для `users` |
| `backend/src/models/affiliateModel.js` | lookup affiliate по `user_id` |
| `backend/src/models/advertiserModel.js` | lookup advertiser по `user_id` |
| `backend/src/models/refreshTokenModel.js` | revoke refresh tokens при password reset/change |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `users` | core user entity | `email unique`, `role`, `timezone` |
| `affiliates` | affiliate profile | `user_id -> users.id`, `manager_user_id -> users.id` |
| `advertisers` | advertiser profile | `user_id -> users.id`, `manager_user_id -> users.id` |
| `refresh_tokens` | активные refresh token пользователя | `user_id -> users.id` |
| `audit_events` | аудит user/profile/manager изменений | содержит actor и context |

## Main data flow

```txt
User creation
  -> route/controller
  -> users/managers/advertisers service
  -> userModel.createUser
  -> optional affiliate/advertiser link
  -> response with role-aware payload

Self profile update
  -> PATCH /api/v1/profile
  -> validateUpdateProfileDto
  -> profile.service
  -> userModel.updateUserById (timezone)
  -> affiliateModel.updateAffiliate / advertiserModel.updateAdvertiser (telegram)
  -> audit_events
  -> getAuthContext
  -> response
```

## Permissions / roles

- `users` CRUD почти не вынесен в отдельный публичный домен; прямой admin endpoint есть только для привязки user к affiliate.
- `admin` управляет manager users и созданием affiliate-linked user.
- `manager` не может создавать/обновлять/удалять managers.
- `affiliate` и `advertiser` могут обновлять только собственный профиль через общий profile service.
- Проверки ролей идут через `authenticate`, `authorizeAdminOnly`, `authorizeAdminArea`, `authorizeRole`.

## Edge cases

- email уже занят -> `CONFLICT`;
- user с ролью affiliate, но без affiliate record -> 404 в auth/profile flows;
- user с ролью advertiser, но без advertiser record -> 404 в auth/profile flows;
- timezone не задан -> `null`, это допустимо;
- невалидная timezone -> validation error;
- привязка user к affiliate, у которого уже есть `user_id` -> `CONFLICT`;
- смена роли как отдельный use case в публичных routes не поддержана. TODO: уточнить, нужен ли административный role change вне migrations/scripts.

## Known limitations

- Нет отдельного UI/route для общего user admin списка.
- Роль пользователя хранится в `users.role`, но прямой runtime-маршрут для массового user management отсутствует.
- `status` живёт не в `users`, а в `affiliates`/`advertisers`; для admin/manager user status отдельного поля нет.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/register.test.js` | создание user и связей при регистрации |
| `backend/tests/integration/auth-me.test.js` | выдача user role/linkage в auth context |
| `backend/tests/integration/advertiser-foundation.test.js` | advertiser linkage в `findUserByEmail` / `findUserById` |
| `backend/tests/integration/manager-admin.test.js` | manager user CRUD и password flows |

## Связанные разделы

- [Auth](./auth.md)
- [Affiliates](./affiliates.md)
- [Advertisers](./advertisers.md)
- [Managers](./managers.md)
