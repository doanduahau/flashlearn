import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationSettings } from "@/features/notifications/components/notification-settings";
import {
  deletePushSubscription,
  saveNotificationPreferences,
  savePushSubscription,
} from "@/features/notifications/server/actions";

vi.mock("@/features/notifications/server/actions", () => ({
  saveNotificationPreferences: vi.fn(),
  savePushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
}));

describe("NotificationSettings Component", () => {
  const dummyVapidKey =
    "BBjAvYx8Ur4nE26SIcMLTlIcbO2QBQFp5Bs-QXPoKH8NYRJUZSl0bualUDrosubTuhFAVVDCaMBT_6G5yxcHcdQ";

  const mockSubscribe = vi.fn();
  const mockUnsubscribe = vi.fn();
  const mockGetSubscription = vi.fn();
  const mockGetRegistration = vi.fn();
  const mockRequestPermission = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(saveNotificationPreferences).mockResolvedValue({ ok: true });
    vi.mocked(savePushSubscription).mockResolvedValue({ ok: true });
    vi.mocked(deletePushSubscription).mockResolvedValue({ ok: true });

    mockSubscribe.mockResolvedValue({
      toJSON: () => ({
        endpoint: "https://push.example.com/sub-1",
        keys: { p256dh: "key-p256", auth: "key-auth" },
      }),
      unsubscribe: mockUnsubscribe,
    });

    mockGetSubscription.mockResolvedValue(null);

    mockGetRegistration.mockResolvedValue({
      pushManager: {
        getSubscription: mockGetSubscription,
        subscribe: mockSubscribe,
      },
    });

    mockRequestPermission.mockResolvedValue("granted");

    // Setup browser mocks
    Object.defineProperty(window, "Notification", {
      writable: true,
      configurable: true,
      value: {
        permission: "default",
        requestPermission: mockRequestPermission,
      },
    });

    Object.defineProperty(window, "PushManager", {
      writable: true,
      configurable: true,
      value: class MockPushManager {},
    });

    Object.defineProperty(navigator, "serviceWorker", {
      writable: true,
      configurable: true,
      value: {
        getRegistration: mockGetRegistration,
        register: vi.fn().mockResolvedValue({
          pushManager: {
            getSubscription: mockGetSubscription,
            subscribe: mockSubscribe,
          },
        }),
      },
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders disabled state when browser does not support push notifications", () => {
    delete (window as unknown as Record<string, unknown>).PushManager;
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;

    render(<NotificationSettings prefs={null} vapidPublicKey={dummyVapidKey} />);

    expect(screen.getByText(/Trình duyệt không hỗ trợ/i)).toBeInTheDocument();
    const masterToggle = screen.getByRole("switch");
    expect(masterToggle).toBeDisabled();
  });

  it("requests permission, subscribes, and saves preferences when turning master toggle ON", async () => {
    render(<NotificationSettings prefs={null} vapidPublicKey={dummyVapidKey} />);

    const masterToggle = screen.getByRole("switch");
    expect(masterToggle).not.toBeChecked();

    fireEvent.click(masterToggle);

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalled();
      expect(savePushSubscription).toHaveBeenCalledWith({
        endpoint: "https://push.example.com/sub-1",
        p256dh: "key-p256",
        auth: "key-auth",
        userAgent: expect.any(String),
      });
      expect(saveNotificationPreferences).toHaveBeenCalledWith({
        pushEnabled: true,
        streakEnabled: true,
        streakTime: "19:00",
        reviewEnabled: true,
        reviewTime: "19:00",
      });
    });

    expect(masterToggle).toBeChecked();
  });

  it("shows error message when notification permission is denied", async () => {
    mockRequestPermission.mockResolvedValue("denied");

    render(<NotificationSettings prefs={null} vapidPublicKey={dummyVapidKey} />);

    const masterToggle = screen.getByRole("switch");
    fireEvent.click(masterToggle);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Quyền thông báo bị từ chối/i);
    });
  });

  it("unsubscribes and deletes subscription when turning master toggle OFF", async () => {
    const activeSub = {
      unsubscribe: mockUnsubscribe.mockResolvedValue(true),
    };
    mockGetSubscription.mockResolvedValue(activeSub);

    render(
      <NotificationSettings
        prefs={{
          push_enabled: true,
          streak_enabled: true,
          streak_time: "19:00",
          review_enabled: true,
          review_time: "19:00",
        }}
        vapidPublicKey={dummyVapidKey}
      />,
    );

    const masterToggle = screen.getByRole("switch");
    expect(masterToggle).toBeChecked();

    fireEvent.click(masterToggle);

    await waitFor(() => {
      expect(deletePushSubscription).toHaveBeenCalled();
      expect(saveNotificationPreferences).toHaveBeenCalledWith({
        pushEnabled: false,
        streakEnabled: true,
        streakTime: "19:00",
        reviewEnabled: true,
        reviewTime: "19:00",
      });
    });

    expect(masterToggle).not.toBeChecked();
  });

  it("saves preferences when changing child streak time picker", async () => {
    render(
      <NotificationSettings
        prefs={{
          push_enabled: true,
          streak_enabled: true,
          streak_time: "19:00",
          review_enabled: true,
          review_time: "19:00",
        }}
        vapidPublicKey={dummyVapidKey}
      />,
    );

    const streakTimeInput = screen.getByLabelText("Giờ nhắc giữ streak");
    fireEvent.change(streakTimeInput, { target: { value: "21:30" } });

    await waitFor(() => {
      expect(saveNotificationPreferences).toHaveBeenCalledWith({
        pushEnabled: true,
        streakEnabled: true,
        streakTime: "21:30",
        reviewEnabled: true,
        reviewTime: "19:00",
      });
    });
  });

  it("displays iOS PWA banner when on iOS and non-standalone display mode", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)",
      configurable: true,
    });

    render(<NotificationSettings prefs={null} vapidPublicKey={dummyVapidKey} />);

    expect(screen.getByTestId("ios-pwa-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/Cài app lên màn hình chính để nhận thông báo \(iOS 16\.4\+\)/i),
    ).toBeInTheDocument();
  });
});
