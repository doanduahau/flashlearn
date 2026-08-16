import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    mocks.importFlashcards.mockResolvedValue({
      setId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it.each(["cards.csv", "cards.xlsx"])(
    "selects a valid %s file and exposes mapping controls",
    async (name) => {
      render(<ImportWizard mascotLevel={1} />);
      const user = await upload(name);
      await user.click(await screen.findByRole("button", { name: /Phân tích/i }));
      expect(screen.getByLabelText("Mặt trước")).toHaveValue("0");
      expect(screen.getByLabelText("Mặt sau")).toHaveValue("1");
      expect(mocks.parseWorkbook).toHaveBeenCalledWith(expect.objectContaining({ name }));
    },
  );

  it("selects worksheets and shows the quick-create summary", async () => {
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
    render(<ImportWizard mascotLevel={1} />);
    const user = await upload("multi.xlsx");
    await user.click(await screen.findByRole("button", { name: /Phân tích/i }));
    await user.selectOptions(screen.getByLabelText("Đổi trang tính"), "1");
    await user.selectOptions(screen.getByLabelText("Mặt trước"), "1");
    await user.selectOptions(screen.getByLabelText("Mặt sau"), "2");
    // Quick-create summary appears with valid cards (no per-card editor)
    expect(await screen.findByText(/2 thẻ hợp lệ/)).toBeInTheDocument();
    expect(screen.getByLabelText("Tên bộ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /thêm thẻ/i })).not.toBeInTheDocument();
  });

  it("labels columns using first available non-empty row text", async () => {
    mocks.parseWorkbook.mockResolvedValue([
      {
        name: "Sheet 1",
        rows: [
          ["", "", "Fruit"],
          ["x", "y", "Mango"],
          ["a", "b", "Apple"],
        ],
      },
    ]);
    render(<ImportWizard mascotLevel={1} />);
    const user = await upload("no-header.csv");
    await user.click(await screen.findByRole("button", { name: /Phân tích/i }));
    const front = screen.getByLabelText("Mặt trước");
    const back = screen.getByLabelText("Mặt sau");
    const optionTexts = (select: HTMLElement) =>
      Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(optionTexts(front)).toEqual(["x", "y", "Fruit"]);
    expect(optionTexts(back)).toEqual(["x", "y", "Fruit"]);
    await user.selectOptions(front, "2");
    await user.selectOptions(back, "1");
    expect(screen.getByText(/2 thẻ hợp lệ/)).toBeInTheDocument();
  });

  it("filters out completely empty columns with no data in any row", async () => {
    mocks.parseWorkbook.mockResolvedValue([
      {
        name: "Sheet 1",
        rows: [
          ["Col1", "Col2", "", "", ""],
          ["Val1", "Val2", "", "", ""],
          ["Val3", "Val4", "", "", ""],
        ],
      },
    ]);
    render(<ImportWizard mascotLevel={1} />);
    const user = await upload("empty-cols.csv");
    await user.click(await screen.findByRole("button", { name: /Phân tích/i }));
    const front = screen.getByLabelText("Mặt trước");
    const optionTexts = Array.from(front.querySelectorAll("option")).map((o) => o.textContent);
    expect(optionTexts).toEqual(["Col1", "Col2"]);
  });

  it("announces same-column mapping", async () => {
    render(<ImportWizard mascotLevel={1} />);
    const user = await upload("cards.csv");
    await user.click(await screen.findByRole("button", { name: /Phân tích/i }));
    await user.selectOptions(screen.getByLabelText("Mặt sau"), "0");
    expect(screen.getByRole("alert")).toHaveTextContent(/hai cột khác nhau/i);
  });

  it("reset clears parsed state", async () => {
    render(<ImportWizard mascotLevel={1} />);
    const user = await upload("cards.csv");
    await screen.findByRole("button", { name: /Phân tích/i });
    await user.click(screen.getByRole("button", { name: /Thay/ }));
    // After reset, back to the file upload screen
    expect(screen.getByLabelText(/CSV\/XLSX/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Phân tích/i })).not.toBeInTheDocument();
  });

  it("processes one file at a time and allows another file after parsing completes", async () => {
    let resolveParse: ((result: ReturnType<typeof workbook>) => void) | undefined;
    mocks.parseWorkbook.mockReturnValue(
      new Promise((resolve) => {
        resolveParse = resolve;
      }),
    );
    render(<ImportWizard mascotLevel={1} />);

    const input = screen.getByLabelText(/CSV\/XLSX/i);
    fireEvent.change(input, { target: { files: [new File(["first"], "first.csv")] } });
    fireEvent.change(input, { target: { files: [new File(["second"], "second.csv")] } });

    expect(mocks.parseWorkbook).toHaveBeenCalledTimes(1);
    expect(input).toBeDisabled();
    expect(screen.getByText("\u0110ang \u0111\u1ecdc t\u1ec7p...")).toBeInTheDocument();

    resolveParse?.(workbook());
    await screen.findByRole("button", { name: /Phân tích/i });
    expect(screen.queryByText("\u0110ang \u0111\u1ecdc t\u1ec7p...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Thay/ }));
    const replacement = screen.getByLabelText(/CSV\/XLSX/i);
    fireEvent.change(replacement, { target: { files: [new File(["third"], "third.csv")] } });
    await waitFor(() => expect(mocks.parseWorkbook).toHaveBeenCalledTimes(2));
  });

  it("recovers the file control after a parsing failure", async () => {
    mocks.parseWorkbook.mockRejectedValueOnce(new Error("bad workbook"));
    render(<ImportWizard mascotLevel={1} />);

    const input = screen.getByLabelText(/CSV\/XLSX/i);
    fireEvent.change(input, { target: { files: [new File(["broken"], "broken.csv")] } });
    await screen.findByRole("alert");

    expect(input).not.toBeDisabled();
    mocks.parseWorkbook.mockResolvedValueOnce(workbook());
    fireEvent.change(input, { target: { files: [new File(["replacement"], "replacement.csv")] } });
    expect(await screen.findByRole("button", { name: /Phân tích/i })).toBeInTheDocument();
  });
});
