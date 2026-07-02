const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const abortFromUpstream = () => controller.abort(init.signal?.reason);

  if (init.signal?.aborted) {
    abortFromUpstream();
  } else {
    init.signal?.addEventListener("abort", abortFromUpstream, { once: true });
  }

  const timeout = setTimeout(() => {
    controller.abort(
      new DOMException(`Request exceeded ${timeoutMs}ms`, "TimeoutError"),
    );
  }, timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromUpstream);
  }
}
