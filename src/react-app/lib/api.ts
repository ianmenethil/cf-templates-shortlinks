import type { AdminProfile, CreatedLink, LinkList, LinkRecord } from "../../shared/types";

/**
 * Calls the admin API and reads its JSON answer.
 * @param path - Path below `/admin/api`.
 * @param init - Request options.
 * @returns The parsed answer, or `undefined` for an empty `204`.
 * @throws An `Error` whose message is the API's `error` field when it has one, to show the person.
 */
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/admin/api${path}`, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `The request failed (${response.status}).`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
};

/** Gets the signed-in user and the brand name. */
export const getProfile = (): Promise<AdminProfile> => request("/me");

/** Gets every saved link, newest first. */
export const getLinks = async (): Promise<LinkRecord[]> =>
  (await request<LinkList>("/links")).links;

/**
 * Creates a short link.
 * @param url - The destination the link should open.
 */
export const createLink = (url: string): Promise<CreatedLink> =>
  request("/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

/**
 * Deletes a short link.
 * @param code - The code to delete.
 */
export const deleteLink = (code: string): Promise<void> =>
  request(`/links/${encodeURIComponent(code)}`, { method: "DELETE" });
