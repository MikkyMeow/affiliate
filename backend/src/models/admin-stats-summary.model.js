import pool from '../db.js';
import { formatPublicId, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';
import { getDefaultTimeZone, resolveTimeZone } from '../lib/timezone.js';

const SUMMARY_GROUP_LIMIT = 100;

const GROUP_CONFIG = {
  partner: {
    type: 'partner',
    clickSelect: `
      c.affiliate_id AS "entityId",
      a.public_id_number AS "entityPublicIdNumber",
      a.name AS "entityName"
    `,
    clickGroupBy: 'c.affiliate_id, a.public_id_number, a.name',
    conversionSelect: `
      c.affiliate_id AS "entityId",
      a.public_id_number AS "entityPublicIdNumber",
      a.name AS "entityName"
    `,
    conversionGroupBy: 'c.affiliate_id, a.public_id_number, a.name',
    buildEntity(row) {
      return {
        partner: {
          id: row.entityId,
          publicId: formatPublicId(
            PUBLIC_ID_PREFIXES.affiliate,
            Number(row.entityPublicIdNumber ?? 0),
          ),
          name: row.entityName ?? null,
        },
      };
    },
  },
  offer: {
    type: 'offer',
    clickSelect: `
      o.id AS "entityId",
      o.public_id_number AS "entityPublicIdNumber",
      o.title AS "entityName"
    `,
    clickGroupBy: 'o.id, o.public_id_number, o.title',
    conversionSelect: `
      o.id AS "entityId",
      o.public_id_number AS "entityPublicIdNumber",
      o.title AS "entityName"
    `,
    conversionGroupBy: 'o.id, o.public_id_number, o.title',
    buildEntity(row) {
      return {
        offer: {
          id: row.entityId,
          publicId: formatPublicId(
            PUBLIC_ID_PREFIXES.offer,
            Number(row.entityPublicIdNumber ?? 0),
          ),
          name: row.entityName ?? null,
        },
      };
    },
  },
  advertiser: {
    type: 'advertiser',
    clickSelect: `
      adv.id AS "entityId",
      adv.public_id_number AS "entityPublicIdNumber",
      adv.name AS "entityName"
    `,
    clickGroupBy: 'adv.id, adv.public_id_number, adv.name',
    conversionSelect: `
      adv.id AS "entityId",
      adv.public_id_number AS "entityPublicIdNumber",
      adv.name AS "entityName"
    `,
    conversionGroupBy: 'adv.id, adv.public_id_number, adv.name',
    buildEntity(row) {
      return {
        advertiser: {
          id: row.entityId,
          publicId: formatPublicId(
            PUBLIC_ID_PREFIXES.advertiser,
            Number(row.entityPublicIdNumber ?? 0),
          ),
          name: row.entityName ?? null,
        },
      };
    },
  },
};

let statsSchemaCapabilitiesPromise = null;

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

async function getStatsSchemaCapabilities() {
  if (!statsSchemaCapabilitiesPromise) {
    statsSchemaCapabilitiesPromise = pool
      .query(
        `
          SELECT table_name AS "tableName", column_name AS "columnName"
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name IN ('clicks', 'conversions')
        `,
      )
      .then((result) => {
        const columnsByTable = new Map();

        result.rows.forEach((row) => {
          const tableName = row.tableName;
          if (!columnsByTable.has(tableName)) {
            columnsByTable.set(tableName, new Set());
          }

          columnsByTable.get(tableName).add(row.columnName);
        });

        const clicksColumns = columnsByTable.get('clicks') ?? new Set();
        const conversionColumns = columnsByTable.get('conversions') ?? new Set();

        return {
          clicks: {
            hasIsTest: clicksColumns.has('is_test'),
            hasSource: clicksColumns.has('source'),
          },
          conversions: {
            hasIsTest: conversionColumns.has('is_test'),
            hasSource: conversionColumns.has('source'),
          },
        };
      });
  }

  return statsSchemaCapabilitiesPromise;
}

function applyDateFilters({
  dateFrom,
  dateTo,
  timezone,
  column,
  conditions,
  params,
}) {
  const resolvedTimezone = resolveTimeZone(timezone, getDefaultTimeZone());

  if (dateFrom) {
    params.push(dateFrom);
    const dateIndex = params.length;
    params.push(resolvedTimezone);
    conditions.push(
      `${column} >= ($${dateIndex}::date::timestamp AT TIME ZONE $${params.length})`,
    );
  }

  if (dateTo) {
    params.push(dateTo);
    const dateIndex = params.length;
    params.push(resolvedTimezone);
    conditions.push(
      `${column} < (($${dateIndex}::date + INTERVAL '1 day')::timestamp AT TIME ZONE $${params.length})`,
    );
  }
}

function applyTestExclusion({
  alias,
  tableCapabilities,
  conditions,
}) {
  if (tableCapabilities.hasIsTest) {
    conditions.push(`COALESCE(${alias}.is_test, false) = false`);
  }

  if (tableCapabilities.hasSource) {
    conditions.push(`COALESCE(${alias}.source, 'normal') <> 'test'`);
  }
}

function buildClickFilter(filter = {}, capabilities) {
  const conditions = [];
  const params = [];

  applyDateFilters({
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
    timezone: filter.timezone,
    column: 'c.created_at',
    conditions,
    params,
  });

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

  applyTestExclusion({
    alias: 'c',
    tableCapabilities: capabilities.clicks,
    conditions,
  });

  return {
    params,
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
  };
}

function buildConversionFilter(filter = {}, capabilities) {
  const conditions = [];
  const params = [];

  applyDateFilters({
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
    timezone: filter.timezone,
    column: 'c.created_at',
    conditions,
    params,
  });

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

  applyTestExclusion({
    alias: 'c',
    tableCapabilities: capabilities.conversions,
    conditions,
  });

  return {
    params,
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
  };
}

function normalizeTotalsRow(row = {}) {
  return {
    clicks: toNumber(row.clicks_total),
    conversions: toNumber(row.conversions_total),
    pendingConversions: toNumber(row.pending_conversions_total),
    approvedConversions: toNumber(row.approved_conversions_total),
    rejectedConversions: toNumber(row.rejected_conversions_total),
    cancelledConversions: toNumber(row.cancelled_conversions_total),
    pendingRevenue: Number(toNumber(row.pending_revenue_total).toFixed(2)),
    pendingPayout: Number(toNumber(row.pending_payout_total).toFixed(2)),
    revenue: Number(toNumber(row.revenue_total).toFixed(2)),
    payout: Number(toNumber(row.payout_total).toFixed(2)),
  };
}

function normalizeGroupMetrics(row = {}) {
  return {
    clicks: toNumber(row.clicks_total),
    conversions: toNumber(row.conversions_total),
    pendingConversions: toNumber(row.pending_conversions_total),
    approvedConversions: toNumber(row.approved_conversions_total),
    rejectedConversions: toNumber(row.rejected_conversions_total),
    cancelledConversions: toNumber(row.cancelled_conversions_total),
    pendingRevenue: Number(toNumber(row.pending_revenue_total).toFixed(2)),
    pendingPayout: Number(toNumber(row.pending_payout_total).toFixed(2)),
    revenue: Number(toNumber(row.revenue_total).toFixed(2)),
    payout: Number(toNumber(row.payout_total).toFixed(2)),
  };
}

function buildGroupKey(row) {
  return String(row.entityId ?? '');
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

export async function getAdminSummaryTotals(filter = {}) {
  const capabilities = await getStatsSchemaCapabilities();
  const clickFilter = buildClickFilter(filter, capabilities);
  const conversionFilter = buildConversionFilter(filter, capabilities);

  const clickQuery = pool.query(
    `
      SELECT COUNT(*)::bigint AS clicks_total
      FROM clicks AS c
      INNER JOIN offers AS o ON o.id = c.offer_id
      INNER JOIN affiliates AS a ON a.id = c.affiliate_id
      LEFT JOIN advertisers AS adv ON adv.id = o.advertiser_id
      ${clickFilter.whereClause}
    `,
    clickFilter.params,
  );

  const conversionQuery = pool.query(
    `
      SELECT
        COUNT(*)::bigint AS conversions_total,
        COUNT(*) FILTER (WHERE c.status = 'pending')::bigint AS pending_conversions_total,
        COUNT(*) FILTER (WHERE c.status = 'approved')::bigint AS approved_conversions_total,
        COUNT(*) FILTER (WHERE c.status = 'rejected')::bigint AS rejected_conversions_total,
        COUNT(*) FILTER (WHERE c.status = 'cancelled')::bigint AS cancelled_conversions_total,
        COALESCE(
          SUM(COALESCE(c.revenue_amount, 0)) FILTER (WHERE c.status = 'pending'),
          0
        )::numeric(14, 2) AS pending_revenue_total,
        COALESCE(
          SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (WHERE c.status = 'pending'),
          0
        )::numeric(14, 2) AS pending_payout_total,
        COALESCE(
          SUM(COALESCE(c.revenue_amount, 0)) FILTER (WHERE c.status = 'approved'),
          0
        )::numeric(14, 2) AS revenue_total,
        COALESCE(
          SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (WHERE c.status = 'approved'),
          0
        )::numeric(14, 2) AS payout_total
      FROM conversions AS c
      INNER JOIN offers AS o ON o.id = c.offer_id
      INNER JOIN affiliates AS a ON a.id = c.affiliate_id
      LEFT JOIN advertisers AS adv ON adv.id = o.advertiser_id
      ${conversionFilter.whereClause}
    `,
    conversionFilter.params,
  );

  const [clickResult, conversionResult] = await Promise.all([
    clickQuery,
    conversionQuery,
  ]);

  return normalizeTotalsRow({
    clicks_total: clickResult.rows[0]?.clicks_total ?? 0,
    conversions_total: conversionResult.rows[0]?.conversions_total ?? 0,
    pending_conversions_total:
      conversionResult.rows[0]?.pending_conversions_total ?? 0,
    approved_conversions_total:
      conversionResult.rows[0]?.approved_conversions_total ?? 0,
    rejected_conversions_total:
      conversionResult.rows[0]?.rejected_conversions_total ?? 0,
    cancelled_conversions_total:
      conversionResult.rows[0]?.cancelled_conversions_total ?? 0,
    pending_revenue_total: conversionResult.rows[0]?.pending_revenue_total ?? 0,
    pending_payout_total: conversionResult.rows[0]?.pending_payout_total ?? 0,
    revenue_total: conversionResult.rows[0]?.revenue_total ?? 0,
    payout_total: conversionResult.rows[0]?.payout_total ?? 0,
  });
}

export async function getAdminSummaryGroups(filter = {}, groupBy) {
  const config = GROUP_CONFIG[groupBy];

  if (!config) {
    return [];
  }

  const capabilities = await getStatsSchemaCapabilities();
  const clickFilter = buildClickFilter(filter, capabilities);
  const conversionFilter = buildConversionFilter(filter, capabilities);

  const clickQuery = pool.query(
    `
      SELECT
        ${config.clickSelect},
        COUNT(*)::bigint AS clicks_total
      FROM clicks AS c
      INNER JOIN offers AS o ON o.id = c.offer_id
      INNER JOIN affiliates AS a ON a.id = c.affiliate_id
      LEFT JOIN advertisers AS adv ON adv.id = o.advertiser_id
      ${clickFilter.whereClause}
      GROUP BY ${config.clickGroupBy}
    `,
    clickFilter.params,
  );

  const conversionQuery = pool.query(
    `
      SELECT
        ${config.conversionSelect},
        COUNT(*)::bigint AS conversions_total,
        COUNT(*) FILTER (WHERE c.status = 'pending')::bigint AS pending_conversions_total,
        COUNT(*) FILTER (WHERE c.status = 'approved')::bigint AS approved_conversions_total,
        COUNT(*) FILTER (WHERE c.status = 'rejected')::bigint AS rejected_conversions_total,
        COUNT(*) FILTER (WHERE c.status = 'cancelled')::bigint AS cancelled_conversions_total,
        COALESCE(
          SUM(COALESCE(c.revenue_amount, 0)) FILTER (WHERE c.status = 'pending'),
          0
        )::numeric(14, 2) AS pending_revenue_total,
        COALESCE(
          SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (WHERE c.status = 'pending'),
          0
        )::numeric(14, 2) AS pending_payout_total,
        COALESCE(
          SUM(COALESCE(c.revenue_amount, 0)) FILTER (WHERE c.status = 'approved'),
          0
        )::numeric(14, 2) AS revenue_total,
        COALESCE(
          SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (WHERE c.status = 'approved'),
          0
        )::numeric(14, 2) AS payout_total
      FROM conversions AS c
      INNER JOIN offers AS o ON o.id = c.offer_id
      INNER JOIN affiliates AS a ON a.id = c.affiliate_id
      LEFT JOIN advertisers AS adv ON adv.id = o.advertiser_id
      ${conversionFilter.whereClause}
      GROUP BY ${config.conversionGroupBy}
    `,
    conversionFilter.params,
  );

  const [clickResult, conversionResult] = await Promise.all([
    clickQuery,
    conversionQuery,
  ]);

  const groups = new Map();

  conversionResult.rows.forEach((row) => {
    const key = buildGroupKey(row);
    groups.set(key, {
      key,
      type: config.type,
      ...config.buildEntity(row),
      metrics: normalizeGroupMetrics(row),
    });
  });

  clickResult.rows.forEach((row) => {
    const key = buildGroupKey(row);
    const existing = groups.get(key);

    if (existing) {
      existing.metrics.clicks = toNumber(row.clicks_total);
      return;
    }

    groups.set(key, {
      key,
      type: config.type,
      ...config.buildEntity(row),
      metrics: {
        clicks: toNumber(row.clicks_total),
        conversions: 0,
        pendingConversions: 0,
        approvedConversions: 0,
        rejectedConversions: 0,
        cancelledConversions: 0,
        pendingRevenue: 0,
        pendingPayout: 0,
        revenue: 0,
        payout: 0,
      },
    });
  });

  return Array.from(groups.values())
    .sort(sortGroupedRows)
    .slice(0, SUMMARY_GROUP_LIMIT);
}
