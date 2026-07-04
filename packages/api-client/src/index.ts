import createClient from 'openapi-fetch';

import type { paths } from './schema';

export type { components, paths } from './schema';

export interface GridClientOptions {
  baseUrl: string;
  /** Called per request; return the current access token or null. */
  getAccessToken?: () => string | null;
}

/**
 * Typed client generated from docs/api/openapi.yaml (`pnpm --filter
 * @grid/api-client generate`). All three apps consume this — hand-written
 * fetch calls against the API are a code smell (PROJECT_BRIEF §5).
 */
export function createGridClient({ baseUrl, getAccessToken }: GridClientOptions) {
  const client = createClient<paths>({ baseUrl });
  client.use({
    onRequest({ request }) {
      const token = getAccessToken?.();
      if (token) request.headers.set('authorization', `Bearer ${token}`);
      return request;
    },
  });
  return client;
}

export type GridClient = ReturnType<typeof createGridClient>;
