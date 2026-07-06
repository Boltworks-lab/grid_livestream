import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { CurrentUser, type AccessTokenPayload } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';

const reportSchema = z.object({
  targetType: z.enum(['STREAM', 'USER', 'CHAT_MESSAGE', 'VOD']),
  targetId: z.string().min(1).max(64),
  reason: z.string().trim().min(3).max(500),
});

/** In-app reporting (brief §7 support ops) — feeds the admin moderation queue. */
@Controller('reports')
export class ReportsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(201)
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(reportSchema)) body: z.infer<typeof reportSchema>,
  ) {
    const report = await this.prisma.report.create({
      data: { reporterId: user.sub, ...body },
    });
    return { id: report.id, status: report.status };
  }
}
