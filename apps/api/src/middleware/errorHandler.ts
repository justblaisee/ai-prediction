import { Request, Response, NextFunction } from 'express';
import { pino } from 'pino';

const logger = pino();

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational ?? false;

  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      statusCode,
      isOperational,
    },
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
    },
  }, 'Error occurred');

  res.status(statusCode).json({
    error: isOperational ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function createError(message: string, statusCode: number): ApiError {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}
