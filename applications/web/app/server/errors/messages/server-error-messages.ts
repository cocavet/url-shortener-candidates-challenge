export const SERVER_ERROR_MESSAGES = {
  unavailable: "The service is temporarily unavailable. Please try again.",
  notFound: "Short link not found.",
  invalidForm: "The URL form could not be read.",
  payloadTooLarge: "The URL form is too large. Maximum size is 32 KiB.",
  rateLimited: "Too many creation attempts. Please try again later.",
  methodNotAllowed: "Method not allowed.",
  invalidPublicUrl: "PUBLIC_URL must be an absolute HTTP(S) origin.",
  invalidPublicOrigin:
    "PUBLIC_URL must be an HTTP(S) origin without credentials, path, query or fragment.",
  invalidDatabaseUrl: "DATABASE_URL must be a SQLite file URL.",
  invalidIntegerOption: (name: string, maximum: number): string =>
    `${name} must be an integer between 1 and ${maximum}.`,
  startupFailed:
    "Server startup failed. Check DATABASE_URL and run pnpm db:migrate.",
} as const;
