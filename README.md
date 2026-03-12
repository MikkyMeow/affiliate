# affiliate monorepo

Монорепа с Node/Express backend и Next.js frontend. Бэкенд работает с PostgreSQL (локально поднимается в Docker)

## Требования

- Docker + Docker Compose
- Node.js 20+ и npm

## Подготовка окружения

1. **Установить зависимости**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
2. **Поднять PostgreSQL и Redis**
   ```bash
   docker compose up -d postgres redis
   ```
3. **Настроить переменные окружения**
   ```bash
   cp .env.example .env
   ```
   Отредактируй `.env`: блоки `DB_*`, Redis и JWT используются backend/воркером,
   а `NEXT_PUBLIC_*` нужны Next.js (client-side). Backend, CLI-скрипты и фронтенд
   автоматически загружают один и тот же файл из корня репозитория.

## Запуск сервисов

1. **Backend**
   ```bash
   cd backend
   npm run dev
   ```
   Сервер стартует на `http://localhost:4000`. Проверка БД: `GET http://localhost:4000/api/v1/health`.
   При запуске backend автоматически применяет все новые миграции БД через `node-pg-migrate`.

2. **Async worker**
   ```bash
   npm run worker --workspace backend
   ```
   Воркер слушает очередь BullMQ в Redis и выполняет любые тяжёлые задачи вне HTTP-запросов. Запускай его в отдельном терминале, чтобы фоновые задания обрабатывались параллельно с HTTP-сервером.

3. **Frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   Next.js доступен на `http://localhost:3000`. Главная страница показывает сообщение с backend и статус авторизации, страницы `/auth/login` и `/auth/register` позволяют войти в систему.

## Остановка

```bash
docker compose down
```

## Миграции БД

Backend использует `node-pg-migrate` и хранит миграции в `backend/migrations`. Для ручного управления схемой используй npm workspaces:

- Применить все новые миграции:  
  `npm run migrate:up --workspace backend`
- Откатить последнюю миграцию:  
  `npm run migrate:down --workspace backend -- 1`
- Создать новую миграцию:  
  `npm run migrate:create --workspace backend -- add_new_table`

CLI подхватывает параметры подключения из `.env` (или использует `DATABASE_URL`).
При необходимости укажи `NODE_ENV=production`, чтобы загружать боевые креды.
После создания миграции не забудь заполнить `up`/`down` функции в файле.

## Следующие шаги

- Подключить миграции/ORM для управления схемой БД и будущими ролями.
- Реализовать refresh-токены/сессии и серверную защиту приватных страниц (middleware/layout).
