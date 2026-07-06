import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';

/**
 * Staff permission matrix (owner direction, 2026-07-05): distinct support roles
 * with scoped access. Deliberately coarse for now — privileges get fleshed out
 * per-role over time; endpoints declare the permission they need and the matrix
 * is the single place that evolves.
 */
export const PERMISSIONS = [
  'staff.manage', // create staff, assign roles
  'payouts.review', // approve/reject payouts, refunds
  'reports.act', // moderation queue actions
  'users.lookup', // user 360 view (money read-only)
  'economics.edit', // fee rates, coin peg, payout params
  'marketing.manage', // banners, promos, discount codes, targeting
  'moderation.view_gated', // view paywalled/hidden content FOR MODERATION (audited; legal monitoring)
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  SUPERADMIN: ALL,
  ADMIN: ALL.filter((p) => p !== 'staff.manage'),
  MODERATOR: ['reports.act', 'moderation.view_gated', 'users.lookup'],
  TECH_SUPPORT: ['users.lookup', 'audit.view'],
  BILLING_SUPPORT: ['payouts.review', 'users.lookup'],
  SUPPORT: ['users.lookup'],
  MARKETING: ['marketing.manage'],
  ANALYST: ['users.lookup', 'audit.view'],
};

export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);

export function roleHas(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
