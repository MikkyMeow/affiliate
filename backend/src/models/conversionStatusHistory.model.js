import pool from '../db.js';

const historyFields = `
  h.id,
  h.conversion_id AS "conversionId",
  h.from_status AS "fromStatus",
  h.to_status AS "toStatus",
  h.reason,
  h.changed_by AS "changedById",
  h.changed_at AS "changedAt",
  h.metadata,
  u.id AS "actorId",
  u.display_name AS "actorName",
  u.email AS "actorEmail"
`;

export async function insertConversionStatusHistory(
  {
    conversionId,
    fromStatus = null,
    toStatus,
    reason = null,
    changedBy = null,
    metadata = null,
    changedAt = null,
  },
  { client = pool } = {},
) {
  const normalizedMetadata =
    metadata && typeof metadata === 'object' ? metadata : null;

  const result = await client.query(
    `
      INSERT INTO conversion_status_history (
        conversion_id,
        from_status,
        to_status,
        reason,
        changed_by,
        changed_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), $7)
      RETURNING
        id,
        conversion_id AS "conversionId",
        from_status AS "fromStatus",
        to_status AS "toStatus",
        reason,
        changed_by AS "changedById",
        changed_at AS "changedAt",
        metadata
    `,
    [
      conversionId,
      fromStatus,
      toStatus,
      reason,
      changedBy,
      changedAt,
      normalizedMetadata,
    ],
  );

  return result.rows[0] ?? null;
}

function normalizeHistoryRow(row) {
  return {
    id: row.id,
    conversionId: row.conversionId,
    fromStatus: row.fromStatus ?? null,
    toStatus: row.toStatus,
    reason: row.reason ?? null,
    changedBy: row.actorId
      ? {
          id: row.actorId,
          name: row.actorName ?? null,
          email: row.actorEmail ?? null,
        }
      : null,
    changedAt: row.changedAt,
    metadata: row.metadata ?? null,
  };
}

export async function listConversionStatusHistory(
  conversionId,
  { client = pool } = {},
) {
  const result = await client.query(
    `
      SELECT ${historyFields}
      FROM conversion_status_history AS h
      LEFT JOIN users AS u ON u.id = h.changed_by
      WHERE h.conversion_id = $1
      ORDER BY h.changed_at DESC, h.id DESC
    `,
    [conversionId],
  );

  return result.rows.map(normalizeHistoryRow);
}
