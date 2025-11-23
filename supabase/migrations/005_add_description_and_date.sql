-- Add description and publication_date to books table
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'books' and column_name = 'description'
  ) then
    alter table books
    add column description text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'books' and column_name = 'publication_date'
  ) then
    alter table books
    add column publication_date text;
  end if;
end $$;
