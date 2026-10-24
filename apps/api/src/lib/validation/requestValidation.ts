import type { NextFunction, Request, Response } from 'express';
import type Joi from 'joi';

import { DEFAULT_JOI_VALIDATION_OPTIONS } from './joiDefaults.js';

export function validateBodyObject(
  schema: Joi.ObjectSchema,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const numericFields = ['position1', 'position2']; // Add any other fields that should be converted

  // Convert numeric string values to numbers
  for (const key of numericFields) {
    if (req.body && req.body[key] && typeof req.body[key] === 'string') {
      req.body[key] = parseFloat(req.body[key]);
    }
  }

  const { error, value } = schema.validate(req.body, DEFAULT_JOI_VALIDATION_OPTIONS);
  if (error) {
    res.status(400).json({ message: error.details[0]?.message ?? 'Validation error' });
    return;
  }
  req.body = value;
  next();
}

export function validateParamsObject(
  schema: Joi.ObjectSchema,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { error, value } = schema.validate(req.params, DEFAULT_JOI_VALIDATION_OPTIONS);
  if (error) {
    res.status(400).json({ message: error.details[0]?.message ?? 'Validation error' });
    return;
  }
  const p = req.params as Record<string, string>;
  for (const key of Object.keys(p)) {
    delete p[key];
  }
  Object.assign(req.params, value);
  next();
}

export function validateQueryObject(
  schema: Joi.ObjectSchema,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { error, value } = schema.validate(req.query, DEFAULT_JOI_VALIDATION_OPTIONS);
  if (error) {
    res.status(400).json({ message: error.details[0]?.message ?? 'Validation error' });
    return;
  }
  // Express 5 defines req.query as a prototype getter that reparses the URL on every read.
  // Writing onto the object that getter returns does not change the next read, so the validated
  // query (defaults, coercion, and unknown keys removed) is installed as an own property.
  Object.defineProperty(req, 'query', {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
  next();
}
