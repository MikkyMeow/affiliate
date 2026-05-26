# How to Add Page

Статус: draft

## Назначение

Инструкция помогает добавить новую frontend-страницу в существующий Next.js app router проект.

## Когда использовать

- нужна новая страница в `/dashboard`, `/partner` или `/advertiser`;
- появляется новый CRUD/list/detail screen;
- нужно подключить новый backend endpoint на UI.

## Перед началом

- Определить кабинет: admin/manager, affiliate или advertiser.
- Найти подходящий route group в `frontend/src/app/`.
- Проверить существующие layout guard'ы и navigation.
- Проверить, есть ли уже API client в `frontend/src/lib/`.

## Шаги

1. Найти нужный route group.
   Доступные группы подтверждены в `frontend/src/app/dashboard`, `frontend/src/app/partner`, `frontend/src/app/advertiser`.
2. Создать `page.tsx` в нужной папке.
   По аналогии с существующими страницами в этой же группе.
3. Если нужен nested detail route, создать папку `[id]` или `[entityId]`.
4. Подключить layout guard группы.
   Для `dashboard` guard уже в `frontend/src/app/dashboard/layout.tsx`, для `partner` и `advertiser` аналогично.
5. Добавить navigation item.
   Обновить `frontend/src/components/AppNavbar.tsx`.
6. Подключить API client call.
   Использовать `frontend/src/lib/api.ts` и специализированные клиенты из `frontend/src/lib/*.ts`, либо создать новый.
7. Добавить loading/error/empty states.
   В проекте это обычно делается локальным `useState` и условным рендерингом в странице.
8. Проверить permissions.
   Если route доступен только одной роли, убедиться, что страница расположена в правильной route group.
9. Проверить responsive layout.
   Кабинеты используют sidebar и мобильное меню из `AppNavbar`.
10. Если применимо, добавить тест.
11. Обновить docs.

## Что изменить

| Слой | Где менять | Что менять |
|---|---|---|
| App Router | `frontend/src/app/**/page.tsx` | Новая страница |
| Layout/guard | `frontend/src/app/dashboard/layout.tsx`, `frontend/src/app/partner/layout.tsx`, `frontend/src/app/advertiser/layout.tsx` | Если нужна новая зона доступа |
| Navigation | `frontend/src/components/AppNavbar.tsx` | Sidebar/top nav item |
| API client | `frontend/src/lib/*.ts` | Fetch wrapper под новый endpoint |
| Auth/roles | `frontend/src/lib/auth/roles.ts`, `frontend/src/lib/auth/routes.ts` | Если меняется маршрут по роли |

## Проверка

```bash
cd frontend && npm run dev
```

Ручные проверки:

- страница открывается по ожидаемому URL;
- ссылка появилась в navigation;
- loading state виден при медленном запросе;
- empty state виден на пустых данных;
- error state не ломает layout;
- чужая роль не может попасть в раздел через URL.

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| Страница доступна не той роли | Создана не в той route group или нет redirect guard | Перенести page и проверить layout |
| Нет empty state | Рендер рассчитан только на non-empty данные | Добавить отдельную ветку UI |
| Ошибки API не отображаются | Нет `try/catch` и user-facing сообщения | Использовать обработку через `ApiError` |
| Нет sync фильтров с URL | Не используется `useSearchParams` / `useRouter` | Повторить паттерн list pages в `dashboard/*/page.tsx` |
| Route не добавлен в navigation | Изменена только page | Обновить `AppNavbar.tsx` |

## Definition of Done

- [ ] Создан `page.tsx` в нужной route group
- [ ] Страница доступна только нужной роли
- [ ] Navigation обновлена
- [ ] API client подключён
- [ ] Есть loading/error/empty states
- [ ] Проверена мобильная вёрстка
- [ ] Обновлена документация

## Связанные разделы

- [Frontend Architecture](../architecture/02-frontend.md)
- [How to Add API Route](./how-to-add-api-route.md)
