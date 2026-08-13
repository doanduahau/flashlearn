begin;
select plan(19);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'authenticated', 'authenticated', 'runner.a@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'authenticated', 'authenticated', 'runner.b@example.com', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.flashcard_sets (id, user_id, name) values
  ('a1a1a1a1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'Runner source set'),
  ('a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'Runner other set'),
  ('b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'Runner B set');

insert into public.flashcards (id, user_id, set_id, front, back) values
  ('ca000001-c2c2-4000-8000-000000000001', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a1a1a1a1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F1', '  Solo  '),
  ('ca000002-c2c2-4000-8000-000000000002', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a1a1a1a1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F2', 'SOLO'),
  ('ca000003-c2c2-4000-8000-000000000003', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F3', 'Beta'),
  ('ca000004-c2c2-4000-8000-000000000004', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F4', 'GAMMA'),
  ('ca000005-c2c2-4000-8000-000000000005', 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'a2a2a2a2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'F5', 'delta'),
  ('cb000001-c2c2-4000-8000-000000000001', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF1', 'Only'),
  ('cb000002-c2c2-4000-8000-000000000002', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF2', 'Other'),
  ('cb000003-c2c2-4000-8000-000000000003', 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b1b1b1b1-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'BF3', '  ONLY ');

-- Unauthenticated invocation fails closed.
set local role anon;
select throws_ok(
  $$select * from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid])$$,
  '42501',
  NULL,
  'anonymous candidate load is denied'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-c2c2-c2c2-c2c2-c2c2c2c2c2c2';

select is(
  (select eligible from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  true,
  'own card with two distinct wrong answers is eligible'
);
select is(
  (select front from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  'F1',
  'question front is returned'
);
select is(
  (select correct_answer from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  '  Solo  ',
  'correct answer is the original back text'
);

-- Whole-library distractor expansion: the question card lives in set A1, but its
-- only distinct wrong answers are in set A2.
select is(
  (select distractor_1 from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001') in ('Beta', 'GAMMA', 'delta'),
  true,
  'first distractor is drawn from another set owned by the same user'
);
select is(
  (select distractor_2 from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001') in ('Beta', 'GAMMA', 'delta'),
  true,
  'second distractor is drawn from another set owned by the same user'
);

-- Canonical normalization: no distractor equals the normalized correct answer,
-- and the two distractors are distinct after the same normalization.
select is(
  (select bool_and(lower(regexp_replace(btrim(d.value), '\s+', ' ', 'g')) <> 'solo')
   from (
     select distractor_1 as value from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'
     union all
     select distractor_2 from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'
   ) d),
  true,
  'no distractor equals the normalized correct answer'
);
select is(
  (select lower(regexp_replace(btrim(distractor_1), '\s+', ' ', 'g')) from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001')
  <>
  (select lower(regexp_replace(btrim(distractor_2), '\s+', ' ', 'g')) from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  true,
  'two distractors are distinct after canonical normalization'
);
select is(
  (select count(distinct n)::integer from (
     select lower(regexp_replace(btrim(correct_answer), '\s+', ' ', 'g')) as n from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'
     union all
     select lower(regexp_replace(btrim(distractor_1), '\s+', ' ', 'g')) from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'
     union all
     select lower(regexp_replace(btrim(distractor_2), '\s+', ' ', 'g')) from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'
   ) v),
  3,
  'exactly three distinct answer values are constructible'
);

-- Deterministic selection for identical database state.
select is(
  (select distractor_1 from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  (select distractor_1 from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  'first distractor is stable across invocations'
);
select is(
  (select distractor_2 from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  (select distractor_2 from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'ca000001-c2c2-4000-8000-000000000001'),
  'second distractor is stable across invocations'
);

-- Foreign card must not leak.
set local request.jwt.claim.sub = 'bbbbbbbb-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
select is(
  (select count(*)::integer from public.load_runner_candidates(array['ca000001-c2c2-4000-8000-000000000001'::uuid])),
  0,
  'foreign card is not disclosed'
);

-- Insufficient account-wide distractors are exposed as ineligible.
select is(
  (select eligible from public.load_runner_candidates(array['cb000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'cb000001-c2c2-4000-8000-000000000001'),
  false,
  'card with a single distinct wrong answer is ineligible'
);
select is(
  (select distractor_2 from public.load_runner_candidates(array['cb000001-c2c2-4000-8000-000000000001'::uuid]) where flashcard_id = 'cb000001-c2c2-4000-8000-000000000001'),
  NULL,
  'ineligible card has a null second distractor'
);
select is(
  (select eligible from public.load_runner_candidates(array['cb000002-c2c2-4000-8000-000000000002'::uuid]) where flashcard_id = 'cb000002-c2c2-4000-8000-000000000002'),
  false,
  'card whose only other answer normalizes to itself is ineligible'
);
select is(
  (select eligible from public.load_runner_candidates(array['cb000003-c2c2-4000-8000-000000000003'::uuid]) where flashcard_id = 'cb000003-c2c2-4000-8000-000000000003'),
  false,
  'duplicate-normalized card is ineligible'
);

-- The read model is side-effect free.
reset role;
select is((select count(*)::integer from public.quiz_sessions), 0, 'candidate load creates no quiz session');
select is((select count(*)::integer from public.learning_coverage_sessions), 0, 'candidate load creates no coverage session');
select is((select count(*)::integer from public.flashcard_coverage), 0, 'candidate load writes no coverage');

select * from finish();
rollback;
