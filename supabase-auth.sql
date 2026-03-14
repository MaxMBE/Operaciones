-- ─────────────────────────────────────────────────────────────────
-- SUPABASE AUTH SETUP — SII Group Operaciones
-- Ejecutar en el SQL Editor de Supabase
-- ─────────────────────────────────────────────────────────────────

-- 1. Tabla de perfiles de usuario (extiende auth.users)
create table if not exists public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'viewer',  -- 'admin' | 'editor' | 'viewer'
  created_at  timestamptz default now()
);

-- 2. RLS: solo el propio usuario puede ver su perfil; admins ven todos
alter table public.user_profiles enable row level security;

create policy "usuarios ven su propio perfil"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "admins ven todos los perfiles"
  on public.user_profiles for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 3. Trigger: crear perfil automáticamente al registrar usuario
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- INSTRUCCIONES PARA CREAR USUARIOS:
-- En Supabase Dashboard → Authentication → Users → "Add user"
-- O con el siguiente SQL (reemplazá los valores):
-- ─────────────────────────────────────────────────────────────────

-- Ejemplo para invitar un usuario:
-- select auth.admin_create_user(
--   '{"email": "usuario@siigroup.com", "password": "ContraseñaSegura123!", "email_confirm": true}'::jsonb
-- );
