-- Ensure every app role has a seed account (idempotent via seed_demo_user).
-- Safe on existing DBs that still have crew1/crew2 from older seeds.

SELECT public.seed_demo_user('ops@cleancity.dev', 'password123', 'Ops Admin', 'ops');
SELECT public.seed_demo_user('crew@cleancity.dev', 'password123', 'Crew Lead', 'crew');
