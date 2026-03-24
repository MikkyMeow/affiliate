/* eslint-disable camelcase */

const CATEGORY_VALUES = [
  'finance_mfo',
  'services',
  'finance',
  'sports_betting',
  'education',
  'surveys',
  'hr_jobs',
  'automotive',
  'b2b',
  'travel',
  'other',
  'games',
  'ecommerce',
  'real_estate',
];

const CATEGORY_ARRAY_SQL = CATEGORY_VALUES.map(
  (value) => `'${value}'`,
).join(', ');

export const up = (pgm) => {
  pgm.addColumn('offers', {
    category: { type: 'text' },
  });

  pgm.addConstraint(
    'offers',
    'offers_category_check',
    `CHECK (category IS NULL OR category = ANY (ARRAY[${CATEGORY_ARRAY_SQL}]::text[]))`,
  );

  pgm.sql(`
    UPDATE offers
    SET category = 'other'
    WHERE category IS NULL;
  `);
};

export const down = (pgm) => {
  pgm.dropConstraint('offers', 'offers_category_check', { ifExists: true });
  pgm.dropColumn('offers', 'category', { ifExists: true });
};
