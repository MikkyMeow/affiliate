# Access Control Overview

This document reflects the current implemented behavior.

## Roles

- `admin` can access the internal dashboard and all operational data.
- `manager` can access the internal dashboard and operational entities, but cannot manage managers or registration questionnaires.
- `affiliate` uses the partner cabinet and partner-safe APIs only.
- `advertiser` uses the advertiser cabinet and advertiser-safe APIs only.

## Authentication

| Endpoint | Allowed actors | Notes |
| --- | --- | --- |
| `POST /api/v1/auth/register` | Public | `accountType` must be `affiliate` or `advertiser`. Managers are not self-registered. |
| `POST /api/v1/auth/login` | Public | Returns JWT auth package for all existing roles. |
| `GET /api/v1/auth/me` | Authenticated | Returns `user`, role-specific `profile`, and questionnaire completion status. |
| `POST /api/v1/auth/change-password` | Authenticated | Available for all authenticated roles through the common auth flow. |

## Admin Area

Internal dashboard access is allowed for `admin` and `manager`.

- Shared admin-area routes use `authorizeAdminArea`.
- Frontend navigation for managers hides `Анкеты` and `Менеджеры`.
- Managers still see dashboard, clicks, conversions, adjustments, advertisers, partners, offers, and audit logs.

Important route groups:

- `GET|POST|PATCH /api/v1/advertisers/**`
- `GET|POST|PATCH /api/v1/affiliates/**`
- `GET|POST|PATCH /api/v1/offers/**`
- `GET /api/v1/clicks`
- `GET|PATCH|POST /api/v1/conversions/**`
- `GET|POST /api/v1/admin/stats/**`
- `GET|POST /api/v1/admin/offers/**`
- `GET|POST /api/v1/admin/adjustments/**`
- `GET /api/v1/admin/audit-logs/**`

## Admin-Only Operations

The following write scopes are restricted to `admin` only:

- manager management via `/api/v1/admin/managers`:
  list, create, update, reset password, delete
- questionnaire management via `/api/v1/admin/questionnaires`
- advertiser creation via `POST /api/v1/advertisers`
- advertiser password reset via `POST /api/v1/advertisers/:id/reset-password`

Managers can still use:

- `GET /api/v1/admin/managers/lookup`
- manager assignment endpoints for partners and advertisers
- offer availability/access/hide operations
- goals and partner-specific goal rates
- adjustments preview/apply
- conversion status changes
- stats recalculation
- audit-log read endpoints

## Partner Cabinet

Partner routes require `role=affiliate`.

- `/api/v1/partner/profile` and `PATCH /api/v1/partner/profile` remain available before questionnaire completion.
- `/api/v1/me/questionnaire` and `PUT /api/v1/me/questionnaire/answers` remain available before questionnaire completion.
- Reporting and offer routes under `/api/v1/partner/**` are gated after profile access by questionnaire completion middleware.
- Logout is not blocked by questionnaire gating.

Partner visibility and privacy rules:

- Partners never access admin pages or admin APIs.
- Partners never access audit logs.
- Partners never receive advertiser information in partner offer responses.
- Partners never receive admin-only notes, postback token, revenue, or profit.
- On `on_request` offers without access, partners get a restricted description-only view and can request access.
- `private` offers are hidden until access is granted.
- Hidden-partner override has the highest priority and hides the offer even if it is public or manually granted.

## Advertiser Cabinet

Advertiser routes require `role=advertiser`.

- Advertisers can self-register through auth registration.
- Admins can also create advertisers and reveal a temporary password once.
- `/api/v1/advertiser/profile` and `PATCH /api/v1/advertiser/profile` remain available before questionnaire completion.
- `/api/v1/me/questionnaire` and `PUT /api/v1/me/questionnaire/answers` remain available before questionnaire completion.
- Offer, stats, postback-log, and finance routes under `/api/v1/advertiser/**` require questionnaire completion.

Advertiser privacy rules:

- Advertisers cannot access admin pages or admin APIs.
- Advertisers cannot access audit logs.
- Advertisers only see their own advertiser-safe data.
- Advertisers do not receive internal notes or other admin-only fields.

## Public Tracking

Tracking endpoints are public:

- `GET /track/click`
- `GET /track/postback`
- `POST /track/postback`

Security rules:

- Postback authentication is based on the offer postback token plus request signature.
- The postback token is server-side only and must never be exposed to partner-facing browser code.
- Postbacks must provide a valid `goalId`/`goal_id` for the offer resolved by the token.
- Revenue, payout, and profit are resolved on the backend and are not trusted from request payloads.

## Questionnaire Gate

Questionnaire completion is enforced for partner and advertiser operational routes, but not for:

- login/logout
- auth refresh
- own profile routes
- own questionnaire routes

This prevents redirect loops and allows users to complete or edit their questionnaire after registration.
