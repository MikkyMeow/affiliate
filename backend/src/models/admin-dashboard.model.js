import pool from '../db.js';

export async function getHourlyDashboardSeries({
  date,
  timezone,
}) {
  const result = await pool.query(
    `
      WITH params AS (
        SELECT
          $1::date AS selected_date,
          $2::text AS timezone
      ),
      bounds AS (
        SELECT
          selected_date,
          timezone,
          selected_date::timestamp AS local_day_start,
          (selected_date + 1)::timestamp AS local_day_end,
          selected_date::timestamp AT TIME ZONE timezone AS utc_day_start,
          (selected_date + 1)::timestamp AT TIME ZONE timezone AS utc_day_end
        FROM params
      ),
      hours AS (
        SELECT
          generate_series(
            bounds.local_day_start,
            bounds.local_day_end - INTERVAL '1 hour',
            INTERVAL '1 hour'
          ) AS bucket_local
        FROM bounds
      ),
      click_hourly AS (
        SELECT
          date_trunc('hour', c.created_at AT TIME ZONE bounds.timezone) AS bucket_local,
          COUNT(*)::bigint AS clicks
        FROM clicks c
        CROSS JOIN bounds
        WHERE c.created_at >= bounds.utc_day_start
          AND c.created_at < bounds.utc_day_end
        GROUP BY 1
      ),
      conversion_hourly AS (
        SELECT
          date_trunc('hour', c.created_at AT TIME ZONE bounds.timezone) AS bucket_local,
          COUNT(*)::bigint AS conversions,
          COUNT(*) FILTER (WHERE c.status = 'pending')::bigint AS pending_conversions,
          COUNT(*) FILTER (WHERE c.status = 'approved')::bigint AS approved_conversions,
          COUNT(*) FILTER (WHERE c.status = 'rejected')::bigint AS rejected_conversions,
          COUNT(*) FILTER (WHERE c.status = 'cancelled')::bigint AS cancelled_conversions,
          COALESCE(
            SUM(COALESCE(c.revenue_amount, 0)) FILTER (WHERE c.status = 'pending'),
            0
          )::numeric(14, 2) AS pending_revenue,
          COALESCE(
            SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (WHERE c.status = 'pending'),
            0
          )::numeric(14, 2) AS pending_payout,
          COALESCE(
            SUM(COALESCE(c.revenue_amount, 0)) FILTER (WHERE c.status = 'approved'),
            0
          )::numeric(14, 2) AS revenue,
          COALESCE(
            SUM(COALESCE(c.payout_amount, c.payout_rub, 0)) FILTER (WHERE c.status = 'approved'),
            0
          )::numeric(14, 2) AS payout
        FROM conversions c
        CROSS JOIN bounds
        WHERE c.created_at >= bounds.utc_day_start
          AND c.created_at < bounds.utc_day_end
          AND COALESCE(c.is_test, false) = false
        GROUP BY 1
      )
      SELECT
        (hours.bucket_local AT TIME ZONE bounds.timezone) AS "bucketStart",
        TO_CHAR(hours.bucket_local, 'HH24:MI') AS label,
        COALESCE(click_hourly.clicks, 0)::bigint AS clicks,
        COALESCE(conversion_hourly.conversions, 0)::bigint AS conversions,
        COALESCE(conversion_hourly.pending_conversions, 0)::bigint AS "pendingConversions",
        COALESCE(conversion_hourly.approved_conversions, 0)::bigint AS "approvedConversions",
        COALESCE(conversion_hourly.rejected_conversions, 0)::bigint AS "rejectedConversions",
        COALESCE(conversion_hourly.cancelled_conversions, 0)::bigint AS "cancelledConversions",
        COALESCE(conversion_hourly.pending_revenue, 0)::numeric(14, 2) AS "pendingRevenue",
        COALESCE(conversion_hourly.pending_payout, 0)::numeric(14, 2) AS "pendingPayout",
        COALESCE(conversion_hourly.revenue, 0)::numeric(14, 2) AS revenue,
        COALESCE(conversion_hourly.payout, 0)::numeric(14, 2) AS payout
      FROM hours
      CROSS JOIN bounds
      LEFT JOIN click_hourly ON click_hourly.bucket_local = hours.bucket_local
      LEFT JOIN conversion_hourly ON conversion_hourly.bucket_local = hours.bucket_local
      ORDER BY hours.bucket_local ASC
    `,
    [date, timezone],
  );

  return result.rows;
}
