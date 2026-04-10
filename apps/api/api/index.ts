import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import express from 'express';

const server = express();
let cachedApp: any;

async function bootstrap() {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
    app.setGlobalPrefix('api/v1');
    app.enableCors();
    cachedApp = app;
  }
  return cachedApp;
}

export default async (req: any, res: any) => {
  await bootstrap();
  server(req, res);
};
