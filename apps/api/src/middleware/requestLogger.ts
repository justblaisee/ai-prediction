import { Request, Response, NextFunction } from 'express';
import { pino } from 'pino';

const logger = pino();

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      req: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
      },
      res: {
        statusCode: res.statusCode,
      },
      duration,
    }, `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });

  next();
}
