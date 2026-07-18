-- Demo users (password: password123)
-- Safe to re-run: updates profile if user already exists.

CREATE OR REPLACE FUNCTION public.seed_demo_user(
  p_email text,
  p_password text,
  p_name text,
  p_role text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
      SET name = p_name, role = p_role, email = p_email, updated_at = now()
      WHERE id = v_user_id;
    RETURN v_user_id;
  END IF;

  v_user_id := gen_random_uuid();
  v_encrypted := crypt(p_password, gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted,
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('name', p_name, 'role', p_role),
    now(), now(),
    '', '', '', '',
    false, false
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (v_user_id, p_email, p_name, p_role)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    updated_at = now();

  RETURN v_user_id;
END;
$$;

SELECT public.seed_demo_user('ops@cleancity.dev', 'password123', 'Ops Admin', 'ops');
SELECT public.seed_demo_user('crew1@cleancity.dev', 'password123', 'Crew One', 'crew');
SELECT public.seed_demo_user('crew2@cleancity.dev', 'password123', 'Crew Two', 'crew');
