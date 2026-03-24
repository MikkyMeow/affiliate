/* eslint-disable camelcase */

const INDEX_NAME = 'clicks_offer_affiliate_dedupe_idx';

export const up = (pgm) => {
  pgm.addColumn('clicks', {
    dedupe_fingerprint: { type: 'text' },
  });

  pgm.createIndex(
    'clicks',
    [
      'offer_id',
      'affiliate_id',
      'dedupe_fingerprint',
      { name: 'created_at', sort: 'DESC' },
    ],
    {
      name: INDEX_NAME,
      ifNotExists: true,
    },
  );
};

export const down = (pgm) => {
  pgm.dropIndex('clicks', null, {
    ifExists: true,
    name: INDEX_NAME,
  });
  pgm.dropColumn('clicks', 'dedupe_fingerprint', { ifExists: true });
};
