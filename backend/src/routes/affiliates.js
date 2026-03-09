import express from 'express';
import {
  createAffiliate,
  listAffiliates,
  findAffiliateById,
  updateAffiliate,
} from '../models/affiliateModel.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateCreateAffiliateDto,
  validateUpdateAffiliateDto,
  validateAffiliateStatusFilter,
} from '../validators/affiliates.js';
import {
  ERROR_CODES,
  sendError,
  sendList,
  sendSuccess,
} from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

function handleDbConflict(error, res) {
  if (error?.code === '23505') {
    return sendError(res, {
      status: 409,
      code: ERROR_CODES.CONFLICT,
      message: 'Аффилиат с таким email уже существует',
      details: { field: 'email' },
    });
  }

  throw error;
}

router.post('/', async (req, res, next) => {
  const { dto, errors } = validateCreateAffiliateDto(req.body);

  if (errors.length) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Ошибка валидации',
      details: { errors },
    });
  }

  try {
    const affiliate = await createAffiliate(dto);
    return sendSuccess(res, { affiliate }, { status: 201 });
  } catch (error) {
    try {
      return handleDbConflict(error, res);
    } catch (err) {
      return next(err);
    }
  }
});

router.get('/', async (req, res) => {
  const { status } = req.query ?? {};
  const { value: statusValue, errors } = validateAffiliateStatusFilter(status);

  if (errors.length) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Ошибка валидации',
      details: { errors },
    });
  }

  const affiliates = await listAffiliates({ status: statusValue });
  return sendList(res, affiliates);
});

router.get('/:id', async (req, res) => {
  const affiliate = await findAffiliateById(req.params.id);

  if (!affiliate) {
    return sendError(res, {
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Аффилиат не найден',
      details: { affiliateId: req.params.id },
    });
  }

  return sendSuccess(res, { affiliate });
});

router.patch('/:id', async (req, res, next) => {
  const { dto, errors } = validateUpdateAffiliateDto(req.body);

  if (errors.length) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Ошибка валидации',
      details: { errors },
    });
  }

  try {
    const affiliate = await updateAffiliate(req.params.id, dto);

    if (!affiliate) {
      return sendError(res, {
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: 'Аффилиат не найден',
        details: { affiliateId: req.params.id },
      });
    }

    return sendSuccess(res, { affiliate });
  } catch (error) {
    try {
      return handleDbConflict(error, res);
    } catch (err) {
      return next(err);
    }
  }
});

export default router;
