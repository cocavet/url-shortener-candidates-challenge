import type { HttpErrorDefinition } from "../contracts/server";
import { SERVER_ERROR_MESSAGES } from "./messages/server-error-messages";

export class ServerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerConfigurationError";
  }
}

export class FormBodyTooLargeError extends Error {
  constructor() {
    super(HTTP_ERRORS.payloadTooLarge.message);
    this.name = "FormBodyTooLargeError";
  }
}

export const HTTP_ERRORS = {
  unavailable: {
    status: 503,
    message: SERVER_ERROR_MESSAGES.unavailable,
  },
  notFound: { status: 404, message: SERVER_ERROR_MESSAGES.notFound },
  invalidForm: { status: 400, message: SERVER_ERROR_MESSAGES.invalidForm },
  payloadTooLarge: {
    status: 413,
    message: SERVER_ERROR_MESSAGES.payloadTooLarge,
  },
  rateLimited: {
    status: 429,
    message: SERVER_ERROR_MESSAGES.rateLimited,
  },
  methodNotAllowed: {
    status: 405,
    message: SERVER_ERROR_MESSAGES.methodNotAllowed,
  },
} as const satisfies Record<string, HttpErrorDefinition>;

export function createHttpErrorResponse(
  error: HttpErrorDefinition,
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json(
    { error: error.message },
    {
      status: error.status,
      statusText: error.message,
      headers: responseHeaders,
    },
  );
}
