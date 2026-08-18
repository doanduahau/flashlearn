import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn() as Mock,
}));

vi.mock("@/features/profile/server/actions", () => ({
  updateProfile: mocks.updateProfile,
}));

import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";

const PROPS = {
  email: "user@example.com",
  displayName: "Nguyễn Văn A",
  timezone: "Asia/Ho_Chi_Minh",
};

describe("ProfileSettingsForm", () => {
  beforeEach(() => {
    mocks.updateProfile.mockReset();
    mocks.updateProfile.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the email as read-only with an accessible label", () => {
    render(<ProfileSettingsForm {...PROPS} />);
    const email = screen.getByLabelText("Email");
    expect(email).toHaveValue("user@example.com");
    expect(email).toHaveAttribute("readonly");
    expect(email).toHaveAttribute("aria-readonly", "true");
  });

  it("provides accessible labels for the editable fields", () => {
    render(<ProfileSettingsForm {...PROPS} />);
    expect(screen.getByLabelText("Tên hiển thị")).toBeInTheDocument();
    expect(screen.getByLabelText("Múi giờ")).toBeInTheDocument();
  });

  it("prefills the current display name and timezone", () => {
    render(<ProfileSettingsForm {...PROPS} />);
    expect(screen.getByLabelText("Tên hiển thị")).toHaveValue("Nguyễn Văn A");
    expect(screen.getByLabelText("Múi giờ")).toHaveValue("Asia/Ho_Chi_Minh");
  });

  it("submits the display name and timezone and reports success", async () => {
    const user = userEvent.setup();
    render(<ProfileSettingsForm {...PROPS} />);

    const name = screen.getByLabelText("Tên hiển thị");
    await user.clear(name);
    await user.type(name, "Tên mới");
    await user.selectOptions(screen.getByLabelText("Múi giờ"), "Europe/Paris");
    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/ }));

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        displayName: "Tên mới",
        timezone: "Europe/Paris",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu thay đổi.");
  });

  it("allows a blank optional display name", async () => {
    const user = userEvent.setup();
    render(<ProfileSettingsForm {...PROPS} />);

    await user.clear(screen.getByLabelText("Tên hiển thị"));
    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/ }));

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        displayName: "",
        timezone: "Asia/Ho_Chi_Minh",
      }),
    );
  });

  it("shows the database-provided timezone cooldown while still allowing a display-name update", async () => {
    const user = userEvent.setup();
    render(
      <ProfileSettingsForm
        {...PROPS}
        timezoneChangeAvailableAt="2026-08-09T00:00:00.000Z"
        timezoneChangeCooldownHours={72}
      />,
    );

    expect(screen.getByLabelText("Múi giờ")).toBeDisabled();
    expect(screen.getByText(/Có thể đổi múi giờ lại sau khoảng 72 giờ/)).toBeInTheDocument();

    const name = screen.getByLabelText("Tên hiển thị");
    await user.clear(name);
    await user.type(name, "Tên mới trong cooldown");
    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/ }));

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        displayName: "Tên mới trong cooldown",
        timezone: "Asia/Ho_Chi_Minh",
      }),
    );
  });

  it("keeps a cooldown error structured and visible after a rejected timezone change", async () => {
    mocks.updateProfile.mockResolvedValue({
      ok: false,
      code: "timezone_change_cooldown",
      error: "Bạn chỉ có thể thay đổi múi giờ mỗi 72 giờ.",
      timezoneChangeAvailableAt: "2099-01-01T00:00:00.000Z",
      timezoneChangeCooldownHours: 72,
    });
    const user = userEvent.setup();
    render(<ProfileSettingsForm {...PROPS} />);

    await user.selectOptions(screen.getByLabelText("Múi giờ"), "Europe/Paris");
    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bạn chỉ có thể thay đổi múi giờ mỗi 72 giờ.",
    );
    expect(screen.getByLabelText("Múi giờ")).toBeDisabled();
    expect(screen.getByText(/Có thể đổi múi giờ lại sau/)).toBeInTheDocument();
  });

  it("keeps entered values and shows the error on a recoverable failure", async () => {
    mocks.updateProfile.mockResolvedValue({
      ok: false,
      error: "Không tìm thấy hồ sơ.",
    });
    const user = userEvent.setup();
    render(<ProfileSettingsForm {...PROPS} />);

    const name = screen.getByLabelText("Tên hiển thị");
    await user.clear(name);
    await user.type(name, "Tên giữ nguyên");
    await user.click(screen.getByRole("button", { name: /Lưu thay đổi/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy hồ sơ.");
    expect(screen.getByLabelText("Tên hiển thị")).toHaveValue("Tên giữ nguyên");
    expect(screen.getByLabelText("Múi giờ")).toHaveValue("Asia/Ho_Chi_Minh");
  });

  it("disables the submit button while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.updateProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ProfileSettingsForm {...PROPS} />);

    const submit = screen.getByRole("button", { name: /Lưu thay đổi/ });
    await user.click(submit);
    expect(screen.getByRole("button", { name: /Đang lưu/ })).toBeDisabled();
    expect(mocks.updateProfile).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: /Lưu thay đổi/ })).toBeEnabled());
  });

  it("updates the local-time preview when the timezone changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T00:00:00Z"));
    render(<ProfileSettingsForm {...PROPS} />);

    expect(screen.getByText(/Giờ địa phương ở Asia\/Ho_Chi_Minh/)).toHaveTextContent(
      "06/08/2026 07:00",
    );
    fireEvent.change(screen.getByLabelText("Múi giờ"), {
      target: { value: "Pacific/Pago_Pago" },
    });
    expect(screen.getByText(/Giờ địa phương ở Pacific\/Pago_Pago/)).toHaveTextContent(
      "05/08/2026 13:00",
    );
  });
});
