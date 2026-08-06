import { describe, expect, it } from "vitest";

import { pageHref, parsePage } from "@/lib/pagination";

describe("pagination helpers", () => {
  it("parses only positive whole-number pages", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage("two")).toBe(1);
    expect(parsePage(["2"])).toBe(1);
  });

  it("keeps search, sort, filter and tab parameters when navigating both directions", () => {
    const params = { q: "thẻ", sort: "position", filter: "active", tab: "regular", page: "2" };

    const previous = new URL(pageHref(params, 1), "http://flashlearn.test");
    expect(previous.searchParams.get("page")).toBe("1");
    expect(previous.searchParams.get("q")).toBe("thẻ");
    expect(previous.searchParams.get("sort")).toBe("position");
    expect(previous.searchParams.get("filter")).toBe("active");
    expect(previous.searchParams.get("tab")).toBe("regular");

    const next = new URL(pageHref({ ...params, page: "1" }, 2), "http://flashlearn.test");
    expect(next.searchParams.get("page")).toBe("2");
    expect(next.searchParams.get("q")).toBe("thẻ");
  });
});
