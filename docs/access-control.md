# Access control overview

This project now exposes three user-facing roles with strict separation of concerns:

- **Admin** — manages advertisers, affiliates, offers, finances and moderation from the internal dashboard. Admins never use advertiser self-service routes.
- **Affiliate** — works with `/api/v1/partner/**` read/write endpoints and legacy `/api/v1/profile`. Affiliates cannot see advertiser data.
- **Advertiser** — self-registers through `/api/v1/auth/register` with `accountType=advertiser`, receives a read-only cabinet and can only access their own profile, offers, stats, postbacks and finance summaries.

Advertisers are no longer created manually from the admin UI; admins only observe and edit existing entities.

## Registration and auth

| Endpoint | Allowed actors | Notes |
| --- | --- | --- |
| `POST /api/v1/auth/register` | Public | `accountType` must be `affiliate` or `advertiser`. Duplicate email -> `409`, invalid type -> `400`. Automatically links affiliate/advertiser entities. |
| `POST /api/v1/auth/login` | Public | Returns JWT + refresh token and role payload. |
| `GET /api/v1/auth/me` | Authenticated (`admin`, `affiliate`, `advertiser`) | Returns user profile with role-specific linkage. Missing token -> `401`. |
| `GET /api/v1/profile` | Authenticated (`affiliate`, `admin`) | Legacy profile endpoint for affiliate/admin panels. Advertisers should use `/api/v1/auth/me`. |

## Advertiser self-service (read-only)

All endpoints require `Authorization: Bearer <advertiser token>`. Missing token -> `401`, wrong role -> `403`. Foreign entity IDs return `404`.

| Endpoint | Description | Scope / protections |
| --- | --- | --- |
| `GET /api/v1/advertiser/profile` | Basic advertiser entity info | Only advertiser linked to the token may access. |
| `GET /api/v1/advertiser/offers` | Paginated list of owned offers | Lists only offers tied to advertiserId. No write endpoints exist, and `/api/v1/offers/**` is blocked for advertisers with `403`. |
| `GET /api/v1/advertiser/offers/:id` | Offer details | Returns `404` if offer belongs to another advertiser. |
| `GET /api/v1/advertiser/stats/summary`<br>`GET /advertiser/stats/breakdowns` | Performance aggregates | Accept `dateFrom/dateTo`. `offerId`/`affiliateId` filters are rejected with `400`. |
| `GET /api/v1/advertiser/stats/offers/:offerId` | Offer-focused stats | `404` when `offerId` is not owned. |
| `GET /api/v1/advertiser/postbacks`<br>`GET /api/v1/advertiser/postbacks/:postbackId` | Postback logs | Restricted to advertiser's own offers; filtering by foreign `offerId` yields `404`. |
| `GET /api/v1/advertiser/finance/summary`<br>`GET /api/v1/advertiser/finance/breakdowns` | Finance view | Supports own offer/date filters; foreign `offerId` -> `404`. Returns zeros for empty history. |

## Admin-only APIs

Admin tokens are required; advertisers/affiliates receive `403`, unauthenticated clients receive `401`.

| Endpoint | Description |
| --- | --- |
| `GET /api/v1/advertisers`, `GET /api/v1/advertisers/:id`, `PATCH /api/v1/advertisers/:id` | List and edit advertisers. Manual creation route removed. |
| `GET|POST|PATCH /api/v1/offers/**` | Offer CRUD + goal/geo/access helpers. |
| `GET /api/v1/admin/stats/totals` | Internal stats dashboard feed. |
| `POST /api/v1/admin/offer-requests/:id/decision` | Moderates affiliate access requests. |
| `GET /api/v1/affiliates/**`, `/api/v1/users/**`, `/api/v1/clicks`, `/api/v1/conversions` | Other admin maintenance APIs (unchanged). |

## Affiliate-only APIs

| Endpoint | Description |
| --- | --- |
| `GET /api/v1/partner/offers`, `/partner/offers/:id`, `/partner/offers/:id/request` | Affiliate offer catalog, requests and access control. |
| `GET /api/v1/partner/stats`, `/partner/clicks`, `/partner/conversions` | Affiliate reporting. |
| `/track/click`, `/track/postback` | Public tracking endpoints (no auth). |

## UX summary

- Admin dashboard still lists advertisers but no longer displays “Создать рекламодателя” or any CTA into the deprecated flow.
- Advertisers always log into `/advertiser/**` routes and see read-only controls; there are no write buttons or links to admin tools.
- Deep links like `/advertiser/offers/:id` and `/advertiser/stats/offers/:offerId` continue to work after refresh and respect the isolation guarantees above.
