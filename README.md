# affilate monorepo

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
2. **Поднять PostgreSQL**
   ```bash
   docker compose up -d postgres
   ```
3. **Настроить переменные окружения**
   ```bash
   cp backend/.env.example backend/.env
   # при необходимости скорректируй креды/порт
   cp frontend/.env.local.example frontend/.env.local
   ```

## Запуск сервисов

1. **Backend**
   ```bash
   cd backend
   npm run dev
   ```
   Сервер стартует на `http://localhost:4000`. Проверка БД: `GET http://localhost:4000/api/health`.

2. **Frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   Next.js доступен на `http://localhost:3000` и выводит сообщение из маршрута `/api/message`.

## Остановка

```bash
docker compose down
```

## Следующие шаги

- Добавить миграции/ORM для управления схемой БД.
- Реализовать авторизацию (register/login) и защищённые маршруты на фронте и бэке.
