import { env } from '../server/config';
import { createBackup } from '../server/backup';
import { prisma } from '../server/db';

const backup = await createBackup();
await prisma.$disconnect();
console.log(`Backup created: ${env.backupDir}/${backup.name} (${backup.bytes} bytes)`);
