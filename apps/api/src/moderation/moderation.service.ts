import {
  DEFAULT_MODERATION,
  moderationConfigSchema,
  type ModerationConfig,
  type ModSeverity,
} from '@grid/shared';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const CONFIG_KEY = 'moderation';
const CACHE_TTL_MS = 30_000;

export interface ScreenVerdict {
  action: ModSeverity; // allow | flag | block
  matched?: string;
  category?: string; // for ML hits
}

/**
 * Automated chat moderation (brief §8). Two tiers:
 *   1. keyword — normalized match against the runtime-editable severity list;
 *      zero deps, ships now.
 *   2. ML text — an optional drop-in (screenMl) that stays a no-op until a
 *      provider key is configured; wired to OpenAI/Perspective later.
 * Default posture is flag-for-review, never over-block (owner direction): only
 * the 'block' tier is withheld pre-broadcast; everything else is allowed and,
 * if 'flag', queued for a human who makes the nuanced call.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private cache: { value: ModerationConfig; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async config(): Promise<ModerationConfig> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.value;
    const row = await this.prisma.appConfig.findUnique({ where: { key: CONFIG_KEY } });
    let value = DEFAULT_MODERATION;
    if (row) {
      const parsed = moderationConfigSchema.safeParse(row.value);
      if (parsed.success) value = parsed.data;
      else this.logger.error('invalid moderation config in app_config — using defaults');
    }
    this.cache = { value, at: Date.now() };
    return value;
  }

  async setConfig(value: ModerationConfig): Promise<ModerationConfig> {
    const parsed = moderationConfigSchema.parse(value);
    await this.prisma.appConfig.upsert({
      where: { key: CONFIG_KEY },
      create: { key: CONFIG_KEY, value: parsed },
      update: { value: parsed },
    });
    this.cache = null; // force reload
    return parsed;
  }

  /**
   * Normalize so evasion doesn't beat the list: lowercase, strip zero-width and
   * combining marks, fold common homoglyphs/leetspeak to latin, collapse
   * repeats/separators. `ni g g3r` and `nigger` normalize the same.
   */
  normalize(text: string): string {
    const leet: Record<string, string> = {
      '0': 'o',
      '1': 'i',
      '3': 'e',
      '4': 'a',
      '5': 's',
      '7': 't',
      '@': 'a',
      $: 's',
      '!': 'i',
    };
    // strip combining marks (U+0300-U+036F) and zero-width chars (U+200B-U+200D,
    // U+FEFF) by code point — no invisible chars in source.
    const cleaned = Array.from(text.toLowerCase().normalize('NFKD'))
      .filter((ch) => {
        const c = ch.codePointAt(0) ?? 0;
        if (c >= 0x300 && c <= 0x36f) return false;
        if (c >= 0x200b && c <= 0x200d) return false;
        return c !== 0xfeff;
      })
      .join('');
    return cleaned
      .replace(/[013457@$!]/g, (c) => leet[c] ?? c)
      .replace(/[^a-z0-9\s]/g, ' ') // punctuation -> space
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Tier-1 keyword screen. Allowlist wins; highest matched severity decides. */
  async screen(text: string): Promise<ScreenVerdict> {
    const cfg = await this.config();
    if (!cfg.enabled) return { action: 'allow' };

    const normalized = this.normalize(text);
    const padded = ` ${normalized} `;
    const allow = new Set(cfg.allow.map((t) => this.normalize(t)));

    let verdict: ScreenVerdict = { action: 'allow' };
    for (const [rawTerm, severity] of Object.entries(cfg.terms)) {
      if (severity === 'allow') continue;
      const term = this.normalize(rawTerm);
      if (!term || allow.has(term)) continue;
      // whole-word match on normalized text (avoids the Scunthorpe problem)
      if (padded.includes(` ${term} `)) {
        if (severity === 'block') return { action: 'block', matched: rawTerm };
        verdict = { action: 'flag', matched: rawTerm };
      }
    }

    // tier-2 ML runs only if tier-1 didn't already block and a provider exists
    if (verdict.action !== 'block') {
      const ml = await this.screenMl(text, cfg);
      if (ml && this.rank(ml.action) > this.rank(verdict.action)) verdict = ml;
    }
    return verdict;
  }

  private rank(a: ModSeverity): number {
    return a === 'block' ? 2 : a === 'flag' ? 1 : 0;
  }

  /**
   * ML text-moderation adapter (drop-in). No provider key configured → returns
   * null (tier-1 only). A real adapter (OpenAI Moderation / Perspective) maps
   * category scores against cfg.mlThresholds → flag/block. Owner-blocked on a
   * key (docs/deferred.md).
   */
  private async screenMl(_text: string, _cfg: ModerationConfig): Promise<ScreenVerdict | null> {
    return null;
  }

  /**
   * Record an automated action: a system Report (reporterId null) so a human
   * reviews it in the moderation queue, plus a ModerationAction(automated) for
   * the audit trail. Reversible by staff (brief §8) — the human makes the call.
   */
  async recordAuto(params: {
    verdict: ScreenVerdict;
    messageId: string;
    senderId: string;
    body: string;
  }): Promise<void> {
    const { verdict, messageId, senderId, body } = params;
    if (verdict.action === 'allow') return;
    const reason = `auto:${verdict.action}:${verdict.matched ?? verdict.category ?? 'ml'}`;
    await this.prisma.$transaction([
      this.prisma.report.create({
        data: {
          reporterId: null, // system
          targetType: 'CHAT_MESSAGE',
          targetId: messageId,
          reason,
          details: body.slice(0, 500),
        },
      }),
      this.prisma.moderationAction.create({
        data: {
          actorStaffId: null,
          automated: true,
          targetType: 'CHAT_MESSAGE',
          targetId: messageId,
          action: verdict.action === 'block' ? 'REMOVE_CONTENT' : 'WARN',
          reason: `${reason} (sender ${senderId})`,
        } satisfies Prisma.ModerationActionUncheckedCreateInput,
      }),
    ]);
  }
}
