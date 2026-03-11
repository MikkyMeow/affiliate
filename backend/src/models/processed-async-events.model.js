import pool from '../db.js';

export async function reserveAsyncEvent(eventKey, jobType) {
  if (!eventKey) {
    throw new Error('eventKey is required');
  }

  if (!jobType) {
    throw new Error('jobType is required');
  }

  const result = await pool.query(
    `
      INSERT INTO processed_async_events (event_key, job_type)
      VALUES ($1, $2)
      ON CONFLICT (event_key) DO NOTHING
      RETURNING id;
    `,
    [eventKey, jobType],
  );

  const row = result.rows[0];
  return {
    reserved: Boolean(row?.id),
    id: row?.id ?? null,
  };
}

export async function releaseAsyncEvent(id) {
  if (!id) {
    return;
  }

  await pool.query(
    `
      DELETE FROM processed_async_events
      WHERE id = $1;
    `,
    [id],
  );
}
