import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('AITA-Gateway-Bootstrap');
  const app = await NestFactory.create(AppModule);

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
