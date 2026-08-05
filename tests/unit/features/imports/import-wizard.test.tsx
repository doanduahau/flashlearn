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
    mocks.importFlashcards.mockResolvedValue({ setId: "11111111-1111-1111-1111-111111111111" });
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

  it("selects worksheets, maps columns, and reports valid, blank, partial, and duplicate rows", async () => {
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
    expect(screen.getByText(/2.*1.*1.*1/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^2\./), "1");
    await user.selectOptions(screen.getByLabelText(/^3\./), "2");
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("x")).toBeInTheDocument();
  });

  it("announces same-column mapping and disables import when no valid rows exist", async () => {
    render(<ImportWizard />);
    const user = await upload("cards.csv");
    await user.selectOptions(screen.getByLabelText(/^3\./), "0");
    expect(screen.getByRole("alert")).toHaveTextContent(/hai cột khác nhau/i);

    mocks.parseWorkbook.mockResolvedValue(
      workbook([
        ["A", "B"],
        ["", ""],
        ["only", ""],
      ]),
    );
    await user.click(screen.getByRole("button", { name: /Thay/ }));
    await upload("empty.csv");
    expect(screen.getByRole("button", { name: /import/i })).toBeDisabled();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveImport: ((result: { setId: string }) => void) | undefined;
    mocks.importFlashcards.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );
    render(<ImportWizard />);
    const user = await upload("cards.csv");
    await user.type(screen.getByLabelText(/^4\./), "Pending set");
    const submit = screen.getByRole("button", { name: /import/i });
    await user.click(submit);
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mocks.importFlashcards).toHaveBeenCalledTimes(1);
    resolveImport?.({ setId: "11111111-1111-1111-1111-111111111111" });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
  });

  it("reset clears parsed state", async () => {
    render(<ImportWizard />);
    const user = await upload("cards.csv");
    await user.click(screen.getByRole("button", { name: /Thay/ }));
    expect(screen.getByLabelText(/CSV\/XLSX/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^1\./)).not.toBeInTheDocument();
  });

  it("announces a recoverable server error and preserves the preview", async () => {
    mocks.importFlashcards.mockResolvedValue({ error: "Import failed safely" });
    render(<ImportWizard />);
    const user = await upload("cards.csv");
    await user.type(screen.getByLabelText(/^4\./), "Retry set");
    await user.click(screen.getByRole("button", { name: /import/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Import failed safely");
    expect(screen.getByText("Một")).toBeInTheDocument();
    expect(screen.getByLabelText(/^4\./)).toHaveValue("Retry set");
  });
});
