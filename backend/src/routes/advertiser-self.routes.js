import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { getAdvertiserProfileByUser } from '../services/advertisers/advertiser-profile.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('advertiser'));

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const profile = await getAdvertiserProfileByUser(req.user);
    return sendSuccess(res, profile);
  }),
);

export default router;
