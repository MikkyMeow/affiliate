/* eslint-disable camelcase */

function backfillPublicIdNumbers(pgm, tableName, sequenceName) {
  pgm.sql(`
    WITH ordered_rows AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS next_public_id_number
      FROM ${tableName}
    )
    UPDATE ${tableName} AS target
    SET public_id_number = ordered_rows.next_public_id_number
    FROM ordered_rows
    WHERE target.id = ordered_rows.id;
  `);

  pgm.sql(`
    SELECT setval(
      '${sequenceName}',
      COALESCE((SELECT MAX(public_id_number) FROM ${tableName}), 1),
      EXISTS (SELECT 1 FROM ${tableName})
    );
  `);
}

function addPublicIdNumber(pgm, tableName, sequenceName, indexName) {
  pgm.addColumn(tableName, {
    public_id_number: { type: 'bigint' },
  });

  pgm.sql(`
    CREATE SEQUENCE IF NOT EXISTS ${sequenceName}
      AS bigint
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1;
  `);

  backfillPublicIdNumbers(pgm, tableName, sequenceName);

  pgm.alterColumn(tableName, 'public_id_number', {
    notNull: true,
    default: pgm.func(`nextval('${sequenceName}'::regclass)`),
  });

  pgm.sql(`
    ALTER SEQUENCE ${sequenceName}
      OWNED BY ${tableName}.public_id_number;
  `);

  pgm.createIndex(tableName, 'public_id_number', {
    name: indexName,
    unique: true,
  });
}

function dropPublicIdNumber(pgm, tableName, sequenceName, indexName) {
  pgm.dropIndex(tableName, 'public_id_number', {
    ifExists: true,
    name: indexName,
  });

  pgm.alterColumn(tableName, 'public_id_number', {
    default: null,
    notNull: false,
  });

  pgm.dropColumn(tableName, 'public_id_number', { ifExists: true });
  pgm.sql(`DROP SEQUENCE IF EXISTS ${sequenceName};`);
}

export const up = (pgm) => {
  addPublicIdNumber(
    pgm,
    'affiliates',
    'affiliates_public_id_seq',
    'affiliates_public_id_number_idx',
  );
  addPublicIdNumber(
    pgm,
    'advertisers',
    'advertisers_public_id_seq',
    'advertisers_public_id_number_idx',
  );
  addPublicIdNumber(
    pgm,
    'offers',
    'offers_public_id_seq',
    'offers_public_id_number_idx',
  );
};

export const down = (pgm) => {
  dropPublicIdNumber(
    pgm,
    'offers',
    'offers_public_id_seq',
    'offers_public_id_number_idx',
  );
  dropPublicIdNumber(
    pgm,
    'advertisers',
    'advertisers_public_id_seq',
    'advertisers_public_id_number_idx',
  );
  dropPublicIdNumber(
    pgm,
    'affiliates',
    'affiliates_public_id_seq',
    'affiliates_public_id_number_idx',
  );
};
