import {
  getPublicDocByHref,
  publicDocsHome,
  publicDocsManifest,
} from "@/features/docs/public-docs-manifest";
import { getPublicDocSectionLabel } from "@/features/docs/public-docs-utils";

export interface PublicDocNavLink {
  href: string;
  title: string;
  section: string;
}

export function getPrevNextPublicDocs(href: string): {
  previous: PublicDocNavLink | null;
  next: PublicDocNavLink | null;
} {
  const orderedDocs = [publicDocsHome, ...publicDocsManifest];
  const currentIndex = orderedDocs.findIndex((item) => item.href === href);

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  const toNavLink = (item?: (typeof orderedDocs)[number]): PublicDocNavLink | null => {
    if (!item) {
      return null;
    }

    const manifestItem = "section" in item ? item : getPublicDocByHref(item.href);

    return {
      href: item.href,
      title: item.title,
      section: manifestItem ? getPublicDocSectionLabel(manifestItem.section) : "Документация",
    };
  };

  return {
    previous: toNavLink(orderedDocs[currentIndex - 1]),
    next: toNavLink(orderedDocs[currentIndex + 1]),
  };
}
