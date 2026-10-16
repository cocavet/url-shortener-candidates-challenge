import { describe, expect, it, vi } from "vitest";
import {
  MAX_FORM_BODY_BYTES,
  readLimitedFormData,
} from "../app/server/form-data.server";
import { FormBodyTooLargeError } from "../app/server/errors/http-errors";

function request(body: string, headers?: HeadersInit) {
  return new Request("http://localhost/", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
  });
}

describe("bounded form reading", () => {
  it("accepts a form exactly at the byte limit", async () => {
    const value = "a".repeat(MAX_FORM_BODY_BYTES - 4);
    expect(
      (await readLimitedFormData(request(`url=${value}`))).get("url"),
    ).toBe(value);
  });

  it("rejects a declared oversized body before reading it", async () => {
    const input = request("url=small", {
      "Content-Length": String(MAX_FORM_BODY_BYTES + 1),
    });
    const read = vi.spyOn(input.body!, "getReader");
    await expect(readLimitedFormData(input)).rejects.toBeInstanceOf(
      FormBodyTooLargeError,
    );
    expect(read).not.toHaveBeenCalled();
  });

  it.each([undefined, "1"])(
    "enforces actual bytes when Content-Length is %s",
    async (length) => {
      const input = request(
        `url=${"a".repeat(MAX_FORM_BODY_BYTES)}`,
        length ? { "Content-Length": length } : {},
      );
      await expect(readLimitedFormData(input)).rejects.toBeInstanceOf(
        FormBodyTooLargeError,
      );
    },
  );

  it("counts UTF-8 bytes rather than characters", async () => {
    await expect(
      readLimitedFormData(request(`url=${"€".repeat(11_000)}`)),
    ).rejects.toBeInstanceOf(FormBodyTooLargeError);
  });

  it("rejects an oversized stream without waiting for its end", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_FORM_BODY_BYTES));
        controller.enqueue(new Uint8Array(1));
      },
    });
    const init = { method: "POST", body, duplex: "half" };
    await expect(
      readLimitedFormData(new Request("http://localhost/", init)),
    ).rejects.toBeInstanceOf(FormBodyTooLargeError);
    expect(body.locked).toBe(false);
  });
});
