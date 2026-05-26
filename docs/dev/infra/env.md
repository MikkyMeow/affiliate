# Environment Variables

Статус: draft

## Назначение

Этот раздел описывает реальные env-переменные проекта, которые используются backend, worker, frontend, PostgreSQL, Redis и staging deploy.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `.env.example` | Базовый пример env для локального запуска |
| `.env` | Локальный и compose runtime env, создаётся вручную из `.env.example` |
| `backend/src/config/load-env.js` | Автозагрузка `.env` или `.env.test` для backend и CLI-скриптов |
| `frontend/src/lib/env.ts` | Жёсткая проверка `NEXT_PUBLIC_*` переменных во frontend |
| `docker-compose.yml` | Передаёт `.env` в `api`, `worker`, `web` |
| `.github/workflows/deploy-staging.yml` | Использует GitHub Secrets для SSH-деплоя на staging |

## Как это работает

Backend и CLI-скрипты читают env через `backend/src/config/load-env.js`. При обычном запуске ожидается корневой `.env`, при тестах используется `.env.test`, если он задан.

Frontend использует только `NEXT_PUBLIC_API_BASE` и `NEXT_PUBLIC_TRACKING_BASE` через `frontend/src/lib/env.ts`. Если одна из них отсутствует, frontend падает на старте.

Docker Compose также читает корневой `.env` и пробрасывает его в контейнеры `api`, `worker`, `web`. При этом часть infra-настроек переопределяется прямо в `docker-compose.yml`, например `DB_HOST=postgres` и `REDIS_HOST=redis`.

`.env.example` покрывает не все переменные, которые реально встречаются в коде. Такие расхождения перечислены в `Known limitations`.

## Backend env

| Variable | Required | Example | Description | Secret |
|---|---|---|---|---|
| `PORT` | yes | `4000` | Порт backend HTTP-сервера | no |
| `JWT_SECRET` | yes | `change-me` | Секрет для access token и auth middleware | yes |
| `JWT_EXPIRES_IN` | no | `1h` | TTL access token | no |
| `REFRESH_TOKEN_TTL_DAYS` | no | `7` | Срок жизни refresh token в днях | no |
| `REFRESH_TOKEN_COOKIE_SECURE` | no | `true` | Флаг `Secure` для refresh cookie | no |
| `REFRESH_TOKEN_COOKIE_SAMESITE` | no | `lax` | SameSite для refresh cookie | no |
| `REFRESH_TOKEN_COOKIE_PATH` | no | `/` | Path для refresh cookie | no |
| `REFRESH_TOKEN_COOKIE_NAME` | no | `refresh_token` | Имя refresh cookie | no |
| `APP_ORIGIN` | yes | `http://localhost:3000` | Origin frontend для CORS и auth flow | no |
| `CORS_ALLOWED_ORIGINS` | no | `http://localhost:3000,http://127.0.0.1:3000` | Явный список origin для CORS | no |
| `FRONTEND_URL` | no | `http://localhost:3000` | Альтернативный источник origin для CORS | no |
| `EMAIL_VERIFY_URL_BASE` | no | `http://localhost:3000/auth/verify-email` | Base URL для email verify ссылок | no |
| `PASSWORD_RESET_URL_BASE` | no | `http://localhost:3000/auth/reset-password` | Base URL для reset password ссылок | no |
| `MAIL_ENABLED` | no | `false` | Включает отправку писем | no |
| `MAIL_FROM` | no | `"MikiLead <noreply@example.test>"` | From для auth email | no |
| `MAIL_SMTP_HOST` | no | `smtp.example.test` | SMTP host | no |
| `MAIL_SMTP_PORT` | no | `465` | SMTP port | no |
| `MAIL_SMTP_SECURE` | no | `true` | SMTP TLS flag | no |
| `MAIL_SMTP_USER` | no | `mailer@example.test` | SMTP user | yes |
| `MAIL_SMTP_PASSWORD` | no | `safe-password` | SMTP password | yes |
| `EMAIL_VERIFY_TOKEN_TTL_HOURS` | no | `24` | TTL verify token | no |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | no | `60` | TTL password reset token | no |
| `TRACKING_INTERNAL_FALLBACK_URL` | no | `/track/unavailable` | Внутренний fallback для tracking redirect | no |
| `TZ` | no | `UTC` | Таймзона процесса по умолчанию | no |
| `ENV_FILE` | no | `.env.staging` | Явное имя env-файла для backend loader | no |
| `NODE_ENV` | no | `production` | Режим процесса | no |

## Frontend env

| Variable | Required | Example | Description | Public |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE` | yes | `http://localhost:4000/api/v1` | Base URL для frontend API client | yes |
| `NEXT_PUBLIC_TRACKING_BASE` | yes | `http://localhost:4000/track` | Base URL для генерации tracking links | yes |

## Infra env

| Variable | Required | Example | Description |
|---|---|---|---|
| `DB_HOST` | yes | `localhost` | Хост PostgreSQL для backend/CLI |
| `DB_PORT` | yes | `55432` | Порт PostgreSQL на host машине |
| `DB_NAME` | yes | `affiliate` | Имя БД |
| `DB_USER` | yes | `affiliate` | Пользователь БД |
| `DB_PASSWORD` | yes | `affiliate` | Пароль БД |
| `DATABASE_URL` | no | `postgres://affiliate:affiliate@localhost:55432/affiliate` | Альтернативная строка подключения, имеет приоритет над `DB_*` |
| `DB_SSL` | no | `true` | Включает SSL для `pg` и `node-pg-migrate` |
| `REDIS_HOST` | yes | `127.0.0.1` | Хост Redis |
| `REDIS_PORT` | yes | `56379` | Порт Redis на host машине |
| `REDIS_URL` | no | `redis://127.0.0.1:56379` | Альтернативная строка подключения Redis |
| `REDIS_DB` | no | `0` | Redis DB index |
| `REDIS_USERNAME` | no | `default` | Redis username |
| `REDIS_PASSWORD` | no | `safe-password` | Redis password |
| `REDIS_REQUIRED` | no | `true` | Если `true`, `/ready` требует рабочий Redis |
| `QUEUE_NAME` | no | `postback-events` | Имя BullMQ queue |
| `ASYNC_JOBS_QUEUE` | no | `postback-events` | Альтернативное имя queue, имеет приоритет |
| `ASYNC_WORKER_CONCURRENCY` | no | `5` | Concurrency worker процесса |
| `ASYNC_JOB_ATTEMPTS` | no | `3` | Количество retry BullMQ job |
| `ASYNC_JOB_BACKOFF_DELAY_MS` | no | `1000` | Базовая задержка exponential backoff |
| `ASYNC_JOB_HISTORY` | no | `1000` | Сколько completed jobs хранить |
| `ASYNC_JOB_REMOVE_ON_FAIL` | no | `200` | Сколько failed jobs хранить |
| `BULLMQ_PREFIX` | no | `affiliate` | Redis key prefix для BullMQ |
| `QUEUE_DISABLED` | no | `true` | Полностью отключает enqueue в backend |
| `RATE_LIMIT_DISABLED` | no | `true` | Отключает rate limiter, используется в тестах |
| `TEST_DB_ADMIN_DB` | no | `postgres` | Админская БД для test bootstrap |

## Локальный запуск

```bash
cp .env.example .env
```

Проверить минимальный набор для локальной среды:

```bash
grep -E '^(PORT|DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|REDIS_HOST|REDIS_PORT|JWT_SECRET|APP_ORIGIN|NEXT_PUBLIC_API_BASE|NEXT_PUBLIC_TRACKING_BASE)=' .env
```

Для backend и worker удобно использовать один общий `.env` в корне репозитория.

## Staging / deploy

На staging реальные секреты не лежат в репозитории. GitHub Actions использует только SSH secrets:

- `STAGING_SSH_KEY`
- `STAGING_HOST`
- `STAGING_PORT`
- `STAGING_USER`

Сам deploy script `scripts/deploy-staging.sh` ожидает, что на сервере уже существует файл `.env` в `/home/deploy/affiliate/.env`.

TODO: уточнить полный состав staging `.env`, так как он не хранится в репозитории.

## Проверка работоспособности

```bash
test -f .env
```

```bash
cd backend && npm run dev
```

Успешные признаки:

- backend не падает с ошибкой `JWT_SECRET is required`;
- frontend не падает с ошибкой `Missing NEXT_PUBLIC_API_BASE`;
- `GET http://localhost:4000/health` возвращает `{"status":"ok"}`;
- `GET http://localhost:4000/ready` возвращает `{"status":"ready"}` при доступных PostgreSQL и Redis.

## Частые проблемы

| Проблема | Что проверить | Где смотреть |
|---|---|---|
| Backend падает на старте | Есть ли `JWT_SECRET`, `DB_*` или `DATABASE_URL` | `.env`, `backend/src/routes/auth.js`, `backend/src/db.js` |
| Frontend не стартует | Есть ли `NEXT_PUBLIC_API_BASE` и `NEXT_PUBLIC_TRACKING_BASE` | `.env`, `frontend/src/lib/env.ts` |
| `/ready` отвечает `503` | Доступны ли PostgreSQL и Redis, не выставлен ли `REDIS_REQUIRED=true` без Redis | `backend/src/app.js`, `backend/src/lib/redis.js`, `backend/src/db.js` |
| Postback validation падает | Передаются ли `token`, `clickId`, `goalId`, `signature` | `backend/src/validators/postback.js` |
| Rate limit мешает локальной отладке | Нужен ли `RATE_LIMIT_DISABLED=true` | `backend/src/middleware/rateLimit.js` |
| Очередь не работает в тестах | Не выставлен ли `QUEUE_DISABLED=true` | `backend/src/lib/queue.js`, `backend/tests/setup/test-env.js` |

## Безопасность

- Нельзя коммитить `.env`, staging secrets, `JWT_SECRET`, SMTP credentials, `DB_PASSWORD`, `REDIS_PASSWORD`.
- Все `NEXT_PUBLIC_*` переменные публичные по определению и попадают во frontend bundle.
- `JWT_SECRET`, `MAIL_SMTP_PASSWORD`, `DB_PASSWORD`, `REDIS_PASSWORD`, `STAGING_SSH_KEY` должны храниться только вне репозитория.
- Для staging/prod нельзя использовать значения вроде `change-me`.
- Если используется `DATABASE_URL`, в неё попадает пароль БД, поэтому её тоже нельзя коммитить.

## Known limitations

- `.env.example` не содержит `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, `TRACKING_INTERNAL_FALLBACK_URL`, `TZ`, `ENV_FILE`, `REDIS_URL`, `REDIS_DB`, `QUEUE_DISABLED`, `RATE_LIMIT_DISABLED`, `TEST_DB_ADMIN_DB`.
- `README.md` ссылается на `GET /api/v1/health`, но реальный health endpoint в `backend/src/app.js` объявлен как `/health`.
- Состав staging `.env` в репозитории не документирован. TODO: уточнить реальные значения и обязательные ключи на сервере.

## Связанные разделы

- [Docker Compose](./docker-compose.md)
- [Deploy Staging](./deploy-staging.md)
- [Backend Architecture](../architecture/03-backend.md)
- [Frontend Architecture](../architecture/02-frontend.md)
