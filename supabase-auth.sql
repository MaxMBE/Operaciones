-- ─────────────────────────────────────────────────────────────────
-- SUPABASE AUTH SETUP — SII Group Operaciones
-- Ejecutar en el SQL Editor de Supabase
-- ─────────────────────────────────────────────────────────────────

-- 1. Tabla de perfiles de usuario (extiende auth.users)
create table if not exists public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  first_name  text,
  last_name   text,
  full_name   text generated always as (
    trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  ) stored,
  role        text not null default 'viewer',  -- 'admin' | 'editor' | 'viewer'
  created_at  timestamptz default now()
);

-- Si la tabla ya existe, agregar las columnas (ejecutar solo si ya creaste la tabla antes):
-- alter table public.user_profiles add column if not exists first_name text;
-- alter table public.user_profiles add column if not exists last_name  text;

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
  insert into public.user_profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'last_name', '')
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

-- Ejemplo para crear un usuario con nombre y apellido:
-- insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
-- values (
--   'usuario@siigroup.com',
--   crypt('ContraseñaSegura123!', gen_salt('bf')),
--   now(),
--   '{"first_name": "Juan", "last_name": "Pérez"}'::jsonb
-- );

-- O desde el Dashboard → Authentication → Users → Add user
-- Y luego actualizar el perfil:
-- update public.user_profiles
--   set first_name = 'Juan', last_name = 'Pérez'
--   where email = 'usuario@siigroup.com';
