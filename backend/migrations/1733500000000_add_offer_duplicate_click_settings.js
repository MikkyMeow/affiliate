/* eslint-disable camelcase */

const CONSTRAINT_NAME = 'offers_duplicate_click_settings_ck';

export const up = (pgm) => {
  pgm.addColumns('offers', {
    allow_duplicate_clicks: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    duplicate_click_window_seconds: {
      type: 'integer',
      notNull: false,
    },
  });

  pgm.addConstraint(
    'offers',
    CONSTRAINT_NAME,
    `
      CHECK (
        allow_duplicate_clicks
        OR (
          duplicate_click_window_seconds IS NOT NULL
          AND duplicate_click_window_seconds BETWEEN 60 AND 2592000
        )
      )
    `,
  );
};

export const down = (pgm) => {
  pgm.dropConstraint('offers', CONSTRAINT_NAME, { ifExists: true });
  pgm.dropColumn('offers', 'duplicate_click_window_seconds', {
    ifExists: true,
  });
  pgm.dropColumn('offers', 'allow_duplicate_clicks', { ifExists: true });
};
