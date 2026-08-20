begin;
select plan(13);

select is((select count(*)::integer from public.catalog_sets where is_starter), 3, 'exactly three starter sets exist');
select is((select count(*)::integer from public.catalog_cards where catalog_set_id = '20000000-0000-4000-8000-000000000001'), 50, 'fruit set has 50 cards');
select is((select count(*)::integer from public.catalog_cards where catalog_set_id = '20000000-0000-4000-8000-000000000002'), 50, 'animal set has 50 cards');
select is((select count(*)::integer from public.catalog_cards where catalog_set_id = '20000000-0000-4000-8000-000000000003'), 50, 'science-social set has 50 cards');
select is((select min(position) from public.catalog_cards where catalog_set_id = '20000000-0000-4000-8000-000000000001'), 0, 'fruit positions start at zero');
select is((select max(position) from public.catalog_cards where catalog_set_id = '20000000-0000-4000-8000-000000000001'), 49, 'fruit positions end at 49');
select is((select count(*)::integer from (select catalog_set_id, lower(btrim(front)), lower(btrim(back)), count(*) from public.catalog_cards where catalog_set_id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003') group by 1,2,3 having count(*) > 1) d), 0, 'no normalized duplicate cards');
select is((select count(*)::integer from public.catalog_cards where btrim(front) = '' or btrim(back) = ''), 0, 'no blank card side');
select is((select count(*)::integer from (select catalog_set_id from public.catalog_cards where catalog_set_id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003') group by catalog_set_id having count(*) = 50 and min(position) = 0 and max(position) = 49) positioned), 3, 'all starter positions are continuous from 0 to 49');
select is((select string_agg(slug, ',' order by starter_order) from public.catalog_sets where is_starter), 'tu-vung-trai-cay-vi-en,tu-vung-dong-vat-vi-en,khoa-hoc-xa-hoi-can-ban', 'starter order is deterministic');
select is((select count(*)::integer from public.catalog_sets where is_starter and status = 'published'), 3, 'all starter sets are published');
select is((select count(*)::integer from public.catalog_sets where id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002') and language_front = 'vi' and language_back = 'en'), 2, 'vocabulary orientation is Vietnamese to English');
select is((select count(*)::integer from public.catalog_cards where front ~ '<[^>]+>' or back ~ '<[^>]+>'), 0, 'starter content contains no HTML tags');

select * from finish();
rollback;
