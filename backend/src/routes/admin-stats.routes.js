import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { getSummary } from '../services/stats/stats.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

router.get(
  '/totals',
  asyncHandler(async (req, res) => {
    const totals = await getSummary();
    return sendSuccess(res, totals);
  }),
);

export default router;
