/*
Purpose: adds 10 fake announcements to the 'announcement' table
Prerequisites:
  At least one admin user must exist in the 'admin_user' table (because
  announcements are linked to admin users).
Usage: 
  npx ts-node src\scripts\generate-fake-announcements
Developed by: Goeme Nthomiwa
*/

import { faker } from '@faker-js/faker';
import range from 'lodash/range';
import prisma from '../v1/prisma/prisma-client';

const main = async () => {
  const adminUser = await prisma.admin_user.findFirst();
  if (!adminUser) {
    throw new Error(
      "No users exist in the 'admin_user' table.  Please add an admin user before running this script.",
    );
  }

  await prisma.announcement.createMany({
    data: range(0, 10).map((i) => ({
      title: faker.lorem.sentence(2),
      description: faker.lorem.paragraph(3),
      published_on: faker.date.recent(),
      expires_on: faker.date.future(),
      status: i % 2 === 0 ? 'PUBLISHED' : 'DRAFT',
      created_by: adminUser.admin_user_id,
      updated_by: adminUser.admin_user_id,
    })),
  });
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });