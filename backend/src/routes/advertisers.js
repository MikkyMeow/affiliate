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

const router = express.Router();

router.use(authenticate);

router.post('/', async (req, res) => {
  const { dto, errors } = validateCreateAdvertiserDto(req.body);

  if (errors.length) {
    return res.status(400).json({ message: 'Ошибка валидации', errors });
  }

  const advertiser = await createAdvertiser(dto);
  return res.status(201).json({ advertiser });
});

router.get('/', async (req, res) => {
  const { status } = req.query ?? {};

  const { value: statusValue, errors } = validateAdvertiserStatusFilter(status);

  if (errors.length) {
    return res.status(400).json({ message: 'Ошибка валидации', errors });
  }

  const advertisers = await listAdvertisers({ status: statusValue });
  return res.json({ advertisers });
});

router.get('/:id', async (req, res) => {
  const advertiser = await findAdvertiserById(req.params.id);

  if (!advertiser) {
    return res.status(404).json({ message: 'Рекламодатель не найден' });
  }

  return res.json({ advertiser });
});

router.patch('/:id', async (req, res) => {
  const { dto, errors } = validateUpdateAdvertiserDto(req.body);

  if (errors.length) {
    return res.status(400).json({ message: 'Ошибка валидации', errors });
  }

  const advertiser = await updateAdvertiser(req.params.id, dto);

  if (!advertiser) {
    return res.status(404).json({ message: 'Рекламодатель не найден' });
  }

  return res.json({ advertiser });
});

export default router;
