import { exports } from 'cloudflare:workers';
import { ORIGIN } from './constants';

/**
 * Sends a create-link request to the token route, `POST /links`.
 * @param body - Raw request body.
 * @param options - `token` is the admin token to send, if any; `visitor` is the address Cloudflare would report for the caller.
 * @returns The Worker's response.
 */
export const createViaToken = (body: string, options: { token?: string; visitor?: string } = {}): Promise<Response> => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  if (options.visitor) {
    headers.set('CF-Connecting-IP', options.visitor);
  }
  return exports.default.fetch(`${ORIGIN}/links`, { method: 'POST', headers, body });
};
