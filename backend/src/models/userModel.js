import pool from '../db.js';

function getQueryable(client) {
  return client ?? pool;
}

const userSelectFields = `
  u.id,
  u.email,
  u.display_name AS "displayName",
  u.role,
  u.created_at AS "createdAt",
  u.updated_at AS "updatedAt",
  a.id AS "affiliateId",
  adv.id AS "advertiserId"
`;

const userCredentialsSelectFields = `
  ${userSelectFields},
  u.password_hash AS "passwordHash"
`;

export async function createUser({
  email,
  passwordHash,
  displayName,
  role = 'affiliate',
}, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO users (email, password_hash, display_name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        email,
        display_name AS "displayName",
        role,
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `,
    [email.toLowerCase(), passwordHash, displayName ?? null, role],
  );

  return result.rows[0];
}

export async function findUserByEmail(email, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT
        ${userCredentialsSelectFields}
      FROM users AS u
      LEFT JOIN affiliates AS a ON a.user_id = u.id
      LEFT JOIN advertisers AS adv ON adv.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1;
    `,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findUserById(id, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT
        ${userSelectFields}
      FROM users AS u
      LEFT JOIN affiliates AS a ON a.user_id = u.id
      LEFT JOIN advertisers AS adv ON adv.user_id = u.id
      WHERE u.id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findUserCredentialsById(id, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT
        ${userCredentialsSelectFields}
      FROM users AS u
      LEFT JOIN affiliates AS a ON a.user_id = u.id
      LEFT JOIN advertisers AS adv ON adv.user_id = u.id
      WHERE u.id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function listUsersByRole(
  {
    role,
    search = null,
    limit = 20,
    offset = 0,
    sort = 'createdAt',
    order = 'desc',
  },
  { client } = {},
) {
  const queryable = getQueryable(client);
  const normalizedSearch =
    typeof search === 'string' && search.trim().length > 0
      ? `%${search.trim().toLowerCase()}%`
      : null;
  const normalizedOrder =
    typeof order === 'string' && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sortMap = {
    createdAt: 'u.created_at',
    updatedAt: 'u.updated_at',
    displayName: 'u.display_name',
    email: 'u.email',
  };
  const sortColumn = sortMap[sort] ?? sortMap.createdAt;

  const [itemsResult, countResult] = await Promise.all([
    queryable.query(
      `
        SELECT
          ${userSelectFields}
        FROM users AS u
        LEFT JOIN affiliates AS a ON a.user_id = u.id
        LEFT JOIN advertisers AS adv ON adv.user_id = u.id
        WHERE u.role = $1
          AND (
            $2::text IS NULL
            OR LOWER(u.email) LIKE $2
            OR LOWER(COALESCE(u.display_name, '')) LIKE $2
          )
        ORDER BY ${sortColumn} ${normalizedOrder}, u.id ${normalizedOrder}
        LIMIT $3
        OFFSET $4;
      `,
      [role, normalizedSearch, limit, offset],
    ),
    queryable.query(
      `
        SELECT COUNT(*)::int AS total
        FROM users AS u
        WHERE u.role = $1
          AND (
            $2::text IS NULL
            OR LOWER(u.email) LIKE $2
            OR LOWER(COALESCE(u.display_name, '')) LIKE $2
          );
      `,
      [role, normalizedSearch],
    ),
  ]);

  return {
    items: itemsResult.rows,
    total: countResult.rows[0]?.total ?? 0,
  };
}

export async function updateUserById(id, fields, { client } = {}) {
  const queryable = getQueryable(client);
  const updates = [];
  const values = [];

  if (Object.hasOwn(fields, 'email')) {
    values.push(fields.email?.toLowerCase() ?? null);
    updates.push(`email = $${values.length}`);
  }

  if (Object.hasOwn(fields, 'displayName')) {
    values.push(fields.displayName ?? null);
    updates.push(`display_name = $${values.length}`);
  }

  if (Object.hasOwn(fields, 'role')) {
    values.push(fields.role ?? null);
    updates.push(`role = $${values.length}`);
  }

  if (updates.length === 0) {
    return findUserById(id, { client });
  }

  values.push(id);

  const result = await queryable.query(
    `
      UPDATE users
      SET
        ${updates.join(', ')},
        updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING id;
    `,
    values,
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findUserById(id, { client });
}

export async function updateUserPasswordById(id, passwordHash, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      UPDATE users
      SET
        password_hash = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `,
    [passwordHash, id],
  );

  return result.rowCount > 0;
}

export async function deleteUserById(id, { client } = {}) {
  const queryable = getQueryable(client);
  await queryable.query(
    `
      DELETE FROM users
      WHERE id = $1;
    `,
    [id],
  );
}
