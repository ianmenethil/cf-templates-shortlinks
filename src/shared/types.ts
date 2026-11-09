/** Details saved with each code as KV metadata, so the admin list needs no extra reads. */
export type LinkMetadata = {
  /** The destination URL, shortened if it would not fit in KV metadata. */
  url: string;
  /** When the link was created, as an ISO 8601 timestamp. */
  createdAt: string;
  /** Who created it: the Access user's email, or `api` for the token route. */
  createdBy: string;
};

/** A saved link as the admin API returns it. */
export type LinkRecord = LinkMetadata & { code: string };

/** Answer of `GET /admin/api/me`: who is signed in and the name shown in the panel. */
export type AdminProfile = {
  /** Email of the signed-in Access user. */
  email: string;
  /** Company name from the `BRAND_NAME` variable. */
  brand: string;
};

/** Answer of `GET /admin/api/links`: every saved link, newest first. */
export type LinkList = {
  links: LinkRecord[];
};

/** Answer of `POST /links`: the new code and its full short URL. */
export type CreatedShortLink = Pick<LinkRecord, 'code'> & Pick<CreatedLink, 'shortUrl'>;

/** Answer of `POST /admin/api/links`. */
export type CreatedLink = {
  link: LinkRecord;
  /** The full short URL on this site, ready to share. */
  shortUrl: string;
};
