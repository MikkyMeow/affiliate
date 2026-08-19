# Анкеты

Статус: draft

## Назначение

Домен описывает registration questionnaires для ролей `affiliate` и `advertiser`, хранение definitions/answers, обязательность заполнения и блокировку доступа к кабинетам до completion.

## Основные пользовательские сценарии

- admin создаёт/обновляет questionnaire для affiliate или advertiser;
- affiliate/advertiser открывает свою анкету;
- пользователь отправляет ответы;
- backend проверяет required fields и типы;
- partner/advertiser routes требуют completion before continuing;
- admin смотрит ответы пользователя через affiliate/advertiser detail pages.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/questionnaires/page.tsx` | admin questionnaire management UI |
| `frontend/src/app/partner/questionnaire/page.tsx` | affiliate questionnaire page |
| `frontend/src/app/advertiser/questionnaire/page.tsx` | advertiser questionnaire page |
| `frontend/src/components/questionnaires/UserQuestionnairePage.tsx` | общий компонент questionnaire submit flow |
| `frontend/src/lib/questionnaires.ts` | admin/self questionnaire API client |
| `frontend/src/app/dashboard/affiliates/[id]/edit/page.tsx` | отображение affiliate questionnaire answers |
| `frontend/src/app/dashboard/advertisers/[id]/edit/page.tsx` | отображение advertiser questionnaire answers |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `GET /api/v1/admin/questionnaires` (`backend/src/routes/admin-questionnaires.routes.js`) | list questionnaires | `admin` |
| `GET /api/v1/admin/questionnaires/:id` (`backend/src/routes/admin-questionnaires.routes.js`) | questionnaire detail | `admin` |
| `PUT /api/v1/admin/questionnaires/:targetRole` (`backend/src/routes/admin-questionnaires.routes.js`) | upsert questionnaire by role | `admin` |
| `GET /api/v1/me/questionnaire` (`backend/src/routes/me-questionnaire.routes.js`) | current user questionnaire + completion state | `affiliate`, `advertiser` |
| `PUT /api/v1/me/questionnaire/answers` (`backend/src/routes/me-questionnaire.routes.js`) | submit answers | `affiliate`, `advertiser` |
| `requireQuestionnaireCompletion` (`backend/src/middleware/requireQuestionnaireCompletion.js`) | guard для partner/advertiser routes | `affiliate`, `advertiser` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/questionnaires.js#validateQuestionnaireListQuery` | admin questionnaire filter |
| `backend/src/validators/questionnaires.js#validateQuestionnaireTargetRole` | target role `affiliate|advertiser` |
| `backend/src/validators/questionnaires.js#validateQuestionnaireUpsertDto` | questionnaire definition, fields, options, uniqueness |
| `backend/src/validators/questionnaires.js#validateQuestionnaireAnswersDto` | answers payload |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/questionnaires.service.js` | questionnaire CRUD, answer validation, completion state, answer formatting |
| `backend/src/middleware/requireQuestionnaireCompletion.js` | guard based on completion state |
| `backend/src/services/auth/auth-context.service.js` | включает questionnaire required/completed в `/auth/me` |
| `backend/src/services/affiliates.service.js` | attaches formatted questionnaire answers to affiliate detail |
| `backend/src/services/advertisers.service.js` | attaches formatted questionnaire answers to advertiser detail |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/registrationQuestionnaires.model.js` | list/find/upsert questionnaire definitions |
| `backend/src/models/registrationQuestionnaireAnswers.model.js` | find/insert/update answer rows |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `registration_questionnaires` | questionnaire definition by target role | `target_role unique`, `fields jsonb`, `is_active` |
| `registration_questionnaire_answers` | answers per user and role | `user_id -> users.id`, unique `(user_id, target_role)` |
| `audit_events` | questionnaire created/updated audit | entity `registration_questionnaire` |

## Main data flow

```txt
Admin questionnaire UI
  -> PUT /api/v1/admin/questionnaires/:targetRole
  -> validateQuestionnaireUpsertDto
  -> questionnaires.service.upsertAdminQuestionnaire
  -> registration_questionnaires table
  -> audit_events

Affiliate/Advertiser cabinet
  -> GET /api/v1/me/questionnaire
  -> questionnaires.service.getMyQuestionnaire
  -> registration_questionnaires + registration_questionnaire_answers
  -> PUT /api/v1/me/questionnaire/answers
  -> validate answers against field definitions
  -> upsert answer row
  -> completion state updated
```

## Permissions / roles

- questionnaire management только у `admin`.
- questionnaire filling только у `affiliate` и `advertiser`.
- `requireQuestionnaireCompletion` блокирует partner/advertiser business routes, если required fields не заполнены.
- `/auth/me` и `getAuthContext` возвращают `questionnaire.required/completed` для frontend redirect UX.

## Edge cases

- questionnaire not configured -> completion может считаться not required. TODO: уточнить точное поведение для отсутствующей active questionnaire;
- required answer missing -> field error / guard failure;
- invalid answer type -> validation error;
- duplicate answer row per user/role запрещён unique index, service делает update существующей строки;
- role mismatch -> `FORBIDDEN`/target role validation failure;
- unknown field in answers -> error `Неизвестное поле анкеты`.

## Known limitations

- Анкеты хранятся как JSON definitions, без отдельной нормализованной таблицы questions/options.
- Admin review workflow ответов не найден. TODO: домен review/moderation не реализован или требует уточнения.
- Заполнение анкеты влияет на доступ, но нет отдельного progress/partial-save state вне answer row.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/questionnaires.test.js` | schema, admin upsert/list, validation, self answers, guard behavior |
| `backend/tests/integration/auth-me.test.js` | presence of questionnaire state in auth context |
| `backend/tests/integration/advertiser-foundation.test.js` | advertiser profile flow with questionnaire domain nearby |

## Связанные разделы

- [Auth](./auth.md)
- [Users](./users.md)
- [Affiliates](./affiliates.md)
- [Advertisers](./advertisers.md)
