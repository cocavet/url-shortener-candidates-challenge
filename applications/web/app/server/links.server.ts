import { data } from "react-router";
import type { AppLoadContext } from "react-router";
import {
  createShortLink,
  InvalidOriginalUrlError,
  listShortLinksWithStats,
  recordClick,
  resolveShortLink,
} from "@url-shortener/engine";
import { generateCryptoShortCode } from "@url-shortener/engine/code-generator";
import type { ShortLink } from "@url-shortener/engine";
import type { CreationResult, ListedLink } from "../contracts/short-links";
import type {
  CreationErrorOptions,
  HttpErrorDefinition,
} from "./contracts/server";
import {
  FormBodyTooLargeError,
  HTTP_ERRORS,
  createHttpErrorResponse,
} from "./errors/http-errors";
import { readLimitedFormData } from "./form-data.server";

function createCreationErrorResponse(
  error: HttpErrorDefinition,
  { headers, ...submittedInput }: CreationErrorOptions = {},
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return data<CreationResult>(
    { error: error.message, ...submittedInput },
    { status: error.status, headers: responseHeaders },
  );
}

export async function listLinks(context: AppLoadContext) {
  const { config, repository } = context.services;
  try {
    const links = await listShortLinksWithStats(repository);
    return data(
      {
        baseUrl: `${config.publicUrl}/s/`,
        links: links.map(
          (link): ListedLink => ({
            ...link,
            createdAt: link.createdAt.toISOString(),
            shortenedUrl: `${config.publicUrl}/s/${link.code}`,
          }),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    throw createHttpErrorResponse(HTTP_ERRORS.unavailable);
  }
}

export async function createLink(request: Request, context: AppLoadContext) {
  if (request.method !== "POST") {
    return createCreationErrorResponse(HTTP_ERRORS.methodNotAllowed, {
      headers: { Allow: "POST" },
    });
  }
  if (!context.clientAddress)
    return createCreationErrorResponse(HTTP_ERRORS.unavailable);
  const { config, repository, creationLimiter } = context.services;
  const retryAfterSeconds = creationLimiter.consume(context.clientAddress);
  if (retryAfterSeconds > 0) {
    return createCreationErrorResponse(HTTP_ERRORS.rateLimited, {
      headers: { "Retry-After": String(retryAfterSeconds) },
    });
  }

  let form: FormData;
  try {
    form = await readLimitedFormData(request);
  } catch (error) {
    if (error instanceof FormBodyTooLargeError) {
      return createCreationErrorResponse(HTTP_ERRORS.payloadTooLarge, {
        headers: { Connection: "close" },
      });
    }
    return createCreationErrorResponse(HTTP_ERRORS.invalidForm);
  }

  const submittedUrl = form.get("url");
  try {
    const link = await createShortLink(submittedUrl, {
      repository,
      generateCode: generateCryptoShortCode,
      now: () => new Date(),
    });
    return data<CreationResult>(
      {
        shortenedUrl: `${config.publicUrl}/s/${link.code.value}`,
        submittedUrl: link.originalUrl.value,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const isInvalidUrl = error instanceof InvalidOriginalUrlError;
    const httpError = isInvalidUrl
      ? { status: 400, message: error.message }
      : HTTP_ERRORS.unavailable;
    return createCreationErrorResponse(httpError, {
      submittedUrl: typeof submittedUrl === "string" ? submittedUrl : "",
      invalidUrl: isInvalidUrl,
    });
  }
}

export async function redirectLink(
  request: Request,
  code: unknown,
  context: AppLoadContext,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return createHttpErrorResponse(HTTP_ERRORS.methodNotAllowed, {
      Allow: "GET, HEAD",
    });
  }
  const { config, repository } = context.services;
  let link: ShortLink | null;
  try {
    link = await resolveShortLink(code, repository);
  } catch {
    return createHttpErrorResponse(HTTP_ERRORS.unavailable);
  }
  if (!link) return createHttpErrorResponse(HTTP_ERRORS.notFound);
  const redirectLocation = new URL(link.originalUrl.value).href;
  if (request.method === "GET") {
    await recordClick(link.code, {
      statistics: repository,
      timeoutMs: config.clickTimeoutMs,
      onFailure: (reason) => console.warn("click-recording-failed", reason),
    });
  }
  return new Response(null, {
    status: 302,
    headers: { Location: redirectLocation, "Cache-Control": "no-store" },
  });
}
