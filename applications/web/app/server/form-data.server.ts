import { FormBodyTooLargeError } from "./errors/http-errors";

export const MAX_FORM_BODY_BYTES = 32 * 1024;

export async function readLimitedFormData(request: Request): Promise<FormData> {
  const declaredBodyLength = request.headers.get("Content-Length");
  if (
    declaredBodyLength !== null &&
    /^\d+$/.test(declaredBodyLength) &&
    Number(declaredBodyLength) > MAX_FORM_BODY_BYTES
  ) {
    throw new FormBodyTooLargeError();
  }
  if (!request.body) return request.formData();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      receivedBytes += chunk.byteLength;
      if (receivedBytes > MAX_FORM_BODY_BYTES)
        throw new FormBodyTooLargeError();
      chunks.push(chunk);
    }
  } finally {
    // The Node adapter cannot safely cancel its source stream; 413 responses close the connection.
    reader.releaseLock();
  }

  return new Response(Buffer.concat(chunks, receivedBytes), {
    headers: { "Content-Type": request.headers.get("Content-Type") ?? "" },
  }).formData();
}
