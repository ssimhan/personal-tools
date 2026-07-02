import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithTimeout } from "./fetch-with-timeout";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout", () => {
  it("aborts a request that exceeds its deadline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
      ),
    );

    await expect(
      fetchWithTimeout("https://example.test", {}, 5),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("propagates an existing abort signal", async () => {
    const upstream = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        upstream.abort(new DOMException("Cancelled", "AbortError"));
        return init?.signal?.aborted
          ? Promise.reject(init.signal.reason)
          : Promise.resolve(new Response());
      }),
    );

    await expect(
      fetchWithTimeout("https://example.test", { signal: upstream.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
