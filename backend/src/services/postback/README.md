# Postback Services

`/track/postback` uses one token per offer. The token authenticates and resolves the offer, while `goalId`/`goal_id` selects the conversion goal inside that offer.

The admin/manager offer page shows one example postback request per goal. Each example reuses the same offer token, sets a different `goal_id`, includes the required fields, and never sends trusted money values from the advertiser side.

The postback token is a server-side secret. It must never be exposed in partner-facing UI, browser JavaScript bundles, or client-side analytics snippets.

## Request contract

- `token`: required offer postback token.
- `clickId` or `click_id`: required click tracking identifier.
- `goalId` or `goal_id`: required goal UUID. No silent default-goal fallback is used.
- `status`: optional conversion status, defaults to `pending`.
- `externalTransactionId`: optional advertiser order/transaction id.
- `externalId`, `external_id`, `transactionId`, and `transaction_id`: accepted aliases for the same external transaction field.
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

### Example request pattern

```bash
curl -X POST "https://platform.example.com/track/postback" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "offer-postback-token",
    "goal_id": "goal-uuid",
    "click_id": "CLICK_ID",
    "external_id": "EXTERNAL_ID",
    "status": "approved",
    "signature": "CALCULATED_SIGNATURE"
  }'
```

## Goal resolution and money

- `goalId` must belong to the offer resolved from the token.
- Partner-specific goal rates override base goal `revenue`/`payout` when configured.
- Goal limits are checked for the selected goal only.
- Revenue, payout, and profit are calculated on the backend from the selected goal/rate.
- Request `revenue`, `payout`, and `profit` values are not trusted for conversion finance.
- Legacy `payoutRub` input may still be present for signature compatibility, but it is not authoritative for stored money.
- Approved conversions count as confirmed money.
- Pending conversions count as unconfirmed money.
- Rejected and cancelled conversions do not count as payable money.
- Test conversions, if created through a dedicated test flow, must not affect money or main statistics.
