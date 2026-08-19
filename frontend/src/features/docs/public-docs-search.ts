import { publicDocsManifest } from "@/features/docs/public-docs-manifest";
import {
  buildSearchSnippet,
  getPublicDocSectionLabel,
  type PublicDocSearchIndexItem,
} from "@/features/docs/public-docs-utils";
import { readPublicDocByHref } from "@/features/docs/read-public-doc";

export async function buildPublicDocsSearchIndex(): Promise<PublicDocSearchIndexItem[]> {
  const docs = await Promise.all(
    publicDocsManifest.map(async (item) => {
      const doc = await readPublicDocByHref(item.href);
      const content = doc?.markdown ?? "";

      return {
        title: item.title,
        href: item.href,
        section: getPublicDocSectionLabel(item.section),
        content,
        snippet: buildSearchSnippet(content, item.title),
      } satisfies PublicDocSearchIndexItem;
    }),
  );

  return docs;
}
