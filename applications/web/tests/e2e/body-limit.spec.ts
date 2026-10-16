import { request as httpRequest } from "node:http";
import { expect, test } from "@playwright/test";

for (const hasContentLength of [true, false]) {
  test(`rejects an unfinished oversized ${hasContentLength ? "declared" : "chunked"} body`, async ({
    baseURL,
    request,
  }) => {
    const response = await new Promise<{
      status: number | undefined;
      connection?: string;
    }>((resolve, reject) => {
      const outgoingRequest = httpRequest(
        `${baseURL}/?index`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...(hasContentLength ? { "Content-Length": "100000" } : {}),
          },
        },
        (serverResponse) => {
          serverResponse.resume();
          serverResponse.on("error", reject);
          serverResponse.on("end", () => {
            resolve({
              status: serverResponse.statusCode,
              connection: serverResponse.headers.connection,
            });
            outgoingRequest.destroy();
          });
        },
      );
      outgoingRequest.on("error", reject);
      outgoingRequest.setTimeout(5000, () =>
        outgoingRequest.destroy(
          new Error("Oversized request was not rejected promptly"),
        ),
      );
      outgoingRequest.flushHeaders();
      if (!hasContentLength)
        outgoingRequest.write(Buffer.alloc(32 * 1024 + 1, "a"));
      // Intentionally leave the request open: rejection must not wait for the remaining body.
    });
    expect(response).toEqual({ status: 413, connection: "close" });
    expect((await request.get("/")).status()).toBe(200);
  });
}
