# Learning statistics and daily streaks

A local day is active only when a quiz session is completed. At completion, the authenticated
answer RPC reads the saved `profiles.timezone` (falling back safely to `Asia/Ho_Chi_Minh`) and
snapshots the resulting local date and timezone to `daily_learning_records`. Multiple quizzes on
the same local day increment one record and count as one active day.

Users can change their timezone on `/profile?tab=settings`, at most once every 72 hours. The cooldown
is enforced by the database clock and the UI shows the next permitted time; a display-name-only save
remains available. Past `daily_learning_records` are never recalculated, so a timezone change does
not add, remove or move historical streak days. The new timezone applies to quiz completions after
the saved change.

Current streak ends today when active, otherwise yesterday when active, and stops at the first missing
day. Longest streak is the largest consecutive active-day run. Statistics include completed quizzes,
questions, correct answers, rounded accuracy, 30-day activity, mode breakdown and recent results.
Empty accounts return zero values and no activity. The read-only authenticated RPC uses immutable daily
records for activity/streaks and completed quiz snapshots for quiz totals and history.
