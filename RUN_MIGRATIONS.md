# Database Migration Instructions

Your authentication flow is working, but you need to apply the missing database migrations to enable full functionality.

## Migrations to Apply

The following migrations need to be run on your Supabase database:

1. `007_add_auth_to_users.sql` - Adds authentication fields to the users table
2. `008_add_shelf_privacy.sql` - Adds shelf privacy settings
3. `009_create_auth_sessions.sql` - Creates auth session tracking table
4. `010_create_phone_verification.sql` - Creates phone verification system
5. `011_create_auth_triggers.sql` - Creates database triggers for auth

## How to Apply Migrations

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. For each migration file in order:
   - Open the file from `supabase/migrations/`
   - Copy the entire SQL content
   - Paste into the SQL Editor
   - Click "Run"
   - Verify success before proceeding to next migration

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref [your-project-ref]

# Apply migrations
supabase db push
```

## Important Notes

- **Run migrations in order** - Each migration may depend on the previous one
- **Start with 007** - Earlier migrations (001-006) should already be applied
- **Check for errors** - If a migration fails, fix the issue before proceeding

## After Running Migrations

Once all migrations are applied:

1. The authentication flow will work completely
2. Users can claim their shelf with email + phone verification
3. Username selection will be available
4. The `auth_id` column error will be resolved

## Current Status

The AuthHandler component has been updated to handle the missing `auth_id` column gracefully, so the app will work even before migrations are applied. However, full functionality requires the migrations.