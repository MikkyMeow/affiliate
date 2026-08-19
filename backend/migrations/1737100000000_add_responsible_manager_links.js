/* eslint-disable camelcase */

function addManagerColumn(pgm, tableName, indexName) {
  pgm.addColumn(tableName, {
    manager_user_id: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex(tableName, 'manager_user_id', {
    name: indexName,
  });
}

function dropManagerColumn(pgm, tableName, indexName) {
  pgm.dropIndex(tableName, 'manager_user_id', {
    ifExists: true,
    name: indexName,
  });
  pgm.dropColumn(tableName, 'manager_user_id', { ifExists: true });
}

export const up = (pgm) => {
  addManagerColumn(
    pgm,
    'affiliates',
    'affiliates_manager_user_id_idx',
  );
  addManagerColumn(
    pgm,
    'advertisers',
    'advertisers_manager_user_id_idx',
  );
};

export const down = (pgm) => {
  dropManagerColumn(
    pgm,
    'advertisers',
    'advertisers_manager_user_id_idx',
  );
  dropManagerColumn(
    pgm,
    'affiliates',
    'affiliates_manager_user_id_idx',
  );
};
