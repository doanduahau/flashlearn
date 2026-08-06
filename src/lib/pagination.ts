export type RouteSearchParams = Record<string, string | string[] | undefined>;

export function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function pageHref(searchParams: RouteSearchParams, targetPage: number): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined) continue;

    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.append(key, value);
    }
  }

  params.set("page", String(Math.max(1, targetPage)));
  return `?${params.toString()}`;
}
