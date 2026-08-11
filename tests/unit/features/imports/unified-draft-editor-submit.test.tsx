import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { UnifiedDraftEditor } from "@/features/imports/components/unified-draft-editor";

describe("UnifiedDraftEditor import submission", () => {
  it("blocks a same-tick double submit and recovers after a failed import", async () => {
    let rejectImport: ((reason?: unknown) => void) | undefined;
    const onImport = vi.fn(
      () =>
        new Promise<{ setId: string }>((_resolve, reject) => {
          rejectImport = reject;
        }),
    );
    render(
      <UnifiedDraftEditor
        sourceCards={[{ front: "Question", back: "Answer" }]}
        onImport={onImport}
      />,
    );

    fireEvent.change(document.querySelector("#unified-set-name")!, {
      target: { value: "Reliable import" },
    });
    const submit = screen.getByRole("button", { name: /flashcard/i });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();

    rejectImport?.(new Error("network failure"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(submit).not.toBeDisabled();

    onImport.mockResolvedValueOnce({ setId: "11111111-1111-4111-8111-111111111111" });
    fireEvent.click(submit);
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(2));
  });
});
