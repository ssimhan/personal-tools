const LOCAL_APPLICATION_URL = "http://127.0.0.1:3000";

export function applicationUrl(path = "/"): URL {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? LOCAL_APPLICATION_URL);
}
