-- Stores the last suggested book for a user to support the SMS 'ADD' command
create table if not exists sms_context (
  phone_number text primary key,
  last_isbn13 text not null,
  last_title text,
  updated_at timestamp with time zone default now()
);

create index if not exists idx_sms_context_updated_at on sms_context(updated_at desc);
