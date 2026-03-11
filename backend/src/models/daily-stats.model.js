import pool from '../db.js';

function buildFilterClause({ offerId, affiliateId, dateFrom, dateTo } = {}) {
  const conditions = [];
  const params = [];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`date >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`date <= $${params.length}`);
  }

  if (offerId) {
    params.push(offerId);
    conditions.push(`offer_id = $${params.length}`);
  }

  if (affiliateId) {
    params.push(affiliateId);
    conditions.push(`affiliate_id = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { whereClause, params };
}

function normalizeDateInput(value) {
  if (!value) {
    throw new Error('date is required');
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Invalid date string');
    }

    return parsed;
  }

  throw new Error('Unsupported date value');
}

function toUtcDateString(value) {
  const date = normalizeDateInput(value);
  return date.toISOString().slice(0, 10);
}

function normalizePayoutValue(value) {
  if (value === null || value === undefined) {
    return '0';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '0';
    }

    return value.toString(10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '0';
    }

    return trimmed;
  }

  return '0';
}

export async function upsertClickRollup({ startDate, endDate }) {
  if (!startDate || !endDate) {
    throw new Error('startDate and endDate are required for click rollup');
  }

  const result = await pool.query(
    `
      WITH params AS (
        SELECT $1::date AS start_date, $2::date AS end_date
      ),
      rollup AS (
        SELECT
          DATE(c.created_at AT TIME ZONE 'UTC') AS rollup_date,
          c.offer_id,
          c.affiliate_id,
          COUNT(*)::int AS clicks_count
        FROM clicks c
        CROSS JOIN params p
        WHERE c.created_at >= p.start_date
          AND c.created_at < p.end_date + INTERVAL '1 day'
        GROUP BY rollup_date, c.offer_id, c.affiliate_id
      )
      INSERT INTO daily_stats (
        date,
        offer_id,
        affiliate_id,
        clicks_count,
        created_at,
        updated_at
      )
      SELECT
        rollup_date,
        offer_id,
        affiliate_id,
        clicks_count,
        NOW(),
        NOW()
      FROM rollup
      ON CONFLICT (date, offer_id, affiliate_id)
      DO UPDATE
      SET
        clicks_count = EXCLUDED.clicks_count,
        updated_at = NOW();
    `,
    [startDate, endDate],
  );

  return {
    startDate,
    endDate,
    rowsProcessed: result.rowCount ?? 0,
  };
}

export async function upsertConversionRollup({ startDate, endDate }) {
  if (!startDate || !endDate) {
    throw new Error('startDate and endDate are required for conversion rollup');
  }

  const result = await pool.query(
    `
      WITH params AS (
        SELECT $1::date AS start_date, $2::date AS end_date
      ),
      rollup AS (
        SELECT
          DATE(c.created_at AT TIME ZONE 'UTC') AS rollup_date,
          c.offer_id,
          c.affiliate_id,
          COUNT(*)::int AS conversions_count,
          COUNT(*) FILTER (WHERE c.status = 'approved')::int AS approved_conversions_count,
          COUNT(*) FILTER (WHERE c.status = 'rejected')::int AS rejected_conversions_count,
          COALESCE(SUM(c.payout_rub), 0)::numeric(14, 2) AS payout_total_rub
        FROM conversions c
        CROSS JOIN params p
        WHERE c.created_at >= p.start_date
          AND c.created_at < p.end_date + INTERVAL '1 day'
        GROUP BY rollup_date, c.offer_id, c.affiliate_id
      )
      INSERT INTO daily_stats (
        date,
        offer_id,
        affiliate_id,
        conversions_count,
        approved_conversions_count,
        rejected_conversions_count,
        payout_total_rub,
        created_at,
        updated_at
      )
      SELECT
        rollup_date,
        offer_id,
        affiliate_id,
        conversions_count,
        approved_conversions_count,
        rejected_conversions_count,
        payout_total_rub,
        NOW(),
        NOW()
      FROM rollup
      ON CONFLICT (date, offer_id, affiliate_id)
      DO UPDATE
      SET
        conversions_count = EXCLUDED.conversions_count,
        approved_conversions_count = EXCLUDED.approved_conversions_count,
        rejected_conversions_count = EXCLUDED.rejected_conversions_count,
        payout_total_rub = EXCLUDED.payout_total_rub,
        updated_at = NOW();
    `,
    [startDate, endDate],
  );

  return {
    startDate,
    endDate,
    rowsProcessed: result.rowCount ?? 0,
  };
}

export async function getDailyStatsTotals({
  offerId,
  affiliateId,
  dateFrom,
  dateTo,
} = {}) {
  const { whereClause, params } = buildFilterClause({
    offerId,
    affiliateId,
    dateFrom,
    dateTo,
  });

  const result = await pool.query(
    `
      SELECT
        COALESCE(SUM(clicks_count), 0)::bigint AS clicks_total,
        COALESCE(SUM(conversions_count), 0)::bigint AS conversions_total,
        COALESCE(SUM(approved_conversions_count), 0)::bigint AS approved_total,
        COALESCE(SUM(rejected_conversions_count), 0)::bigint AS rejected_total,
        COALESCE(SUM(payout_total_rub), 0)::numeric(14, 2) AS payout_total_rub
      FROM daily_stats
      ${whereClause};
    `,
    params,
  );

  const row = result.rows[0] ?? {
    clicks_total: 0,
    conversions_total: 0,
    approved_total: 0,
    rejected_total: 0,
    payout_total_rub: 0,
  };

  return {
    clicksTotal: Number(row.clicks_total ?? 0),
    conversionsTotal: Number(row.conversions_total ?? 0),
    approvedConversionsTotal: Number(row.approved_total ?? 0),
    rejectedConversionsTotal: Number(row.rejected_total ?? 0),
    payoutTotalRub: Number(row.payout_total_rub ?? 0),
  };
}

export async function incrementConversionRollup({
  date,
  offerId,
  affiliateId,
  status,
  payoutRub,
}) {
  if (!offerId) {
    throw new Error('offerId is required for conversion rollup');
  }

  if (!affiliateId) {
    throw new Error('affiliateId is required for conversion rollup');
  }

  if (!status) {
    throw new Error('status is required for conversion rollup');
  }

  const normalizedDate = toUtcDateString(date);
  const approvedIncrement = status === 'approved' ? 1 : 0;
  const rejectedIncrement = status === 'rejected' ? 1 : 0;
  const payoutIncrement = normalizePayoutValue(payoutRub);

  await pool.query(
    `
      INSERT INTO daily_stats (
        date,
        offer_id,
        affiliate_id,
        conversions_count,
        approved_conversions_count,
        rejected_conversions_count,
        payout_total_rub,
        created_at,
        updated_at
      )
      VALUES (
        $1::date,
        $2,
        $3,
        1,
        $4,
        $5,
        $6::numeric(14, 2),
        NOW(),
        NOW()
      )
      ON CONFLICT (date, offer_id, affiliate_id)
      DO UPDATE
      SET
        conversions_count = daily_stats.conversions_count + EXCLUDED.conversions_count,
        approved_conversions_count =
          daily_stats.approved_conversions_count + EXCLUDED.approved_conversions_count,
        rejected_conversions_count =
          daily_stats.rejected_conversions_count + EXCLUDED.rejected_conversions_count,
        payout_total_rub = daily_stats.payout_total_rub + EXCLUDED.payout_total_rub,
        updated_at = NOW();
    `,
    [normalizedDate, offerId, affiliateId, approvedIncrement, rejectedIncrement, payoutIncrement],
  );
}

export async function incrementClickRollup({ date, offerId, affiliateId }) {
  if (!offerId) {
    throw new Error('offerId is required for click rollup');
  }

  if (!affiliateId) {
    throw new Error('affiliateId is required for click rollup');
  }

  const normalizedDate = toUtcDateString(date);

  await pool.query(
    `
      INSERT INTO daily_stats (
        date,
        offer_id,
        affiliate_id,
        clicks_count,
        created_at,
        updated_at
      )
      VALUES (
        $1::date,
        $2,
        $3,
        1,
        NOW(),
        NOW()
      )
      ON CONFLICT (date, offer_id, affiliate_id)
      DO UPDATE
      SET
        clicks_count = daily_stats.clicks_count + EXCLUDED.clicks_count,
        updated_at = NOW();
    `,
    [normalizedDate, offerId, affiliateId],
  );
}
