-- Add new_cards origin for the New Cards learning flow.
-- The trigger is updated to accept the new value; a dedicated service-role
-- wrapper sets the transaction-local config before creating the session.

alter table public.quiz_sessions
  drop constraint if exists quiz_sessions_origin_check;

alter table public.quiz_sessions
  add constraint quiz_sessions_origin_check
    check (origin in ('manual', 'smart_review', 'new_cards'));

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

    if v_origin not in ('manual', 'smart_review', 'new_cards') then
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

create or replace function public.create_owned_quiz_session_from_card_ids_new_cards(
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
  perform set_config('flashlearn.quiz_session_origin', 'new_cards', true);
  return public.create_quiz_session_from_card_ids(p_card_ids);
end;
$$;

revoke all on function public.create_owned_quiz_session_from_card_ids_new_cards(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_owned_quiz_session_from_card_ids_new_cards(uuid, uuid[]) to service_role;
