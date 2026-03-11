import 'dotenv/config';
import pool from '../db.js';
import { runDailyStatsRollup } from '../services/stats/rollup.service.js';

function parseCliArgs(argv = []) {
  const params = {};

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }

    const [rawKey, rawValue] = arg.slice(2).split('=');
    if (!rawKey || typeof rawValue === 'undefined') {
      continue;
    }

    const key = rawKey.trim().toLowerCase();
    const value = rawValue.trim();

    if (!value) {
      continue;
    }

    if (key === 'date') {
      params.date = value;
    } else if (key === 'start' || key === 'startdate') {
      params.startDate = value;
    } else if (key === 'end' || key === 'enddate') {
      params.endDate = value;
    }
  }

  return params;
}

async function main() {
  const cliParams = parseCliArgs(process.argv.slice(2));
  try {
    const result = await runDailyStatsRollup(cliParams);
    console.log(
      JSON.stringify({
        event: 'daily_rollup_finished',
        startDate: result.startDate,
        endDate: result.endDate,
        conversionsRowsProcessed: result.conversionsRowsProcessed,
        clicksRowsProcessed: result.clicksRowsProcessed,
        rowsProcessed: result.rowsProcessed,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'daily_rollup_failed',
        error: error.message,
      }),
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
