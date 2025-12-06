-- Migration: Create auth triggers for user synchronization
-- Description: Automatically create/update users table records when auth.users changes

-- Function to handle new auth user signups
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  phone_to_link TEXT;
BEGIN
  -- Check if there's a pending phone verification for this email
  SELECT phone_number INTO phone_to_link
  FROM phone_verification_codes
  WHERE email = NEW.email
    AND is_used = false
    AND expires_at > NOW()
    AND purpose = 'account_claim'
  ORDER BY created_at DESC
  LIMIT 1;

  IF phone_to_link IS NOT NULL THEN
    -- User is claiming an existing phone-based account
    UPDATE users
    SET
      auth_id = NEW.id,
      email = NEW.email,
      account_created_at = NOW()
    WHERE phone_number = phone_to_link;

    -- Mark verification as pending (will be completed when code is verified)
    UPDATE phone_verification_codes
    SET auth_id = NEW.id
    WHERE phone_number = phone_to_link
      AND email = NEW.email
      AND is_used = false;
  ELSE
    -- New user without existing phone account
    -- Create a placeholder user record (will be completed in app)
    INSERT INTO users (
      phone_number,
      auth_id,
      email,
      has_started,
      account_created_at,
      created_at
    ) VALUES (
      'auth_' || NEW.id::TEXT, -- Temporary phone_number until real phone is linked
      NEW.id,
      NEW.email,
      true, -- Auth users are considered "started"
      NOW(),
      NOW()
    )
    ON CONFLICT (email) DO UPDATE
    SET
      auth_id = NEW.id,
      account_created_at = COALESCE(users.account_created_at, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle auth user updates
CREATE OR REPLACE FUNCTION handle_auth_user_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Update email if changed
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE users
    SET email = NEW.email
    WHERE auth_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle auth user deletion
CREATE OR REPLACE FUNCTION handle_auth_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Optionally preserve user data by just removing auth_id
  -- Or fully delete depending on requirements
  UPDATE users
  SET
    auth_id = NULL,
    email = NULL,
    username = NULL
  WHERE auth_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_update();

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_delete();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, service_role;
GRANT ALL ON auth.users TO postgres, service_role;

COMMENT ON FUNCTION handle_new_auth_user IS 'Creates or links users table record when new auth user signs up';
COMMENT ON FUNCTION handle_auth_user_update IS 'Updates users table when auth user email changes';
COMMENT ON FUNCTION handle_auth_user_delete IS 'Handles cleanup when auth user is deleted';