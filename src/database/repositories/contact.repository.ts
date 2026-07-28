import 'server-only';

import { prisma } from '@/database/client';

/** Data access for contact enquiries. */

export interface ContactRecord {
  name: string;
  email: string;
  subject: string;
  message: string;
  ipHash: string;
}

export function create(record: ContactRecord) {
  return prisma.contactMessage.create({ data: record, select: { id: true } });
}
