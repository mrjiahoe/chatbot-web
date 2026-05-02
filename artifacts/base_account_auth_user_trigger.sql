ALTER TABLE public.base_account
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_base_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_username TEXT;
  resolved_username TEXT;
  uid_suffix TEXT;
BEGIN
  uid_suffix := SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8);
  requested_username := LOWER(
    REGEXP_REPLACE(
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'username', ''),
        SPLIT_PART(COALESCE(NEW.email, 'user@example.com'), '@', 1)
      ),
      '[^a-zA-Z0-9_]',
      '',
      'g'
    )
  );

  IF requested_username IS NULL OR requested_username = '' THEN
    requested_username := 'user_' || uid_suffix;
  END IF;

  resolved_username := LEFT(requested_username, 225);

  IF EXISTS (
    SELECT 1
    FROM public.base_account
    WHERE username = resolved_username
  ) THEN
    resolved_username := LEFT(requested_username, 216) || '_' || uid_suffix;
  END IF;

  INSERT INTO public.base_account (
    id,
    auth_user_id,
    password,
    last_login,
    username,
    smart_card_no,
    email,
    terms_and_conditions,
    is_admin,
    is_active,
    is_staff,
    is_superuser,
    is_teacher,
    is_ra,
    is_principal,
    account_date,
    date_of_birth,
    school_level_id,
    school_name_id,
    cluster_id,
    is_cluster_head,
    is_management,
    pin,
    preschool,
    "primary",
    secondary,
    sixth_form
  )
  VALUES (
    LEFT('acct_' || REPLACE(NEW.id::text, '-', ''), 32),
    NEW.id,
    'supabase_auth_managed',
    NEW.last_sign_in_at,
    resolved_username,
    NULL,
    COALESCE(NEW.email, ''),
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    FALSE,
    COALESCE(NEW.created_at, NOW()),
    NULL,
    NULL,
    NULL,
    NULL,
    FALSE,
    FALSE,
    NULL,
    FALSE,
    FALSE,
    FALSE,
    FALSE
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_base_account ON auth.users;

CREATE TRIGGER on_auth_user_created_base_account
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user_base_account();
