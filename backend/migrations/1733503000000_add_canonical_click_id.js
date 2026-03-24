/* eslint-disable camelcase */

const CANONICAL_INDEX = 'clicks_canonical_click_id_idx';
const CANONICAL_CREATED_INDEX = 'clicks_canonical_click_created_idx';

export const up = (pgm) => {
  pgm.addColumns('clicks', {
    canonical_click_id: { type: 'text' },
    is_duplicate: { type: 'boolean', notNull: true, default: false },
    duplicate_of_click_id: { type: 'text' },
  });

  pgm.sql(`
    UPDATE clicks
    SET canonical_click_id = click_id
    WHERE canonical_click_id IS NULL;
  `);

  pgm.alterColumn('clicks', 'canonical_click_id', { notNull: true });

  pgm.createIndex('clicks', 'canonical_click_id', {
    name: CANONICAL_INDEX,
    ifNotExists: true,
  });

  pgm.createIndex(
    'clicks',
    ['canonical_click_id', { name: 'created_at', sort: 'DESC' }],
    {
      name: CANONICAL_CREATED_INDEX,
      ifNotExists: true,
    },
  );
};

export const down = (pgm) => {
  pgm.dropIndex('clicks', null, {
    ifExists: true,
    name: CANONICAL_CREATED_INDEX,
  });

  pgm.dropIndex('clicks', null, {
    ifExists: true,
    name: CANONICAL_INDEX,
  });

  pgm.dropColumn('clicks', 'duplicate_of_click_id', { ifExists: true });
  pgm.dropColumn('clicks', 'is_duplicate', { ifExists: true });
  pgm.dropColumn('clicks', 'canonical_click_id', { ifExists: true });
};
