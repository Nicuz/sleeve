import { Elysia } from 'elysia';
import { z } from 'zod';
import {
  CONDITION_OPTIONS,
  CURRENCY_OPTIONS,
  FORMAT_OPTIONS,
  getAppSettings,
  saveAppSettings,
} from '../app-settings';

const settingsSchema = z.object({
  defaultFormat: z.enum(FORMAT_OPTIONS).optional(),
  defaultCondition: z.enum(CONDITION_OPTIONS).optional(),
  defaultCurrency: z.enum(CURRENCY_OPTIONS).optional(),
});

function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid settings';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

export const settingsRoutes = new Elysia({ prefix: '/api/settings' })
  .get('/', async () => {
    return { settings: await getAppSettings() };
  })
  .patch('/', async ({ body, set }) => {
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { message: errorMessage(parsed.error) };
    }

    try {
      return { settings: await saveAppSettings(parsed.data) };
    } catch (error) {
      set.status = 500;
      return { message: errorMessage(error) };
    }
  });
