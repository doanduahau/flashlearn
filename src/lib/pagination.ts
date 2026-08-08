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

export function updateSearchParamHref(
  pathname: string,
  searchParams: RouteSearchParams,
  key: string,
  value: string,
): string {
  const params = new URLSearchParams();

  for (const [currentKey, currentValue] of Object.entries(searchParams)) {
    if (currentKey === key || currentValue === undefined) continue;

    if (Array.isArray(currentValue)) {
      for (const item of currentValue) params.append(currentKey, item);
    } else {
      params.append(currentKey, currentValue);
    }
  }

  params.set(key, value);
  return `${pathname}?${params.toString()}`;
}

export function removeSearchParamHref(
  pathname: string,
  searchParams: RouteSearchParams,
  key: string,
): string {
  const params = new URLSearchParams();

  for (const [currentKey, currentValue] of Object.entries(searchParams)) {
    if (currentKey === key || currentValue === undefined) continue;

    if (Array.isArray(currentValue)) {
      for (const item of currentValue) params.append(currentKey, item);
    } else {
      params.append(currentKey, currentValue);
    }
  }

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
