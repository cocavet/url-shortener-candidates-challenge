export const ENGINE_ERROR_MESSAGES = {
  invalidOriginalUrl:
    "Enter an absolute HTTP(S) URL without credentials, up to 2048 characters.",
  invalidShortCode: "Expected an eight-character alphanumeric short code.",
  shortCodeCollision: "Short code is already reserved.",
  shortCodeExhausted: "Could not reserve a short code after five attempts.",
  invalidCreationDate: "Invalid creation date.",
  invalidClickTimeout:
    "Click recording timeout must be a positive number of milliseconds.",
  invalidDatabaseUrl: "DATABASE_URL must be a SQLite file URL.",
} as const;
