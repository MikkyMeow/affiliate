import express from 'express';
import {
  createAdvertiser,
  listAdvertisers,
  findAdvertiserById,
  updateAdvertiser,
} from '../models/advertiserModel.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateCreateAdvertiserDto,
  validateUpdateAdvertiserDto,
  validateAdvertiserStatusFilter,
} from '../validators/advertisers.js';
import {
  ERROR_CODES,
  sendError,
  sendList,
  sendSuccess,
} from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

router.post('/', async (req, res) => {
  const { dto, errors } = validateCreateAdvertiserDto(req.body);

  if (errors.length) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Ошибка валидации',
      details: { errors },
    });
  }

  const advertiser = await createAdvertiser(dto);
  return sendSuccess(res, { advertiser }, { status: 201 });
});

router.get('/', async (req, res) => {
  const { status } = req.query ?? {};

  const { value: statusValue, errors } = validateAdvertiserStatusFilter(status);

  if (errors.length) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Ошибка валидации',
      details: { errors },
    });
  }

  const advertisers = await listAdvertisers({ status: statusValue });
  return sendList(res, advertisers);
});

router.get('/:id', async (req, res) => {
  const advertiser = await findAdvertiserById(req.params.id);

  if (!advertiser) {
    return sendError(res, {
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Рекламодатель не найден',
      details: { advertiserId: req.params.id },
    });
  }

  return sendSuccess(res, { advertiser });
});

router.patch('/:id', async (req, res) => {
  const { dto, errors } = validateUpdateAdvertiserDto(req.body);

  if (errors.length) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Ошибка валидации',
      details: { errors },
    });
  }

  const advertiser = await updateAdvertiser(req.params.id, dto);

  if (!advertiser) {
    return sendError(res, {
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Рекламодатель не найден',
      details: { advertiserId: req.params.id },
    });
  }

  return sendSuccess(res, { advertiser });
});

export default router;
