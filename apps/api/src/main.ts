import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // Create app with production-appropriate logging
  const app = await NestFactory.create(AppModule, {
    logger: isProduction
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // ---------------------------------------------------------------------------
  // Sentry Error Monitoring (Production)
  // ---------------------------------------------------------------------------
  const sentryDsn = configService.get<string>('SENTRY_DSN');
  if (sentryDsn && isProduction) {
    Sentry.init({
      dsn: sentryDsn,
      environment: configService.get<string>('SENTRY_ENVIRONMENT', 'production'),
      tracesSampleRate: parseFloat(
        configService.get<string>('SENTRY_TRACES_SAMPLE_RATE', '0.1'),
      ),
      integrations: [
        Sentry.httpIntegration(),
      ],
      beforeSend(event) {
        // Scrub sensitive data
        if (event.request?.cookies) {
          event.request.cookies = {};
        }
        if (event.request?.headers?.authorization) {
          event.request.headers.authorization = '[REDACTED]';
        }
        return event;
      },
    });
    logger.log('Sentry error monitoring initialized');
  }

  // ---------------------------------------------------------------------------
  // Security Middleware
  // ---------------------------------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: isProduction,
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );

  app.use(cookieParser());

  // ---------------------------------------------------------------------------
  // CORS Configuration
  // ---------------------------------------------------------------------------
  const frontendOrigin = configService.get<string>(
    'FRONTEND_ORIGIN',
    'http://localhost:5173',
  );

  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24 hours
  });

  // ---------------------------------------------------------------------------
  // API Versioning
  // ---------------------------------------------------------------------------
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  // ---------------------------------------------------------------------------
  // Global Pipes & Filters
  // ---------------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: isProduction,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(isProduction));

  // ---------------------------------------------------------------------------
  // Swagger (Development Only)
  // ---------------------------------------------------------------------------
  const enableSwagger = configService.get<string>('ENABLE_SWAGGER', 'true');
  if (!isProduction && enableSwagger === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Voter Management System API')
      .setDescription('Multi-tenant election management API')
      .setVersion('1.0')
      .addCookieAuth('vms_access')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger documentation available at /api/docs');
  }

  // ---------------------------------------------------------------------------
  // Graceful Shutdown
  // ---------------------------------------------------------------------------
  app.enableShutdownHooks();

  // ---------------------------------------------------------------------------
  // Start Server
  // ---------------------------------------------------------------------------
  const port = Number(configService.get<string>('API_PORT', '4000'));
  await app.listen(port);

  logger.log(`Application running on port ${port}`);
  logger.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

  if (!isProduction) {
    logger.debug(`Frontend Origin: ${frontendOrigin}`);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
