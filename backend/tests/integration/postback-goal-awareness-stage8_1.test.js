import request from 'supertest';
import { createApp } from '../../src/app.js';
import pool from '../../src/db.js';
import {
  findByClickIdAndGoalId,
  listByClickId,
} from '../../src/models/conversions.model.js';
import {
  createTestAffiliate,
  createTestAffiliateUser,
  createTestOffer,
  createTestOfferGoal,
  createTestOfferGoalAffiliateRate,
  hideAffiliateFromOffer,
} from '../helpers/factories.js';
import { buildPostbackSignature } from '../helpers/postback.js';

const app = createApp();

function extractClickIdFromRedirect(location) {
  const url = new URL(location);
  return url.searchParams.get('click_id');
}

async function createTrackedClick(offerId, affiliateId, country = 'RU') {
  const response = await request(app)
    .get('/track/click')
    .query({ offerId, affiliateId })
    .set('CF-IPCountry', country);

  expect(response.status).toBe(302);

  return extractClickIdFromRedirect(response.headers.location);
}

async function sendPostback({
  method = 'post',
  token,
  clickId,
  goalId,
  status = 'approved',
  externalTransactionId,
  payoutRub,
  extra = {},
}) {
  const payload = {
    token,
    clickId,
    goalId,
    status,
    signature: buildPostbackSignature({
      token,
      clickId,
      status,
      payoutRub,
    }),
    ...extra,
  };

  if (externalTransactionId !== undefined) {
    payload.externalTransactionId = externalTransactionId;
  }

  if (payoutRub !== undefined) {
    payload.payoutRub = payoutRub;
  }

  if (method === 'get') {
    return request(app).get('/track/postback').query(payload);
  }

  return request(app).post('/track/postback').send(payload);
}

describe('Stage 8.1 goal-aware postbacks', () => {
  it('creates conversions for the explicitly selected goal via POST and GET', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goalA = await createTestOfferGoal(offer.id, {
      name: 'Lead',
      revenue: 400,
      payout: 200,
      isDefault: true,
    });
    const goalB = await createTestOfferGoal(offer.id, {
      name: 'Sale',
      revenue: 900,
      payout: 450,
      isDefault: false,
    });

    const clickA = await createTrackedClick(offer.id, affiliate.id);
    const postResponse = await sendPostback({
      token: offer.postbackToken,
      clickId: clickA,
      goalId: goalA.id,
      status: 'approved',
      externalTransactionId: 'order-a',
    });

    expect(postResponse.status).toBe(200);
    expect(postResponse.body.data.conversion).toMatchObject({
      offerId: offer.id,
      goalId: goalA.id,
      clickId: clickA,
      externalTransactionId: 'order-a',
      status: 'approved',
      isTest: false,
    });
    expect(postResponse.body.data.goal).toMatchObject({
      id: goalA.id,
      name: 'Lead',
    });

    const clickB = await createTrackedClick(offer.id, affiliate.id);
    const getResponse = await sendPostback({
      method: 'get',
      token: offer.postbackToken,
      clickId: clickB,
      goalId: goalB.id,
      status: 'pending',
      externalTransactionId: 'order-b',
    });

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.conversion).toMatchObject({
      offerId: offer.id,
      goalId: goalB.id,
      clickId: clickB,
      externalTransactionId: 'order-b',
      status: 'pending',
      isTest: false,
    });
    expect(getResponse.body.data.goal).toMatchObject({
      id: goalB.id,
      name: 'Sale',
    });
  });

  it('rejects postbacks without goalId', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    await createTestOfferGoal(offer.id);
    const clickId = await createTrackedClick(offer.id, affiliate.id);

    const response = await request(app).post('/track/postback').send({
      token: offer.postbackToken,
      clickId,
      status: 'approved',
      signature: buildPostbackSignature({
        token: offer.postbackToken,
        clickId,
        status: 'approved',
      }),
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GOAL_REQUIRED');
  });

  it('rejects a goal from another offer', async () => {
    const affiliate = await createTestAffiliate();
    const offerA = await createTestOffer({ visibilityMode: 'public' });
    const offerB = await createTestOffer({ visibilityMode: 'public' });
    const goalA = await createTestOfferGoal(offerA.id);
    const foreignGoal = await createTestOfferGoal(offerB.id, {
      isDefault: false,
    });
    const clickId = await createTrackedClick(offerA.id, affiliate.id);

    const response = await sendPostback({
      token: offerA.postbackToken,
      clickId,
      goalId: foreignGoal.id,
      status: 'approved',
    });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('GOAL_NOT_FOUND_FOR_OFFER');

    const conversion = await findByClickIdAndGoalId(clickId, goalA.id);
    expect(conversion).toBeNull();
  });

  it('uses base goal money, snapshots the selected goal, and ignores request money fields', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goal = await createTestOfferGoal(offer.id, {
      name: 'Qualified Lead',
      revenue: 700,
      payout: 320,
    });
    const clickId = await createTrackedClick(offer.id, affiliate.id);

    const response = await sendPostback({
      token: offer.postbackToken,
      clickId,
      goalId: goal.id,
      status: 'approved',
      payoutRub: 9999,
      extra: {
        revenue: 8888,
        profit: 7777,
      },
    });

    expect(response.status).toBe(200);

    const conversion = await findByClickIdAndGoalId(clickId, goal.id);
    expect(conversion).not.toBeNull();
    expect(conversion.goalId).toBe(goal.id);
    expect(Number(conversion.payoutRub)).toBeCloseTo(320);
    expect(Number(conversion.payoutAmount)).toBeCloseTo(320);
    expect(Number(conversion.revenueAmount)).toBeCloseTo(700);
  });

  it('uses partner-specific goal rates when an override exists', async () => {
    const { user: creatorUser } = await createTestAffiliateUser();
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goal = await createTestOfferGoal(offer.id, {
      revenue: 800,
      payout: 300,
    });

    await createTestOfferGoalAffiliateRate(goal.id, affiliate.id, {
      revenue: 650,
      payout: 250,
      createdBy: creatorUser.id,
    });

    const clickId = await createTrackedClick(offer.id, affiliate.id);
    const response = await sendPostback({
      token: offer.postbackToken,
      clickId,
      goalId: goal.id,
      status: 'approved',
    });

    expect(response.status).toBe(200);

    const conversion = await findByClickIdAndGoalId(clickId, goal.id);
    expect(conversion).not.toBeNull();
    expect(Number(conversion.revenueAmount)).toBeCloseTo(650);
    expect(Number(conversion.payoutAmount)).toBeCloseTo(250);
    expect(Number(conversion.payoutRub)).toBeCloseTo(250);
  });

  it('returns 403 when a partner loses offer visibility before postback conversion', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goal = await createTestOfferGoal(offer.id, {
      revenue: 500,
      payout: 250,
    });
    const clickId = await createTrackedClick(offer.id, affiliate.id);

    await hideAffiliateFromOffer({
      offerId: offer.id,
      affiliateId: affiliate.id,
      reason: 'stage19-hidden-before-postback',
    });

    const response = await sendPostback({
      token: offer.postbackToken,
      clickId,
      goalId: goal.id,
      status: 'approved',
      externalTransactionId: 'hidden-after-click',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.details).toMatchObject({
      clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      denyReason: 'hidden',
    });

    const conversion = await findByClickIdAndGoalId(clickId, goal.id);
    expect(conversion).toBeNull();
  });

  it('checks limits on the selected goal, allows other goals on the same click, and still blocks true duplicates', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goalA = await createTestOfferGoal(offer.id, {
      name: 'Goal A',
      revenue: 500,
      payout: 200,
      limitEnabled: true,
      limitType: 'conversions_count',
      limitValue: 1,
    });
    const goalB = await createTestOfferGoal(offer.id, {
      name: 'Goal B',
      revenue: 300,
      payout: 120,
      isDefault: false,
    });

    const firstClickId = await createTrackedClick(offer.id, affiliate.id);
    const goalAResponse = await sendPostback({
      token: offer.postbackToken,
      clickId: firstClickId,
      goalId: goalA.id,
      status: 'approved',
    });
    expect(goalAResponse.status).toBe(200);

    const goalBSameClickResponse = await sendPostback({
      token: offer.postbackToken,
      clickId: firstClickId,
      goalId: goalB.id,
      status: 'approved',
    });
    expect(goalBSameClickResponse.status).toBe(200);

    const duplicateGoalAResponse = await sendPostback({
      token: offer.postbackToken,
      clickId: firstClickId,
      goalId: goalA.id,
      status: 'approved',
    });
    expect(duplicateGoalAResponse.status).toBe(409);
    expect(duplicateGoalAResponse.body.error.code).toBe('DUPLICATE_CONVERSION');

    const secondClickId = await createTrackedClick(offer.id, affiliate.id);
    const blockedGoalAResponse = await sendPostback({
      token: offer.postbackToken,
      clickId: secondClickId,
      goalId: goalA.id,
      status: 'approved',
    });
    expect(blockedGoalAResponse.status).toBe(409);
    expect(blockedGoalAResponse.body.error.code).toBe('GOAL_LIMIT_REACHED');

    const goalBSecondClickResponse = await sendPostback({
      token: offer.postbackToken,
      clickId: secondClickId,
      goalId: goalB.id,
      status: 'approved',
    });
    expect(goalBSecondClickResponse.status).toBe(200);

    const firstClickConversions = await listByClickId(firstClickId);
    expect(firstClickConversions.map((item) => item.goalId).sort()).toEqual(
      [goalA.id, goalB.id].sort(),
    );
  });

  it('deduplicates by goal-aware external transaction id and still allows the same external id for another goal', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goalA = await createTestOfferGoal(offer.id, {
      name: 'Registration',
    });
    const goalB = await createTestOfferGoal(offer.id, {
      name: 'Deposit',
      isDefault: false,
    });

    const clickA = await createTrackedClick(offer.id, affiliate.id);
    const firstResponse = await sendPostback({
      token: offer.postbackToken,
      clickId: clickA,
      goalId: goalA.id,
      status: 'approved',
      externalTransactionId: 'order-42',
    });
    expect(firstResponse.status).toBe(200);

    const clickB = await createTrackedClick(offer.id, affiliate.id);
    const duplicateExternalResponse = await sendPostback({
      token: offer.postbackToken,
      clickId: clickB,
      goalId: goalA.id,
      status: 'approved',
      externalTransactionId: 'order-42',
    });
    expect(duplicateExternalResponse.status).toBe(409);
    expect(duplicateExternalResponse.body.error.code).toBe('DUPLICATE_CONVERSION');

    const otherGoalResponse = await sendPostback({
      token: offer.postbackToken,
      clickId: clickB,
      goalId: goalB.id,
      status: 'approved',
      externalTransactionId: 'order-42',
    });
    expect(otherGoalResponse.status).toBe(200);

    const countResult = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM conversions
        WHERE offer_id = $1
          AND external_transaction_id = $2
      `,
      [offer.id, 'order-42'],
    );

    expect(countResult.rows[0].count).toBe(2);
  });
});
