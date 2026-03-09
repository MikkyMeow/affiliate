import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { validatePostbackParams } from '../validators/postback.js';
import { registerConversion } from '../services/postback/conversions.service.js';

const router = express.Router();

router.post(
  '/postback',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validatePostbackParams(req.body ?? {});

    if (errors.length) {
      throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Ошибка валидации', {
        errors,
      });
    }

    const conversion = await registerConversion(dto);

    return sendSuccess(res, {
      clickId: conversion.clickId,
      status: conversion.status,
    });
  }),
);

export default router;
