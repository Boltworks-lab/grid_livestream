// Gift catalog seed — extracted from prototypes/js/data.js (server-driven from
// day one; admin CRUD manages it in Phase 8). Run: pnpm --filter @grid/api db:seed
const { PrismaClient } = require('@prisma/client');

const GIFTS = [
  { id: 'rose', name: 'Rose', emoji: '🌹', priceDiamonds: 1, animationTier: 0 },
  { id: 'heart', name: 'Heart', emoji: '❤️', priceDiamonds: 5, animationTier: 0 },
  { id: 'icecream', name: 'Ice cream', emoji: '🍦', priceDiamonds: 10, animationTier: 0 },
  { id: 'confetti', name: 'Confetti', emoji: '🎉', priceDiamonds: 20, animationTier: 1 },
  { id: 'guitar', name: 'Guitar', emoji: '🎸', priceDiamonds: 99, animationTier: 1 },
  { id: 'crown', name: 'Crown', emoji: '👑', priceDiamonds: 199, animationTier: 1 },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', priceDiamonds: 500, animationTier: 2 },
  { id: 'castle', name: 'Castle', emoji: '🏰', priceDiamonds: 1000, animationTier: 2 },
  { id: 'racecar', name: 'Race car', emoji: '🏎️', priceDiamonds: 2999, animationTier: 3 },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', priceDiamonds: 10000, animationTier: 3 },
];

async function main() {
  const prisma = new PrismaClient();
  for (const [index, gift] of GIFTS.entries()) {
    await prisma.giftCatalogItem.upsert({
      where: { id: gift.id },
      create: { ...gift, sortOrder: index },
      update: { ...gift, sortOrder: index },
    });
  }
  console.log(`seeded ${GIFTS.length} gifts`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
