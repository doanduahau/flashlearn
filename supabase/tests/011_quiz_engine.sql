begin;
select plan(18);

insert into auth.users (instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','aaaaaaaa-1111-1111-1111-111111111111','authenticated','authenticated','quiz.a@example.com',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','bbbbbbbb-1111-1111-1111-111111111111','authenticated','authenticated','quiz.b@example.com',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into public.flashcard_sets(id,user_id,name) values ('11111111-aaaa-aaaa-aaaa-111111111111','aaaaaaaa-1111-1111-1111-111111111111','Quiz A'),('22222222-bbbb-bbbb-bbbb-222222222222','bbbbbbbb-1111-1111-1111-111111111111','Quiz B');
insert into public.flashcards(id,user_id,set_id,front,back,position)
select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'aaaaaaaa-1111-1111-1111-111111111111','11111111-aaaa-aaaa-aaaa-111111111111', 'Prompt '||n, 'Answer '||n, n-1 from generate_series(1,12) n;

set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-1111-1111-1111-111111111111';
select lives_ok($$select public.create_quiz_session('balanced', array['11111111-aaaa-aaaa-aaaa-111111111111']::uuid[], '{}'::uuid[], false, 10)$$,'authenticated session creation succeeds');
select is((select count(*) from public.quiz_sessions),1::bigint,'one session is created');
select is((select count(*) from public.quiz_questions),10::bigint,'ten unique question snapshots are created');
select is((select min(position) from public.quiz_questions),0,'positions begin at zero');
select is((select max(position) from public.quiz_questions),9,'positions are deterministic');
select is((select count(distinct flashcard_id) from public.quiz_questions),10::bigint,'cards are deduplicated in a session');
select ok((select bool_and(jsonb_array_length(choices) between 2 and 4) from public.quiz_questions),'choices obey count constraint');
select throws_ok($$select public.create_quiz_session('balanced', array['11111111-aaaa-aaaa-aaaa-111111111111']::uuid[], '{}'::uuid[], false, 0)$$,'22023','invalid quiz request','minimum question count is enforced');
select throws_ok($$select public.create_quiz_session('balanced', array['22222222-bbbb-bbbb-bbbb-222222222222']::uuid[], '{}'::uuid[], false, 10)$$,'22023','source not found','foreign source is non-disclosing');
select throws_ok($$select public.create_quiz_session('balanced', '{}'::uuid[], '{}'::uuid[], false, 10)$$,'22023','invalid quiz request','empty custom source is rejected');
select lives_ok($$select public.submit_quiz_answer((select id from public.quiz_questions order by position limit 1),0)$$,'answer is accepted once');
select lives_ok($$select public.submit_quiz_answer((select id from public.quiz_questions order by position limit 1),0)$$,'an exact transport retry returns the existing answer');
select set_config('quiz.test_question_id',(select id::text from public.quiz_questions order by position limit 1),false);
set local request.jwt.claim.sub='bbbbbbbb-1111-1111-1111-111111111111';
select is((select count(*) from public.quiz_sessions),0::bigint,'RLS hides another user sessions');
select throws_ok($$select public.submit_quiz_answer(current_setting('quiz.test_question_id')::uuid,0)$$,'22023','question not found','foreign answer is non-disclosing');
reset role;
set local role anon;
select throws_ok($$select public.create_quiz_session('balanced','{}','{}',true,10)$$,'42501','permission denied for function create_quiz_session','anonymous session creation is denied');
select throws_ok($$select public.submit_quiz_answer('00000000-0000-0000-0000-000000000001',0)$$,'42501','permission denied for function submit_quiz_answer','anonymous answer is denied');
reset role;
select is((select has_table_privilege('authenticated','public.quiz_sessions','insert')),false,'direct session insert is denied');
select is((select has_table_privilege('authenticated','public.quiz_questions','update')),false,'direct question updates are denied');
select * from finish();
rollback;
