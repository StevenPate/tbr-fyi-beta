-- Users table for tracking consent and onboarding status
-- Run this in Supabase SQL Editor

create table if not exists users (
  phone_number text primary key,
  has_started boolean default false,
  opted_out boolean default false,
  created_at timestamp default now(),
  started_at timestamp,
  opted_out_at timestamp
);

-- Index for quick lookups (though primary key already provides this)
create index if not exists idx_users_phone on users(phone_number);

-- Index for filtering active users
create index if not exists idx_users_active on users(has_started, opted_out) where has_started = true and opted_out = false;

-- Add helpful comment
comment on table users is 'Tracks user consent, onboarding status, and opt-out preferences. phone_number matches user_id in books table.';
comment on column users.has_started is 'True after user sends START command, allows them to add books';
comment on column users.opted_out is 'True after user sends STOP command, blocks further processing';
