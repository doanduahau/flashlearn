import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { installCatalogSet, push } = vi.hoisted(() => ({
  installCatalogSet: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/features/catalog/server/actions", () => ({ installCatalogSet }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { InstallCatalogButton } from "@/features/catalog/components/install-catalog-button";

describe("InstallCatalogButton", () => {
  it("shows an existing installation as an accessible open link", () => {
    render(<InstallCatalogButton catalogSetId="catalog" installedSetId="owned" />);
    expect(screen.getByRole("link", { name: "Mở bộ" })).toHaveAttribute("href", "/sets/owned");
  });

  it("disables repeated clicks while install is pending", async () => {
    installCatalogSet.mockReturnValue(new Promise(() => undefined));
    render(<InstallCatalogButton catalogSetId="catalog" installedSetId={null} />);
    const button = screen.getByRole("button", { name: "Thêm vào bộ của bạn" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(installCatalogSet).toHaveBeenCalledTimes(1);
  });

  it("keeps the page and renders an inline action error", async () => {
    installCatalogSet.mockResolvedValue({ ok: false, error: "Đã đạt giới hạn." });
    render(<InstallCatalogButton catalogSetId="catalog" installedSetId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào bộ của bạn" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Đã đạt giới hạn.");
    expect(push).not.toHaveBeenCalled();
  });
});
