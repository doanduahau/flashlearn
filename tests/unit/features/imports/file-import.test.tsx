import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/imports/components/import-wizard", () => ({
  ImportWizard: ({ initialFile }: { initialFile?: File }) => (
    <div data-testid="import-wizard">{initialFile?.name}</div>
  ),
}));
vi.mock("@/features/imports/components/document-import", () => ({
  DocumentImport: ({ initialFile }: { initialFile?: File }) => (
    <div data-testid="document-import">{initialFile?.name}</div>
  ),
}));

import { FileImport } from "@/features/imports/components/file-import";

describe("FileImport", () => {
  it("renders a single file input accepting spreadsheet and document types", () => {
    render(<FileImport mascotLevel={1} planTier="free" />);

    const input = screen.getByLabelText(/CSV\/XLSX/i) as HTMLInputElement;
    expect(input.type).toBe("file");
    expect(input.accept).toContain(".xlsx");
    expect(input.accept).toContain(".csv");
    expect(input.accept).toContain(".docx");
    expect(input.accept).toContain(".pdf");
  });

  it("delegates spreadsheet files to the excel wizard", async () => {
    const user = userEvent.setup();
    render(<FileImport mascotLevel={1} planTier="free" />);

    await user.upload(screen.getByLabelText(/CSV\/XLSX/i), new File(["data"], "cards.csv"));
    expect(screen.getByTestId("import-wizard")).toHaveTextContent("cards.csv");
  });

  it("delegates document files to the document extractor", async () => {
    const user = userEvent.setup();
    render(<FileImport mascotLevel={1} planTier="free" />);

    await user.upload(screen.getByLabelText(/CSV\/XLSX/i), new File(["data"], "notes.pdf"));
    expect(screen.getByTestId("document-import")).toHaveTextContent("notes.pdf");
  });
});
