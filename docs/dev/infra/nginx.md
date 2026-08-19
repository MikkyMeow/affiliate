# Nginx

Статус: draft

## Назначение

Этот раздел описывает внутренний nginx-конфиг staging, который проксирует frontend, backend API, tracking, health и metrics.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `services/nginx/default.conf` | Реальный nginx config из репозитория |
| `docker-compose.yml` | Подключает `default.conf` в контейнер `nginx` |
| `scripts/deploy-staging.sh` | Перезапускает `nginx` и проверяет доступность upstream |

## Routing map

| Host / path | Upstream | Purpose |
|---|---|---|
| `http://staging.mikilead.ru/*` | redirect на HTTPS | Принудительный TLS |
| `https://staging.mikilead.ru/api` | `http://api:4000` | Backend API |
| `https://staging.mikilead.ru/track` | `http://api:4000` | Tracking click и postback endpoints |
| `https://staging.mikilead.ru/health` | `http://api:4000/health` | Basic health |
| `https://staging.mikilead.ru/ready` | `http://api:4000/ready` | Readiness check |
| `https://staging.mikilead.ru/metrics` | `http://api:4000/metrics` | Prometheus metrics |
| `https://staging.mikilead.ru/` | `http://web:4000` | Frontend |

## Important locations

| Location | Purpose | Notes |
|---|---|---|
| `location /api` | Проксирует REST API backend | Передаёт `Host`, `X-Real-IP`, `X-Forwarded-*` |
| `location /track` | Проксирует tracking и postback routes | Идёт в тот же backend upstream |
| `location /health` | Проксирует liveness endpoint | Используется deploy script |
| `location /ready` | Проксирует readiness endpoint | Проверяет PostgreSQL и, при необходимости, Redis |
| `location /metrics` | Открывает Prometheus metrics | Публичность зависит от внешнего контура доступа |
| `location /` | Проксирует frontend | Upstream `web:4000` конфликтует с compose/frontend runtime |

## Как это работает

В репозитории есть только внутренний nginx для compose/staging. Он обслуживает домен `staging.mikilead.ru`, слушает `80` и `443`, использует сертификаты Let's Encrypt из `/etc/letsencrypt/live/staging.mikilead.ru/`.

Конфиг не содержит отдельного SPA fallback вида `try_files ... /index.html`. Вместо этого корень просто проксируется в Next.js frontend, и fallback логика остаётся на стороне Next.js.

Tracking и postback идут через `location /track` в backend. Это соответствует `app.use('/track', trackingRouter)` в `backend/src/app.js`.

В `docker-compose.yml` указано, что этот nginx не должен публиковать host-порты, потому что внешние `80/443` принадлежат отдельному `infra-proxy`. Значит часть ingress-инфраструктуры живёт вне репозитория.

## Локальный запуск

Для этого раздела локальный запуск не применяется напрямую.

Если нужен просмотр текущего конфига внутри compose:

```bash
docker compose exec nginx cat /etc/nginx/conf.d/default.conf
```

## Staging / deploy

Staging deploy script делает:

```bash
docker compose -f docker-compose.yml restart nginx
```

После этого выполняются проверки из контейнера `nginx`:

```bash
docker compose -f docker-compose.yml exec -T nginx wget -q -O /dev/null http://api:4000/health
docker compose -f docker-compose.yml exec -T nginx wget -q -O /dev/null http://web:4000/
```

Также после recreate контейнеров перезагружается внешний `infra-proxy-nginx` через `docker exec infra-proxy-nginx nginx -s reload`.

TODO: уточнить конфиг внешнего `infra-proxy`, он отсутствует в текущем репозитории.

## Проверка работоспособности

```bash
curl -k -I https://staging.mikilead.ru/health
curl -k -I https://staging.mikilead.ru/ready
curl -k -I https://staging.mikilead.ru/metrics
```

Изнутри compose:

```bash
docker compose exec nginx wget -q -O - http://api:4000/health
```

Успешные признаки:

- `80` редиректит на `https://`;
- `/health` отдаёт `200`;
- `/ready` отдаёт `200`, когда PostgreSQL и Redis доступны;
- `/api/...` не отдаёт `404` на корректный backend route;
- `/track/click` отвечает backend-редиректом `302` на валидный запрос.

## Частые проблемы

| Проблема | Что проверить | Где смотреть |
|---|---|---|
| `502 Bad Gateway` | Живы ли `api` и `web`, совпадают ли порты upstream | `services/nginx/default.conf`, `docker compose logs nginx api web` |
| API отдаёт `404` | Используется ли правильный префикс `/api/v1`, а не только `/api` | `backend/src/app.js`, frontend API base |
| Frontend открывается, API нет | `NEXT_PUBLIC_API_BASE` и `location /api` | `.env`, `services/nginx/default.conf` |
| CORS ошибки | `APP_ORIGIN`, `CORS_ALLOWED_ORIGINS`, фактический host | `backend/src/app.js` |
| SSL certificate expired | Наличие cert в `/etc/letsencrypt/live/staging.mikilead.ru/` | host-сервер, `services/nginx/default.conf` |
| Tracking redirect не работает | `location /track`, backend `/track/click`, offer target/fallback URL | `services/nginx/default.conf`, `backend/src/routes/tracking.routes.js` |
| Postback не доходит до backend | Метод/URL `/track/postback`, proxy до `api:4000` | nginx logs, backend logs |

## Безопасность

- `/metrics` сейчас проксируется без ограничений в самом nginx-конфиге. Если endpoint не должен быть публичным, ограничение должно быть на внешнем ingress или network layer.
- TLS сертификаты монтируются с host-сервера и не хранятся в репозитории.
- Tracking и postback передают токены и сигнатуры; не логируйте их в открытом виде за пределами контролируемых журналов backend.

## Known limitations

- Конфиг внешнего `infra-proxy-nginx` отсутствует в репозитории. TODO: уточнить внешний routing layer.
- `location /` использует `proxy_pass http://web:4000`, но `frontend/Dockerfile` и compose указывают на runtime порт `3000`. TODO: уточнить актуальный upstream frontend.
- Отдельные access/error log path в `default.conf` не заданы, значит используется поведение nginx по умолчанию внутри контейнера.

## Связанные разделы

- [Deploy Staging](./deploy-staging.md)
- [Docker Compose](./docker-compose.md)
- [Tracking API](../api/tracking.md)
