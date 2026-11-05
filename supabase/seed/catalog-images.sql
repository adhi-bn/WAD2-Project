-- Points each Case, Keycap and Switch option at its picture in public/parts/.
-- Run after supabase/schema.sql and the catalogue import. Safe to run again.
-- The app falls back to /parts/<id>.png when a row has no image field, so this is optional.
update public.parts
set data = data || jsonb_build_object('image', '/parts/' || id || '.png')
where category_key in ('case', 'keycaps', 'switches');

-- Check: every row in those categories should show an image path.
select category_key, count(*) as parts, count(data->>'image') as with_image
from public.parts
group by category_key
order by category_key;
