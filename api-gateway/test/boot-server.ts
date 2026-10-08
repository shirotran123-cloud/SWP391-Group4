import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';

async function boot(port: number): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableCors({ origin: '*' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(port);
  console.log(`fresh-boot listening on :${port}`);
}

const port = parseInt(process.argv[2] || '3121', 10);
boot(port).catch((e) => { console.error(e); process.exit(1); });
