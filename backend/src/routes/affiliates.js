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

const router = express.Router();

router.use(authenticate);

function handleDbConflict(error, res) {
  if (error?.code === '23505') {
    return res
      .status(409)
      .json({ message: 'Аффилиат с таким email уже существует', field: 'email' });
  }

  throw error;
}

router.post('/', async (req, res, next) => {
  const { dto, errors } = validateCreateAffiliateDto(req.body);

  if (errors.length) {
    return res.status(400).json({ message: 'Ошибка валидации', errors });
  }

  try {
    const affiliate = await createAffiliate(dto);
    return res.status(201).json({ affiliate });
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
    return res.status(400).json({ message: 'Ошибка валидации', errors });
  }

  const affiliates = await listAffiliates({ status: statusValue });
  return res.json({ affiliates });
});

router.get('/:id', async (req, res) => {
  const affiliate = await findAffiliateById(req.params.id);

  if (!affiliate) {
    return res.status(404).json({ message: 'Аффилиат не найден' });
  }

  return res.json({ affiliate });
});

router.patch('/:id', async (req, res, next) => {
  const { dto, errors } = validateUpdateAffiliateDto(req.body);

  if (errors.length) {
    return res.status(400).json({ message: 'Ошибка валидации', errors });
  }

  try {
    const affiliate = await updateAffiliate(req.params.id, dto);

    if (!affiliate) {
      return res.status(404).json({ message: 'Аффилиат не найден' });
    }

    return res.json({ affiliate });
  } catch (error) {
    try {
      return handleDbConflict(error, res);
    } catch (err) {
      return next(err);
    }
  }
});

export default router;
