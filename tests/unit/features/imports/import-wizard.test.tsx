import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importFlashcards: vi.fn(),
  parseWorkbook: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/imports/server/actions", () => ({ importFlashcards: mocks.importFlashcards }));
vi.mock("@/features/imports/utils/parse-workbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/imports/utils/parse-workbook")>();
  return { ...actual, parseWorkbook: mocks.parseWorkbook };
});

import { ImportWizard } from "@/features/imports/components/import-wizard";
import type { DraftFlashcard } from "@/features/imports/types/import-types";

const rows = [
  ["Question", "Answer", "Extra"],
  ["Một", "One", "x"],
  ["", "", ""],
  ["Partial", "", ""],
  ["Một", "One", "x"],
  ["Hai", "Two", "y"],
];

function workbook(sheetRows = rows) {
  return [{ name: "Sheet 1", rows: sheetRows }];
}

async function upload(name: string) {
  const user = userEvent.setup();
  await user.upload(screen.getByLabelText(/CSV\/XLSX/i), new File(["fixture"], name));
  return user;
}

describe("ImportWizard", () => {
  beforeEach(() => {
    mocks.importFlashcards.mockReset();
    mocks.parseWorkbook.mockReset();
    mocks.push.mockReset();
    mocks.parseWorkbook.mockResolvedValue(workbook());
    mocks.importFlashcards.mockResolvedValue({
      setId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it.each(["cards.csv", "cards.xlsx"])(
    "selects a valid %s file and exposes mapping controls",
    async (name) => {
      render(<ImportWizard />);
      await upload(name);
      expect(await screen.findByLabelText(/^1\./)).toBeInTheDocument();
      expect(screen.getByLabelText(/^2\./)).toHaveValue("0");
      expect(screen.getByLabelText(/^3\./)).toHaveValue("1");
      expect(mocks.parseWorkbook).toHaveBeenCalledWith(expect.objectContaining({ name }));
    },
  );

  it("selects worksheets and opens the unified editor with cards", async () => {
    mocks.parseWorkbook.mockResolvedValue([
      {
        name: "First",
        rows: [
          ["A", "B"],
          ["skip", "skip"],
        ],
      },
      { name: "Second", rows },
    ]);
    render(<ImportWizard />);
    const user = await upload("multi.xlsx");
    await user.selectOptions(screen.getByLabelText(/^1\./), "1");
    await user.selectOptions(screen.getByLabelText(/^2\./), "1");
    await user.selectOptions(screen.getByLabelText(/^3\./), "2");
    // Unified editor renders global actions when cards are present
    expect(await screen.findByRole("button", { name: /thêm thẻ/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /đảo tất cả/i })).toBeInTheDocument();
  });

  it("announces same-column mapping", async () => {
    render(<ImportWizard />);
    const user = await upload("cards.csv");
    await user.selectOptions(screen.getByLabelText(/^3\./), "0");
    expect(screen.getByRole("alert")).toHaveTextContent(/hai cột khác nhau/i);
  });

  it("reset clears parsed state", async () => {
    render(<ImportWizard />);
    const user = await upload("cards.csv");
    // After upload, the wizard shows mapping controls + editor
    await screen.findByLabelText(/^1\./);
    await user.click(screen.getByRole("button", { name: /Thay/ }));
    // After reset, back to the file upload screen
    expect(screen.getByLabelText(/CSV\/XLSX/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^1\./)).not.toBeInTheDocument();
  });
});
