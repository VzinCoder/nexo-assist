import { z } from "zod";

export const ERROR_CODES = [
  "invalid_request",
  "unauthorized",
  "not_found",
  "conflict",
  "service_unavailable",
  "internal_error",
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Formato único de erro do tickets-api: `{ error: { code, message } }`. */
export const errorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
  }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;
