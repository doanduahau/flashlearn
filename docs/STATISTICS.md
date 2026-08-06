# Learning statistics and daily streaks

A local day is active only when a quiz session is completed. The date is calculated from `quiz_sessions.completed_at` in `profiles.timezone`; invalid or missing values safely use `Asia/Ho_Chi_Minh`. Multiple quizzes on the same local day count once.

Current streak ends today when active, otherwise yesterday when active, and stops at the first missing day. Longest streak is the largest consecutive active-day run. Statistics include completed quizzes, questions, correct answers, rounded accuracy, 30-day activity, mode breakdown and recent results. Empty accounts return zero values and no activity. All values are derived by a read-only, authenticated RPC so streak/statistics extensions can reuse completed snapshots without storing analytics duplicates.
