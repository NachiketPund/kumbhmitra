import type { Request, Response, NextFunction, RequestHandler } from "../types/index.js";
import { AppError } from "./errorHandler.js";

export type ValidationRule = (value: any, field: string) => string | null;

export interface ValidationSchema {
  body?: Record<string, ValidationRule[]>;
  query?: Record<string, ValidationRule[]>;
  params?: Record<string, ValidationRule[]>;
}

export const rules = {
  required: (value: any, field: string) => {
    if (value === undefined || value === null || value === "") {
      return `${field} is required`;
    }
    return null;
  },
  isString: (value: any, field: string) => {
    if (value !== undefined && typeof value !== "string") {
      return `${field} must be a string`;
    }
    return null;
  },
  maxLength: (max: number) => (value: any, field: string) => {
    if (typeof value === "string" && value.length > max) {
      return `${field} must not exceed ${max} characters`;
    }
    return null;
  },
  minLength: (min: number) => (value: any, field: string) => {
    if (typeof value === "string" && value.length < min) {
      return `${field} must be at least ${min} characters`;
    }
    return null;
  },
  isIn: (allowed: any[]) => (value: any, field: string) => {
    if (value !== undefined && !allowed.includes(value)) {
      return `${field} must be one of: ${allowed.join(", ")}`;
    }
    return null;
  },
};

/**
 * Validates request input data against a provided schema.
 */
export function validate(schema: ValidationSchema): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: Record<string, string[]> = {};

    const checkPart = (
      data: any,
      partSchema?: Record<string, ValidationRule[]>,
      partName = "body"
    ) => {
      if (!partSchema) return;
      for (const [field, fieldRules] of Object.entries(partSchema)) {
        const val = data?.[field];
        for (const rule of fieldRules) {
          const errMsg = rule(val, `${partName}.${field}`);
          if (errMsg) {
            if (!errors[field]) errors[field] = [];
            errors[field].push(errMsg);
          }
        }
      }
    };

    checkPart(req.body, schema.body, "body");
    checkPart(req.query, schema.query, "query");
    checkPart(req.params, schema.params, "params");

    if (Object.keys(errors).length > 0) {
      return next(
        new AppError(
          "Input validation failed",
          400,
          "VALIDATION_ERROR",
          errors
        )
      );
    }

    next();
  };
}

export default validate;
