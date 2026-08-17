export interface NotificationPreferences {
  user_id?: string;
  push_enabled: boolean;
  streak_enabled: boolean;
  streak_time: string;
  review_enabled: boolean;
  review_time: string;
  updated_at?: string;
}
