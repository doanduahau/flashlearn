-- The browser must not be able to nominate arbitrary Smart Review targets.
-- Keep the explicit-card primitive private and expose this owner-explicit entry
-- point only to the server's service client.
revoke execute on function public.create_quiz_session_from_card_ids(uuid[]) from authenticated;

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

  -- The nested private primitive reads auth.uid(). Its only caller is this
  -- service-role function, so the user id comes from the authenticated server
  -- action rather than a browser-controlled RPC argument.
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return public.create_quiz_session_from_card_ids(p_card_ids);
end;
$$;

revoke all on function public.create_owned_quiz_session_from_card_ids(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_owned_quiz_session_from_card_ids(uuid, uuid[]) to service_role;
