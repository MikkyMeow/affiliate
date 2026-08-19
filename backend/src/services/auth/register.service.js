import bcrypt from 'bcryptjs';
import pool from '../../db.js';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_VALUES } from '../../constants/accountTypes.js';
import { createUser, findUserByEmail } from '../../models/userModel.js';
import {
  createAffiliate,
  findAffiliateByEmail,
} from '../../models/affiliateModel.js';
import { createAdvertiser } from '../../models/advertiserModel.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';

function ensureAccountTypeAllowed(accountType) {
  if (!ACCOUNT_TYPE_VALUES.includes(accountType)) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      400,
      'Недопустимый accountType',
      { allowed: ACCOUNT_TYPE_VALUES },
    );
  }
}

export async function registerUser({
  email,
  password,
  displayName,
  accountType,
}) {
  if (!email || !password || !displayName) {
    throw new Error('email, password и displayName обязательны');
  }

  const normalizedAccountType =
    typeof accountType === 'string'
      ? accountType.trim().toLowerCase()
      : accountType;

  ensureAccountTypeAllowed(normalizedAccountType);

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'Пользователь с таким email уже существует',
      { email },
    );
  }

  if (normalizedAccountType === ACCOUNT_TYPES.AFFILIATE) {
    const existingAffiliate = await findAffiliateByEmail(email);

    if (existingAffiliate) {
      throw new ApiError(
        ERROR_CODES.CONFLICT,
        409,
        'Аффилиат с таким email уже существует',
        { email },
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const user = await createUser(
      {
        email,
        passwordHash,
        displayName,
        role: normalizedAccountType,
      },
      { client },
    );

    let affiliateId = null;
    let advertiserId = null;

    if (normalizedAccountType === ACCOUNT_TYPES.AFFILIATE) {
      const affiliate = await createAffiliate(
        {
          name: displayName,
          email,
          userId: user.id,
        },
        { client },
      );
      affiliateId = affiliate.id;
    }

    if (normalizedAccountType === ACCOUNT_TYPES.ADVERTISER) {
      const advertiser = await createAdvertiser(
        {
          name: displayName,
          userId: user.id,
        },
        { client },
      );
      advertiserId = advertiser.id;
    }

    await client.query('COMMIT');

    return {
      user: {
        ...user,
        affiliateId,
        advertiserId,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error?.code === '23505') {
      if (error?.constraint === 'users_email_key') {
        throw new ApiError(
          ERROR_CODES.CONFLICT,
          409,
          'Пользователь с таким email уже существует',
          { email },
        );
      }

      if (error?.constraint === 'affiliates_email_key') {
        throw new ApiError(
          ERROR_CODES.CONFLICT,
          409,
          'Аффилиат с таким email уже существует',
          { email },
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}
