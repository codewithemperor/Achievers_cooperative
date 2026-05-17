import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '').toLowerCase();
}

function resolveCorsOrigins() {
  const configuredOrigins =
    process.env.CORS_ORIGINS ||
    process.env.ALLOWED_FRONTEND_ORIGINS ||
    process.env.FRONTEND_URL ||
    '';
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://achieverscoop.vercel.app',
    'https://achieversmember.vercel.app',
    'https://achieverscooperative.com.ng',
    'https://www.achieverscooperative.com.ng',
    'https://member.achieverscooperative.com.ng',
    'https://admin.achieverscooperative.com.ng',
  ];

  return Array.from(
    new Set([
      ...defaultOrigins,
      ...configuredOrigins
        .split(/[\s,]+/)
        .map((origin) => normalizeOrigin(origin))
        .filter(Boolean),
    ].map((origin) => normalizeOrigin(origin))),
  );
}

function isAllowedCorsOrigin(origin: string | undefined, allowedOrigins: string[]) {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);

  return (
    allowedOrigins.includes(normalizedOrigin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(normalizedOrigin)
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = resolveCorsOrigins();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (typeof origin === 'string' && isAllowedCorsOrigin(origin, allowedOrigins)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Authorization,Content-Type,Accept,Origin,X-Requested-With,x-cron-secret',
    );
    res.header('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }

    next();
  });
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    credentials: false,
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) {
      if (isAllowedCorsOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Achievers Cooperative API')
    .setDescription('Source-of-truth API contract for member and admin apps.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
