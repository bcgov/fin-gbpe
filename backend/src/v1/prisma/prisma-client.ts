import { logger } from '../../logger';
import { Prisma, PrismaClient } from '@prisma/client';
import { config } from '../../config';


const prisma: PrismaClient<
  Prisma.PrismaClientOptions,
  'query' | 'info' | 'warn' | 'error'
> = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
    { emit: 'stdout', level: 'error' },
  ],
  errorFormat: 'pretty',
  datasourceUrl: config.get('server:databaseUrl'),
});
prisma.$on('query', (e) => {
  logger.debug(
    `Query: ${e.query}- Params: ${e.params} - Duration: ${e.duration}ms`,
  );
});

export default prisma;
