-- Add default_shelf_id to users table (idempotent)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'users' and column_name = 'default_shelf_id'
  ) then
    alter table users
    add column default_shelf_id uuid references shelves(id) on delete set null;
  end if;
end $$;

-- Index for performance on shelf page load
create index if not exists idx_users_default_shelf on users(default_shelf_id);

-- Unique constraint for idempotent TBR creation
create unique index if not exists idx_shelves_user_name on shelves(user_id, name);
