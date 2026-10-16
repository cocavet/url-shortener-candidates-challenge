const MAX_ORIGINAL_URL_LENGTH = 2048;

function parseHttpUrlWithoutCredentials(value: string): URL | null {
  if (!/^https?:\/\/[^/?#\\]/i.test(value)) return null;

  try {
    const parsedUrl = new URL(value);
    // URL.username/password are empty for explicit but empty userinfo (https://@host).
    const authority = value
      .slice(value.indexOf("://") + 3)
      .split(/[/?#\\]/, 1)[0];
    if (
      !parsedUrl.hostname ||
      parsedUrl.username ||
      parsedUrl.password ||
      authority.includes("@")
    ) {
      return null;
    }
    return parsedUrl;
  } catch {
    return null;
  }
}

export function isValidOriginalUrl(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_ORIGINAL_URL_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    parseHttpUrlWithoutCredentials(value) !== null
  );
}

export function isValidHttpOrigin(value: string): boolean {
  if (/[\u0000-\u0020\u007f\\]/.test(value)) return false;
  const parsedUrl = parseHttpUrlWithoutCredentials(value);
  return (
    parsedUrl !== null &&
    parsedUrl.pathname === "/" &&
    !parsedUrl.search &&
    !parsedUrl.hash
  );
}
