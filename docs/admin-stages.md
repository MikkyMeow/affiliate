# Admin Expansion Implementation Plan

## 1. Purpose

This document is the authoritative execution plan for expanding the admin area and related backend APIs in this affiliate/CPA platform monorepo.

This document controls the implementation order.
Agents must execute stages in the order defined here unless the user explicitly changes that order.
Agents must not invent missing business rules.
Any unclear or missing business decision must be written into the relevant stage's `Open Questions` section instead of being silently decided.
Coding agents must not change business decisions, naming decisions, access decisions, money rules, or scope boundaries without explicit user approval.

This plan is implementation-oriented.
It defines the required backend scope, frontend scope, migration scope, API contracts, validation rules, and definition of done for each stage.
Where the current project already has a route family or naming convention, agents must extend that convention instead of renaming working APIs.

## 2. Global Business Decisions

### 2.1 Terminology

- Internal backend/API/DB term `affiliate` remains unchanged.
- UI label must be `Partner`.
- Internal backend/API/DB term `clicks` remains unchanged.
- UI label must be `Transactions`.
- Admin statistics page becomes `Main` in the admin UI.
- Admin main page must be available at `/dashboard`.
- Old `/dashboard/stats` does not need a redirect for now and may become `404`.

### 2.2 Money

- Money is `RUB` only for now.
- Goal values are fixed amounts only.
- Goal has:
  - `revenue`: amount paid by advertiser.
  - `payout`: amount paid to partner.
  - `profit`: `revenue - payout`.
- `payout` must never be greater than `revenue`.
- `profit` must be calculated by backend.
- Frontend may display `profit` but must not calculate it as source of truth.
- Frontend must never be the source of truth for revenue, payout, profit, CR, EPC, approve rate, or financial totals.

### 2.3 Manual data

- Manual CSV uploads are called `Adjustments` in UI.
- Manual conversions and manual payable clicks participate in statistics and payouts.
- Manual records must be marked with `source = "manual"` or exact equivalent.
- Manual records must be linked to an adjustment batch.
- Manual records must include `createdBy`.
- Manual records must be auditable and cancellable.

### 2.4 Test data

- Test postbacks must be marked as test data.
- Test data must not affect money.
- Test data must not affect main statistics.
- Test events may be visible in logs or diagnostics.

### 2.5 Access control

- Admin can do everything.
- Manager is a separate role.
- Manager can do everything admin can do except:
  - create/manage managers.
  - create/manage registration questionnaires.
- Manager can assign offers/access where allowed by feature rules.
- For now, manager sees all data, not only assigned entities.

### 2.6 Audit

All critical operations must be written to audit log:

- manager creation.
- manager assignment to partner.
- manager assignment to advertiser.
- advertiser creation.
- partner info changes.
- advertiser info changes.
- offer availability changes.
- offer access grant/revoke.
- hiding offer from partner.
- goal creation/update/delete.
- revenue/payout changes.
- postback test execution.
- CSV upload.
- CSV apply.
- CSV batch cancellation.
- conversion status changes.
- questionnaire creation/update.
- questionnaire submission.

## 3. Required Implementation Order

Stages must be executed in this exact order:

0. Documentation and architecture plan.
1. Public ordered IDs.
2. Roles and managers.
3. Responsible managers for partners and advertisers.
4. UI terminology changes.
5. Partner and advertiser information blocks.
6. Registration questionnaires.
7. Offer page: advertiser, availability, partner hiding.
8. Offer goals: revenue, payout, backend profit, remove offer-level payout.
9. Postback JS generator on offer page.
10. Postback test on offer page.
11. Admin main page and 24-hour charts.
12. Backend-side filters for transactions and conversions.
13. Aggregated statistics by selected partner and/or offer.
14. CSV adjustments.
15. Conversion status and cancellation model.
16. Daily stats and recalculation.
17. Backend-side search and filters across all sections.
18. Audit log expansion.
19. End-to-end validation.

## 4. Stage Template

Every stage in Section 5 must include all of these sections:

- `Goal`
- `Backend tasks`
- `Frontend tasks`
- `Database migrations`
- `API contracts`
- `Tests`
- `DoD`
- `Open Questions`

If a stage has no backend work, frontend work, migration work, or API work, the section must still exist and must state `None in this stage`.

## 5. Detailed Stages

### Stage 0. Documentation and architecture plan

#### Goal

Create `docs/admin-stages.md` as the authoritative implementation plan for the full admin expansion scope.

#### Backend tasks

- No code changes in this stage.
- No service changes in this stage.
- No validator changes in this stage.

#### Frontend tasks

- No code changes in this stage.

#### Database migrations

- None in this stage.

#### API contracts

- No API changes in this stage.

#### Tests

- No automated test changes in this stage.
- Verify that the document exists and that it covers all stages from `0` to `19`.

#### DoD

- `docs/admin-stages.md` exists.
- The document covers all required sections from this request.
- No code files were changed.
- No migrations were created.
- No API contracts were implemented in code.

#### Open Questions

- None.

### Stage 1. Public ordered IDs

#### Goal

Add human-facing public ordered IDs for partners, advertisers, and offers while keeping UUIDs and internal IDs as machine identifiers.

#### Backend tasks

- Add public ordered ID support for:
  - partners: `#P1`, `#P2`, ...
  - advertisers: `#A1`, `#A2`, ...
  - offers: `#O1`, `#O2`, ...
- Keep UUID primary keys and internal foreign keys unchanged.
- Use `publicIdNumber` as the stored numeric sequence value per entity type.
- Use `publicId` as the API/UI string representation generated by backend serializer:
  - partner: `#P${publicIdNumber}`
  - advertiser: `#A${publicIdNumber}`
  - offer: `#O${publicIdNumber}`
- Add backend generation rules:
  - public ID generation happens on create.
  - generation uses a dedicated PostgreSQL sequence per entity type.
  - generation is monotonic per entity type.
  - uniqueness is required per entity type.
  - gapless numbering is not required after rollbacks, deletions, or failed transactions.
- Add backend lookup support so list filters and search can match both UUID and `publicId`.
- Extend serializers for list and detail responses to expose both `publicId` and `publicIdNumber`.

#### Frontend tasks

- Show `publicId` in admin lists and detail pages for partners, advertisers, and offers.
- Show `publicId` in selects, breadcrumbs, tables, and detail headers where entity identification matters.
- Show `publicId` in CSV help examples and operator-facing diagnostics.
- Keep UUIDs as hidden machine identifiers in forms and navigation params.

#### Database migrations

- Add nullable `public_id_number BIGINT` columns to `affiliates`, `advertisers`, and `offers`.
- Create unique indexes:
  - `affiliates(public_id_number)`
  - `advertisers(public_id_number)`
  - `offers(public_id_number)`
- Create sequences:
  - `affiliates_public_id_seq`
  - `advertisers_public_id_seq`
  - `offers_public_id_seq`
- Backfill existing rows in deterministic order:
  - order by `created_at ASC`, then `id ASC`.
- After backfill, mark the columns `NOT NULL`.
- Set default values for new rows from the matching sequence.

#### API contracts

##### Endpoint
`GET /api/v1/affiliates`

##### Auth
`admin`, `manager` after Stage 2.

##### Query Params

- Existing filters remain.
- Future-compatible search param: `search`, optional.

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "5cb79d78-c7c6-4702-a0d9-3fd727c58650",
      "publicIdNumber": 12,
      "publicId": "#P12",
      "name": "Partner One",
      "email": "partner@example.com",
      "status": "active",
      "createdAt": "2026-05-15T10:00:00.000Z",
      "updatedAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

##### Validation Rules

- `publicIdNumber` is backend-generated only.
- `publicId` is read-only.

##### Error Cases

- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `403 FORBIDDEN`

Apply the same response pattern to:

- `GET /api/v1/affiliates/:id`
- `GET /api/v1/advertisers`
- `GET /api/v1/advertisers/:id`
- `GET /api/v1/offers`
- `GET /api/v1/offers/:id`

#### Tests

- Migration test for new columns, indexes, and sequences.
- Backfill test for deterministic ordering.
- Create flow test for new partner, advertiser, and offer public IDs.
- API response test for list/detail serialization.
- Uniqueness test per entity type.
- Non-gapless behavior test after rolled-back transaction.

#### DoD

- Every partner, advertiser, and offer has a unique public ordered ID.
- Backend creates IDs automatically.
- Existing UUID-based logic continues to work.
- API list/detail responses expose `publicId` and `publicIdNumber`.
- Admin UI displays public IDs in key operator flows.

#### Open Questions

- None.

### Stage 2. Roles and managers

#### Goal

Add the `manager` role and the manager-management flow controlled by admins.

#### Backend tasks

- Extend user role support to include `manager`.
- Create manager-management service layer under admin scope.
- Admin can create managers.
- Manager cannot create managers.
- Manager cannot manage questionnaires.
- Generated password must be shown once to admin at creation time.
- Do not store plaintext password.
- Add authenticated password change endpoint because no current endpoint exists.
- Review all admin-only endpoints and expand access to `manager` where the feature is allowed by the global rules.
- Keep manager deactivation out of Stage 2 implementation because the current user model has no active/deactivated state.
- Record audit events for manager creation and manager updates.

#### Frontend tasks

- Add admin-only managers page under dashboard navigation.
- Add manager list view.
- Add create manager form.
- Add update manager form for name and email.
- Show generated password once in a post-create success state with explicit copy action.
- Remove manager management UI from manager role completely.
- Add change-password UI for authenticated user profile/settings if a profile/settings surface already exists; otherwise add a minimal dedicated page.

#### Database migrations

- Add `manager` to the allowed user role set.
- No manager-specific table is required if managers are stored in `users`.
- Do not add deactivation columns in this stage.

#### API contracts

Authorization matrix:

| Capability | Admin | Manager |
| --- | --- | --- |
| List managers | Yes | No |
| Create manager | Yes | No |
| Update manager | Yes | No |
| Manage questionnaires | Yes | No |
| Read admin entities | Yes | Yes |
| Update admin entities outside restricted areas | Yes | Yes |

##### Endpoint
`GET /api/v1/admin/managers`

##### Auth
`admin`

##### Query Params

- `limit`: number, optional, default `20`
- `offset`: number, optional, default `0`
- `search`: string, optional

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
      "email": "manager@example.com",
      "displayName": "Manager One",
      "role": "manager",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

##### Validation Rules

- Return only users with role `manager`.

##### Error Cases

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`

##### Endpoint
`POST /api/v1/admin/managers`

##### Auth
`admin`

##### Query Params
None.

##### Request Body

```json
{
  "email": "manager@example.com",
  "displayName": "Manager One"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "manager": {
      "id": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
      "email": "manager@example.com",
      "displayName": "Manager One",
      "role": "manager",
      "createdAt": "2026-05-15T10:00:00.000Z"
    },
    "generatedPassword": "TempPassword123!"
  },
  "meta": null
}
```

##### Validation Rules

- `email` required, unique, normalized to lowercase.
- `displayName` required.
- Backend generates password.
- `generatedPassword` is returned only in create response.
- No read endpoint returns plaintext password.

##### Error Cases

- `400 VALIDATION_ERROR`
- `409 CONFLICT`

##### Endpoint
`PATCH /api/v1/admin/managers/:id`

##### Auth
`admin`

##### Query Params
None.

##### Request Body

```json
{
  "email": "manager.updated@example.com",
  "displayName": "Manager Updated"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "manager": {
      "id": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
      "email": "manager.updated@example.com",
      "displayName": "Manager Updated",
      "role": "manager",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  },
  "meta": null
}
```

##### Validation Rules

- Allow updates only for `email` and `displayName` in this stage.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `409 CONFLICT`

##### Endpoint
`POST /api/v1/auth/change-password`

##### Auth
Authenticated user of any role.

##### Query Params
None.

##### Request Body

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "message": "Password updated"
  },
  "meta": null
}
```

##### Validation Rules

- `currentPassword` required.
- `newPassword` required.
- Backend validates current password before update.

##### Error Cases

- `400 VALIDATION_ERROR`
- `401 INVALID_CREDENTIALS`

Deferred endpoint for future stage only:

- `POST /api/v1/admin/managers/:id/deactivate`
- Do not implement in Stage 2 unless the user approves a deactivation model for `users`.

#### Tests

- Role validation tests for `manager`.
- Authorization tests for admin-only manager routes.
- Password hashing test.
- One-time password exposure test.
- Change-password endpoint tests.
- Regression tests proving manager can use allowed admin APIs and cannot use restricted ones.

#### DoD

- `manager` role exists end-to-end.
- Admin can create and update managers.
- Manager cannot create or manage managers.
- Manager cannot manage questionnaires.
- Generated password is shown once and not persisted as plaintext.
- Password change endpoint exists and works.

#### Open Questions

- None.

### Stage 3. Responsible managers for partners and advertisers

#### Goal

Add one responsible manager assignment for each partner and each advertiser.

#### Backend tasks

- Add manager linkage to partners and advertisers using manager user ID.
- Allow exactly one responsible manager per partner.
- Allow exactly one responsible manager per advertiser.
- Return manager summary in list and detail responses.
- Add assignment endpoints for partner and advertiser.
- Permit `admin` and `manager` to assign or change the responsible manager.
- Write audit events on assignment change.

#### Frontend tasks

- Add manager column to partner list and advertiser list.
- Add manager field to partner detail/edit page.
- Add manager field to advertiser detail/edit page.
- Use manager display name and email in summary displays.

#### Database migrations

- Add nullable `manager_user_id UUID` to `affiliates`.
- Add nullable `manager_user_id UUID` to `advertisers`.
- Add foreign keys to `users(id)`.
- Add indexes on both new columns.

#### API contracts

##### Endpoint
`PATCH /api/v1/affiliates/:id/manager`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "managerUserId": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "affiliate": {
      "id": "5cb79d78-c7c6-4702-a0d9-3fd727c58650",
      "publicId": "#P12",
      "name": "Partner One",
      "managerUserId": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
      "manager": {
        "id": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
        "displayName": "Manager One",
        "email": "manager@example.com"
      }
    }
  },
  "meta": null
}
```

##### Validation Rules

- `managerUserId` required.
- Target user must exist.
- Target user role must be `manager` or `admin`.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `409 CONFLICT`

##### Endpoint
`PATCH /api/v1/advertisers/:id/manager`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "managerUserId": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1"
}
```

##### Response
Same structure as partner assignment with `advertiser` root object.

##### Validation Rules

- Same validation as partner assignment.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

List/detail responses for:

- `GET /api/v1/affiliates`
- `GET /api/v1/affiliates/:id`
- `GET /api/v1/advertisers`
- `GET /api/v1/advertisers/:id`

must include:

- `managerUserId`
- `manager`

#### Tests

- Migration tests.
- Assignment endpoint tests.
- Authorization tests for `admin` and `manager`.
- Serializer tests for list/detail responses.
- Audit event tests for partner and advertiser assignment changes.

#### DoD

- Partners and advertisers can each have one responsible manager.
- Lists and detail pages display manager information.
- Assignment changes are auditable.

#### Open Questions

- None.

### Stage 4. UI terminology changes

#### Goal

Rename admin UI labels only without renaming backend terms, API paths, or database terms.

#### Backend tasks

- Do not rename backend routes.
- Do not rename DB tables or columns.
- Do not rename internal domain terms `affiliate` or `clicks`.
- Update backend-provided labels only if a response currently contains human-facing Russian UI text that must match the new labels.

#### Frontend tasks

- Rename UI labels:
  - `Affiliates` -> `Partners`
  - `Clicks` -> `Transactions`
  - `Statistics` -> `Main`
- Move admin main page to `/dashboard`.
- Remove or stop linking `/dashboard/stats`.
- Update all affected frontend areas:
  - left navigation
  - breadcrumbs
  - page headers
  - table titles
  - table column labels
  - filter labels
  - buttons
  - empty states
  - chart titles
  - modal titles
  - notifications
  - internal admin links

#### Database migrations

- None in this stage.

#### API contracts

- No route changes in this stage.
- No DB naming changes in this stage.
- Frontend continues to call existing APIs such as:
  - `GET /api/v1/affiliates`
  - `GET /api/v1/clicks`
  - `GET /api/v1/admin/stats/totals`

#### Tests

- Frontend smoke tests for route reachability.
- Snapshot or UI text tests for renamed labels where the project already has UI test coverage.
- Manual verification checklist for navigation labels and main page route.

#### DoD

- Admin UI uses `Partner`, `Transactions`, and `Main`.
- Admin main page is `/dashboard`.
- `/dashboard/stats` is no longer used by admin navigation and may return `404`.
- Backend/API/internal naming remains unchanged.

#### Open Questions

- None.

### Stage 5. Partner and advertiser information blocks

#### Goal

Expose richer partner and advertiser information in admin while keeping private internal data hidden from partner and advertiser users.

#### Backend tasks

- Extend partner data model with:
  - `telegram`
  - `internalNotes`
- Extend advertiser data model with:
  - `email` via linked user record
  - `telegram`
  - `internalNotes`
- Expose questionnaire answers on admin read responses if present.
- Add admin advertiser creation flow with generated one-time password.
- Keep advertiser self-registration flow working.
- Enforce visibility rules:
  - `internalNotes` visible only to `admin` and `manager`
  - partner and advertiser self-service responses must not include `internalNotes`
- Write audit events for partner info changes, advertiser info changes, and advertiser creation.

#### Frontend tasks

- Add admin information blocks on partner detail pages:
  - name
  - email
  - telegram
  - responsible manager
  - questionnaire answers
  - internal notes
- Add admin information blocks on advertiser detail pages with the same pattern.
- Add admin-only form for advertiser creation with one-time generated password display.
- Hide internal notes in partner and advertiser self-service UI.

#### Database migrations

- Add nullable `telegram TEXT` and `internal_notes TEXT` to `affiliates`.
- Add nullable `telegram TEXT` and `internal_notes TEXT` to `advertisers`.
- No migration is required for questionnaire answers in this stage; questionnaire answer storage belongs to Stage 6.

#### API contracts

##### Endpoint
`GET /api/v1/affiliates/:id`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": {
    "affiliate": {
      "id": "5cb79d78-c7c6-4702-a0d9-3fd727c58650",
      "publicId": "#P12",
      "name": "Partner One",
      "email": "partner@example.com",
      "status": "active",
      "telegram": "@partner_one",
      "managerUserId": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
      "manager": {
        "id": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
        "displayName": "Manager One",
        "email": "manager@example.com"
      },
      "internalNotes": "Visible only to admin and manager",
      "questionnaireAnswers": null,
      "createdAt": "2026-05-15T10:00:00.000Z",
      "updatedAt": "2026-05-15T10:00:00.000Z"
    }
  },
  "meta": null
}
```

##### Validation Rules

- `internalNotes` must not be present in partner self-service response.

##### Error Cases

- `404 NOT_FOUND`

##### Endpoint
`PATCH /api/v1/affiliates/:id`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "name": "Partner One Updated",
  "email": "partner.updated@example.com",
  "telegram": "@partner_one_updated",
  "internalNotes": "Internal note"
}
```

##### Response
Same envelope with updated `affiliate`.

##### Validation Rules

- `email` must be unique where partner email uniqueness already applies.
- `internalNotes` is writable only by `admin` and `manager`.

##### Error Cases

- `400 VALIDATION_ERROR`
- `409 CONFLICT`

##### Endpoint
`GET /api/v1/advertisers/:id`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": {
    "advertiser": {
      "id": "49b7682e-3b55-4aa1-ac9f-7f01b128f841",
      "publicId": "#A9",
      "name": "Advertiser One",
      "email": "advertiser@example.com",
      "status": "active",
      "telegram": "@advertiser_one",
      "managerUserId": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
      "manager": {
        "id": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
        "displayName": "Manager One",
        "email": "manager@example.com"
      },
      "internalNotes": "Visible only to admin and manager",
      "questionnaireAnswers": null,
      "createdAt": "2026-05-15T10:00:00.000Z",
      "updatedAt": "2026-05-15T10:00:00.000Z"
    }
  },
  "meta": null
}
```

##### Validation Rules

- `internalNotes` must not be present in advertiser self-service response.

##### Error Cases

- `404 NOT_FOUND`

##### Endpoint
`PATCH /api/v1/advertisers/:id`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "name": "Advertiser One Updated",
  "telegram": "@advertiser_one_updated",
  "internalNotes": "Internal note"
}
```

##### Response
Same envelope with updated `advertiser`.

##### Validation Rules

- `internalNotes` writable only by `admin` and `manager`.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

##### Endpoint
`POST /api/v1/advertisers`

##### Auth
`admin`

##### Query Params
None.

##### Request Body

```json
{
  "name": "Advertiser One",
  "email": "advertiser@example.com",
  "telegram": "@advertiser_one",
  "managerUserId": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
  "internalNotes": "Optional internal note"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "advertiser": {
      "id": "49b7682e-3b55-4aa1-ac9f-7f01b128f841",
      "publicId": "#A9",
      "name": "Advertiser One",
      "email": "advertiser@example.com",
      "status": "active",
      "telegram": "@advertiser_one",
      "managerUserId": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
      "internalNotes": "Optional internal note"
    },
    "generatedPassword": "TempPassword123!"
  },
  "meta": null
}
```

##### Validation Rules

- `email` required and unique.
- Backend creates linked user with role `advertiser`.
- `generatedPassword` returned only once.

##### Error Cases

- `400 VALIDATION_ERROR`
- `409 CONFLICT`

#### Tests

- Migration tests for partner and advertiser info fields.
- Admin read/update endpoint tests.
- Self-service visibility tests proving `internalNotes` is hidden.
- Admin advertiser creation tests.
- Audit tests for info changes and advertiser creation.

#### DoD

- Admin and manager can read and update partner/advertiser info blocks.
- Internal notes are hidden from partner and advertiser users.
- Advertiser can be self-registered or admin-created.
- Admin-created advertiser gets a one-time generated password.

#### Open Questions

- None.

### Stage 6. Registration questionnaires

#### Goal

Add admin-managed registration questionnaires for partners and advertisers and require completion before platform usage.

#### Backend tasks

- Build questionnaire management under admin scope only.
- Support separate questionnaires for:
  - `affiliate`
  - `advertiser`
- Support field types:
  - `text`
  - `textarea`
  - `select`
  - `multiselect`
  - `checkbox`
  - `radio`
- Do not support file upload.
- Support field properties:
  - `name`
  - `question`
  - `type`
  - `required`
  - `order`
  - `options` for option-based fields
- Store questionnaire definitions in normalized tables.
- Store answers as `JSONB`.
- Enforce completion of all required fields after registration and before normal cabinet usage.
- Show stored answers in admin partner and advertiser pages.
- Manager must not manage questionnaires.
- Write audit events for questionnaire creation/update and questionnaire submission.

#### Frontend tasks

- Add admin-only questionnaire list page.
- Add admin-only questionnaire create/edit page.
- Add questionnaire submission UI for partner and advertiser after registration.
- Block platform usage until required questionnaire is completed.
- Show submitted answers on admin partner/advertiser pages.

#### Database migrations

- Create `questionnaires` table.
- Create `questionnaire_fields` table.
- Create `questionnaire_submissions` table with `answers JSONB`.
- Enforce one active questionnaire per target role at a time.

#### API contracts

##### Endpoint
`GET /api/v1/questionnaires/current`

##### Auth
Authenticated `affiliate` or `advertiser`.

##### Query Params
None.

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": {
    "questionnaire": {
      "id": "ab248e0d-1f73-4109-8ab0-f95f8ed3a1d8",
      "targetRole": "affiliate",
      "isActive": true,
      "fields": [
        {
          "id": "5b9a9782-8b89-4f92-8ab5-629dce837f1a",
          "name": "traffic_sources",
          "question": "What traffic sources do you use?",
          "type": "multiselect",
          "required": true,
          "order": 1,
          "options": ["seo", "ppc", "social"]
        }
      ]
    },
    "submission": null
  },
  "meta": null
}
```

##### Validation Rules

- Role decides which questionnaire is returned.
- Return only the active questionnaire for the current role.

##### Error Cases

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`

##### Endpoint
`POST /api/v1/questionnaires/current/submit`

##### Auth
Authenticated `affiliate` or `advertiser`.

##### Query Params
None.

##### Request Body

```json
{
  "answers": {
    "traffic_sources": ["seo", "social"]
  }
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "submission": {
      "id": "0346cf79-4efd-4ee3-8d92-3d4c1f310324",
      "questionnaireId": "ab248e0d-1f73-4109-8ab0-f95f8ed3a1d8",
      "targetRole": "affiliate",
      "answers": {
        "traffic_sources": ["seo", "social"]
      },
      "submittedAt": "2026-05-15T10:00:00.000Z"
    }
  },
  "meta": null
}
```

##### Validation Rules

- All required fields must be present.
- `select`, `radio` must match a configured option.
- `multiselect` values must be an array of configured options.
- `checkbox` value must be boolean.
- Unknown field keys rejected.

##### Error Cases

- `400 VALIDATION_ERROR`

##### Endpoint
`GET /api/v1/admin/questionnaires`

##### Auth
`admin`

##### Query Params

- `targetRole`: `affiliate | advertiser`, optional

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "ab248e0d-1f73-4109-8ab0-f95f8ed3a1d8",
      "targetRole": "affiliate",
      "name": "Affiliate Registration",
      "isActive": true,
      "updatedAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": null
}
```

##### Validation Rules

- Return questionnaire definitions only.

##### Error Cases

- `403 FORBIDDEN`

##### Endpoint
`POST /api/v1/admin/questionnaires`

##### Auth
`admin`

##### Query Params
None.

##### Request Body

```json
{
  "name": "Affiliate Registration",
  "targetRole": "affiliate",
  "fields": [
    {
      "name": "traffic_sources",
      "question": "What traffic sources do you use?",
      "type": "multiselect",
      "required": true,
      "order": 1,
      "options": ["seo", "ppc", "social"]
    }
  ]
}
```

##### Response
Created questionnaire object with fields.

##### Validation Rules

- One questionnaire target role per record.
- Field `name` must be unique within questionnaire.
- `options` required for `select`, `multiselect`, `radio`.
- `options` forbidden for `text`, `textarea`, `checkbox`.

##### Error Cases

- `400 VALIDATION_ERROR`
- `409 CONFLICT`

##### Endpoint
`PATCH /api/v1/admin/questionnaires/:id`

##### Auth
`admin`

##### Query Params
None.

##### Request Body
Same structure as create.

##### Response
Updated questionnaire object with fields.

##### Validation Rules

- Full definition update in one request.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

##### Endpoint
`POST /api/v1/admin/questionnaires/:id/activate`

##### Auth
`admin`

##### Query Params
None.

##### Request Body
None.

##### Response
Activated questionnaire object.

##### Validation Rules

- Activating one questionnaire deactivates the current active questionnaire for the same target role in the same transaction.

##### Error Cases

- `404 NOT_FOUND`

##### Endpoint
`POST /api/v1/admin/questionnaires/:id/deactivate`

##### Auth
`admin`

##### Query Params
None.

##### Request Body
None.

##### Response
Deactivated questionnaire object.

##### Validation Rules

- Deactivation allowed only if the role should have no active questionnaire.

##### Error Cases

- `404 NOT_FOUND`

#### Tests

- Questionnaire definition validation tests.
- Submission validation tests by field type.
- Authorization tests proving manager cannot manage questionnaires.
- Post-registration blocking tests.
- Admin display tests for questionnaire answers.
- Audit tests for definition change and submission.

#### DoD

- Admin can manage separate partner and advertiser questionnaires.
- Partner and advertiser users must complete required questionnaire before normal usage.
- Answers are stored as JSONB and visible in admin.
- Manager cannot manage questionnaires.

#### Open Questions

- None.

### Stage 7. Offer page: advertiser, availability, partner hiding

#### Goal

Extend offer access rules and operator controls without renaming existing internal entities.

#### Backend tasks

- Show advertiser name and link in admin offer detail.
- Add offer availability field with values:
  - `public`
  - `on_request`
  - `private`
- Apply behavior rules:
  - `public`: visible to all partners unless explicitly hidden; accessible immediately.
  - `on_request`: visible to all partners unless explicitly hidden; partner without access sees only allowed description; partner can request access.
  - `private`: not visible to partner unless access is granted; partner cannot request access.
- Add explicit partner hide override for any offer.
- Keep manual grant/revoke access for admin and manager.
- Return partner-visible offer list according to availability, access grants, and hide overrides.
- Write audit events for availability changes, access changes, and hide/unhide actions.

#### Frontend tasks

- Add advertiser block on admin offer page with link to advertiser page.
- Add availability selector on admin offer page.
- Add partner access management panel on admin offer page.
- Add hide/unhide controls per partner.
- On partner side:
  - show public offers
  - show on-request offers with request action when not granted
  - hide private offers unless granted
  - hide explicitly hidden offers

#### Database migrations

- Add `availability TEXT NOT NULL DEFAULT 'public'` to `offers`.
- Add partner hide storage:
  - new table `offer_affiliate_hidden`
  - unique key on `(offer_id, affiliate_id)`
- Reuse existing access table/mechanism for granted access where possible.

#### API contracts

##### Endpoint
`PATCH /api/v1/offers/:id`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "availability": "on_request"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "offer": {
      "id": "a44dc597-9cb5-4ad8-9b07-96a0d91a4e28",
      "publicId": "#O18",
      "name": "Offer One",
      "advertiserId": "49b7682e-3b55-4aa1-ac9f-7f01b128f841",
      "advertiserName": "Advertiser One",
      "availability": "on_request"
    }
  },
  "meta": null
}
```

##### Validation Rules

- `availability` must be one of `public`, `on_request`, `private`.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

##### Endpoint
`PUT /api/v1/admin/offers/:offerId/affiliates/:affiliateId/access`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "accessType": "manual"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "access": {
      "offerId": "a44dc597-9cb5-4ad8-9b07-96a0d91a4e28",
      "affiliateId": "5cb79d78-c7c6-4702-a0d9-3fd727c58650",
      "accessType": "manual",
      "grantedAt": "2026-05-15T10:00:00.000Z"
    }
  },
  "meta": null
}
```

##### Validation Rules

- Partner access can be granted for any availability.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

##### Endpoint
`DELETE /api/v1/admin/offers/:offerId/affiliates/:affiliateId/access`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body
None.

##### Response
HTTP `204 No Content`

##### Validation Rules

- Revocation removes manual access grant.

##### Error Cases

- `404 NOT_FOUND`

##### Endpoint
`PUT /api/v1/admin/offers/:offerId/affiliates/:affiliateId/hide`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "reason": "Internal network decision"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "hidden": true,
    "offerId": "a44dc597-9cb5-4ad8-9b07-96a0d91a4e28",
    "affiliateId": "5cb79d78-c7c6-4702-a0d9-3fd727c58650"
  },
  "meta": null
}
```

##### Validation Rules

- Hide override always wins over public/on-request visibility.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

##### Endpoint
`DELETE /api/v1/admin/offers/:offerId/affiliates/:affiliateId/hide`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body
None.

##### Response
HTTP `204 No Content`

##### Validation Rules

- Unhide removes only the hide override.

##### Error Cases

- `404 NOT_FOUND`

##### Endpoint
`GET /api/v1/partner/offers`

##### Auth
`affiliate`

##### Query Params

- Existing filters remain.

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "a44dc597-9cb5-4ad8-9b07-96a0d91a4e28",
      "publicId": "#O18",
      "name": "Offer One",
      "availability": "on_request",
      "hasAccess": false,
      "canRequestAccess": true,
      "advertiserName": "Advertiser One"
    }
  ],
  "meta": null
}
```

##### Validation Rules

- Private offers without access are excluded from the result.
- Hidden offers are excluded from the result.
- On-request offers without access are listed with `hasAccess=false` and `canRequestAccess=true`.

##### Error Cases

- `401 UNAUTHORIZED`

#### Tests

- Availability transition tests.
- Partner-visible catalog tests for each availability mode.
- Access grant/revoke tests.
- Hide/unhide tests.
- Authorization tests for admin/manager/partner behavior.
- Audit tests for all critical actions.

#### DoD

- Offers support `public`, `on_request`, and `private`.
- Advertiser is shown on offer page.
- Partner-specific hide works.
- Partner-visible catalog behavior matches the rules above.

#### Open Questions

- None.

### Stage 8. Offer goals: revenue, payout, backend profit, remove offer-level payout

#### Goal

Move financial logic fully to goal level, remove offer-level payout, and make backend-calculated profit the only source of truth.

#### Backend tasks

- Remove offer-level payout from UI, API, and DB.
- Project is not yet in production, so destructive migration is allowed.
- Keep goal fields:
  - `revenue`
  - `payout`
  - `profit` read-only, calculated by backend
- Keep `RUB` only.
- Keep fixed amounts only.
- Enforce `payout <= revenue`.
- Update all goal serializers to expose `profit`.
- Update all downstream services to read partner payout and advertiser revenue from goal snapshots, not offer-level payout.
- If any current response still exposes `payoutRub` or `revenueAmount`, add normalized response fields `payout`, `revenue`, `profit`, `currency` for admin-facing goal endpoints from this stage forward.
- Write audit events for goal create/update/delete and revenue/payout changes.

#### Frontend tasks

- Remove offer-level payout form fields and displays.
- Update goal creation and editing forms to show `revenue`, `payout`, and read-only `profit`.
- Display currency as `RUB`.
- Prevent local profit calculation from being used as a saved value.

#### Database migrations

- Drop old offer-level payout column from `offers`.
- Remove any obsolete code path or constraint tied to offer-level payout.
- Keep or add goal-level numeric columns for `revenue` and `payout`.
- Do not add a stored `profit` column; calculate `profit` in backend serializer/service.

#### API contracts

##### Endpoint
`GET /api/v1/admin/offers/:offerId/goals`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "4dad1b15-2d7f-455e-b00e-a6029a9e14c5",
      "offerId": "a44dc597-9cb5-4ad8-9b07-96a0d91a4e28",
      "name": "Sale",
      "type": "CPA",
      "revenue": 1000.0,
      "payout": 700.0,
      "profit": 300.0,
      "currency": "RUB",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-05-15T10:00:00.000Z",
      "updatedAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

##### Validation Rules

- `profit` is read-only and backend-calculated.

##### Error Cases

- `404 NOT_FOUND`

##### Endpoint
`POST /api/v1/admin/offers/:offerId/goals`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "name": "Sale",
  "type": "CPA",
  "revenue": 1000.0,
  "payout": 700.0,
  "currency": "RUB",
  "isDefault": true,
  "isActive": true
}
```

##### Response
Created `goal` object with calculated `profit`.

##### Validation Rules

- `currency` must be `RUB`.
- `revenue >= 0`
- `payout >= 0`
- `payout <= revenue`

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

##### Endpoint
`PATCH /api/v1/admin/offers/:offerId/goals/:goalId`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "revenue": 1200.0,
  "payout": 800.0,
  "isActive": true
}
```

##### Response
Updated `goal` object with calculated `profit`.

##### Validation Rules

- Same money rules as create.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

#### Tests

- Migration test removing offer-level payout.
- Goal validation tests for `payout <= revenue`.
- Goal serializer tests for calculated `profit`.
- Downstream service tests proving financial calculations read goal data.
- Audit tests for money-related goal changes.

#### DoD

- Offer-level payout no longer exists in UI, API, or DB.
- Goal-level revenue and payout are authoritative.
- Backend returns calculated profit.
- Frontend displays profit but does not save or calculate it as truth.

#### Open Questions

- None.

### Stage 9. Postback JS generator on offer page

#### Goal

Add a minimal working advertiser-facing JS postback generator to the offer page without moving rate logic to frontend.

#### Backend tasks

- Reuse the existing postback endpoint route family under `/track/postback`.
- Extend the postback contract so backend can resolve:
  - offer public/internal identifier
  - goal public/internal identifier
  - click ID or tracking token when available
  - status
  - external transaction/order ID when available
- Keep rate, revenue, payout, and profit resolution on backend goal settings only.
- Do not expose unnecessary secrets in generated JS.
- Keep generator output extendable for later custom macro mapping.

#### Frontend tasks

- Add generator section on admin offer page.
- Generate one JS function per goal.
- Add copy-to-clipboard button.
- Add a short instruction block for advertiser-side developer.
- Explain macros in UI:
  - macro means placeholder provided by advertiser-side system, for example `{click_id}`, `{order_id}`, `{status}`
  - MVP uses default placeholder names
  - future versions may support custom macro mapping

#### Database migrations

- Add nullable backend storage for `externalTransactionId` on the conversion or postback-log side if that field does not already exist.
- Do not add storage for this data in frontend state.

#### API contracts

Generated JS example format:

```js
async function sendSaleGoalPostback() {
  await fetch("https://platform.example.com/track/postback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "{postback_token}",
      offerId: "#O18",
      goalId: "4dad1b15-2d7f-455e-b00e-a6029a9e14c5",
      clickId: "{click_id}",
      status: "{status}",
      externalTransactionId: "{order_id}",
      signature: "{signature}"
    })
  });
}
```

##### Endpoint
`POST /track/postback`

##### Auth
Public endpoint. Signature/token validation is required.

##### Query Params
None.

##### Request Body

```json
{
  "token": "postback-token",
  "offerId": "#O18",
  "goalId": "4dad1b15-2d7f-455e-b00e-a6029a9e14c5",
  "clickId": "clk_123",
  "status": "approved",
  "externalTransactionId": "order_555",
  "signature": "signed-value"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "clickId": "clk_123",
    "status": "approved"
  },
  "meta": null
}
```

##### Validation Rules

- `token` required.
- `goalId` required.
- `status` required.
- `signature` required.
- At least one of `clickId` or tracking token alias must be present when supported by the offer.
- Backend resolves revenue and payout from goal settings only.
- Request body money fields must be ignored for financial truth.

##### Error Cases

- `400 VALIDATION_ERROR`
- `401 INVALID_POSTBACK_TOKEN`
- `404 NOT_FOUND`
- `409 DUPLICATE_CONVERSION`

#### Tests

- Generator rendering test per goal.
- Contract validation tests for new postback fields.
- Security test proving frontend does not inject money values into financial calculations.
- Copy button smoke test if UI test coverage exists.

#### DoD

- Offer page shows generated JS snippets per goal.
- Generated JS targets the platform postback endpoint.
- Macros are documented for advertiser developers.
- Backend remains the only source of truth for rates and totals.

#### Open Questions

- None.

### Stage 10. Postback test on offer page

#### Goal

Add operator-facing postback test flow on the offer page without affecting money or statistics.

#### Backend tasks

- Move test postback UX to the offer page.
- Add test mode support to the postback endpoint flow.
- Mark test conversions/events as test data.
- Ensure test data does not affect statistics or money.
- Return detailed structured test result:
  - success/failure
  - offer found/not found
  - goal found/not found
  - click/token valid/invalid
  - test conversion created/not created
  - error reason
- Write audit event for postback test execution.

#### Frontend tasks

- Add postback test form on admin offer page.
- Show structured result block with explicit statuses for each validation step.
- Keep test UI separate from production postback generator UI.

#### Database migrations

- Add test markers to the persisted diagnostic record model:
  - required boolean `isTest`
  - required `source = "test"` or exact equivalent source marker
- Add supporting columns to postback logs or conversions if current schema cannot distinguish test records.

#### API contracts

- Keep `/track/postback` as the production endpoint.
- Add dedicated admin test endpoint for controlled diagnostics.

##### Endpoint
`POST /api/v1/admin/offers/:offerId/postback-test`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "goalId": "4dad1b15-2d7f-455e-b00e-a6029a9e14c5",
  "clickId": "clk_123",
  "status": "approved",
  "externalTransactionId": "order_555",
  "payload": {
    "clickId": "clk_123",
    "status": "approved",
    "externalTransactionId": "order_555"
  }
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "result": {
      "ok": true,
      "offerFound": true,
      "goalFound": true,
      "clickOrTokenValid": true,
      "testConversionCreated": true,
      "errorReason": null,
      "testConversionId": "1be94604-93d6-4c22-a2ae-f0f5f7c4768d"
    }
  },
  "meta": null
}
```

##### Validation Rules

- All created records from this endpoint must be marked as test.
- Test execution must not update stats aggregates or payouts.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

#### Tests

- Test-mode isolation tests proving no stats change.
- Test-mode isolation tests proving no money change.
- Result object completeness tests.
- Audit test for postback test execution.

#### DoD

- Offer page can run a test postback.
- Test result is structured and operator-readable.
- Test records are marked and excluded from money/statistics.

#### Open Questions

- Should test mode auto-create a temporary test click/token when no real click is provided, or should a real click/token always be required?

### Stage 11. Admin main page and 24-hour charts

#### Goal

Replace the old admin stats page with `/dashboard` main page backed by hourly backend aggregation for the last 24 hours.

#### Backend tasks

- Add dedicated admin dashboard stats endpoint.
- Backend must aggregate all metrics.
- Last 24 hours must be returned as hourly buckets.
- Buckets must be returned in UTC timestamps.
- Exclude test data.
- Include manual data.
- Provide metric cards and time series in one response.

#### Frontend tasks

- Implement `/dashboard` as admin main page.
- Add separate chart cards for:
  - transactions/clicks
  - conversions
  - CR
  - revenue
  - payout
  - profit
  - EPC
  - approve rate
- Use a lightweight chart library.
- Render metric cards and charts from backend response only.
- Do not re-aggregate raw data on frontend.

#### Database migrations

- None in the initial implementation of this stage.
- Use service-level hourly aggregation first.
- Do not add a new hourly rollup table in this stage without explicit user approval.

#### API contracts

##### Endpoint
`GET /api/v1/admin/stats/dashboard`

##### Auth
`admin`, `manager`

##### Query Params
None in this stage.

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": {
    "metricCards": {
      "clicks": 1200,
      "conversions": 45,
      "cr": 3.75,
      "revenue": 45000.0,
      "payout": 30000.0,
      "profit": 15000.0,
      "epc": 25.0,
      "approveRate": 80.0
    },
    "timeSeries": [
      {
        "bucketStart": "2026-05-14T10:00:00.000Z",
        "clicks": 10,
        "conversions": 1,
        "cr": 10.0,
        "revenue": 1000.0,
        "payout": 700.0,
        "profit": 300.0,
        "epc": 70.0,
        "approveRate": 100.0
      }
    ]
  },
  "meta": {
    "bucketSize": "hour",
    "rangeHours": 24,
    "timezone": "UTC"
  }
}
```

##### Validation Rules

- Return exactly 24 hourly buckets.
- Buckets with no data must still be present with zero values.

##### Error Cases

- `401 UNAUTHORIZED`
- `403 FORBIDDEN`

#### Tests

- Dashboard endpoint aggregation tests.
- Test-data exclusion tests.
- Manual-data inclusion tests.
- Zero-filled bucket tests.
- Frontend smoke test for `/dashboard`.

#### DoD

- `/dashboard` is the admin main page.
- All chart cards use backend-provided hourly series.
- Test data is excluded.
- Manual data is included.

#### Open Questions

- None.

### Stage 12. Backend-side filters for transactions and conversions

#### Goal

Move transaction and conversion filtering fully to backend and expand admin visibility tools.

#### Backend tasks

- Expand `GET /api/v1/clicks` filters.
- Expand `GET /api/v1/conversions` filters.
- Keep internal naming:
  - UI says `Transactions`
  - backend route remains `clicks`
- Add backend pagination and total count to both endpoints.
- Allow `admin` and `manager`.

#### Frontend tasks

- Replace local-only filter behavior with query-param-driven backend filtering.
- Reflect selected filters in page URL.
- Keep UI label `Transactions` while sending backend params such as `affiliateId` and `clickId`.

#### Database migrations

- Add indexes required by new filters:
  - clicks: date, offer, affiliate, country, click ID, IP, sub1-sub5, advertiser relation path
  - conversions: date, offer, goal, affiliate, advertiser relation path, status, click ID, external transaction ID, source
- Do not add denormalized columns unless current joins are too expensive and a measured query plan requires them.

#### API contracts

##### Endpoint
`GET /api/v1/clicks`

##### Auth
`admin`, `manager`

##### Query Params

- `dateFrom`: string `YYYY-MM-DD`, optional
- `dateTo`: string `YYYY-MM-DD`, optional
- `offerId`: UUID or public ID string, optional
- `affiliateId`: UUID or public ID string, optional
- `advertiserId`: UUID or public ID string, optional
- `countryCode`: string, optional
- `redirectOutcome`: string, optional
- `clickId`: string, optional
- `sub1`: string, optional
- `sub2`: string, optional
- `sub3`: string, optional
- `sub4`: string, optional
- `sub5`: string, optional
- `ip`: string, optional
- `limit`: number, optional, default `20`
- `offset`: number, optional, default `0`

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "clickId": "clk_123",
      "offerId": "a44dc597-9cb5-4ad8-9b07-96a0d91a4e28",
      "offerPublicId": "#O18",
      "affiliateId": "5cb79d78-c7c6-4702-a0d9-3fd727c58650",
      "affiliatePublicId": "#P12",
      "advertiserId": "49b7682e-3b55-4aa1-ac9f-7f01b128f841",
      "advertiserPublicId": "#A9",
      "countryCode": "RU",
      "ip": "203.0.113.10",
      "sub1": "camp1",
      "sub2": null,
      "sub3": null,
      "sub4": null,
      "sub5": null,
      "redirectOutcome": "redirected",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

##### Validation Rules

- Date range must be valid and `dateFrom <= dateTo`.
- Public IDs must resolve to the correct entity type.

##### Error Cases

- `400 VALIDATION_ERROR`

##### Endpoint
`GET /api/v1/conversions`

##### Auth
`admin`, `manager`

##### Query Params

- `dateFrom`: string `YYYY-MM-DD`, optional
- `dateTo`: string `YYYY-MM-DD`, optional
- `offerId`: UUID or public ID string, optional
- `goalId`: UUID, optional
- `affiliateId`: UUID or public ID string, optional
- `advertiserId`: UUID or public ID string, optional
- `status`: `pending | approved | rejected | cancelled`, optional
- `clickId`: string, optional
- `conversionId`: UUID, optional
- `externalTransactionId`: string, optional
- `revenueFrom`: number, optional
- `revenueTo`: number, optional
- `payoutFrom`: number, optional
- `payoutTo`: number, optional
- `source`: `normal | manual | test`, optional
- `limit`: number, optional, default `20`
- `offset`: number, optional, default `0`

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "1be94604-93d6-4c22-a2ae-f0f5f7c4768d",
      "clickId": "clk_123",
      "offerId": "a44dc597-9cb5-4ad8-9b07-96a0d91a4e28",
      "offerPublicId": "#O18",
      "goalId": "4dad1b15-2d7f-455e-b00e-a6029a9e14c5",
      "affiliateId": "5cb79d78-c7c6-4702-a0d9-3fd727c58650",
      "affiliatePublicId": "#P12",
      "advertiserId": "49b7682e-3b55-4aa1-ac9f-7f01b128f841",
      "advertiserPublicId": "#A9",
      "status": "approved",
      "source": "manual",
      "externalTransactionId": "order_555",
      "revenue": 1000.0,
      "payout": 700.0,
      "profit": 300.0,
      "currency": "RUB",
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

##### Validation Rules

- Money range filters must use non-negative numbers.
- `status` must be valid.
- `source` must resolve to stored source flags.

##### Error Cases

- `400 VALIDATION_ERROR`

#### Tests

- Query validation tests for both endpoints.
- Filter combination tests.
- Pagination tests.
- Public ID resolution tests.
- Manager authorization tests.

#### DoD

- Transactions and conversions are filtered on backend.
- URL query params fully represent current filters.
- Frontend does not fetch all data and filter locally.

#### Open Questions

- None.

### Stage 13. Aggregated statistics by selected partner and/or offer

#### Goal

Implement backend aggregation for selected partner and/or offer. The MVP behavior is filtering plus aggregation, not arbitrary client-side grouping.

#### Backend tasks

- Add filtered aggregate stats endpoint.
- Support filters:
  - partner only
  - offer only
  - partner + offer
  - date range
- Return aggregated metrics:
  - clicks
  - conversions
  - CR
  - revenue
  - payout
  - profit
  - EPC
  - approve rate
- Include manual records.
- Exclude test records.

#### Frontend tasks

- Add aggregate stats controls for partner and offer selection.
- Keep the UI wording simple: selection filters, not free-form grouping builder.
- Render totals only from backend response.

#### Database migrations

- None required if existing raw tables or rollups can serve the aggregation.
- Add supporting indexes only if Stage 12 indexes are insufficient.

#### API contracts

##### Endpoint
`GET /api/v1/admin/stats/summary`

##### Auth
`admin`, `manager`

##### Query Params

- `affiliateId`: UUID or public ID string, optional
- `offerId`: UUID or public ID string, optional
- `dateFrom`: string `YYYY-MM-DD`, optional
- `dateTo`: string `YYYY-MM-DD`, optional

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": {
    "clicks": 1200,
    "conversions": 45,
    "cr": 3.75,
    "revenue": 45000.0,
    "payout": 30000.0,
    "profit": 15000.0,
    "epc": 25.0,
    "approveRate": 80.0,
    "currency": "RUB"
  },
  "meta": {
    "filters": {
      "affiliateId": "#P12",
      "offerId": "#O18",
      "dateFrom": "2026-05-01",
      "dateTo": "2026-05-15"
    }
  }
}
```

##### Validation Rules

- At least one of `affiliateId`, `offerId`, `dateFrom`, `dateTo` may be absent.
- Returned metrics must exclude test data and include manual data.

##### Error Cases

- `400 VALIDATION_ERROR`

#### Tests

- Aggregate calculation tests for each filter combination.
- Manual inclusion tests.
- Test exclusion tests.
- Public ID filter resolution tests.

#### DoD

- Backend returns aggregated stats for partner, offer, or both.
- UI uses backend aggregation instead of client-side totals.

#### Open Questions

- None.

### Stage 14. CSV adjustments

#### Goal

Add `Adjustments` workflow for manual CSV ingestion that participates in statistics and payouts and stays fully auditable.

#### Backend tasks

- Add adjustment batch model.
- Support CSV upload for:
  - conversions
  - payable clicks
- Support partner modes:
  - `single_partner`
  - `per_row_partner`
- Add preview/validation before apply.
- Add apply flow.
- Add batch detail view data.
- Add batch cancellation flow.
- Manual conversion must not require synthetic click.
- Recommended manual conversion model:
  - `clickId` nullable
  - stores `affiliateId`, `offerId`, `goalId` directly
  - `source = "manual"`
  - `manualAdjustmentBatchId` set
  - `createdBy` set
- Manual clicks model:
  - `source = "manual"`
  - `affiliateId`
  - `offerId`
  - optional `goalId`
  - `manualAdjustmentBatchId`
  - `createdBy`
- On apply and cancel, trigger stats recalculation for affected date range.
- Write audit events for upload preview, apply, and cancellation.

#### Frontend tasks

- Add `Adjustments` page in admin.
- Add controls:
  - upload type
  - partner mode
  - selected partner in single-partner mode
  - default offer
  - default goal
  - default status
- Add CSV help section with column specs and examples.
- Add preview grid with row errors and warnings.
- Add apply confirmation.
- Add batch list and batch detail views.
- Add cancellation action for applied batches.

#### Database migrations

- Create `manual_adjustment_batches` table.
- Add `source`, `manual_adjustment_batch_id`, `created_by`, `is_cancelled`, `cancelled_at` to conversion and manual-click storage where absent.
- Make conversion `click_id` nullable if not already nullable.
- Add `external_transaction_id` field to conversions if absent.
- Add indexes for batch lookup and recalculation.

#### API contracts

CSV column specification for conversion upload:

- Required for both modes:
  - `offerId`
  - `goalId`
  - `status`
  - `revenue`
  - `payout`
  - `conversionAt`
- Required only for `per_row_partner`:
  - `affiliateId`
- Optional:
  - `clickId`
  - `externalTransactionId`
  - `note`

CSV column specification for payable click upload:

- Required for both modes:
  - `offerId`
  - `clickAt`
  - `payout`
- Required only for `per_row_partner`:
  - `affiliateId`
- Optional:
  - `goalId`
  - `clickId`
  - `externalTransactionId`
  - `note`

Validation error format:

```json
{
  "row": 7,
  "field": "goalId",
  "code": "NOT_FOUND",
  "message": "Goal not found",
  "value": "#G99"
}
```

##### Endpoint
`POST /api/v1/admin/adjustments/preview`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body
`multipart/form-data`

Required form fields:

- `uploadType`: `conversion | payable_click`
- `partnerMode`: `single_partner | per_row_partner`
- `affiliateId`: required in `single_partner` mode
- `defaultOfferId`: optional
- `defaultGoalId`: optional
- `defaultStatus`: optional
- `file`: CSV file

##### Response

```json
{
  "success": true,
  "data": {
    "batchDraftId": "0cb2b353-b014-4437-b304-cd4ef0c7407c",
    "uploadType": "conversion",
    "partnerMode": "single_partner",
    "rowCount": 2,
    "validRowCount": 1,
    "invalidRowCount": 1,
    "rows": [
      {
        "row": 1,
        "valid": true,
        "normalized": {
          "affiliateId": "5cb79d78-c7c6-4702-a0d9-3fd727c58650",
          "offerId": "a44dc597-9cb5-4ad8-9b07-96a0d91a4e28",
          "goalId": "4dad1b15-2d7f-455e-b00e-a6029a9e14c5",
          "status": "approved",
          "revenue": 1000.0,
          "payout": 700.0,
          "conversionAt": "2026-05-15T10:00:00.000Z",
          "clickId": null,
          "externalTransactionId": "order_555"
        },
        "errors": []
      }
    ]
  },
  "meta": null
}
```

##### Validation Rules

- Preview does not write payable records into stats tables.
- Validation must resolve public IDs and UUIDs.
- `payout <= revenue` for manual conversions.

##### Error Cases

- `400 VALIDATION_ERROR`
- `413 PAYLOAD_TOO_LARGE` if upload limit is exceeded

##### Endpoint
`POST /api/v1/admin/adjustments/batches/:batchId/apply`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "confirm": true
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "0cb2b353-b014-4437-b304-cd4ef0c7407c",
      "status": "applied",
      "uploadType": "conversion",
      "rowCount": 2,
      "appliedRowCount": 1,
      "invalidRowCount": 1,
      "appliedAt": "2026-05-15T10:00:00.000Z"
    }
  },
  "meta": null
}
```

##### Validation Rules

- Only previewed draft batch can be applied.
- Apply must be idempotent.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `409 CONFLICT`

##### Endpoint
`GET /api/v1/admin/adjustments/batches`

##### Auth
`admin`, `manager`

##### Query Params

- `limit`: number, optional, default `20`
- `offset`: number, optional, default `0`
- `status`: `draft | applied | cancelled`, optional
- `uploadType`: `conversion | payable_click`, optional

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "0cb2b353-b014-4437-b304-cd4ef0c7407c",
      "status": "applied",
      "uploadType": "conversion",
      "partnerMode": "single_partner",
      "rowCount": 2,
      "appliedRowCount": 1,
      "createdBy": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
      "createdAt": "2026-05-15T10:00:00.000Z",
      "appliedAt": "2026-05-15T10:05:00.000Z",
      "cancelledAt": null
    }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

##### Validation Rules

- List returns batches only.

##### Error Cases

- `400 VALIDATION_ERROR`

##### Endpoint
`GET /api/v1/admin/adjustments/batches/:batchId`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body
None.

##### Response
Batch summary plus normalized rows, errors, and apply/cancel state.

##### Validation Rules

- Detail endpoint must return enough data for audit review.

##### Error Cases

- `404 NOT_FOUND`

##### Endpoint
`POST /api/v1/admin/adjustments/batches/:batchId/cancel`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "reason": "Operator cancelled batch"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "0cb2b353-b014-4437-b304-cd4ef0c7407c",
      "status": "cancelled",
      "cancelledAt": "2026-05-15T10:10:00.000Z"
    }
  },
  "meta": null
}
```

##### Validation Rules

- Cancel must logically reverse batch financial/statistical effect.
- Cancellation must be idempotent.

##### Error Cases

- `404 NOT_FOUND`
- `409 CONFLICT`

#### Tests

- CSV parsing and validation tests.
- Preview-only no-write tests.
- Apply flow tests.
- Cancel flow tests.
- Manual conversion without click ID tests.
- Recalculation trigger tests.
- Audit tests.

#### DoD

- Admin and manager can preview, apply, inspect, and cancel adjustment batches.
- Manual conversions and payable clicks participate in payouts and statistics.
- Test data remains excluded.
- Every manual record is linked to a batch and creator.

#### Open Questions

- None.

### Stage 15. Conversion status and cancellation model

#### Goal

Define the authoritative conversion status model and make financial impact depend on status.

#### Backend tasks

- Extend conversion status model to:
  - `pending`
  - `approved`
  - `rejected`
  - `cancelled`
- Only `approved` conversions count as payable.
- Status change must update financial statistics and recalculation logic.
- Manual conversions can be cancelled.
- Test conversions must never become payable.
- Persist status history through audit log at minimum.
- Add optional operator reason/note storage in audit metadata for status changes.

#### Frontend tasks

- Update conversion status controls to support `cancelled`.
- Show current status clearly in conversion lists/details.
- Show status change confirmation for destructive states such as `cancelled`.

#### Database migrations

- Extend conversion status constraint or enum to include `cancelled`.
- Add optional `cancelled_at` if operationally useful.
- Add `external_transaction_id` or status-reason columns only if not already added in Stage 14 and required for workflow clarity.

#### API contracts

##### Endpoint
`POST /api/v1/conversions/:conversionId/status`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "status": "cancelled",
  "reason": "Batch cancelled"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "conversion": {
      "id": "1be94604-93d6-4c22-a2ae-f0f5f7c4768d",
      "status": "cancelled",
      "revenue": 1000.0,
      "payout": 700.0,
      "profit": 300.0,
      "source": "manual",
      "updatedAt": "2026-05-15T10:00:00.000Z"
    }
  },
  "meta": null
}
```

##### Validation Rules

- `status` must be one of `pending`, `approved`, `rejected`, `cancelled`.
- Test conversion cannot become payable regardless of requested status.
- Status change must trigger stats recalculation for affected date.

##### Error Cases

- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `409 CONFLICT`

Audit/event history requirement:

- Every conversion status change must record:
  - old status
  - new status
  - actor
  - timestamp
  - reason if provided

#### Tests

- Status validation tests.
- Approved-only payable rule tests.
- Manual conversion cancellation tests.
- Test-conversion payable protection tests.
- Audit/history tests.

#### DoD

- Conversion status model includes `cancelled`.
- Only approved conversions are payable.
- Status changes update statistics and audit history.

#### Open Questions

- None.

### Stage 16. Daily stats and recalculation

#### Goal

Make daily stats deterministic and compatible with normal, manual, cancelled, and test-excluded records.

#### Backend tasks

- Update daily stats logic to account for:
  - normal clicks
  - normal conversions
  - manual conversions
  - manual payable clicks
  - cancelled records
  - conversion statuses
  - test exclusion
- Recalculation must be deterministic from source tables.
- Add recalculation service for date range.
- Use queue execution for recalculation because BullMQ already exists in the stack.
- Allow manual trigger from admin scope.

#### Frontend tasks

- Do not add new recalculation UI in this stage.
- Keep this stage backend-driven and operator-triggered through API or internal tooling.

#### Database migrations

- Extend `daily_stats` schema to store every total required by Stages 14 and 15.
- Include fields needed for approved, rejected, cancelled, manual, revenue, payout, and profit-related rollup values.
- Do not create a second parallel daily stats table.

#### API contracts

Internal service contract:

`recalculateDailyStats({ dateFrom, dateTo, triggeredByUserId, triggeredByRole, reason })`

Service guarantees:

- deterministic output for the same committed source data
- full overwrite of affected daily rollups
- exclusion of test records
- inclusion of manual records

##### Endpoint
`POST /api/v1/admin/stats/recalculate`

##### Auth
`admin`, `manager`

##### Query Params
None.

##### Request Body

```json
{
  "dateFrom": "2026-05-01",
  "dateTo": "2026-05-15",
  "reason": "Adjustment batch apply"
}
```

##### Response

```json
{
  "success": true,
  "data": {
    "jobId": "daily-stats-recalc-20260515-1",
    "status": "queued",
    "dateFrom": "2026-05-01",
    "dateTo": "2026-05-15"
  },
  "meta": null
}
```

##### Validation Rules

- `dateFrom` and `dateTo` required.
- `dateFrom <= dateTo`.

##### Error Cases

- `400 VALIDATION_ERROR`
- `409 CONFLICT` when duplicate recalculation job for same range is already running

#### Tests

- Rollup determinism tests.
- Financial consistency tests before and after recalculation.
- Test exclusion tests.
- Manual inclusion tests.
- Queue job execution tests.

#### DoD

- Daily stats reflect normal, manual, cancelled, and approved-only payable logic.
- Recalculation works for arbitrary date ranges.
- Recalculation is deterministic.

#### Open Questions

- None.

### Stage 17. Backend-side search and filters across all sections

#### Goal

Apply backend-side search, filters, sorting, and pagination consistently across admin sections.

#### Backend tasks

- Apply backend-side search/filter/sort/pagination to:
  - main dashboard where relevant
  - offers
  - partners
  - advertisers
  - offer requests
  - transactions/clicks
  - conversions
  - postback logs
  - goals where listed separately
  - managers
  - adjustment batches
- Add standard query contract:
  - `search`
  - `sortBy`
  - `sortOrder`
  - `limit`
  - `offset`
- Keep resource-specific filters additive.
- Frontend must not fetch all data and filter locally.

#### Frontend tasks

- Persist list filters in URL query params.
- Restore list state from URL on page load.
- Use backend totals for pagination controls.

#### Database migrations

- Add indexes for searchable columns used by backend search:
  - public IDs
  - names
  - emails
  - click IDs
  - external transaction IDs
- Keep the search implementation backend-side.

#### API contracts

Standard pagination response shape:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 0,
    "limit": 20,
    "offset": 0,
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }
}
```

Standard query param meanings:

- `search`: free-text search string
- `sortBy`: stable field name supported by the resource
- `sortOrder`: `asc | desc`
- `limit`: page size
- `offset`: row offset

Required default sort:

- default `sortBy=createdAt`
- default `sortOrder=desc`

Resource examples:

- `GET /api/v1/offers?search=#O18&sortBy=createdAt&sortOrder=desc&limit=20&offset=0`
- `GET /api/v1/affiliates?search=partner@example.com`
- `GET /api/v1/advertisers?search=#A9`
- `GET /api/v1/admin/managers?search=manager@example.com`
- `GET /api/v1/admin/adjustments/batches?status=applied`

Validation rules:

- Reject unsupported `sortBy` per resource.
- Reject unsupported `sortOrder`.
- Keep search backend-side.

Error cases:

- `400 VALIDATION_ERROR`

#### Tests

- Shared pagination contract tests.
- Search correctness tests per resource.
- Sort validation tests.
- Frontend URL state smoke tests.

#### DoD

- All listed admin sections use backend-side search/filter/pagination/sorting.
- URL query params are shareable and restorable.
- Frontend local filtering is removed from large data sections.

#### Open Questions

- None.

### Stage 18. Audit log expansion

#### Goal

Expand audit logging so all critical admin and financial actions are reviewable with old/new values and actor context.

#### Backend tasks

- Expand audit logging coverage for all critical actions from Section 2.6.
- Standardize audit entry shape:
  - `actorId`
  - `actorRole`
  - `action`
  - `entityType`
  - `entityId`
  - `oldValue`
  - `newValue`
  - `createdAt`
  - `metadata`
- Keep audit writes inside the same transaction as the business change where possible.
- Expose admin audit list endpoint.

#### Frontend tasks

- Add a minimal admin-only audit log page.
- Show:
  - actor
  - action
  - entity
  - timestamp
  - before/after values
  - metadata
- Add filters by entity type, actor, and date range.

#### Database migrations

- Extend existing `audit_events` table if current schema does not already support the required fields.
- Add indexes for:
  - `entity_type`
  - `entity_id`
  - `actor_user_id`
  - `created_at`

#### API contracts

##### Endpoint
`GET /api/v1/admin/audit-log`

##### Auth
`admin`, `manager`

##### Query Params

- `entityType`: string, optional
- `entityId`: UUID or public ID string, optional
- `actorId`: UUID, optional
- `dateFrom`: string `YYYY-MM-DD`, optional
- `dateTo`: string `YYYY-MM-DD`, optional
- `limit`: number, optional, default `20`
- `offset`: number, optional, default `0`

##### Request Body
None.

##### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "0d0ce48b-f649-48d5-9885-c7ff8e5e1960",
      "actorId": "d2d2e881-40fb-4d78-b05e-8df9b50f55f1",
      "actorRole": "manager",
      "action": "conversion.status_changed",
      "entityType": "conversion",
      "entityId": "1be94604-93d6-4c22-a2ae-f0f5f7c4768d",
      "oldValue": {
        "status": "approved"
      },
      "newValue": {
        "status": "cancelled"
      },
      "metadata": {
        "reason": "Batch cancelled"
      },
      "createdAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

##### Validation Rules

- `oldValue` and `newValue` must be structured JSON objects where the action has a before/after diff.
- `metadata` must hold non-core context only.

##### Error Cases

- `400 VALIDATION_ERROR`
- `403 FORBIDDEN`

#### Tests

- Audit write tests for all listed critical actions.
- Transactional consistency tests where audit and business write occur together.
- Audit read endpoint tests.

#### DoD

- All critical actions from Section 2.6 create audit entries.
- Audit entries contain actor, action, entity, old/new values, timestamp, and metadata.
- Audit data is queryable in admin.

#### Open Questions

- None.

### Stage 19. End-to-end validation

#### Goal

Validate the full expansion end-to-end after all previous stages are complete.

#### Backend tasks

- Run end-to-end validation scenarios across auth, access, offers, goals, postbacks, adjustments, stats, and audit.
- Confirm that manual and test data rules are enforced end-to-end.
- Confirm that manager permissions match the global rules exactly.

#### Frontend tasks

- Run end-to-end validation scenarios across admin, manager, partner, and advertiser UI.
- Confirm terminology changes are present in UI while backend names remain unchanged.

#### Database migrations

- None in this stage unless a previous stage left an approved corrective migration explicitly requested by the user.

#### API contracts

- No new product API contracts in this stage.
- Use existing contracts from Stages `1` to `18`.

#### Tests

Validation scenarios must cover:

- admin
- manager
- partner
- advertiser
- offer access
- postback
- test postback
- manual CSV adjustment
- statistics
- audit

Required scenario list:

1. Admin creates manager, manager logs in, manager cannot manage managers or questionnaires.
2. Admin assigns responsible manager to partner and advertiser.
3. Admin sees partner/advertiser internal info; partner/advertiser do not.
4. Partner and advertiser questionnaire gating works.
5. Public, on-request, and private offer visibility behaves correctly.
6. Goal revenue/payout/profit logic works and profit is backend-derived.
7. Generated postback JS uses backend goal configuration.
8. Test postback creates only test data and does not affect stats or money.
9. Manual CSV adjustment updates stats and payouts after apply.
10. Batch cancellation reverses manual batch effect.
11. Conversion cancellation updates stats and payout logic.
12. Dashboard and filtered stats exclude test data and include manual data.
13. Audit log shows all critical actions with old/new values.

#### DoD

- All previous stages are validated together.
- Admin, manager, partner, and advertiser behavior matches the business rules in this document.
- Financial totals are backend-authoritative across normal, manual, cancelled, and test scenarios.
- Final expansion is ready for user review without hidden product decisions by the coding agent.

#### Open Questions

- None.

## 6. API Contract Style

For every stage that touches API, use this exact contract style.

General API rules:

- Keep API prefix `/api/v1`.
- Keep existing route families where they already exist.
- Use `affiliateId` in API, not `partnerId`.
- Use `clickId` in API, not `transactionId`.
- Use camelCase field names.
- Use UUID/internal IDs in paths unless the contract explicitly states support for public IDs in filters.
- Use backend response envelope:

```json
{
  "success": true,
  "data": {},
  "meta": null
}
```

- Paginated list responses must return:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 0,
    "limit": 20,
    "offset": 0
  }
}
```

- Money fields in new or updated admin-facing contracts should use:
  - `revenue`
  - `payout`
  - `profit`
  - `currency`

- Error status codes and keys must stay consistent with current backend conventions:
  - `400 VALIDATION_ERROR`
  - `401 UNAUTHORIZED`
  - `401 INVALID_CREDENTIALS`
  - `403 FORBIDDEN`
  - `404 NOT_FOUND`
  - `409 CONFLICT`
  - `409 DUPLICATE_CONVERSION`
  - `500 INTERNAL_ERROR`

Required subsection format for each endpoint:

### Endpoint
`METHOD /api/...`

### Auth
Allowed roles.

### Query Params
List names, types, required/optional, defaults.

### Request Body
JSON example.

### Response
JSON example.

### Validation Rules

### Error Cases
Include expected status codes and error keys.

Use stable field names.
Do not invent inconsistent naming.
Prefer existing project naming conventions observed in current routes and responses.

## 7. Testing Requirements

General test expectations for all implementation stages:

- backend unit tests for services
- backend API tests for endpoints
- authorization tests
- validation tests
- financial calculation tests
- migration/backfill checks
- frontend smoke tests where existing setup allows it

Additional required principles:

- Any stage that changes money or stats must include regression tests for financial correctness.
- Any stage that changes access must include positive and negative authorization cases.
- Any stage that adds migrations must include forward migration verification and data backfill verification.
- Any stage that introduces public IDs must include deterministic backfill tests.
- Any stage that introduces audit writes must verify audit payload content, not only row existence.

## 8. Final Checklist

- [x] Scope fully documented.
- [x] All 20 stages documented.
- [x] All known business decisions recorded.
- [x] API contracts included.
- [x] Open questions isolated.
- [x] No implementation code changed.
