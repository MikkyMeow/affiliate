import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import {
  getPartnerProfile,
  getPartnerStatsSummary,
  listPartnerOffers,
} from '../services/partner.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('affiliate'));

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const profile = await getPartnerProfile(req.user.sub);
    return sendSuccess(res, profile);
  }),
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await getPartnerStatsSummary(req.user.sub);
    return sendSuccess(res, stats);
  }),
);

router.get(
  '/offers',
  asyncHandler(async (req, res) => {
    const offers = await listPartnerOffers();
    return sendSuccess(res, offers);
  }),
);

export default router;
