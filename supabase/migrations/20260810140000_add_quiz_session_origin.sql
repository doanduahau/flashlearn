-- Quiz origin is durable context, not a quiz mode or scheduling field. Existing
-- sessions resolve to manual through the additive non-null default.
alter table public.quiz_sessions
  add column origin text not null default 'manual'
  check (origin in ('manual', 'smart_review'));

-- The insert trigger ignores caller-provided origin values. Only the restricted
-- server-side Smart Review wrapper sets the transaction-local value below;
-- ordinary quiz creation receives the safe manual default.
create or replace function public.set_quiz_session_origin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin text;
begin
  if tg_op = 'INSERT' then
    v_origin := coalesce(nullif(current_setting('flashlearn.quiz_session_origin', true), ''), 'manual');

    if v_origin not in ('manual', 'smart_review') then
      raise exception 'invalid quiz session origin' using errcode = '22023';
    end if;

    new.origin := v_origin;
    return new;
  end if;

  if new.origin is distinct from old.origin then
    raise exception 'quiz session origin is immutable' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists quiz_sessions_set_origin on public.quiz_sessions;
create trigger quiz_sessions_set_origin
  before insert or update on public.quiz_sessions
  for each row
  execute function public.set_quiz_session_origin();

-- Preserve the trusted Smart Review boundary. The outer function receives its
-- user id only from the authenticated server action and is the sole path that
-- can set the smart_review transaction value before creating an explicit quiz.
create or replace function public.create_owned_quiz_session_from_card_ids(
  p_user_id uuid,
  p_card_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('flashlearn.quiz_session_origin', 'smart_review', true);
  return public.create_quiz_session_from_card_ids(p_card_ids);
end;
$$;

-- Fail closed from this migration onward: neither the raw explicit-card
-- primitive nor the origin trigger function is browser callable.
revoke all on function public.set_quiz_session_origin() from public, anon, authenticated, service_role;
revoke all on function public.create_quiz_session_from_card_ids(uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.create_owned_quiz_session_from_card_ids(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_owned_quiz_session_from_card_ids(uuid, uuid[]) to service_role;
