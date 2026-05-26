import type { PublicDocItem, PublicDocSection } from "@/features/docs/public-docs-manifest";

export interface PublicDocHeading {
  id: string;
  level: 2 | 3;
  title: string;
}

export interface PublicDocSearchResult {
  title: string;
  href: string;
  section: string;
  snippet?: string;
}

export interface PublicDocSearchIndexItem extends PublicDocSearchResult {
  content: string;
}

const transliterationMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const sectionLabels: Record<PublicDocSection, string> = {
  general: "Общее",
  admin: "Администратор",
  partner: "Партнёр",
  advertiser: "Рекламодатель",
  guides: "Быстрый старт",
};

export function getPublicDocSectionLabel(section: PublicDocSection): string {
  return sectionLabels[section];
}

export function slugifyHeading(value: string): string {
  const transliterated = value
    .trim()
    .toLowerCase()
    .split("")
    .map((character) => transliterationMap[character] ?? character)
    .join("");

  const slug = transliterated
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}

export function extractPublicDocHeadings(markdown: string): PublicDocHeading[] {
  const lines = markdown.split(/\r?\n/);
  const headings: PublicDocHeading[] = [];
  const usedIds = new Map<string, number>();

  for (const line of lines) {
    const match = /^(##|###)\s+(.+?)\s*$/.exec(line);

    if (!match) {
      continue;
    }

    const level = match[1].length as 2 | 3;
    const title = match[2].trim().replace(/\s+#*$/, "").trim();
    const baseId = slugifyHeading(title);
    const duplicateCount = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, duplicateCount + 1);

    headings.push({
      id: duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount + 1}`,
      level,
      title,
    });
  }

  return headings;
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, " $1 ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[>*-]\s+/gm, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchSnippet(content: string, query: string): string | undefined {
  const normalizedContent = stripMarkdown(content);
  if (!normalizedContent) {
    return undefined;
  }

  const haystack = normalizedContent.toLocaleLowerCase("ru");
  const needle = query.trim().toLocaleLowerCase("ru");

  if (!needle) {
    return undefined;
  }

  const matchIndex = haystack.indexOf(needle);
  if (matchIndex === -1) {
    return normalizedContent.slice(0, 160);
  }

  const start = Math.max(0, matchIndex - 60);
  const end = Math.min(normalizedContent.length, matchIndex + needle.length + 100);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalizedContent.length ? "…" : "";

  return `${prefix}${normalizedContent.slice(start, end).trim()}${suffix}`;
}

export function getDocBreadcrumbs(item: PublicDocItem | null): Array<{ label: string; href?: string }> {
  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: "Документация", href: "/docs" },
  ];

  if (!item) {
    return breadcrumbs;
  }

  breadcrumbs.push({ label: getPublicDocSectionLabel(item.section) });
  breadcrumbs.push({ label: item.title });

  return breadcrumbs;
}
