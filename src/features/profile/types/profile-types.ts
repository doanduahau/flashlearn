export interface ProfileSettingsData {
  email: string;
  displayName: string | null;
  timezone: string;
  timezoneChangeAvailableAt: string | null;
  timezoneChangeCooldownHours: number | null;
}
