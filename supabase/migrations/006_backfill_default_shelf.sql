-- Backfill default_shelf_id for existing users who have a TBR shelf
-- This fixes users who were created before the default_shelf_id column existed

update users
set default_shelf_id = shelves.id
from shelves
where shelves.user_id = users.phone_number
  and shelves.name = 'TBR'
  and users.default_shelf_id is null;
