import pool from '../db.js';

const CONVERSION_METRIC_COLUMNS = `
  COUNT(*)::bigint AS conversions_total,
  COUNT(*) FILTER (WHERE status = 'pending')::bigint AS conversions_pending,
  COUNT(*) FILTER (WHERE status = 'approved')::bigint AS conversions_approved,
  COUNT(*) FILTER (WHERE status = 'rejected')::bigint AS conversions_rejected,
  COALESCE(SUM(payout_rub) FILTER (WHERE status = 'pending'), 0)::numeric AS pending_payout_total,
  COALESCE(SUM(payout_rub) FILTER (WHERE status = 'approved'), 0)::numeric AS approved_payout_total,
  COALESCE(SUM(payout_rub) FILTER (WHERE status = 'rejected'), 0)::numeric AS rejected_payout_total,
  COALESCE(SUM(revenue_amount) FILTER (WHERE status = 'pending'), 0)::numeric AS pending_revenue_total,
  COALESCE(SUM(revenue_amount) FILTER (WHERE status = 'approved'), 0)::numeric AS approved_revenue_total,
  COALESCE(SUM(revenue_amount) FILTER (WHERE status = 'rejected'), 0)::numeric AS rejected_revenue_total
`;

function createEmptyMetrics() {
  return {
    clicks: 0,
    conversionsTotal: 0,
    conversionsPending: 0,
    conversionsApproved: 0,
    conversionsRejected: 0,
    pendingRevenue: 0,
    pendingPayout: 0,
    approvedRevenue: 0,
    approvedPayout: 0,
    rejectedRevenue: 0,
    rejectedPayout: 0,
  };
}

function mapConversionMetrics(row = {}) {
  return {
    conversionsTotal: Number(row.conversions_total ?? 0),
    conversionsPending: Number(row.conversions_pending ?? 0),
    conversionsApproved: Number(row.conversions_approved ?? 0),
    conversionsRejected: Number(row.conversions_rejected ?? 0),
    pendingRevenue: Number(row.pending_revenue_total ?? 0),
    approvedRevenue: Number(row.approved_revenue_total ?? 0),
    rejectedRevenue: Number(row.rejected_revenue_total ?? 0),
    pendingPayout: Number(row.pending_payout_total ?? 0),
    approvedPayout: Number(row.approved_payout_total ?? 0),
    rejectedPayout: Number(row.rejected_payout_total ?? 0),
  };
}

function mergeMetrics(target, metrics) {
  return {
    ...target,
    ...metrics,
  };
}

function normalizeDateValue(value) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  return undefined;
}

function normalizeDateRange(filter = {}) {
  return {
    ...filter,
    dateFrom: normalizeDateValue(filter.dateFrom),
    dateTo: normalizeDateValue(filter.dateTo),
  };
}

function buildConversionFilter(filter = {}, alias = 'c') {
  const normalized = normalizeDateRange(filter);
  const conditions = [];
  const params = [];

  if (normalized.offerId) {
    params.push(normalized.offerId);
    conditions.push(`${alias}.offer_id = $${params.length}`);
  }

  if (normalized.affiliateId) {
    params.push(normalized.affiliateId);
    conditions.push(`${alias}.affiliate_id = $${params.length}`);
  }

  if (normalized.goalId) {
    params.push(normalized.goalId);
    conditions.push(`${alias}.goal_id = $${params.length}`);
  }

  if (normalized.status) {
    params.push(normalized.status);
    conditions.push(`${alias}.status = $${params.length}`);
  }

  if (normalized.dateFrom) {
    params.push(normalized.dateFrom);
    conditions.push(`${alias}.created_at >= $${params.length}::date`);
  }

  if (normalized.dateTo) {
    params.push(normalized.dateTo);
    conditions.push(`${alias}.created_at < $${params.length}::date + INTERVAL '1 day'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { whereClause, params };
}

function buildClickFilter(filter = {}, alias = 'c') {
  const normalized = normalizeDateRange(filter);
  const conditions = [];
  const params = [];

  if (normalized.offerId) {
    params.push(normalized.offerId);
    conditions.push(`${alias}.offer_id = $${params.length}`);
  }

  if (normalized.affiliateId) {
    params.push(normalized.affiliateId);
    conditions.push(`${alias}.affiliate_id = $${params.length}`);
  }

  if (normalized.dateFrom) {
    params.push(normalized.dateFrom);
    conditions.push(`${alias}.created_at >= $${params.length}::date`);
  }

  if (normalized.dateTo) {
    params.push(normalized.dateTo);
    conditions.push(`${alias}.created_at < $${params.length}::date + INTERVAL '1 day'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { whereClause, params };
}

export async function getStatsSummary(filter = {}) {
  const { whereClause, params } = buildConversionFilter(filter, 'c');
  const { whereClause: clickClause, params: clickParams } = buildClickFilter(filter, 'c');

  const conversionResult = await pool.query(
    `
      SELECT ${CONVERSION_METRIC_COLUMNS}
      FROM conversions c
      ${whereClause}
    `,
    params,
  );

  const clicksResult = await pool.query(
    `
      SELECT COUNT(*)::bigint AS clicks_total
      FROM clicks c
      ${clickClause}
    `,
    clickParams,
  );

  const conversionMetrics = mapConversionMetrics(conversionResult.rows[0]);
  const clicks = Number(clicksResult.rows[0]?.clicks_total ?? 0);

  return mergeMetrics({
    ...createEmptyMetrics(),
    clicks,
  }, conversionMetrics);
}

async function getClickBreakdown(filter = {}, groupColumn, alias = 'c') {
  if (!groupColumn) {
    return [];
  }

  const { whereClause, params } = buildClickFilter(filter, alias);

  const result = await pool.query(
    `
      SELECT ${groupColumn.expression} AS "groupValue",
             COUNT(*)::bigint AS clicks_total
      FROM clicks ${alias}
      ${whereClause}
      GROUP BY ${groupColumn.expression}
    `,
    params,
  );

  return result.rows.map((row) => ({
    key: row.groupValue ?? null,
    clicks: Number(row.clicks_total ?? 0),
  }));
}

function applyGroupFields(row, groupColumns) {
  const payload = {};

  groupColumns.forEach((column) => {
    payload[column.alias] = row[column.alias] ?? null;
  });

  return payload;
}

function stringifyGroupKey(values = []) {
  return JSON.stringify(values.map((value) => (value ?? null))); // stable key
}

async function getConversionBreakdown(filter, groupColumns, { orderBy } = {}) {
  if (!groupColumns.length) {
    return [];
  }

  const selectFields = groupColumns
    .map((column) => `${column.expression} AS "${column.alias}"`)
    .join(',\n             ');
  const groupByClause = groupColumns.map((column) => column.expression).join(', ');

  const { whereClause, params } = buildConversionFilter(filter, 'c');

  const result = await pool.query(
    `
      SELECT
        ${selectFields},
        ${CONVERSION_METRIC_COLUMNS}
      FROM conversions c
      ${whereClause}
      GROUP BY ${groupByClause}
      ${orderBy ? `ORDER BY ${orderBy}` : ''}
    `,
    params,
  );

  return result.rows.map((row) => ({
    key: stringifyGroupKey(groupColumns.map((column) => row[column.alias] ?? null)),
    payload: applyGroupFields(row, groupColumns),
    metrics: mapConversionMetrics(row),
  }));
}

function mergeBreakdowns(conversionRows, clickRows, groupColumns) {
  const map = new Map();

  conversionRows.forEach((row) => {
    const entry = {
      ...row.payload,
      ...createEmptyMetrics(),
      ...row.metrics,
    };
    map.set(row.key, entry);
  });

  clickRows.forEach((row) => {
    const key = stringifyGroupKey([row.key]);
    const existing = map.get(key);

    if (existing) {
      existing.clicks = row.clicks;
      return;
    }

    const payload = {};
    if (groupColumns.length === 1) {
      payload[groupColumns[0].alias] = row.key ?? null;
    }

    map.set(key, {
      ...payload,
      ...createEmptyMetrics(),
      clicks: row.clicks,
    });
  });

  return Array.from(map.values());
}

export async function getOfferBreakdown(filter = {}) {
  const groupColumns = [{ expression: 'c.offer_id', alias: 'offerId' }];
  const conversions = await getConversionBreakdown(filter, groupColumns, {
    orderBy: 'conversions_total DESC',
  });
  const clicks = await getClickBreakdown(filter, groupColumns[0]);

  return mergeBreakdowns(conversions, clicks, groupColumns);
}

export async function getAffiliateBreakdown(filter = {}) {
  const groupColumns = [{ expression: 'c.affiliate_id', alias: 'affiliateId' }];
  const conversions = await getConversionBreakdown(filter, groupColumns, {
    orderBy: 'conversions_total DESC',
  });
  const clicks = await getClickBreakdown(filter, groupColumns[0]);

  return mergeBreakdowns(conversions, clicks, groupColumns);
}

export async function getGoalBreakdown(filter = {}) {
  const groupColumns = [
    { expression: 'c.goal_id', alias: 'goalId' },
    { expression: 'c.goal_name', alias: 'goalName' },
    { expression: 'c.goal_type', alias: 'goalType' },
  ];

  const conversions = await getConversionBreakdown(filter, groupColumns, {
    orderBy: 'conversions_total DESC',
  });

  return conversions.map(({ payload, metrics }) => ({
    ...payload,
    clicks: 0,
    ...metrics,
  }));
}

export async function getStatusBreakdown(filter = {}) {
  const groupColumns = [{ expression: 'c.status', alias: 'status' }];
  const conversions = await getConversionBreakdown(filter, groupColumns, {
    orderBy: 'status',
  });

  return conversions.map(({ payload, metrics }) => ({
    ...payload,
    clicks: 0,
    ...metrics,
  }));
}
