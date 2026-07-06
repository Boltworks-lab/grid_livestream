import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { Public } from '../auth/public.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';
import { CurrentStaff } from './current-staff.decorator';
import type { StaffTokenPayload } from './admin-auth.service';
import { RequirePermission } from './permissions';

const bannerSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
  placement: z.enum(['WEB', 'MOBILE', 'ALL']).default('ALL'),
  /** targeting rules — deliberately loose JSON until the model is fleshed out */
  audience: z.record(z.string(), z.unknown()).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  active: z.boolean().default(true),
});

const promoSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,32}$/),
  kind: z.enum(['PERCENT_OFF', 'BONUS_DIAMONDS']),
  value: z.number().int().positive(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  active: z.boolean().default(true),
});

/**
 * Marketing CMS (MARKETING staff): ad banners, promos, discount codes with time
 * windows, audience + platform targeting. Redemption engine and richer
 * targeting rules are tracked in docs/deferred.md.
 */
@Public()
@UseGuards(AdminGuard)
@RequirePermission('marketing.manage')
@Controller('admin/marketing')
export class MarketingAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('banners')
  banners() {
    return this.prisma.marketingBanner.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  @Post('banners')
  createBanner(
    @CurrentStaff() staff: StaffTokenPayload,
    @Body(new ZodValidationPipe(bannerSchema)) body: z.infer<typeof bannerSchema>,
  ) {
    return this.prisma.marketingBanner.create({
      data: {
        ...body,
        audience: body.audience as never,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        createdByStaffId: staff.sub,
      },
    });
  }

  @Put('banners/:id')
  updateBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(bannerSchema.partial()))
    body: Partial<z.infer<typeof bannerSchema>>,
  ) {
    return this.prisma.marketingBanner.update({
      where: { id },
      data: {
        ...body,
        audience: body.audience as never,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      },
    });
  }

  @Delete('banners/:id')
  @HttpCode(204)
  async deleteBanner(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.marketingBanner.delete({ where: { id } });
  }

  @Get('promos')
  promos() {
    return this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  @Post('promos')
  createPromo(
    @CurrentStaff() staff: StaffTokenPayload,
    @Body(new ZodValidationPipe(promoSchema)) body: z.infer<typeof promoSchema>,
  ) {
    return this.prisma.promoCode.create({
      data: {
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        createdByStaffId: staff.sub,
      },
    });
  }

  @Put('promos/:id')
  updatePromo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(promoSchema.partial())) body: Partial<z.infer<typeof promoSchema>>,
  ) {
    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      },
    });
  }
}

/** Public: what clients render. Targeting evaluation deepens with the rules model. */
@Public()
@Controller('marketing')
export class MarketingPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('banners')
  async activeBanners(@Query('placement') placement?: string) {
    const now = new Date();
    const where = {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
      ...(placement === 'WEB' || placement === 'MOBILE'
        ? { placement: { in: [placement as never, 'ALL' as never] } }
        : {}),
    };
    const banners = await this.prisma.marketingBanner.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return banners.map((b) => ({
      id: b.id,
      title: b.title,
      body: b.body,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl,
      placement: b.placement,
    }));
  }
}
