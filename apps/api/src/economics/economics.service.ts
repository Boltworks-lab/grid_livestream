import { DEFAULT_ECONOMICS, economicsSchema, type Economics } from '@grid/shared';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

const CONFIG_KEY = 'economics';
const CACHE_MS = 30_000;

/**
 * Runtime-adjustable economics (ADR 0005): rates live in app_config under the
 * `economics` key — change them and every split/payout computed after the next
 * cache refresh uses the new numbers. Invalid or missing config falls back to
 * DEFAULT_ECONOMICS loudly, never silently to wrong numbers.
 */
@Injectable()
export class EconomicsService {
  private readonly logger = new Logger(EconomicsService.name);
  private cached: { value: Economics; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async current(): Promise<Economics> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.value;
    let value = DEFAULT_ECONOMICS;
    try {
      const row = await this.prisma.appConfig.findUnique({ where: { key: CONFIG_KEY } });
      if (row) {
        const parsed = economicsSchema.safeParse(row.value);
        if (parsed.success) value = parsed.data;
        else this.logger.error(`app_config.${CONFIG_KEY} is invalid — using defaults`);
      }
    } catch (error) {
      this.logger.error(`failed to read app_config.${CONFIG_KEY}: ${String(error)}`);
    }
    this.cached = { value, at: Date.now() };
    return value;
  }

  /** used by the set-economics script and (later) the admin app */
  async update(value: Economics, updatedByStaffId?: string): Promise<void> {
    economicsSchema.parse(value);
    await this.prisma.appConfig.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value, updatedByStaffId },
      update: { value, updatedByStaffId },
    });
    this.cached = null;
  }
}
