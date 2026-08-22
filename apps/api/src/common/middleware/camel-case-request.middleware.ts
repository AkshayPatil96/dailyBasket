import type { NextFunction, Request, Response } from 'express';
import { toCamelCase } from '@grocery-delivery/utils';

export function camelCaseRequestMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = toCamelCase(req.body);
  }
  next();
}
