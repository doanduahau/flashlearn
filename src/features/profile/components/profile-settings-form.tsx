"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupportedTimezone, TIMEZONE_GROUPS } from "@/features/profile/constants/timezones";
import { LocalTimePreview } from "@/features/profile/components/local-time-preview";
import { updateProfile } from "@/features/profile/server/actions";
import { DEFAULT_TIMEZONE, PROFILE_DISPLAY_NAME_MAX_LENGTH } from "@/lib/constants";

export function ProfileSettingsForm({
  email,
  displayName,
  timezone,
  timezoneChangeAvailableAt = null,
  timezoneChangeCooldownHours = null,
}: Readonly<{
  email: string;
  displayName: string | null;
  timezone: string;
  timezoneChangeAvailableAt?: string | null;
  timezoneChangeCooldownHours?: number | null;
}>) {
  const [name, setName] = useState(displayName ?? "");
  const [zone, setZone] = useState(isSupportedTimezone(timezone) ? timezone : DEFAULT_TIMEZONE);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(timezoneChangeAvailableAt);
  const [cooldownHours, setCooldownHours] = useState(timezoneChangeCooldownHours);
  const [isPending, startTransition] = useTransition();

  function submit(): void {
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await updateProfile({ displayName: name, timezone: zone });
      if (!result.ok) {
        setError(result.error);
        if (result.timezoneChangeAvailableAt) {
          setCooldownUntil(result.timezoneChangeAvailableAt);
          setCooldownHours(result.timezoneChangeCooldownHours ?? null);
        }
        return;
      }
      setCooldownUntil(result.timezoneChangeAvailableAt);
      setCooldownHours(result.timezoneChangeCooldownHours);
      setSuccess("Đã lưu thay đổi.");
    });
  }

  const selectClass =
    "mt-1 block w-full rounded-xl border border-border-soft bg-surface px-3 py-2 text-base md:text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
  const cooldownActive = (cooldownHours ?? 0) > 0;
  const cooldownDate = cooldownUntil ? new Date(cooldownUntil) : null;

  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <section
        aria-labelledby="account-heading"
        className="rounded-2xl border border-border-soft bg-surface p-5"
      >
        <h2 id="account-heading" className="font-semibold">
          Thông tin tài khoản
        </h2>
        <div className="mt-4">
          <Label htmlFor="settings-email">Email</Label>
          <Input id="settings-email" className="mt-1" value={email} readOnly aria-readonly="true" />
          <p className="mt-1 text-xs text-text-secondary">Email không thể thay đổi.</p>
        </div>
      </section>

      <section
        aria-labelledby="profile-heading"
        className="rounded-2xl border border-border-soft bg-surface p-5"
      >
        <h2 id="profile-heading" className="font-semibold">
          Hồ sơ
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="settings-display-name">Tên hiển thị</Label>
            <Input
              id="settings-display-name"
              className="mt-1"
              value={name}
              maxLength={PROFILE_DISPLAY_NAME_MAX_LENGTH}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="mt-1 text-xs text-text-secondary">
              Để trống để sử dụng email làm tên hiển thị.
            </p>
          </div>
          <div>
            <Label htmlFor="settings-timezone">Múi giờ</Label>
            <select
              id="settings-timezone"
              className={selectClass}
              value={zone}
              disabled={cooldownActive}
              aria-describedby={
                cooldownActive
                  ? "settings-timezone-description settings-timezone-cooldown"
                  : "settings-timezone-description"
              }
              onChange={(event) => setZone(event.target.value)}
            >
              {TIMEZONE_GROUPS.map((group) => (
                <optgroup label={group.group} key={group.group}>
                  {group.options.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p id="settings-timezone-description" className="mt-1 text-xs text-text-secondary">
              Múi giờ này được dùng để tính chuỗi học và thống kê theo ngày.
            </p>
            {cooldownActive && cooldownDate ? (
              <p id="settings-timezone-cooldown" className="mt-2 text-xs text-text-secondary">
                Có thể đổi múi giờ lại sau khoảng {cooldownHours} giờ, vào{" "}
                {new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: zone,
                }).format(cooldownDate)}
                . Tên hiển thị vẫn có thể cập nhật.
              </p>
            ) : null}
          </div>
          <LocalTimePreview timezone={zone} />
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-success">
          {success}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Đang lưu…" : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
