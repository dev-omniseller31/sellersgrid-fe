// Vercel forwards the rewritten function path; Nest routes retain /api.
export function apiRequestUrl(url: string): string {
  return url.startsWith("/index/api/") ? url.slice(6) : url;
}
