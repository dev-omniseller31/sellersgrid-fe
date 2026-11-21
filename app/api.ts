export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  if (!["GET", "HEAD"].includes(method)) headers.set("x-sellersgrid-request", "web");
  const response = await fetch(`/api${path}`, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("json") ? await response.json() : await response.text();
  if (!response.ok) throw new ApiError(Array.isArray(body?.message) ? body.message[0] : body?.message ?? "Request failed", response.status);
  return body as T;
}
