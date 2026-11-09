/** Path under which the Worker serves short links: `/s/<code>`. */
export const SHORT_LINK_PREFIX = '/s';

/**
 * Builds the address people open for a code.
 * @param base - Any address on this site, such as `location.origin` or a request URL.
 * @param code - The short code.
 * @returns The full short URL, for example `https://go.example.com/s/RxA8XTt2`.
 */
export const shortUrl = (base: string, code: string): string => new URL(`${SHORT_LINK_PREFIX}/${code}`, base).href;
