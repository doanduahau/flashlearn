export type StudyModeSourceInput = {
  all: boolean;
  setIds: string[];
  collectionIds: string[];
};

export function buildStudyModeHref(source: StudyModeSourceInput): string {
  const params = new URLSearchParams();
  if (source.all) params.set("all", "1");
  if (source.setIds.length) params.set("sets", source.setIds.join(","));
  if (source.collectionIds.length) params.set("collections", source.collectionIds.join(","));
  return `/study/mode?${params.toString()}`;
}

export function studyModeHrefFromSession(sessionHref: string): string {
  const url = new URL(sessionHref, "http://localhost");
  url.pathname = "/study/mode";
  url.searchParams.delete("count");
  url.searchParams.delete("seed");
  url.searchParams.delete("sessionId");
  url.searchParams.delete("difficulty");
  return `${url.pathname}${url.search}`;
}
