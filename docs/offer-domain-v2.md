# Offer Domain v2

This document reflects the current implemented offer model and partner visibility behavior.

## Offer Core

An offer belongs to one advertiser and is managed from the admin area by `admin` and `manager`.

Current operational fields include:

- advertiser ownership
- title and description
- category
- target URL
- optional preview URL
- optional fallback URL
- status
- visibility mode
- targeting strict flag
- postback token

Current status values:

- `active`
- `paused`
- `archived`

Legacy `inactive` can still appear in old data paths, but partner access logic treats only active offers as available.

## Goals And Rates

Offers now use goal-based finance instead of offer-level payout.

Each goal stores:

- `name`
- `type`
- `revenue`
- `payout`
- backend-derived `profit`
- default flag
- optional limit configuration

Rules:

- `payout` cannot exceed `revenue`
- postbacks must reference a concrete goal with `goalId` or `goal_id`
- partner-specific goal rates can override base `revenue` and `payout`
- conversions snapshot the selected goal and resolved money at creation time
- goal limits are enforced per selected goal, not per whole offer

## Visibility Model

Current visibility modes:

- `public`
- `on_request`
- `private`

Partner-facing behavior:

- `public` offers are fully visible unless a hidden override blocks them.
- `on_request` offers are visible without full access, but only a restricted description-safe view is returned until access is granted.
- `private` offers are not visible until explicit access is granted.

Priority rules:

1. Hidden partner override wins over everything else.
2. Explicit exclusion or rejection blocks full access.
3. Manual allow grants full access for `private` and `on_request`.
4. `on_request` without access stays visible in restricted mode only.

## Partner-Safe Data

Partner offer APIs intentionally exclude internal and advertiser-facing data.

Partners do not receive:

- advertiser identity
- postback token
- revenue
- profit
- internal notes

Partners can receive:

- description
- public offer metadata
- payout or effective payout from allowed goals
- access/request state
- safe visibility status

## Tracking And Postback

Tracking uses:

- `/track/click` to create the click and bind partner plus offer
- `/track/postback` to create the conversion for a selected goal

Postback rules:

- one offer token authenticates the offer
- `goalId` or `goal_id` is required
- the goal must belong to the token-resolved offer
- the click must belong to the same offer
- offer visibility is rechecked for the partner before conversion creation
- backend money values are authoritative

## Manual Adjustments

Manual adjustments participate in the same offer and goal model.

- Manual conversions do not require synthetic clicks.
- Manual records use `source = "manual"`.
- Manual conversions store direct `affiliateId`, `offerId`, and `goalId`.
- Manual clicks and conversions are linked to an adjustment batch and creator.
- Manual records participate in stats and payouts.
- Batch cancellation and CSV export are intentionally not implemented in the current scope.

## Stats And Money

Offer-related money rules are shared across dashboard and summary stats:

- approved conversions count as confirmed money
- pending conversions count as unconfirmed money
- rejected and cancelled conversions do not count as payable money
- manual records are included
- test records are excluded

Stats recalculation is manual through the admin API. There is no scheduled stats job in the current scope.
