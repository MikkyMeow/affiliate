import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  getPublicDocByHref,
  publicDocsHome,
  publicDocsManifest,
} from "@/features/docs/public-docs-manifest";

const repoRoot = path.resolve(process.cwd(), "..");
const docsRoot = path.join(repoRoot, "docs", "user");

export interface PublicDocRecord {
  title: string;
  href: string;
  markdown: string | null;
  sourcePath: string;
  missing: boolean;
}

function normalizeSourcePath(sourcePath: string): string {
  return sourcePath.replace(/\\/g, "/");
}

function buildSourceToHrefMap(): Map<string, string> {
  const entries = [
    [publicDocsHome.sourcePath, publicDocsHome.href] as const,
    ...publicDocsManifest.map((item) => [item.sourcePath, item.href] as const),
  ];

  return new Map(entries.map(([sourcePath, href]) => [normalizeSourcePath(sourcePath), href]));
}

const sourceToHrefMap = buildSourceToHrefMap();

export function resolvePublicDocLink(currentSourcePath: string, href: string): string | null {
  if (!href) {
    return null;
  }

  if (href.startsWith("#")) {
    return href;
  }

  if (/^[a-z]+:/i.test(href) || href.startsWith("//")) {
    return href;
  }

  if (href.startsWith("/docs")) {
    return href;
  }

  if (href.startsWith("/")) {
    return href;
  }

  const currentDir = path.posix.dirname(normalizeSourcePath(currentSourcePath));
  const resolved = path.posix.normalize(path.posix.join(currentDir, href));
  const cleanResolved = resolved.replace(/^\.\//, "");

  if (cleanResolved.endsWith(".md")) {
    return sourceToHrefMap.get(cleanResolved) ?? null;
  }

  return href;
}

async function readMarkdownFile(filePath: string): Promise<string | null> {
  const absolutePath = path.join(repoRoot, filePath);

  if (!absolutePath.startsWith(docsRoot)) {
    return null;
  }

  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function readPublicDocByHref(href: string): Promise<PublicDocRecord | null> {
  if (href === publicDocsHome.href) {
    const markdown = await readMarkdownFile(publicDocsHome.filePath);

    return {
      title: publicDocsHome.title,
      href: publicDocsHome.href,
      markdown,
      sourcePath: publicDocsHome.sourcePath,
      missing: markdown === null,
    };
  }

  const doc = getPublicDocByHref(href);

  if (!doc) {
    return null;
  }

  const markdown = await readMarkdownFile(doc.filePath);

  return {
    title: doc.title,
    href: doc.href,
    markdown,
    sourcePath: doc.sourcePath,
    missing: markdown === null,
  };
}
