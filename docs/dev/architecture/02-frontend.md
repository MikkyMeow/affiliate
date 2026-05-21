# Frontend architecture

Статус: draft

## Назначение

Этот документ объясняет, как устроен frontend проекта: где лежат страницы и общие компоненты, как frontend вызывает backend API, где хранится auth/session state и как реализованы role-based redirects для разных кабинетов.

## Технологии

Подтверждённые технологии по `frontend/package.json` и коду:

- Next.js 16.1.6
- React 19.2.3
- TypeScript
- App Router (`frontend/src/app`)
- Tailwind CSS 4
- `recharts` для графиков

Наблюдения по стеку:

- глобальный state management вроде Redux в runtime-коде frontend не используется;
- forms library вроде React Hook Form не подтверждена;
- frontend-валидация в основном ручная, через component state и backend errors;
- charts library подтверждена только как `recharts`.

## Где лежит frontend

| Путь | Назначение |
|---|---|
| `frontend/` | Отдельный workspace frontend |
| `frontend/src/app` | App Router страницы, layout'ы и role sections |
| `frontend/src/app/layout.tsx` | Корневой layout приложения |
| `frontend/src/app/providers.tsx` | Подключение `AuthProvider` и `ToastProvider` |
| `frontend/src/components` | Общие компоненты интерфейса |
| `frontend/src/components/questionnaires` | UI для questionnaire pages |
| `frontend/src/components/toast` | Toast notifications |
| `frontend/src/context` | Auth/session state |
| `frontend/src/hooks` | UI hooks |
| `frontend/src/lib` | API-клиенты, env helpers, role helpers, domain helpers |
| `frontend/public` | Static assets |

## Основная структура frontend

```txt
app pages
  -> page/layout components
  -> shared/components
  -> lib/api clients
  -> auth context
```

Реальный flow:

- route определяется файловой структурой `frontend/src/app`;
- страницы используют компоненты из `frontend/src/components`;
- запросы к backend идут через `apiFetch` и domain helpers из `frontend/src/lib`;
- токен, user и questionnaire state живут в `frontend/src/context/AuthContext.tsx`;
- доступ к кабинетам ограничивается layout'ами секций и role redirects.

## Pages / routes

Ниже перечислены подтверждённые разделы frontend.

| Раздел | Frontend path | Комментарий |
|---|---|---|
| Landing | `frontend/src/app/page.tsx` | Публичная главная страница |
| Root layout | `frontend/src/app/layout.tsx` | Общий layout для всего frontend |
| Login | `frontend/src/app/auth/login/page.tsx` | Вход |
| Register | `frontend/src/app/auth/register/page.tsx` | Регистрация |
| Admin dashboard | `frontend/src/app/dashboard/page.tsx` | Главная страница admin/manager кабинета |
| Admin layout | `frontend/src/app/dashboard/layout.tsx` | Guard для admin/manager area |
| Admin advertisers | `frontend/src/app/dashboard/advertisers/page.tsx` | Список рекламодателей |
| Admin advertisers create | `frontend/src/app/dashboard/advertisers/create/page.tsx` | Создание рекламодателя |
| Admin affiliates | `frontend/src/app/dashboard/affiliates/page.tsx` | Список партнёров |
| Admin affiliates create | `frontend/src/app/dashboard/affiliates/create/page.tsx` | Создание партнёра |
| Admin offers | `frontend/src/app/dashboard/offers/page.tsx` | Список офферов |
| Admin offers create | `frontend/src/app/dashboard/offers/create/page.tsx` | Создание оффера |
| Admin clicks | `frontend/src/app/dashboard/clicks/page.tsx` | Просмотр кликов/транзакций |
| Admin conversions | `frontend/src/app/dashboard/conversions/page.tsx` | Просмотр конверсий |
| Admin adjustments | `frontend/src/app/dashboard/adjustments/page.tsx` | Ручные корректировки |
| Admin audit logs | `frontend/src/app/dashboard/audit-logs/page.tsx` | Логи аудита |
| Admin managers | `frontend/src/app/dashboard/managers/page.tsx` | Управление менеджерами |
| Admin questionnaires | `frontend/src/app/dashboard/questionnaires/page.tsx` | Управление анкетами |
| Admin profile | `frontend/src/app/dashboard/profile/page.tsx` | Профиль пользователя admin/manager |
| Partner home | `frontend/src/app/partner/page.tsx` | Кабинет партнёра, список офферов/обзор |
| Partner layout | `frontend/src/app/partner/layout.tsx` | Guard для affiliate role |
| Partner offers details | `frontend/src/app/partner/offers/[offerId]/page.tsx` | Страница конкретного оффера |
| Partner clicks | `frontend/src/app/partner/clicks/page.tsx` | Клики |
| Partner conversions | `frontend/src/app/partner/conversions/page.tsx` | Конверсии |
| Partner stats | `frontend/src/app/partner/stats/page.tsx` | Статистика |
| Partner profile | `frontend/src/app/partner/profile/page.tsx` | Профиль |
| Partner questionnaire | `frontend/src/app/partner/questionnaire/page.tsx` | Анкета |
| Advertiser home | `frontend/src/app/advertiser/page.tsx` | Обзор advertiser кабинета |
| Advertiser layout | `frontend/src/app/advertiser/layout.tsx` | Guard для advertiser role |
| Advertiser offers | `frontend/src/app/advertiser/offers/page.tsx` | Список офферов |
| Advertiser offer details | `frontend/src/app/advertiser/offers/[offerId]/page.tsx` | Карточка оффера |
| Advertiser stats | `frontend/src/app/advertiser/stats/page.tsx` | Статистика |
| Advertiser postbacks | `frontend/src/app/advertiser/postbacks/page.tsx` | Список postback logs |
| Advertiser postback details | `frontend/src/app/advertiser/postbacks/[postbackId]/page.tsx` | Детали postback log |
| Advertiser finance | `frontend/src/app/advertiser/finance/page.tsx` | Финансовые данные |
| Advertiser profile | `frontend/src/app/advertiser/profile/page.tsx` | Профиль |
| Advertiser questionnaire | `frontend/src/app/advertiser/questionnaire/page.tsx` | Анкета |

`manager` не имеет отдельного frontend route tree. По текущей реализации manager использует тот же `/dashboard`, что и admin, но с урезанным меню и access rules.

## Components

Подтверждённые общие компоненты:

- `frontend/src/components/AppNavbar.tsx`
  Главная навигация, role-based links, logout, theme toggle, mobile menu.

- `frontend/src/components/AppShell.tsx`
  Общий shell, который добавляет отступы под fixed sidebar в кабинетах.

- `frontend/src/components/AuthStatus.tsx`
  TODO: уточнить конкретную роль в текущем UI.

- `frontend/src/components/AuditLogTable.tsx`
  Таблица аудита.

- `frontend/src/components/AuditLogsModal.tsx`
  Модальное окно для просмотра audit logs.

- `frontend/src/components/DateInput.tsx`
  Общий date input.

- `frontend/src/components/InlineAlert.tsx`
  Показ inline ошибок/предупреждений.

- `frontend/src/components/BackendMessage.tsx`
  TODO: уточнить, где именно используется.

- `frontend/src/components/questionnaires/UserQuestionnairePage.tsx`
  Role-specific questionnaire UI.

- `frontend/src/components/toast/ToastProvider.tsx`
  Глобальные toast notifications.

Текущая структура не разделяет компоненты по отдельным каталогам `tables/`, `forms/`, `charts/`, `badges/`. Эти роли в основном реализованы внутри page-level компонентов и нескольких shared components.

Layout/sidebar/header:

- sidebar и верхняя навигация реализованы в `AppNavbar.tsx`;
- page shell и cabinet spacing находятся в `AppShell.tsx`;
- section guards реализованы не в navbar, а в `dashboard/layout.tsx`, `partner/layout.tsx`, `advertiser/layout.tsx`.

## API clients

Основная точка вызова backend:

- `frontend/src/lib/api.ts`

Что делает `api.ts`:

- собирает URL через `NEXT_PUBLIC_API_BASE`;
- добавляет `Content-Type: application/json`;
- добавляет `Authorization: Bearer ...`, если передан token;
- умеет возвращать либо `data`, либо `{ data, meta }`;
- преобразует backend envelope в `ApiError` с `status`, `code`, `details`.

Базовые env:

- `NEXT_PUBLIC_API_BASE`
- `NEXT_PUBLIC_TRACKING_BASE`

Они проверяются в `frontend/src/lib/env.ts`, и при отсутствии frontend падает на старте.

Domain-specific API helpers подтверждены в:

- `frontend/src/lib/advertiser.api.ts`
- `frontend/src/lib/offers.ts`
- `frontend/src/lib/partner.ts`
- `frontend/src/lib/partnerOffers.ts`
- `frontend/src/lib/stats.ts`
- `frontend/src/lib/adjustments.ts`
- `frontend/src/lib/admin-stats.ts`
- `frontend/src/lib/admin-lists.ts`
- `frontend/src/lib/audit-logs.ts`
- `frontend/src/lib/questionnaires.ts`
- `frontend/src/lib/tracking.ts`

Обработка ошибок:

- backend message и code приходят через `ApiError`;
- компонент или hook выше решает, как показать ошибку;
- единый визуальный error boundary для app routes в текущей структуре не подтверждён.

## Auth context / session

Основной auth state находится в `frontend/src/context/AuthContext.tsx`.

Что хранится в context:

- `user`
- `profile`
- `questionnaire`
- `accessToken`
- `loading`

Как работает session:

- access token хранится в `localStorage` под ключом `affiliate_access_token`;
- refresh token хранится в cookie и используется через `/auth/refresh`;
- при старте frontend пытается сначала использовать stored access token, потом fallback на refresh;
- профиль и questionnaire подгружаются через `/auth/me`.

Как определяется роль:

- по полю `user.role` из backend auth context;
- подтверждённые роли: `admin`, `manager`, `affiliate`, `advertiser`.

Как работает logout:

- `logout()` из `AuthContext` вызывает backend logout, очищает local token и local state;
- UI entry point для logout находится в `AppNavbar.tsx`.

Как защищаются страницы:

- `dashboard/layout.tsx` проверяет наличие `user` и `accessToken`, затем `canAccessAdminArea(user)`;
- `partner/layout.tsx` допускает только `affiliate`;
- `advertiser/layout.tsx` допускает только `advertiser`;
- при незавершённой анкете layout перенаправляет на questionnaire page.

Redirect по роли:

- helper `frontend/src/lib/auth/routes.ts` сопоставляет роль и home path;
- redirect на root `/` также инициируется из `AppNavbar.tsx`.

## Role-based UI

Role-based UI реализован в первую очередь в `frontend/src/components/AppNavbar.tsx`.

Подтверждённые наборы ссылок:

- admin/manager: `/dashboard`, клики, конверсии, корректировки, рекламодатели, партнёры, офферы, логи;
- admin дополнительно видит `Анкеты` и `Менеджеры`;
- affiliate: офферы, статистика, клики, конверсии, профиль;
- advertiser: обзор, офферы, статистика, postbacks, финансы, профиль.

Если questionnaire не завершён:

- affiliate и advertiser получают урезанное меню;
- им оставляют только questionnaire и profile routes;
- остальные разделы layout не пускает.

## Forms and validation

По текущей структуре формы разбросаны по page components, а не выделены в отдельный form layer.

Подтверждено:

- часть форм использует ручной `fetch`/state flow через `apiFetch`;
- ошибки backend приходят в `ApiError.details`;
- для UI ошибок используются inline alerts и toast notifications.

Не подтверждено:

- единая frontend schema validation library;
- отдельный каталог reusable form controls;
- client-side validation rules, полностью совпадающие с backend.

Поэтому для большинства форм безопасно считать backend source of truth, а frontend-валидацию рассматривать как UX-слой.

## Tables and filters

Табличные представления точно есть в admin audit logs и в кабинетных списках кликов, конверсий, офферов и postbacks.

Подтверждённые признаки фильтрации и pagination:

- query helpers есть в `frontend/src/lib/stats.ts`, `audit-logs.ts`, `admin-lists.ts`, `advertiser.api.ts`;
- advertiser postbacks backend поддерживает `page`, `pageSize`, `status`, `dateFrom`, `dateTo`, `offerId`;
- admin stats backend поддерживает date range и entity filters.

UI-реализация всех таблиц и фильтров в одном месте не централизована. `DataGrid`-подобный shared component по структуре не найден.

## Charts and dashboard

`recharts` подтверждён как dependency, а stats helpers есть в:

- `frontend/src/lib/stats.ts`
- `frontend/src/lib/admin-stats.ts`
- `frontend/src/lib/dashboard.ts`

Это говорит о наличии dashboard/statistics визуализации, но единый каталог chart components в `frontend/src/components` не найден.

Что точно можно утверждать:

- данные для графиков и summary загружаются из backend stats endpoints;
- admin/partner/advertiser имеют отдельные stats pages;
- агрегаты опираются на `daily_stats`, а не напрямую на raw clicks/conversions в UI.

TODO: уточнить конкретные chart components и наборы графиков по страницам после отдельного walkthrough stats pages.

## Как добавить новую страницу

1. Найти нужный route section в `frontend/src/app`: `dashboard`, `partner`, `advertiser` или `auth`.
2. Создать новый `page.tsx` в нужном каталоге.
3. При необходимости вынести UI в shared component в `frontend/src/components` или в page-local component рядом со страницей.
4. Если странице нужны данные, добавить или расширить helper в `frontend/src/lib`.
5. Если страница должна появиться в меню, обновить набор ссылок в `frontend/src/components/AppNavbar.tsx`.
6. Если нужен role guard, использовать существующий section layout или добавить проверку по аналогии с `dashboard/layout.tsx`, `partner/layout.tsx`, `advertiser/layout.tsx`.
7. Проверить loading, empty и error states.

## Как добавить новый frontend API call

1. Найти подходящий API client layer в `frontend/src/lib`.
2. Добавить типы запроса/ответа рядом с этой функцией.
3. Добавить вызов через `apiFetch(...)`.
4. Преобразовать backend response в удобный frontend shape, если это уже принято в файле.
5. Обработать `ApiError` в компоненте или hook.
6. Использовать новый helper в page/component.

## Known frontend TODO

- TODO: уточнить, какие страницы используют `recharts` и какие метрики рисуют графиками.
- TODO: уточнить, где именно используется `BackendMessage.tsx`.
- TODO: уточнить, есть ли shared page-specific components вне `frontend/src/components`.
- TODO: уточнить, есть ли в проекте отдельные loading/error route files для app router помимо layout guards.
