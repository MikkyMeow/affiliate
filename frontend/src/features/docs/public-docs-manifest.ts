export type PublicDocSection =
  | "general"
  | "admin"
  | "partner"
  | "advertiser"
  | "guides";

export interface PublicDocItem {
  title: string;
  href: string;
  filePath: string;
  sourcePath: string;
  section: PublicDocSection;
}

export interface PublicDocSectionGroup {
  id: PublicDocSection;
  title: string;
  items: PublicDocItem[];
}

const manifestItems: PublicDocItem[] = [
  {
    title: "Обзор платформы",
    href: "/docs/platform-overview",
    filePath: "docs/user/platform-overview.md",
    sourcePath: "platform-overview.md",
    section: "general",
  },
  {
    title: "Роли и доступы",
    href: "/docs/roles",
    filePath: "docs/user/roles.md",
    sourcePath: "roles.md",
    section: "general",
  },
  {
    title: "Глоссарий",
    href: "/docs/guides/glossary",
    filePath: "docs/user/guides/glossary.md",
    sourcePath: "guides/glossary.md",
    section: "general",
  },
  {
    title: "Частые ошибки",
    href: "/docs/guides/common-errors",
    filePath: "docs/user/guides/common-errors.md",
    sourcePath: "guides/common-errors.md",
    section: "general",
  },
  {
    title: "Обзор",
    href: "/docs/admin/dashboard",
    filePath: "docs/user/admin/01-dashboard.md",
    sourcePath: "admin/01-dashboard.md",
    section: "admin",
  },
  {
    title: "Партнёры",
    href: "/docs/admin/affiliates",
    filePath: "docs/user/admin/02-affiliates.md",
    sourcePath: "admin/02-affiliates.md",
    section: "admin",
  },
  {
    title: "Рекламодатели",
    href: "/docs/admin/advertisers",
    filePath: "docs/user/admin/03-advertisers.md",
    sourcePath: "admin/03-advertisers.md",
    section: "admin",
  },
  {
    title: "Офферы",
    href: "/docs/admin/offers",
    filePath: "docs/user/admin/04-offers.md",
    sourcePath: "admin/04-offers.md",
    section: "admin",
  },
  {
    title: "Цели оффера",
    href: "/docs/admin/offer-goals",
    filePath: "docs/user/admin/05-offer-goals.md",
    sourcePath: "admin/05-offer-goals.md",
    section: "admin",
  },
  {
    title: "Доступ к офферам",
    href: "/docs/admin/offer-access",
    filePath: "docs/user/admin/06-offer-access.md",
    sourcePath: "admin/06-offer-access.md",
    section: "admin",
  },
  {
    title: "География",
    href: "/docs/admin/geo-targeting",
    filePath: "docs/user/admin/07-geo-targeting.md",
    sourcePath: "admin/07-geo-targeting.md",
    section: "admin",
  },
  {
    title: "Клики",
    href: "/docs/admin/clicks",
    filePath: "docs/user/admin/08-clicks.md",
    sourcePath: "admin/08-clicks.md",
    section: "admin",
  },
  {
    title: "Конверсии",
    href: "/docs/admin/conversions",
    filePath: "docs/user/admin/09-conversions.md",
    sourcePath: "admin/09-conversions.md",
    section: "admin",
  },
  {
    title: "Корректировки",
    href: "/docs/admin/adjustments",
    filePath: "docs/user/admin/10-adjustments.md",
    sourcePath: "admin/10-adjustments.md",
    section: "admin",
  },
  {
    title: "Менеджеры",
    href: "/docs/admin/managers",
    filePath: "docs/user/admin/11-managers.md",
    sourcePath: "admin/11-managers.md",
    section: "admin",
  },
  {
    title: "Анкеты",
    href: "/docs/admin/questionnaires",
    filePath: "docs/user/admin/12-questionnaires.md",
    sourcePath: "admin/12-questionnaires.md",
    section: "admin",
  },
  {
    title: "Журнал действий",
    href: "/docs/admin/audit-logs",
    filePath: "docs/user/admin/13-audit-logs.md",
    sourcePath: "admin/13-audit-logs.md",
    section: "admin",
  },
  {
    title: "Профиль",
    href: "/docs/admin/profile",
    filePath: "docs/user/admin/14-profile.md",
    sourcePath: "admin/14-profile.md",
    section: "admin",
  },
  {
    title: "Обзор",
    href: "/docs/partner/dashboard",
    filePath: "docs/user/partner/01-dashboard.md",
    sourcePath: "partner/01-dashboard.md",
    section: "partner",
  },
  {
    title: "Офферы",
    href: "/docs/partner/offers",
    filePath: "docs/user/partner/02-offers.md",
    sourcePath: "partner/02-offers.md",
    section: "partner",
  },
  {
    title: "Карточка оффера",
    href: "/docs/partner/offer-detail",
    filePath: "docs/user/partner/03-offer-detail.md",
    sourcePath: "partner/03-offer-detail.md",
    section: "partner",
  },
  {
    title: "Трекинговые ссылки",
    href: "/docs/partner/tracking-links",
    filePath: "docs/user/partner/04-tracking-links.md",
    sourcePath: "partner/04-tracking-links.md",
    section: "partner",
  },
  {
    title: "Клики",
    href: "/docs/partner/clicks",
    filePath: "docs/user/partner/05-clicks.md",
    sourcePath: "partner/05-clicks.md",
    section: "partner",
  },
  {
    title: "Конверсии",
    href: "/docs/partner/conversions",
    filePath: "docs/user/partner/06-conversions.md",
    sourcePath: "partner/06-conversions.md",
    section: "partner",
  },
  {
    title: "Статистика",
    href: "/docs/partner/stats",
    filePath: "docs/user/partner/07-stats.md",
    sourcePath: "partner/07-stats.md",
    section: "partner",
  },
  {
    title: "Анкета",
    href: "/docs/partner/questionnaire",
    filePath: "docs/user/partner/08-questionnaire.md",
    sourcePath: "partner/08-questionnaire.md",
    section: "partner",
  },
  {
    title: "Профиль",
    href: "/docs/partner/profile",
    filePath: "docs/user/partner/09-profile.md",
    sourcePath: "partner/09-profile.md",
    section: "partner",
  },
  {
    title: "Обзор",
    href: "/docs/advertiser/dashboard",
    filePath: "docs/user/advertiser/01-dashboard.md",
    sourcePath: "advertiser/01-dashboard.md",
    section: "advertiser",
  },
  {
    title: "Офферы",
    href: "/docs/advertiser/offers",
    filePath: "docs/user/advertiser/02-offers.md",
    sourcePath: "advertiser/02-offers.md",
    section: "advertiser",
  },
  {
    title: "Карточка оффера",
    href: "/docs/advertiser/offer-detail",
    filePath: "docs/user/advertiser/03-offer-detail.md",
    sourcePath: "advertiser/03-offer-detail.md",
    section: "advertiser",
  },
  {
    title: "Постбеки",
    href: "/docs/advertiser/postbacks",
    filePath: "docs/user/advertiser/04-postbacks.md",
    sourcePath: "advertiser/04-postbacks.md",
    section: "advertiser",
  },
  {
    title: "Финансы",
    href: "/docs/advertiser/finance",
    filePath: "docs/user/advertiser/05-finance.md",
    sourcePath: "advertiser/05-finance.md",
    section: "advertiser",
  },
  {
    title: "Статистика",
    href: "/docs/advertiser/stats",
    filePath: "docs/user/advertiser/06-stats.md",
    sourcePath: "advertiser/06-stats.md",
    section: "advertiser",
  },
  {
    title: "Анкета",
    href: "/docs/advertiser/questionnaire",
    filePath: "docs/user/advertiser/07-questionnaire.md",
    sourcePath: "advertiser/07-questionnaire.md",
    section: "advertiser",
  },
  {
    title: "Профиль",
    href: "/docs/advertiser/profile",
    filePath: "docs/user/advertiser/08-profile.md",
    sourcePath: "advertiser/08-profile.md",
    section: "advertiser",
  },
  {
    title: "Быстрый старт администратора",
    href: "/docs/guides/quick-start-admin",
    filePath: "docs/user/guides/quick-start-admin.md",
    sourcePath: "guides/quick-start-admin.md",
    section: "guides",
  },
  {
    title: "Быстрый старт партнёра",
    href: "/docs/guides/quick-start-partner",
    filePath: "docs/user/guides/quick-start-partner.md",
    sourcePath: "guides/quick-start-partner.md",
    section: "guides",
  },
  {
    title: "Быстрый старт рекламодателя",
    href: "/docs/guides/quick-start-advertiser",
    filePath: "docs/user/guides/quick-start-advertiser.md",
    sourcePath: "guides/quick-start-advertiser.md",
    section: "guides",
  },
];

export const publicDocsManifest = manifestItems;

export const publicDocsHome = {
  title: "Документация",
  href: "/docs",
  filePath: "docs/user/README.md",
  sourcePath: "README.md",
} as const;

export const publicDocsSections: PublicDocSectionGroup[] = [
  {
    id: "general",
    title: "Общее",
    items: manifestItems.filter((item) => item.section === "general"),
  },
  {
    id: "admin",
    title: "Команда сети",
    items: manifestItems.filter((item) => item.section === "admin"),
  },
  {
    id: "partner",
    title: "Партнёр",
    items: manifestItems.filter((item) => item.section === "partner"),
  },
  {
    id: "advertiser",
    title: "Рекламодатель",
    items: manifestItems.filter((item) => item.section === "advertiser"),
  },
  {
    id: "guides",
    title: "Быстрый старт",
    items: manifestItems.filter((item) => item.section === "guides"),
  },
];

export function getPublicDocByHref(href: string): PublicDocItem | null {
  return publicDocsManifest.find((item) => item.href === href) ?? null;
}

export function getPublicDocHrefFromSlug(slug?: string[]): string {
  if (!slug || slug.length === 0) {
    return "/docs";
  }

  return `/docs/${slug.join("/")}`;
}

export function getPublicDocStaticSlugs(): string[][] {
  return publicDocsManifest.map((item) => item.href.replace(/^\/docs\//, "").split("/"));
}
