# Postback Services

`/track/postback` uses one token per offer. The token authenticates and resolves the offer, while `goalId`/`goal_id` selects the conversion goal inside that offer.

## Request contract

- `token`: required offer postback token.
- `clickId` or `click_id`: required click tracking identifier.
- `goalId` or `goal_id`: required goal UUID. No silent default-goal fallback is used.
- `status`: optional conversion status, defaults to `pending`.
- `externalTransactionId`: optional advertiser order/transaction id.
- `signature`: required legacy request signature.

Both `POST /track/postback` JSON bodies and `GET /track/postback` query params are supported.

### Example GET

```text
GET /track/postback?token=<offer_token>&click_id=<click_id>&goal_id=<goal_uuid>&externalTransactionId=order-123&status=approved&signature=<signature>
```

### Example POST

```json
{
  "token": "offer_conversion_token",
  "clickId": "click-id-or-tracking-token",
  "goalId": "goal-uuid",
  "externalTransactionId": "order-123",
  "status": "approved",
  "signature": "signed-value"
}
```

## Goal resolution and money

- `goalId` must belong to the offer resolved from the token.
- Partner-specific goal rates override base goal `revenue`/`payout` when configured.
- Goal limits are checked for the selected goal only.
- Revenue, payout, and profit are calculated on the backend from the selected goal/rate.
- Request `revenue`, `payout`, and `profit` values are not trusted for conversion finance.
- Legacy `payoutRub` input may still be present for signature compatibility, but it is not authoritative for stored money.
