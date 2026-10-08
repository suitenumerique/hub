/**
 * Mentions travel as `https://matrix.to/#/@user:server` links, the form Element
 * writes for every pill and the one other clients turn back into pills. The
 * composer writes them and the message renderer reads them through this file.
 */

/** The link a mention of `userId` points to. */
export const userPermalink = (userId: string): string =>
  `https://matrix.to/#/${userId}`;

/** The user a `matrix.to` permalink points to, or `null` for any other link. */
export const parseUserPermalink = (href: string): string | null => {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.host !== "matrix.to") {
    return null;
  }
  try {
    const entity = decodeURIComponent(url.hash.replace(/^#\/?/, ""));
    return entity.startsWith("@") ? entity.split(/[/?]/)[0] : null;
  } catch {
    return null;
  }
};
