import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { camelCaseRequestMiddleware } from './common/middleware/camel-case-request.middleware';
import { SnakeCaseResponseInterceptor } from './common/interceptors/snake-case-response.interceptor';

async function bootstrap() {
  // bodyParser disabled here and applied manually below — Nest's own body-parser
  // middleware registers AFTER any app.use() calls made in bootstrap(), which
  // silently broke the camelCase conversion running ahead of a parsed body.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(helmet());
  app.use(json());
  app.use(cookieParser());
  app.use(camelCaseRequestMiddleware);
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new SnakeCaseResponseInterceptor());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Grocery Delivery API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
