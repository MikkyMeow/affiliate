import pool from '../db.js';

const batchFields = `
  b.id,
  b.type,
  b.partner_mode AS "partnerMode",
  b.default_affiliate_id AS "defaultAffiliateId",
  b.default_offer_id AS "defaultOfferId",
  b.default_goal_id AS "defaultGoalId",
  b.default_status AS "defaultStatus",
  b.original_filename AS "originalFilename",
  b.total_rows AS "totalRows",
  b.valid_rows AS "validRows",
  b.invalid_rows AS "invalidRows",
  b.created_rows AS "createdRows",
  b.skipped_rows AS "skippedRows",
  b.status,
  b.created_by AS "createdById",
  b.created_at AS "createdAt",
  b.applied_at AS "appliedAt",
  b.metadata,
  u.id AS "creator.id",
  u.display_name AS "creator.name",
  u.email AS "creator.email"
`;

function getQueryable(client) {
  return client ?? pool;
}

function normalizeCount(value) {
  return Number.isFinite(value) ? value : Number(value ?? 0);
}

function normalizeBatch(row, { includeMetadata = false } = {}) {
  if (!row) {
    return null;
  }

  const creatorId = row['creator.id'] ?? row.createdById ?? null;

  return {
    id: row.id,
    type: row.type,
    partnerMode: row.partnerMode,
    defaultAffiliateId: row.defaultAffiliateId ?? null,
    defaultOfferId: row.defaultOfferId ?? null,
    defaultGoalId: row.defaultGoalId ?? null,
    defaultStatus: row.defaultStatus ?? null,
    originalFilename: row.originalFilename ?? null,
    totalRows: normalizeCount(row.totalRows),
    validRows: normalizeCount(row.validRows),
    invalidRows: normalizeCount(row.invalidRows),
    createdRows: normalizeCount(row.createdRows),
    skippedRows: normalizeCount(row.skippedRows),
    status: row.status,
    createdById: row.createdById ?? null,
    createdBy: creatorId
      ? {
          id: creatorId,
          name: row['creator.name'] ?? null,
          email: row['creator.email'] ?? null,
        }
      : null,
    createdAt: row.createdAt ?? null,
    appliedAt: row.appliedAt ?? null,
    ...(includeMetadata ? { metadata: row.metadata ?? null } : {}),
  };
}

export async function createManualAdjustmentBatch(
  {
    type,
    partnerMode,
    defaultAffiliateId = null,
    defaultOfferId = null,
    defaultGoalId = null,
    defaultStatus = null,
    originalFilename = null,
    totalRows = 0,
    validRows = 0,
    invalidRows = 0,
    createdRows = 0,
    skippedRows = 0,
    status,
    createdById,
    appliedAt = null,
    metadata = null,
  },
  { client } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO manual_adjustment_batches (
        type,
        partner_mode,
        default_affiliate_id,
        default_offer_id,
        default_goal_id,
        default_status,
        original_filename,
        total_rows,
        valid_rows,
        invalid_rows,
        created_rows,
        skipped_rows,
        status,
        created_by,
        applied_at,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16
      )
      RETURNING id
    `,
    [
      type,
      partnerMode,
      defaultAffiliateId,
      defaultOfferId,
      defaultGoalId,
      defaultStatus,
      originalFilename,
      totalRows,
      validRows,
      invalidRows,
      createdRows,
      skippedRows,
      status,
      createdById,
      appliedAt,
      metadata,
    ],
  );

  return findManualAdjustmentBatchById(result.rows[0]?.id, {
    client,
    includeMetadata: true,
  });
}

export async function findManualAdjustmentBatchById(
  id,
  { client, includeMetadata = true } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${batchFields}
      FROM manual_adjustment_batches AS b
      LEFT JOIN users AS u ON u.id = b.created_by
      WHERE b.id = $1
      LIMIT 1
    `,
    [id],
  );

  return normalizeBatch(result.rows[0] ?? null, { includeMetadata });
}

export async function updateManualAdjustmentBatch(
  id,
  attrs = {},
  { client } = {},
) {
  const queryable = getQueryable(client);
  const assignments = [];
  const params = [];

  const fieldMap = [
    ['type', 'type'],
    ['partnerMode', 'partner_mode'],
    ['defaultAffiliateId', 'default_affiliate_id'],
    ['defaultOfferId', 'default_offer_id'],
    ['defaultGoalId', 'default_goal_id'],
    ['defaultStatus', 'default_status'],
    ['originalFilename', 'original_filename'],
    ['totalRows', 'total_rows'],
    ['validRows', 'valid_rows'],
    ['invalidRows', 'invalid_rows'],
    ['createdRows', 'created_rows'],
    ['skippedRows', 'skipped_rows'],
    ['status', 'status'],
    ['appliedAt', 'applied_at'],
    ['metadata', 'metadata'],
  ];

  fieldMap.forEach(([key, column]) => {
    if (!Object.hasOwn(attrs, key)) {
      return;
    }

    params.push(attrs[key]);
    assignments.push(`${column} = $${params.length}`);
  });

  if (assignments.length === 0) {
    return findManualAdjustmentBatchById(id, { client, includeMetadata: true });
  }

  params.push(id);
  const result = await queryable.query(
    `
      UPDATE manual_adjustment_batches
      SET ${assignments.join(', ')}
      WHERE id = $${params.length}
      RETURNING id
    `,
    params,
  );

  return findManualAdjustmentBatchById(result.rows[0]?.id, {
    client,
    includeMetadata: true,
  });
}

export async function listManualAdjustmentBatches(
  {
    type,
    status,
    createdById,
    dateFrom,
    dateTo,
    search,
  } = {},
  {
    limit = 20,
    offset = 0,
    sort = 'createdAt',
    order = 'desc',
  } = {},
) {
  const conditions = [];
  const params = [];
  const normalizedOrder =
    typeof order === 'string' && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sortMap = {
    createdAt: 'b.created_at',
    appliedAt: 'b.applied_at',
    type: 'b.type',
    status: 'b.status',
    originalFilename: 'b.original_filename',
    totalRows: 'b.total_rows',
    validRows: 'b.valid_rows',
    invalidRows: 'b.invalid_rows',
    createdRows: 'b.created_rows',
    skippedRows: 'b.skipped_rows',
  };
  const sortColumn = sortMap[sort] ?? sortMap.createdAt;

  if (type) {
    params.push(type);
    conditions.push(`b.type = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`b.status = $${params.length}`);
  }

  if (createdById) {
    params.push(createdById);
    conditions.push(`b.created_by = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`b.created_at >= $${params.length}::date`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`b.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const searchParam = `$${params.length}`;
    conditions.push(`
      (
        LOWER(COALESCE(b.original_filename, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(u.display_name, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(u.email, '')) LIKE ${searchParam}
        OR LOWER(b.id::text) LIKE ${searchParam}
      )
    `);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromClause = `
    FROM manual_adjustment_batches AS b
    LEFT JOIN users AS u ON u.id = b.created_by
  `;

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      ${fromClause}
      ${whereClause}
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${batchFields}
      ${fromClause}
      ${whereClause}
      ORDER BY ${sortColumn} ${normalizedOrder}, b.id ${normalizedOrder}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, limit, offset],
  );

  return {
    items: result.rows.map((row) => normalizeBatch(row)),
    total: totalResult.rows[0]?.count ?? 0,
  };
}
