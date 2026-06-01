import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CURRENT_EMAIL = 'bashiratmakinde17@gmail.com';
const CURRENT_PHONE = '08054588827';
const NEXT_EMAIL = 'makindebashirat17@gmail.com';
const NEXT_PHONE = '08054588827';

async function main() {
  const member = await prisma.member.findFirst({
    where: {
      phoneNumber: CURRENT_PHONE,
      user: { email: CURRENT_EMAIL },
    },
    include: { user: true },
  });

  if (!member) {
    throw new Error(`No member found for ${CURRENT_EMAIL} / ${CURRENT_PHONE}`);
  }

  const emailOwner = await prisma.user.findUnique({ where: { email: NEXT_EMAIL } });
  if (emailOwner && emailOwner.id !== member.userId) {
    throw new Error(`${NEXT_EMAIL} already belongs to another user`);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: member.userId },
      data: { email: NEXT_EMAIL },
    }),
    prisma.member.update({
      where: { id: member.id },
      data: { phoneNumber: NEXT_PHONE },
    }),
  ]);

  console.log(`Updated ${member.fullName} (${member.membershipNumber}) to ${NEXT_EMAIL} / ${NEXT_PHONE}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
