import crypto from 'node:crypto';
import { faker } from '@faker-js/faker';
import '../config/load-env.js';
import pool from '../db.js';
import { applyMigrations } from '../migrate.js';
import { advertiserCatalog } from './data/advertisers.js';
import {
  affiliateFirstNames,
  affiliateLastNames,
  contactProfiles,
  managerProfiles,
} from './data/russianNames.js';
import { offerTemplates } from './data/offerTemplates.js';

const SEED = 20260519;
const NOW = new Date('2026-05-19T12:00:00.000Z');
const PASSWORD_HASH = '$2a$10$oSC3jbMIoWW81jaCW4B0d.UKOZkU88MPB/umR0WTEcoht5lU.UlLe';
const USER_EMAIL_PATTERN = '%@example.local';
const EXPECTED_COUNTS = Object.freeze({
  managers: 12,
  advertisers: 36,
  partners: 148,
  offers: 37,
  clicks: 1897,
  conversions: 689,
});

const managerTimezones = [
  'Europe/Moscow',
  'Europe/Samara',
  'Europe/Kirov',
  'Europe/Volgograd',
  'Asia/Yekaterinburg',
  'Asia/Novosibirsk',
];

const affiliateFormats = [
  {
    typeLabel: 'SEO-сайт',
    source: 'seo',
    refererDomain: 'fin-sovet-demo.local',
    telegramPrefix: 'seo',
    siteLabel: 'Финсовет',
  },
  {
    typeLabel: 'Telegram-канал',
    source: 'telegram',
    refererDomain: 'skidki-gid-demo.local',
    telegramPrefix: 'tg',
    siteLabel: 'Гид скидок',
  },
  {
    typeLabel: 'VK-сообщество',
    source: 'vk',
    refererDomain: 'gorod-vybor-demo.local',
    telegramPrefix: 'vk',
    siteLabel: 'Городской выбор',
  },
  {
    typeLabel: 'YouTube-канал',
    source: 'youtube',
    refererDomain: 'review-potok-demo.local',
    telegramPrefix: 'yt',
    siteLabel: 'Обзорный поток',
  },
  {
    typeLabel: 'Дзен-канал',
    source: 'direct',
    refererDomain: 'dom-review-demo.local',
    telegramPrefix: 'zen',
    siteLabel: 'Дом Review',
  },
  {
    typeLabel: 'арбитражная команда',
    source: 'direct',
    refererDomain: 'lead-sprint-demo.local',
    telegramPrefix: 'arb',
    siteLabel: 'Lead Sprint',
  },
  {
    typeLabel: 'email-рассылка',
    source: 'email',
    refererDomain: 'sale-vestnik-demo.local',
    telegramPrefix: 'mail',
    siteLabel: 'Sale Вестник',
  },
  {
    typeLabel: 'cashback-сервис',
    source: 'cashback',
    refererDomain: 'bonus-karta-demo.local',
    telegramPrefix: 'cash',
    siteLabel: 'Бонус Карта',
  },
  {
    typeLabel: 'coupon-сайт',
    source: 'coupons',
    refererDomain: 'promo-baza-demo.local',
    telegramPrefix: 'promo',
    siteLabel: 'Промо База',
  },
  {
    typeLabel: 'блог',
    source: 'seo',
    refererDomain: 'expert-blog-demo.local',
    telegramPrefix: 'blog',
    siteLabel: 'Эксперт Блог',
  },
  {
    typeLabel: 'мобильное приложение',
    source: 'direct',
    refererDomain: 'app-potok-demo.local',
    telegramPrefix: 'app',
    siteLabel: 'App Поток',
  },
  {
    typeLabel: 'контентная сетка',
    source: 'direct',
    refererDomain: 'content-grid-demo.local',
    telegramPrefix: 'grid',
    siteLabel: 'Content Grid',
  },
];

const geoPoints = [
  { countryCode: 'RU', city: 'Москва' },
  { countryCode: 'RU', city: 'Санкт-Петербург' },
  { countryCode: 'RU', city: 'Казань' },
  { countryCode: 'RU', city: 'Екатеринбург' },
  { countryCode: 'RU', city: 'Новосибирск' },
  { countryCode: 'BY', city: 'Минск' },
  { countryCode: 'KZ', city: 'Алматы' },
  { countryCode: 'AM', city: 'Ереван' },
];

const deviceProfiles = [
  {
    device: 'mobile',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  {
    device: 'mobile',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  },
  {
    device: 'desktop',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  },
  {
    device: 'desktop',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  },
  {
    device: 'tablet',
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  },
  {
    device: 'desktop',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  },
];

function transliterate(value) {
  const map = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };

  return value
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomInt(min, max) {
  return faker.number.int({ min, max });
}

function choose(list) {
  return list[randomInt(0, list.length - 1)];
}

function daysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function shiftDate(baseDate, minutes) {
  return new Date(baseDate.getTime() + minutes * 60 * 1000);
}

function buildInsertQuery(tableName, columns, rows) {
  if (rows.length === 0) {
    throw new Error(`Cannot build INSERT for ${tableName} without rows`);
  }

  const values = [];
  const tuples = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      values.push(row[column]);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });

    return `(${placeholders.join(', ')})`;
  });

  return {
    text: `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
    values,
  };
}

function buildCountsMap(rows) {
  return rows.reduce((acc, row) => {
    acc[row.entity] = Number(row.count);
    return acc;
  }, {});
}

function ensureSafeEnvironment() {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();

  if (nodeEnv === 'production') {
    throw new Error('Refusing to run seed in NODE_ENV=production');
  }

  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (databaseUrl) {
    let parsedUrl;
    try {
      parsedUrl = new URL(databaseUrl);
    } catch (error) {
      throw new Error(`DATABASE_URL is invalid: ${error.message}`);
    }

    const host = (parsedUrl.hostname ?? '').toLowerCase();
    const dbName = parsedUrl.pathname.replace(/^\//, '').toLowerCase();
    const safeHosts = new Set(['localhost', '127.0.0.1', 'db', 'postgres']);
    const looksSafeByName = /(local|dev|test|affiliate)/.test(dbName);
    const looksDangerousByName = /(prod|production)/.test(dbName);

    if (looksDangerousByName || (!safeHosts.has(host) && !looksSafeByName)) {
      throw new Error(
        `Refusing to run seed against suspicious DATABASE_URL host="${host}" database="${dbName}"`,
      );
    }
  } else {
    const host = (process.env.DB_HOST ?? 'localhost').toLowerCase();
    const dbName = (process.env.DB_NAME ?? 'affiliate').toLowerCase();
    const looksDangerousByName = /(prod|production)/.test(dbName);

    if (!['localhost', '127.0.0.1', 'db', 'postgres'].includes(host)) {
      throw new Error(`Refusing to run seed against non-local DB host "${host}"`);
    }

    if (looksDangerousByName || !/(local|dev|test|affiliate)/.test(dbName)) {
      throw new Error(`Refusing to run seed against suspicious DB_NAME "${dbName}"`);
    }
  }
}

function buildManagers() {
  return managerProfiles.map((profile, index) => {
    const firstNameSlug = transliterate(profile.firstName);
    const lastNameSlug = transliterate(profile.lastName);

    return {
      displayName: `${profile.firstName} ${profile.lastName}`,
      email: `${firstNameSlug}.${lastNameSlug}@example.local`,
      role: 'manager',
      timezone: managerTimezones[index % managerTimezones.length],
      emailVerifiedAt: daysAgo(120 - index),
      createdAt: daysAgo(140 - index * 2),
    };
  });
}

function buildAdvertiserUsers(advertisers) {
  return advertisers.map((advertiser, index) => ({
    displayName: advertiser.companyName,
    email: `contact@${advertiser.slug}.example.local`,
    role: 'advertiser',
    timezone: 'Europe/Moscow',
    emailVerifiedAt: daysAgo(110 - (index % 20)),
    createdAt: daysAgo(115 - index),
  }));
}

function buildAdvertisers(managerIds, advertiserUsers) {
  return advertiserCatalog.map((advertiser, index) => {
    const contactName = contactProfiles[index % contactProfiles.length];

    return {
      companyName: advertiser.companyName,
      slug: advertiser.slug,
      theme: advertiser.theme,
      status: index % 9 === 0 ? 'inactive' : 'active',
      telegram: `@${advertiser.slug.replace(/-/g, '_')}_ads`,
      internalNote: `Seed advertiser: ${contactName}`,
      managerUserId: managerIds[index % managerIds.length],
      userId: advertiserUsers[index].id,
      createdAt: daysAgo(100 - index),
      updatedAt: daysAgo(50 - (index % 20)),
    };
  });
}

function buildAffiliateUsers() {
  const rows = [];

  for (let index = 0; index < EXPECTED_COUNTS.partners; index += 1) {
    const firstName = affiliateFirstNames[index % affiliateFirstNames.length];
    const lastName =
      affiliateLastNames[Math.floor(index / affiliateFirstNames.length) % affiliateLastNames.length];
    const firstNameSlug = transliterate(firstName);
    const lastNameSlug = transliterate(lastName);

    rows.push({
      displayName: `${firstName} ${lastName}`,
      email: `${firstNameSlug}.${lastNameSlug}.${index + 1}@example.local`,
      role: 'affiliate',
      timezone: choose(['Europe/Moscow', 'Europe/Samara', 'Asia/Yekaterinburg']),
      emailVerifiedAt: daysAgo(95 - (index % 30)),
      createdAt: daysAgo(102 - (index % 40)),
    });
  }

  return rows;
}

function buildAffiliates(managerIds, affiliateUsers) {
  return affiliateUsers.map((user, index) => {
    const format = affiliateFormats[index % affiliateFormats.length];
    const displayName = user.displayName;
    const siteName = `${format.siteLabel} ${index + 1}`;
    const status = index % 11 === 0 ? 'inactive' : 'active';

    return {
      name: `${displayName} — ${format.typeLabel} «${siteName}»`,
      email: user.email,
      status,
      telegram: `@${format.telegramPrefix}_${index + 1}`,
      internalNote: `Источник: ${format.typeLabel}; площадка: https://${format.refererDomain}`,
      userId: user.id,
      managerUserId: managerIds[index % managerIds.length],
      createdAt: daysAgo(90 - (index % 45)),
      updatedAt: daysAgo(20 - (index % 10)),
      trafficSource: format.source,
      refererDomain: format.refererDomain,
    };
  });
}

function buildOffers(advertisersBySlug) {
  return offerTemplates.map((template, index) => {
    const advertiser = advertisersBySlug.get(template.advertiserSlug);

    if (!advertiser) {
      throw new Error(`Advertiser with slug "${template.advertiserSlug}" not found`);
    }

    return {
      ...template,
      advertiserId: advertiser.id,
      createdAt: daysAgo(88 - index),
      updatedAt: daysAgo(12 - (index % 9)),
      targetUrl: `https://${template.advertiserSlug}.demo.local/offers/${index + 1}`,
      fallbackUrl: `https://${template.advertiserSlug}.demo.local/unavailable/${index + 1}`,
      previewUrl: `https://${template.advertiserSlug}.demo.local/preview/${index + 1}`,
      postbackToken: crypto.createHash('sha256').update(`postback-${SEED}-${index}`).digest('hex'),
      allowDuplicateClicks: index % 7 !== 0,
      duplicateClickWindowSeconds: index % 7 === 0 ? 86400 : null,
      targetingStrict: index % 5 === 0,
    };
  });
}

function buildOfferWeights(offers) {
  return offers.map((offer, index) => {
    if (index < 8) {
      return { offerId: offer.id, weight: 9 };
    }

    if (index < 20) {
      return { offerId: offer.id, weight: 5 };
    }

    return { offerId: offer.id, weight: 2 };
  });
}

function pickWeightedId(weightedItems) {
  const total = weightedItems.reduce((sum, item) => sum + item.weight, 0);
  let cursor = randomInt(1, total);

  for (const item of weightedItems) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.offerId;
    }
  }

  return weightedItems[weightedItems.length - 1].offerId;
}

function buildClicks(offers, offerGoalsByOfferId, affiliates) {
  const weightedOffers = buildOfferWeights(offers);
  const offersById = new Map(offers.map((offer) => [offer.id, offer]));

  return Array.from({ length: EXPECTED_COUNTS.clicks }, (_, index) => {
    const offerId = pickWeightedId(weightedOffers);
    const offer = offersById.get(offerId);
    const offerGoal = offerGoalsByOfferId.get(offerId);
    const affiliate = affiliates[randomInt(0, affiliates.length - 1)];
    const geo = choose(geoPoints);
    const deviceProfile = choose(deviceProfiles);
    const format = affiliateFormats[index % affiliateFormats.length];
    const createdAt = shiftDate(
      daysAgo(randomInt(1, 87)),
      randomInt(0, 23 * 60 + 59),
    );
    const clickId = `CLK-${String(index + 1).padStart(5, '0')}-${SEED}`;

    return {
      clickId,
      offerId,
      affiliateId: affiliate.id,
      goalId: offerGoal.id,
      source: 'tracking',
      createdAt,
      ip: faker.internet.ipv4(),
      userAgent: deviceProfile.userAgent,
      device: deviceProfile.device,
      referer: `https://${affiliate.refererDomain}/out/${offer.publicIdNumber ?? index + 1}`,
      sub1: `${affiliate.trafficSource}_${(index % 17) + 1}`,
      sub2: geo.city,
      sub3: offer.category,
      sub4: `m${(index % 12) + 1}`,
      sub5: `flow-${(index % 7) + 1}`,
      canonicalClickId: clickId,
      isDuplicate: false,
      duplicateOfClickId: null,
      dedupeFingerprint: `fp-${offer.id.slice(0, 8)}-${affiliate.id.slice(0, 8)}-${index + 1}`,
      countryCode: geo.countryCode,
      targetingStrict: offer.targetingStrict,
      redirectOutcome: offer.targetingStrict && geo.countryCode !== 'RU'
        ? 'fallback_redirect'
        : 'allowed_target_redirect',
      redirectReason: offer.targetingStrict && geo.countryCode !== 'RU'
        ? 'geo_not_allowed'
        : null,
      destinationType: offer.targetingStrict && geo.countryCode !== 'RU'
        ? 'fallback'
        : 'target',
    };
  });
}

function buildConversions(clicks, offersById, offerGoalsByOfferId) {
  const selectedClicks = clicks
    .slice()
    .sort((left, right) => {
      const leftScore = Number.parseInt(left.clickId.slice(4, 9), 10) % 13;
      const rightScore = Number.parseInt(right.clickId.slice(4, 9), 10) % 13;
      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    })
    .slice(0, EXPECTED_COUNTS.conversions);

  return selectedClicks.map((click, index) => {
    const offer = offersById.get(click.offerId);
    const goal = offerGoalsByOfferId.get(click.offerId);
    const status =
      index % 10 === 0
        ? 'rejected'
        : index % 7 === 0
          ? 'pending'
          : index % 19 === 0
            ? 'cancelled'
            : 'approved';

    let delayMinutes;
    if (goal.name.includes('Регистрация') || goal.name.includes('Подписка') || goal.name.includes('Установка')) {
      delayMinutes = randomInt(15, 12 * 60);
    } else if (offer.category === 'finance' || offer.category === 'real_estate' || offer.category === 'b2b') {
      delayMinutes = randomInt(24 * 60, 14 * 24 * 60);
    } else {
      delayMinutes = randomInt(3 * 60, 4 * 24 * 60);
    }

    return {
      clickId: click.clickId,
      offerId: click.offerId,
      affiliateId: click.affiliateId,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      source: 'tracking',
      status,
      isTest: false,
      payoutRub: goal.payout,
      payoutAmount: goal.payout,
      revenueAmount: goal.revenue,
      externalTransactionId: `ORD-${String(index + 1).padStart(5, '0')}-${offer.publicIdNumber}`,
      createdAt: shiftDate(click.createdAt, delayMinutes),
      updatedAt: shiftDate(click.createdAt, delayMinutes + randomInt(5, 180)),
    };
  });
}

async function cleanSeedScope(client) {
  await client.query(`
    TRUNCATE TABLE
      conversion_status_history,
      click_dedup_registry,
      conversions,
      clicks,
      offer_goal_affiliate_rates,
      offer_affiliate_hidden,
      offer_affiliate_access,
      offer_requests,
      offer_geo_rules,
      offer_goals,
      offers
    RESTART IDENTITY CASCADE;
  `);

  await client.query(`
    DELETE FROM affiliates;
  `);

  await client.query(`
    DELETE FROM advertisers;
  `);

  await client.query(`
    DELETE FROM users
    WHERE role IN ('manager', 'affiliate', 'advertiser');
  `);
}

async function insertUsers(client, users) {
  const columns = [
    'email',
    'password_hash',
    'display_name',
    'role',
    'timezone',
    'email_verified_at',
    'created_at',
    'updated_at',
  ];

  const rows = users.map((user) => ({
    email: user.email.toLowerCase(),
    password_hash: PASSWORD_HASH,
    display_name: user.displayName,
    role: user.role,
    timezone: user.timezone ?? null,
    email_verified_at: user.emailVerifiedAt ?? null,
    created_at: user.createdAt,
    updated_at: user.createdAt,
  }));

  const query = buildInsertQuery('users', columns, rows);
  const result = await client.query(
    `${query.text} RETURNING id, email, role, display_name AS "displayName";`,
    query.values,
  );

  return result.rows;
}

async function insertAdvertisers(client, advertisers) {
  const columns = [
    'name',
    'status',
    'telegram',
    'internal_note',
    'manager_user_id',
    'user_id',
    'created_at',
    'updated_at',
  ];

  const query = buildInsertQuery(
    'advertisers',
    columns,
    advertisers.map((advertiser) => ({
      name: advertiser.companyName,
      status: advertiser.status,
      telegram: advertiser.telegram,
      internal_note: advertiser.internalNote,
      manager_user_id: advertiser.managerUserId,
      user_id: advertiser.userId,
      created_at: advertiser.createdAt,
      updated_at: advertiser.updatedAt,
    })),
  );

  const result = await client.query(
    `${query.text} RETURNING id, name, user_id AS "userId", public_id_number AS "publicIdNumber";`,
    query.values,
  );

  return result.rows;
}

async function insertAffiliates(client, affiliates) {
  const columns = [
    'name',
    'email',
    'status',
    'telegram',
    'internal_note',
    'user_id',
    'manager_user_id',
    'created_at',
    'updated_at',
  ];

  const query = buildInsertQuery(
    'affiliates',
    columns,
    affiliates.map((affiliate) => ({
      name: affiliate.name,
      email: affiliate.email.toLowerCase(),
      status: affiliate.status,
      telegram: affiliate.telegram,
      internal_note: affiliate.internalNote,
      user_id: affiliate.userId,
      manager_user_id: affiliate.managerUserId,
      created_at: affiliate.createdAt,
      updated_at: affiliate.updatedAt,
    })),
  );

  const result = await client.query(
    `${query.text} RETURNING id, email, public_id_number AS "publicIdNumber";`,
    query.values,
  );

  return result.rows;
}

async function insertOffers(client, offers) {
  const columns = [
    'title',
    'category',
    'advertiser_id',
    'target_url',
    'status',
    'visibility_mode',
    'targeting_strict',
    'fallback_url',
    'preview_url',
    'postback_token',
    'allow_duplicate_clicks',
    'duplicate_click_window_seconds',
    'description',
    'created_at',
    'updated_at',
  ];

  const query = buildInsertQuery(
    'offers',
    columns,
    offers.map((offer) => ({
      title: offer.title,
      category: offer.category,
      advertiser_id: offer.advertiserId,
      target_url: offer.targetUrl,
      status: offer.status,
      visibility_mode: offer.visibilityMode,
      targeting_strict: offer.targetingStrict,
      fallback_url: offer.fallbackUrl,
      preview_url: offer.previewUrl,
      postback_token: offer.postbackToken,
      allow_duplicate_clicks: offer.allowDuplicateClicks,
      duplicate_click_window_seconds: offer.duplicateClickWindowSeconds,
      description: offer.description,
      created_at: offer.createdAt,
      updated_at: offer.updatedAt,
    })),
  );

  const result = await client.query(
    `${query.text} RETURNING id, title, advertiser_id AS "advertiserId", public_id_number AS "publicIdNumber";`,
    query.values,
  );

  return result.rows;
}

async function insertOfferGoals(client, offerGoals) {
  const columns = [
    'offer_id',
    'name',
    'type',
    'revenue',
    'payout',
    'currency',
    'is_default',
    'limit_enabled',
    'limit_type',
    'limit_value',
    'created_at',
    'updated_at',
  ];

  const query = buildInsertQuery(
    'offer_goals',
    columns,
    offerGoals.map((goal) => ({
      offer_id: goal.offerId,
      name: goal.name,
      type: goal.type,
      revenue: goal.revenue,
      payout: goal.payout,
      currency: 'RUB',
      is_default: true,
      limit_enabled: false,
      limit_type: null,
      limit_value: null,
      created_at: goal.createdAt,
      updated_at: goal.updatedAt,
    })),
  );

  const result = await client.query(
    `${query.text} RETURNING id, offer_id AS "offerId", name, type, revenue, payout;`,
    query.values,
  );

  return result.rows;
}

async function insertClicks(client, clicks) {
  const columns = [
    'click_id',
    'offer_id',
    'affiliate_id',
    'goal_id',
    'source',
    'created_at',
    'ip',
    'user_agent',
    'device',
    'referer',
    'sub1',
    'sub2',
    'sub3',
    'sub4',
    'sub5',
    'canonical_click_id',
    'is_duplicate',
    'duplicate_of_click_id',
    'dedupe_fingerprint',
    'country_code',
    'targeting_strict',
    'redirect_outcome',
    'redirect_reason',
    'destination_type',
  ];

  const query = buildInsertQuery(
    'clicks',
    columns,
    clicks.map((click) => ({
      click_id: click.clickId,
      offer_id: click.offerId,
      affiliate_id: click.affiliateId,
      goal_id: click.goalId,
      source: click.source,
      created_at: click.createdAt,
      ip: click.ip,
      user_agent: click.userAgent,
      device: click.device,
      referer: click.referer,
      sub1: click.sub1,
      sub2: click.sub2,
      sub3: click.sub3,
      sub4: click.sub4,
      sub5: click.sub5,
      canonical_click_id: click.canonicalClickId,
      is_duplicate: click.isDuplicate,
      duplicate_of_click_id: click.duplicateOfClickId,
      dedupe_fingerprint: click.dedupeFingerprint,
      country_code: click.countryCode,
      targeting_strict: click.targetingStrict,
      redirect_outcome: click.redirectOutcome,
      redirect_reason: click.redirectReason,
      destination_type: click.destinationType,
    })),
  );

  await client.query(query.text, query.values);
}

async function insertConversions(client, conversions) {
  const columns = [
    'click_id',
    'offer_id',
    'affiliate_id',
    'source',
    'status',
    'is_test',
    'payout_rub',
    'external_transaction_id',
    'goal_id',
    'goal_name',
    'goal_type',
    'revenue_amount',
    'payout_amount',
    'created_at',
    'updated_at',
  ];

  const query = buildInsertQuery(
    'conversions',
    columns,
    conversions.map((conversion) => ({
      click_id: conversion.clickId,
      offer_id: conversion.offerId,
      affiliate_id: conversion.affiliateId,
      source: conversion.source,
      status: conversion.status,
      is_test: conversion.isTest,
      payout_rub: conversion.payoutRub,
      external_transaction_id: conversion.externalTransactionId,
      goal_id: conversion.goalId,
      goal_name: conversion.goalName,
      goal_type: conversion.goalType,
      revenue_amount: conversion.revenueAmount,
      payout_amount: conversion.payoutAmount,
      created_at: conversion.createdAt,
      updated_at: conversion.updatedAt,
    })),
  );

  await client.query(query.text, query.values);
}

async function verifyCounts(client) {
  const result = await client.query(
    `
    SELECT 'managers' AS entity, COUNT(*)::int AS count
    FROM users
    WHERE role = 'manager'
    UNION ALL
    SELECT 'advertisers' AS entity, COUNT(*)::int AS count
    FROM advertisers
    UNION ALL
    SELECT 'partners' AS entity, COUNT(*)::int AS count
    FROM affiliates
    UNION ALL
    SELECT 'offers' AS entity, COUNT(*)::int AS count
    FROM offers
    UNION ALL
    SELECT 'clicks' AS entity, COUNT(*)::int AS count
    FROM clicks
    UNION ALL
    SELECT 'conversions' AS entity, COUNT(*)::int AS count
    FROM conversions;
  `,
  );

  const counts = buildCountsMap(result.rows);

  for (const [entity, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
    const actualCount = counts[entity] ?? 0;
    if (actualCount !== expectedCount) {
      throw new Error(`Count mismatch for ${entity}: expected ${expectedCount}, got ${actualCount}`);
    }
  }

  return counts;
}

async function runSeed() {
  ensureSafeEnvironment();
  faker.seed(SEED);
  await applyMigrations();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await cleanSeedScope(client);

    const managerUsers = await insertUsers(client, buildManagers());
    const managerIds = managerUsers.map((manager) => manager.id);

    const advertiserUserRows = await insertUsers(client, buildAdvertiserUsers(advertiserCatalog));
    const advertiserUsersByEmail = new Map(
      advertiserUserRows.map((user) => [user.email.toLowerCase(), user]),
    );
    const advertisers = buildAdvertisers(managerIds, advertiserUserRows);
    const advertisersWithResolvedUsers = advertisers.map((advertiser) => ({
      ...advertiser,
      userId: advertiserUsersByEmail.get(`contact@${advertiser.slug}.example.local`)?.id ?? null,
    }));
    const advertiserRows = await insertAdvertisers(client, advertisersWithResolvedUsers);
    const advertisersBySlug = new Map(
      advertisersWithResolvedUsers.map((advertiser, index) => [
        advertiser.slug,
        {
          ...advertiserRows[index],
          slug: advertiser.slug,
          theme: advertiser.theme,
        },
      ]),
    );

    const affiliateUserRows = await insertUsers(client, buildAffiliateUsers());
    const affiliateUsersByEmail = new Map(
      affiliateUserRows.map((user) => [user.email.toLowerCase(), user]),
    );
    const affiliates = buildAffiliates(managerIds, affiliateUserRows).map((affiliate) => ({
      ...affiliate,
      userId: affiliateUsersByEmail.get(affiliate.email.toLowerCase())?.id ?? null,
    }));
    const affiliateRows = await insertAffiliates(client, affiliates);
    const affiliateRecords = affiliates.map((affiliate, index) => ({
      ...affiliateRows[index],
      trafficSource: affiliate.trafficSource,
      refererDomain: affiliate.refererDomain,
    }));

    const offerInput = buildOffers(advertisersBySlug);
    const offerRows = await insertOffers(client, offerInput);
    const offers = offerInput.map((offer, index) => ({
      ...offerRows[index],
      category: offer.category,
      targetingStrict: offer.targetingStrict,
    }));

    const offerGoalInput = offerInput.map((offer, index) => ({
      offerId: offers[index].id,
      name: offer.goalName,
      type: offer.goalType,
      revenue: offer.revenue,
      payout: offer.payout,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    }));
    const offerGoalRows = await insertOfferGoals(client, offerGoalInput);
    const offerGoalsByOfferId = new Map(
      offerGoalRows.map((goal) => [
        goal.offerId,
        {
          id: goal.id,
          name: goal.name,
          type: goal.type,
          revenue: Number(goal.revenue),
          payout: Number(goal.payout),
        },
      ]),
    );

    const clicks = buildClicks(offers, offerGoalsByOfferId, affiliateRecords);
    await insertClicks(client, clicks);

    const offersById = new Map(
      offers.map((offer, index) => [
        offer.id,
        {
          ...offer,
          category: offerInput[index].category,
        },
      ]),
    );
    const conversions = buildConversions(clicks, offersById, offerGoalsByOfferId);
    await insertConversions(client, conversions);

    const counts = await verifyCounts(client);
    await client.query('COMMIT');

    console.log('Seed completed:');
    console.log(`- managers: ${counts.managers}`);
    console.log(`- advertisers: ${counts.advertisers}`);
    console.log(`- partners: ${counts.partners}`);
    console.log(`- offers: ${counts.offers}`);
    console.log(`- clicks: ${counts.clicks}`);
    console.log(`- conversions: ${counts.conversions}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
