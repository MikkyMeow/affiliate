import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { getSummary } from '../services/stats/stats.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminArea);

router.get(
  '/totals',
  asyncHandler(async (req, res) => {
    const totals = await getSummary();
    return sendSuccess(res, totals);
  }),
);

export default router;
