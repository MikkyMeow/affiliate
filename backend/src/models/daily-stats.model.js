import pool from '../db.js';
import { formatPublicId, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';
import { resolveTimeZone } from '../lib/timezone.js';

const NULL_UUID = '00000000-0000-0000-0000-000000000000';
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SUMMARY_GROUP_LIMIT = 100;
const DAILY_STATS_CONFLICT_TARGET = `
  (date, timezone,
   COALESCE(offer_id, '${NULL_UUID}'::uuid),
   COALESCE(affiliate_id, '${NULL_UUID}'::uuid),
   COALESCE(advertiser_id, '${NULL_UUID}'::uuid),
   COALESCE(goal_id, '${NULL_UUID}'::uuid))
`;

const GROUP_CONFIG = {
  partner: {
    type: 'partner',
    select: `
      ds.affiliate_id AS "entityId",
      a.public_id_number AS "entityPublicIdNumber",
      a.name AS "entityName"
    `,
    groupBy: 'ds.affiliate_id, a.public_id_number, a.name',
    buildEntity(row) {
      return {
        partner: {
          id: row.entityId,
          publicId: row.entityId
            ? formatPublicId(
                PUBLIC_ID_PREFIXES.affiliate,
                Number(row.entityPublicIdNumber ?? 0),
              )
            : null,
          name: row.entityName ?? null,
        },
      };
    },
  },
  offer: {
    type: 'offer',
    select: `
      ds.offer_id AS "entityId",
      o.public_id_number AS "entityPublicIdNumber",
      o.title AS "entityName"
    `,
    groupBy: 'ds.offer_id, o.public_id_number, o.title',
    buildEntity(row) {
      return {
        offer: {
          id: row.entityId,
          publicId: row.entityId
            ? formatPublicId(
                PUBLIC_ID_PREFIXES.offer,
                Number(row.entityPublicIdNumber ?? 0),
              )
            : null,
          name: row.entityName ?? null,
        },
      };
    },
  },
  advertiser: {
    type: 'advertiser',
    select: `
      ds.advertiser_id AS "entityId",
      adv.public_id_number AS "entityPublicIdNumber",
      adv.name AS "entityName"
    `,
    groupBy: 'ds.advertiser_id, adv.public_id_number, adv.name',
    buildEntity(row) {
      return {
        advertiser: {
          id: row.entityId,
          publicId: row.entityId
            ? formatPublicId(
                PUBLIC_ID_PREFIXES.advertiser,
                Number(row.entityPublicIdNumber ?? 0),
              )
            : null,
          name: row.entityName ?? null,
        },
      };
    },
  },
};

function getQueryable(client) {
  return client ?? pool;
}

function normalizeDateValue(value, fieldName = 'date') {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!DATE_REGEX.test(normalized)) {
      throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
    }

    return normalized;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  throw new Error(`${fieldName} must be a valid date`);
}

function normalizeRange({
  startDate,
  endDate,
  dateFrom,
  dateTo,
  date,
  timezone,
}) {
  const normalizedStart = normalizeDateValue(
    startDate ?? dateFrom ?? date,
    'startDate',
  );
  const normalizedEnd = normalizeDateValue(endDate ?? dateTo ?? date, 'endDate');

  if (normalizedStart > normalizedEnd) {
    throw new Error('startDate cannot be after endDate');
  }

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    timezone: resolveTimeZone(timezone),
  };
}

function addUuidOrPublicIdCondition({
  value,
  idColumn,
  publicIdColumn,
  conditions,
  params,
}) {
  if (!value) {
    return;
  }

  if (typeof value === 'string') {
    params.push(value);
    conditions.push(`${idColumn} = $${params.length}`);
    return;
  }

  params.push(value.value);
  conditions.push(
    value.type === 'publicId'
      ? `${publicIdColumn} = $${params.length}`
      : `${idColumn} = $${params.length}`,
  );
}

function addGoalCondition({ value, conditions, params }) {
  if (!value) {
    return;
  }

  const resolved = typeof value === 'string' ? value : value.value;
  params.push(resolved);
  conditions.push(`ds.goal_id = $${params.length}`);
}

function buildDailyStatsFilter(filter = {}) {
  const conditions = [];
  const params = [];

  const timezone = resolveTimeZone(filter.timezone);
  params.push(timezone);
  conditions.push(`ds.timezone = $${params.length}`);

  if (filter.dateFrom) {
    params.push(normalizeDateValue(filter.dateFrom, 'dateFrom'));
    conditions.push(`ds.date >= $${params.length}::date`);
  }

  if (filter.dateTo) {
    params.push(normalizeDateValue(filter.dateTo, 'dateTo'));
    conditions.push(`ds.date <= $${params.length}::date`);
  }

  addUuidOrPublicIdCondition({
    value: filter.offerId,
    idColumn: 'o.id',
    publicIdColumn: 'o.public_id_number',
    conditions,
    params,
  });
  addUuidOrPublicIdCondition({
    value: filter.affiliateId,
    idColumn: 'a.id',
    publicIdColumn: 'a.public_id_number',
    conditions,
    params,
  });
  addUuidOrPublicIdCondition({
    value: filter.advertiserId,
    idColumn: 'adv.id',
    publicIdColumn: 'adv.public_id_number',
    conditions,
    params,
  });
  addGoalCondition({
    value: filter.goalId,
    conditions,
    params,
  });

  return {
    params,
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
  };
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapSummaryRow(row = {}) {
  return {
    rowCount: Number(row.row_count ?? 0),
    clicks: Number(row.clicks_total ?? 0),
    manualClicks: Number(row.manual_clicks_total ?? 0),
    conversionsTotal: Number(row.conversions_total ?? 0),
    pendingConversions: Number(row.pending_conversions_total ?? 0),
    approvedConversions: Number(row.approved_conversions_total ?? 0),
    rejectedConversions: Number(row.rejected_conversions_total ?? 0),
    cancelledConversions: Number(row.cancelled_conversions_total ?? 0),
    manualConversions: Number(row.manual_conversions_total ?? 0),
    testConversions: Number(row.test_conversions_total ?? 0),
    pendingRevenue: Number(toNumber(row.pending_revenue_total).toFixed(2)),
    pendingPayout: Number(toNumber(row.pending_payout_total).toFixed(2)),
    approvedRevenue: Number(toNumber(row.approved_revenue_total).toFixed(2)),
    approvedPayout: Number(toNumber(row.approved_payout_total).toFixed(2)),
    rejectedRevenue: Number(toNumber(row.rejected_revenue_total).toFixed(2)),
    rejectedPayout: Number(toNumber(row.rejected_payout_total).toFixed(2)),
    cancelledRevenue: Number(toNumber(row.cancelled_revenue_total).toFixed(2)),
    cancelledPayout: Number(toNumber(row.cancelled_payout_total).toFixed(2)),
    statsUpdatedAt: row.stats_updated_at ?? null,
  };
}

function mapGroupMetrics(row = {}) {
  return {
    clicks: Number(row.clicks_total ?? 0),
    manualClicks: Number(row.manual_clicks_total ?? 0),
    conversions: Number(row.conversions_total ?? 0),
    pendingConversions: Number(row.pending_conversions_total ?? 0),
    approvedConversions: Number(row.approved_conversions_total ?? 0),
    rejectedConversions: Number(row.rejected_conversions_total ?? 0),
    cancelledConversions: Number(row.cancelled_conversions_total ?? 0),
    manualConversions: Number(row.manual_conversions_total ?? 0),
    testConversions: Number(row.test_conversions_total ?? 0),
    pendingRevenue: Number(toNumber(row.pending_revenue_total).toFixed(2)),
    pendingPayout: Number(toNumber(row.pending_payout_total).toFixed(2)),
    revenue: Number(toNumber(row.approved_revenue_total).toFixed(2)),
    payout: Number(toNumber(row.approved_payout_total).toFixed(2)),
    rejectedRevenue: Number(toNumber(row.rejected_revenue_total).toFixed(2)),
    rejectedPayout: Number(toNumber(row.rejected_payout_total).toFixed(2)),
    cancelledRevenue: Number(toNumber(row.cancelled_revenue_total).toFixed(2)),
    cancelledPayout: Number(toNumber(row.cancelled_payout_total).toFixed(2)),
  };
}

function sortGroupedRows(left, right) {
  const revenueDiff = right.metrics.revenue - left.metrics.revenue;
  if (revenueDiff !== 0) {
    return revenueDiff;
  }

  const conversionsDiff = right.metrics.conversions - left.metrics.conversions;
  if (conversionsDiff !== 0) {
    return conversionsDiff;
  }

  return right.metrics.clicks - left.metrics.clicks;
}

export async function clearDailyStatsRange(
  { startDate, endDate, timezone },
  { client = pool } = {},
) {
  const range = normalizeRange({ startDate, endDate, timezone });
  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      DELETE FROM daily_stats
      WHERE date >= $1::date
        AND date <= $2::date
        AND timezone = $3
    `,
    [range.startDate, range.endDate, range.timezone],
  );

  return {
    ...range,
    rowsDeleted: Number(result.rowCount ?? 0),
  };
}

export async function upsertClickRollup(
  { startDate, endDate, timezone },
  { client = pool } = {},
) {
  const range = normalizeRange({ startDate, endDate, timezone });
  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      WITH params AS (
        SELECT
          $1::date AS start_date,
          $2::date AS end_date,
          $3::text AS timezone,
          ($1::date::timestamp AT TIME ZONE $3::text) AS utc_start,
          (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE $3::text) AS utc_end
      ),
      rollup AS (
        SELECT
          DATE(c.created_at AT TIME ZONE p.timezone) AS rollup_date,
          p.timezone AS timezone,
          c.offer_id,
          c.affiliate_id,
          o.advertiser_id,
          c.goal_id,
          COUNT(*)::int AS clicks_count,
          COUNT(*) FILTER (
            WHERE COALESCE(c.source, 'tracking') = 'manual'
          )::int AS manual_clicks_count
        FROM clicks AS c
        INNER JOIN offers AS o ON o.id = c.offer_id
        CROSS JOIN params AS p
        WHERE c.created_at >= p.utc_start
          AND c.created_at < p.utc_end
          AND COALESCE(c.source, 'tracking') <> 'test'
        GROUP BY 1, 2, 3, 4, 5, 6
      )
      INSERT INTO daily_stats (
        date,
        timezone,
        offer_id,
        affiliate_id,
        advertiser_id,
        goal_id,
        clicks_count,
        manual_clicks_count,
        created_at,
        updated_at,
        recalculated_at
      )
      SELECT
        rollup_date,
        timezone,
        offer_id,
        affiliate_id,
        advertiser_id,
        goal_id,
        clicks_count,
        manual_clicks_count,
        NOW(),
        NOW(),
        NOW()
      FROM rollup
      ON CONFLICT ${DAILY_STATS_CONFLICT_TARGET}
      DO UPDATE
      SET
        clicks_count = EXCLUDED.clicks_count,
        manual_clicks_count = EXCLUDED.manual_clicks_count,
        updated_at = NOW(),
        recalculated_at = EXCLUDED.recalculated_at
    `,
    [range.startDate, range.endDate, range.timezone],
  );

  return {
    ...range,
    rowsProcessed: Number(result.rowCount ?? 0),
  };
}

export async function upsertConversionRollup(
  { startDate, endDate, timezone },
  { client = pool } = {},
) {
  const range = normalizeRange({ startDate, endDate, timezone });
  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      WITH params AS (
        SELECT
          $1::date AS start_date,
          $2::date AS end_date,
          $3::text AS timezone,
          ($1::date::timestamp AT TIME ZONE $3::text) AS utc_start,
          (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE $3::text) AS utc_end
      ),
      rollup AS (
        SELECT
          DATE(c.created_at AT TIME ZONE p.timezone) AS rollup_date,
          p.timezone AS timezone,
          c.offer_id,
          c.affiliate_id,
          o.advertiser_id,
          c.goal_id,
          COUNT(*) FILTER (
            WHERE COALESCE(c.is_test, false) = false
          )::int AS conversions_count,
          COUNT(*) FILTER (
            WHERE COALESCE(c.is_test, false) = false
              AND c.status = 'pending'
          )::int AS pending_conversions_count,
          COUNT(*) FILTER (
            WHERE COALESCE(c.is_test, false) = false
              AND c.status = 'approved'
          )::int AS approved_conversions_count,
          COUNT(*) FILTER (
            WHERE COALESCE(c.is_test, false) = false
              AND c.status = 'rejected'
          )::int AS rejected_conversions_count,
          COUNT(*) FILTER (
            WHERE COALESCE(c.is_test, false) = false
              AND c.status = 'cancelled'
          )::int AS cancelled_conversions_count,
          COUNT(*) FILTER (
            WHERE COALESCE(c.is_test, false) = false
              AND COALESCE(c.source, 'tracking') = 'manual'
          )::int AS manual_conversions_count,
          COUNT(*) FILTER (
            WHERE COALESCE(c.is_test, false) = true
          )::int AS test_conversions_count,
          COALESCE(
            SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (
              WHERE COALESCE(c.is_test, false) = false
                AND c.status = 'pending'
            ),
            0
          )::numeric(14, 2) AS pending_payout_total_rub,
          COALESCE(
            SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (
              WHERE COALESCE(c.is_test, false) = false
                AND c.status = 'approved'
            ),
            0
          )::numeric(14, 2) AS approved_payout_total_rub,
          COALESCE(
            SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (
              WHERE COALESCE(c.is_test, false) = false
                AND c.status = 'rejected'
            ),
            0
          )::numeric(14, 2) AS rejected_payout_total_rub,
          COALESCE(
            SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (
              WHERE COALESCE(c.is_test, false) = false
                AND c.status = 'cancelled'
            ),
            0
          )::numeric(14, 2) AS cancelled_payout_total_rub,
          COALESCE(
            SUM(COALESCE(c.revenue_amount, 0)) FILTER (
              WHERE COALESCE(c.is_test, false) = false
                AND c.status = 'pending'
            ),
            0
          )::numeric(14, 2) AS pending_revenue_total_rub,
          COALESCE(
            SUM(COALESCE(c.revenue_amount, 0)) FILTER (
              WHERE COALESCE(c.is_test, false) = false
                AND c.status = 'approved'
            ),
            0
          )::numeric(14, 2) AS approved_revenue_total_rub,
          COALESCE(
            SUM(COALESCE(c.revenue_amount, 0)) FILTER (
              WHERE COALESCE(c.is_test, false) = false
                AND c.status = 'rejected'
            ),
            0
          )::numeric(14, 2) AS rejected_revenue_total_rub,
          COALESCE(
            SUM(COALESCE(c.revenue_amount, 0)) FILTER (
              WHERE COALESCE(c.is_test, false) = false
                AND c.status = 'cancelled'
            ),
            0
          )::numeric(14, 2) AS cancelled_revenue_total_rub
        FROM conversions AS c
        INNER JOIN offers AS o ON o.id = c.offer_id
        CROSS JOIN params AS p
        WHERE c.created_at >= p.utc_start
          AND c.created_at < p.utc_end
        GROUP BY 1, 2, 3, 4, 5, 6
      )
      INSERT INTO daily_stats (
        date,
        timezone,
        offer_id,
        affiliate_id,
        advertiser_id,
        goal_id,
        conversions_count,
        pending_conversions_count,
        approved_conversions_count,
        rejected_conversions_count,
        cancelled_conversions_count,
        manual_conversions_count,
        test_conversions_count,
        pending_payout_total_rub,
        approved_payout_total_rub,
        rejected_payout_total_rub,
        cancelled_payout_total_rub,
        pending_revenue_total_rub,
        approved_revenue_total_rub,
        rejected_revenue_total_rub,
        cancelled_revenue_total_rub,
        created_at,
        updated_at,
        recalculated_at
      )
      SELECT
        rollup_date,
        timezone,
        offer_id,
        affiliate_id,
        advertiser_id,
        goal_id,
        conversions_count,
        pending_conversions_count,
        approved_conversions_count,
        rejected_conversions_count,
        cancelled_conversions_count,
        manual_conversions_count,
        test_conversions_count,
        pending_payout_total_rub,
        approved_payout_total_rub,
        rejected_payout_total_rub,
        cancelled_payout_total_rub,
        pending_revenue_total_rub,
        approved_revenue_total_rub,
        rejected_revenue_total_rub,
        cancelled_revenue_total_rub,
        NOW(),
        NOW(),
        NOW()
      FROM rollup
      ON CONFLICT ${DAILY_STATS_CONFLICT_TARGET}
      DO UPDATE
      SET
        conversions_count = EXCLUDED.conversions_count,
        pending_conversions_count = EXCLUDED.pending_conversions_count,
        approved_conversions_count = EXCLUDED.approved_conversions_count,
        rejected_conversions_count = EXCLUDED.rejected_conversions_count,
        cancelled_conversions_count = EXCLUDED.cancelled_conversions_count,
        manual_conversions_count = EXCLUDED.manual_conversions_count,
        test_conversions_count = EXCLUDED.test_conversions_count,
        pending_payout_total_rub = EXCLUDED.pending_payout_total_rub,
        approved_payout_total_rub = EXCLUDED.approved_payout_total_rub,
        rejected_payout_total_rub = EXCLUDED.rejected_payout_total_rub,
        cancelled_payout_total_rub = EXCLUDED.cancelled_payout_total_rub,
        pending_revenue_total_rub = EXCLUDED.pending_revenue_total_rub,
        approved_revenue_total_rub = EXCLUDED.approved_revenue_total_rub,
        rejected_revenue_total_rub = EXCLUDED.rejected_revenue_total_rub,
        cancelled_revenue_total_rub = EXCLUDED.cancelled_revenue_total_rub,
        updated_at = NOW(),
        recalculated_at = EXCLUDED.recalculated_at
    `,
    [range.startDate, range.endDate, range.timezone],
  );

  return {
    ...range,
    rowsProcessed: Number(result.rowCount ?? 0),
  };
}

export async function getDailyStatsSummary(filter = {}) {
  const { whereClause, params } = buildDailyStatsFilter(filter);

  const result = await pool.query(
    `
      SELECT
        COUNT(*)::bigint AS row_count,
        COALESCE(SUM(ds.clicks_count), 0)::bigint AS clicks_total,
        COALESCE(SUM(ds.manual_clicks_count), 0)::bigint AS manual_clicks_total,
        COALESCE(SUM(ds.conversions_count), 0)::bigint AS conversions_total,
        COALESCE(SUM(ds.pending_conversions_count), 0)::bigint AS pending_conversions_total,
        COALESCE(SUM(ds.approved_conversions_count), 0)::bigint AS approved_conversions_total,
        COALESCE(SUM(ds.rejected_conversions_count), 0)::bigint AS rejected_conversions_total,
        COALESCE(SUM(ds.cancelled_conversions_count), 0)::bigint AS cancelled_conversions_total,
        COALESCE(SUM(ds.manual_conversions_count), 0)::bigint AS manual_conversions_total,
        COALESCE(SUM(ds.test_conversions_count), 0)::bigint AS test_conversions_total,
        COALESCE(SUM(ds.pending_revenue_total_rub), 0)::numeric(14, 2) AS pending_revenue_total,
        COALESCE(SUM(ds.pending_payout_total_rub), 0)::numeric(14, 2) AS pending_payout_total,
        COALESCE(SUM(ds.approved_revenue_total_rub), 0)::numeric(14, 2) AS approved_revenue_total,
        COALESCE(SUM(ds.approved_payout_total_rub), 0)::numeric(14, 2) AS approved_payout_total,
        COALESCE(SUM(ds.rejected_revenue_total_rub), 0)::numeric(14, 2) AS rejected_revenue_total,
        COALESCE(SUM(ds.rejected_payout_total_rub), 0)::numeric(14, 2) AS rejected_payout_total,
        COALESCE(SUM(ds.cancelled_revenue_total_rub), 0)::numeric(14, 2) AS cancelled_revenue_total,
        COALESCE(SUM(ds.cancelled_payout_total_rub), 0)::numeric(14, 2) AS cancelled_payout_total,
        MAX(ds.recalculated_at) AS stats_updated_at
      FROM daily_stats AS ds
      LEFT JOIN offers AS o ON o.id = ds.offer_id
      LEFT JOIN affiliates AS a ON a.id = ds.affiliate_id
      LEFT JOIN advertisers AS adv ON adv.id = ds.advertiser_id
      ${whereClause}
    `,
    params,
  );

  return mapSummaryRow(result.rows[0]);
}

export async function getDailyStatsGroups(filter = {}, groupBy) {
  const config = GROUP_CONFIG[groupBy];

  if (!config) {
    return [];
  }

  const { whereClause, params } = buildDailyStatsFilter(filter);
  const result = await pool.query(
    `
      SELECT
        ${config.select},
        COALESCE(SUM(ds.clicks_count), 0)::bigint AS clicks_total,
        COALESCE(SUM(ds.manual_clicks_count), 0)::bigint AS manual_clicks_total,
        COALESCE(SUM(ds.conversions_count), 0)::bigint AS conversions_total,
        COALESCE(SUM(ds.pending_conversions_count), 0)::bigint AS pending_conversions_total,
        COALESCE(SUM(ds.approved_conversions_count), 0)::bigint AS approved_conversions_total,
        COALESCE(SUM(ds.rejected_conversions_count), 0)::bigint AS rejected_conversions_total,
        COALESCE(SUM(ds.cancelled_conversions_count), 0)::bigint AS cancelled_conversions_total,
        COALESCE(SUM(ds.manual_conversions_count), 0)::bigint AS manual_conversions_total,
        COALESCE(SUM(ds.test_conversions_count), 0)::bigint AS test_conversions_total,
        COALESCE(SUM(ds.pending_revenue_total_rub), 0)::numeric(14, 2) AS pending_revenue_total,
        COALESCE(SUM(ds.pending_payout_total_rub), 0)::numeric(14, 2) AS pending_payout_total,
        COALESCE(SUM(ds.approved_revenue_total_rub), 0)::numeric(14, 2) AS approved_revenue_total,
        COALESCE(SUM(ds.approved_payout_total_rub), 0)::numeric(14, 2) AS approved_payout_total,
        COALESCE(SUM(ds.rejected_revenue_total_rub), 0)::numeric(14, 2) AS rejected_revenue_total,
        COALESCE(SUM(ds.rejected_payout_total_rub), 0)::numeric(14, 2) AS rejected_payout_total,
        COALESCE(SUM(ds.cancelled_revenue_total_rub), 0)::numeric(14, 2) AS cancelled_revenue_total,
        COALESCE(SUM(ds.cancelled_payout_total_rub), 0)::numeric(14, 2) AS cancelled_payout_total
      FROM daily_stats AS ds
      LEFT JOIN offers AS o ON o.id = ds.offer_id
      LEFT JOIN affiliates AS a ON a.id = ds.affiliate_id
      LEFT JOIN advertisers AS adv ON adv.id = ds.advertiser_id
      ${whereClause}
      GROUP BY ${config.groupBy}
    `,
    params,
  );

  return result.rows
    .map((row) => {
      const key = String(row.entityId ?? '');

      return {
        key,
        type: config.type,
        ...config.buildEntity(row),
        metrics: mapGroupMetrics(row),
      };
    })
    .sort(sortGroupedRows)
    .slice(0, SUMMARY_GROUP_LIMIT);
}

export async function getDailyStatsTotals(filter = {}) {
  const summary = await getDailyStatsSummary(filter);

  return {
    clicksTotal: summary.clicks,
    manualClicksTotal: summary.manualClicks,
    conversionsTotal: summary.conversionsTotal,
    pendingConversionsTotal: summary.pendingConversions,
    approvedConversionsTotal: summary.approvedConversions,
    rejectedConversionsTotal: summary.rejectedConversions,
    cancelledConversionsTotal: summary.cancelledConversions,
    manualConversionsTotal: summary.manualConversions,
    testConversionsTotal: summary.testConversions,
    pendingPayoutTotalRub: summary.pendingPayout,
    approvedPayoutTotalRub: summary.approvedPayout,
    rejectedPayoutTotalRub: summary.rejectedPayout,
    cancelledPayoutTotalRub: summary.cancelledPayout,
    pendingRevenueTotalRub: summary.pendingRevenue,
    approvedRevenueTotalRub: summary.approvedRevenue,
    rejectedRevenueTotalRub: summary.rejectedRevenue,
    cancelledRevenueTotalRub: summary.cancelledRevenue,
    statsUpdatedAt: summary.statsUpdatedAt,
    rowCount: summary.rowCount,
  };
}
