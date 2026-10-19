import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

/**
 * Serves the built frontend from the same process, when a bundle is present.
 *
 * Free hosting tiers commonly allow a single web service, so the gateway has to be the whole
 * deployment: it answers `/api/*`, upgrades `/socket.io`, and returns the SPA for everything
 * else. One origin also removes CORS and the mixed-content problem — the browser only ever
 * talks to the host that served the page.
 *
 * The directory is optional by design: in local development the frontend runs under Vite on its
 * own port and this does nothing.
 */
function serveFrontendIfPresent(app: NestExpressApplication, logger: Logger): void {
  // `FRONTEND_DIST` lets a deployment point at a bundle outside the gateway directory.
  const candidates = [
    process.env.FRONTEND_DIST,
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), '..', 'frontend', 'dist'),
    path.resolve(__dirname, '..', '..', 'public'),
  ].filter(Boolean) as string[];

  const distDir = candidates.find(
    (dir) => fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html')),
  );

  if (!distDir) {
    logger.log('Frontend bundle not found — serving API only (development mode).');
    return;
  }

  app.useStaticAssets(distDir, { index: false });

  const server = app.getHttpAdapter().getInstance();
  // SPA fallback. Declared after Nest's routes, and it deliberately skips paths that look like
  // API or socket calls, so a mistyped URL returns a real 404 instead of the HTML shell — which
  // would otherwise surface in the client as a confusing JSON parse error.
  server.get(/^\/(?!api\/|socket\.io\/).*/, (_req: any, res: any) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  logger.log(`Serving frontend from ${distDir}`);
}

async function bootstrap() {
  const logger = new Logger('AITA-Gateway-Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for Frontend and WebSocket clients
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  serveFrontendIfPresent(app, logger);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`================================================================`);
  logger.log(`🚀 AITA API Gateway & Socket.IO Server running on port ${port}`);
  logger.log(`📥 API Submissions Endpoint: POST http://localhost:${port}/api/v1/submissions`);
  logger.log(`⚡ WebSocket Socket.IO Server: ws://localhost:${port}`);
  logger.log(`📡 Real-Time Events: testcase:evaluated, grading:progress, grading:completed`);
  logger.log(`⚡ SLA: < 200ms submission acceptance & Redis BullMQ queuing`);
  logger.log(`================================================================`);
}

bootstrap();
