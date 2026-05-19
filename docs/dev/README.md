# Dev-документация

Статус: draft

## Назначение

Здесь будет собрана внутренняя документация для разработчиков: архитектура, домены, потоки данных, API, инфраструктура, тестирование и эксплуатационные инструкции.

## Основные разделы

### Architecture

- [01. Overview](./architecture/01-overview.md)
- [02. Frontend](./architecture/02-frontend.md)
- [03. Backend](./architecture/03-backend.md)
- [04. Database](./architecture/04-database.md)
- [05. Auth and Roles](./architecture/05-auth-and-roles.md)
- [06. API Response Format](./architecture/06-api-response-format.md)
- [07. Error Handling](./architecture/07-error-handling.md)
- [08. Validation](./architecture/08-validation.md)
- [09. Audit Events](./architecture/09-audit-events.md)

### Domains

- [Auth](./domains/auth.md)
- [Users](./domains/users.md)
- [Affiliates](./domains/affiliates.md)
- [Advertisers](./domains/advertisers.md)
- [Managers](./domains/managers.md)
- [Offers](./domains/offers.md)
- [Offer Goals](./domains/offer-goals.md)
- [Offer Access](./domains/offer-access.md)
- [Geo Targeting](./domains/geo-targeting.md)
- [Tracking Clicks](./domains/tracking-clicks.md)
- [Postbacks and Conversions](./domains/postbacks-conversions.md)
- [Adjustments](./domains/adjustments.md)
- [Stats](./domains/stats.md)
- [Questionnaires](./domains/questionnaires.md)
- [Finance](./domains/finance.md)

### Data flow

- [Click Flow](./data-flow/click-flow.md)
- [Postback Flow](./data-flow/postback-flow.md)
- [Conversion Flow](./data-flow/conversion-flow.md)
- [Stats Rollup Flow](./data-flow/stats-rollup-flow.md)
- [Manual Adjustment Flow](./data-flow/manual-adjustment-flow.md)
- [Registration Flow](./data-flow/registration-flow.md)

### API

- [Auth](./api/auth.md)
- [Admin](./api/admin.md)
- [Partner](./api/partner.md)
- [Advertiser](./api/advertiser.md)
- [Tracking](./api/tracking.md)

### Infra

- [Environment Variables](./infra/env.md)
- [Docker Compose](./infra/docker-compose.md)
- [Nginx](./infra/nginx.md)
- [Database Migrations](./infra/database-migrations.md)
- [Redis](./infra/redis.md)
- [Queues](./infra/queues.md)
- [Metrics](./infra/metrics.md)
- [Deploy Staging](./infra/deploy-staging.md)

### Testing

- [Test Strategy](./testing/test-strategy.md)
- [Integration Tests](./testing/integration-tests.md)
- [E2E Tests](./testing/e2e-tests.md)
- [Seed Data](./testing/seed-data.md)

### Maintenance

- [How to Add Role](./maintenance/how-to-add-role.md)
- [How to Add Page](./maintenance/how-to-add-page.md)
- [How to Add API Route](./maintenance/how-to-add-api-route.md)
- [How to Add Migration](./maintenance/how-to-add-migration.md)
- [How to Debug Tracking](./maintenance/how-to-debug-tracking.md)
- [How to Debug Postbacks](./maintenance/how-to-debug-postbacks.md)

## Правила ведения dev-документации

- Описывать не только что делает код, но и зачем.
- Указывать frontend files, backend routes, services, models, database tables и tests.
- Для сложных процессов обязательно описывать data flow.
- Если информация ещё не проверена по коду, помечать её как TODO.
- Не писать догадки как факты.
