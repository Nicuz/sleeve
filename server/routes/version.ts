import { Elysia } from 'elysia';
import { buildInfo } from '../version';

export const versionRoutes = new Elysia({ prefix: '/api' }).get('/version', () => ({
  name: 'Sleeve',
  ...buildInfo(),
}));
