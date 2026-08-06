# Learning statistics and daily streaks

A local day is active only when a quiz session is completed. The date is calculated from `quiz_sessions.completed_at` in `profiles.timezone`; invalid or missing values safely use `Asia/Ho_Chi_Minh`. Multiple quizzes on the same local day count once.

Users can change their timezone on `/settings`. Because the statistics RPC reads `profiles.timezone` on every call, a saved timezone change immediately affects the streak boundaries, the "today" flag and the 30-day calendar: a quiz completed near a timezone boundary may fall on a different local date. The settings page revalidates `/statistics` and `/dashboard` after saving, so the updated numbers render on the next navigation.

Current streak ends today when active, otherwise yesterday when active, and stops at the first missing day. Longest streak is the largest consecutive active-day run. Statistics include completed quizzes, questions, correct answers, rounded accuracy, 30-day activity, mode breakdown and recent results. Empty accounts return zero values and no activity. All values are derived by a read-only, authenticated RPC so streak/statistics extensions can reuse completed snapshots without storing analytics duplicates.
