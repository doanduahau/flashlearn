-- Keep ownership and ordering fields behind the authenticated RPC boundary.
-- Browser clients may rename a set and edit card text, but cannot bypass
-- import_flashcard_set/add_flashcard by creating records or choosing owners,
-- sets, or positions themselves.

revoke insert on table public.flashcard_sets from authenticated;
revoke update on table public.flashcard_sets from authenticated;
grant update (name) on table public.flashcard_sets to authenticated;

revoke insert on table public.flashcards from authenticated;
revoke update on table public.flashcards from authenticated;
grant update (front, back) on table public.flashcards to authenticated;
