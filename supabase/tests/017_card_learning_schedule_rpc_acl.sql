-- card_learning_schedule private CAS RPC ACL tests.

begin;

select plan(14);

-- fixtures ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'rpcacl.a@example.com', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.flashcard_sets (id, user_id, name)
values ('11111111-1111-1111-1111-1111111111aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set A');

insert into public.flashcards (id, user_id, set_id, front, back)
values ('22222222-2222-2222-2222-2222222222aa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-1111111111aa', 'A front', 'A back');

insert into public.card_review_events (id, user_id, flashcard_id, source, is_correct, reviewed_at)
values ('e0000000-0000-4000-8000-0000000000a1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-2222222222aa', 'smart_review', true, '2026-08-09 12:00:00+00');

-- RPC metadata ---------------------------------------------------------------

select has_function('public', 'upsert_card_learning_schedule',
  array['uuid','uuid','bigint','smallint','double precision','double precision','timestamptz','double precision','integer','integer','integer','timestamptz','bigint','timestamptz','uuid','text','text','text']);

select ok(
  (select prosecdef from pg_proc where proname = 'upsert_card_learning_schedule')
);

select ok(
  (select proconfig[1] = 'search_path=""' from pg_proc where proname = 'upsert_card_learning_schedule')
);

select is(
  has_function_privilege('service_role', 'public.upsert_card_learning_schedule(uuid,uuid,bigint,smallint,double precision,double precision,timestamptz,double precision,integer,integer,integer,timestamptz,bigint,timestamptz,uuid,text,text,text)', 'execute'),
  true,
  'service_role has execute privilege on the private projection RPC'
);
select is(
  has_function_privilege('authenticated', 'public.upsert_card_learning_schedule(uuid,uuid,bigint,smallint,double precision,double precision,timestamptz,double precision,integer,integer,integer,timestamptz,bigint,timestamptz,uuid,text,text,text)', 'execute'),
  false,
  'authenticated has no execute privilege on the private projection RPC'
);
select is(
  (
    select count(*)
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
    where p.oid = 'public.upsert_card_learning_schedule(uuid,uuid,bigint,smallint,double precision,double precision,timestamptz,double precision,integer,integer,integer,timestamptz,bigint,timestamptz,uuid,text,text,text)'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  0::bigint,
  'PUBLIC has no execute privilege on the private projection RPC'
);

-- ACL: PUBLIC denied ----------------------------------------------------------

set local role anon;

select throws_ok(
  $$select public.upsert_card_learning_schedule(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, (-1)::bigint, 1::smallint, 2.3065::double precision, 2.1181::double precision, '2026-08-09 12:10:00+00'::timestamptz, 0::double precision, 1, 1, 0, '2026-08-09 12:00:00+00'::timestamptz, 1::bigint, '2026-08-09 12:00:00+00'::timestamptz, 'e0000000-0000-4000-8000-0000000000a1'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1'
  )$$,
  '42501', NULL
);

-- ACL: authenticated denied --------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select throws_ok(
  $$select public.upsert_card_learning_schedule(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, (-1)::bigint, 1::smallint, 2.3065::double precision, 2.1181::double precision, '2026-08-09 12:10:00+00'::timestamptz, 0::double precision, 1, 1, 0, '2026-08-09 12:00:00+00'::timestamptz, 1::bigint, '2026-08-09 12:00:00+00'::timestamptz, 'e0000000-0000-4000-8000-0000000000a1'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1'
  )$$,
  '42501', NULL
);

-- service_role can execute ----------------------------------------------------

reset role;
set local role service_role;

select lives_ok(
  $$select public.upsert_card_learning_schedule(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '22222222-2222-2222-2222-2222222222aa'::uuid, (-1)::bigint, 1::smallint, 2.3065::double precision, 2.1181::double precision, '2026-08-09 12:10:00+00'::timestamptz, 0::double precision, 1, 1, 0, '2026-08-09 12:00:00+00'::timestamptz, 1::bigint, '2026-08-09 12:00:00+00'::timestamptz, 'e0000000-0000-4000-8000-0000000000a1'::uuid, 'fsrs-6', 'ts-fsrs@5.4.1', 'flashlearn-v1'
  )$$
);

reset role;

select is(
  (select state from public.card_learning_schedule where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  1::smallint
);

select is(
  (select algorithm from public.card_learning_schedule where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  'fsrs-6'
);

select is(
  (select implementation from public.card_learning_schedule where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  'ts-fsrs@5.4.1'
);

select is(
  (select parameter_set from public.card_learning_schedule where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  'flashlearn-v1'
);

select is(
  (select projection_revision from public.card_learning_schedule where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and flashcard_id = '22222222-2222-2222-2222-2222222222aa'),
  0::bigint
);

select * from finish();
rollback;
