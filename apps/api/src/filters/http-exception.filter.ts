/**
 * Global HTTP Exception Filter
 * ============================
 * 
 * Handles all HTTP exceptions and formats responses consistently.
 * In production, hides internal error details and stack traces.
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Optional Sentry integration - only loaded if available
let Sentry: { captureException?: (error: unknown) => void } | null = null;
try {
  Sentry = require('@sentry/node');
} catch {
  // Sentry not installed - skip
}

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly isProduction: boolean = false) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = this.generateRequestId();
    const timestamp = new Date().toISOString();

    let status: number;
    let message: string;
    let error: string;
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = HttpStatus[status] || 'Error';
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || exception.message;
        error = (responseObj.error as string) || HttpStatus[status] || 'Error';
        
        // Include validation details in non-production
        if (!this.isProduction && responseObj.message !== message) {
          details = responseObj.message;
        }
      } else {
        message = exception.message;
        error = HttpStatus[status] || 'Error';
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'Internal Server Error';
      
      // In production, hide internal error messages
      message = this.isProduction
        ? 'An unexpected error occurred. Please try again later.'
        : exception.message;

      // Log full error in production
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );

      // Report to Sentry (if available)
      if (this.isProduction && Sentry?.captureException) {
        Sentry.captureException(exception);
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = this.isProduction
        ? 'An unexpected error occurred. Please try again later.'
        : 'Unknown error';
      error = 'Internal Server Error';
    }

    // Build response
    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: Array.isArray(message) ? message.join(', ') : message,
      error,
      timestamp,
      path: request.url,
    };

    // Include request ID in production for support
    if (this.isProduction) {
      errorResponse.requestId = requestId;
    }

    // Include details in development
    if (!this.isProduction && details) {
      errorResponse.details = details;
    }

    // Log error (not for client errors in production)
    if (status >= 500 || !this.isProduction) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(errorResponse);
  }

  private generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
