import { exports } from 'cloudflare:workers';
import { ORIGIN, VISITOR_IP } from './constants';

/**
 * Sends a create-link request to the token route, `POST /links`.
 * @param body - Raw request body.
 * @param options - `token` is the admin token to send, if any; `visitor` is the address Cloudflare would report for the caller.
 * @returns The Worker's response.
 */
export const createViaToken = (body: string, options: { token?: string; visitor?: string } = {}): Promise<Response> => {
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': options.visitor ?? VISITOR_IP });
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  return exports.default.fetch(`${ORIGIN}/links`, { method: 'POST', headers, body });
};

/**
 * Opens a short link the way a visitor does, without following the redirect.
 * @param address - Full short URL, or a path such as `/s/<code>`.
 * @param visitor - The address Cloudflare would report for the visitor.
 * @returns The Worker's response.
 */
export const openShortLink = (address: string, visitor: string = VISITOR_IP): Promise<Response> =>
  exports.default.fetch(new URL(address, ORIGIN), { redirect: 'manual', headers: { 'CF-Connecting-IP': visitor } });
