-- GeoCam · Semana 10 · IA generativa (ejecutar en el SQL Editor de Supabase)

-- T3. La descripción hecha con IA viaja con la sincronización de la Semana 9
alter table public.photos add column if not exists ai_description text;

-- C5. Límite de peticiones de IA por usuario. Las Edge Functions cuentan e insertan con el cliente
-- DEL USUARIO (no con la secret key), así que RLS garantiza que cada quien solo cuenta lo suyo.
create table if not exists public.uso_ia (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  funcion text not null check (funcion in ('tutor', 'describir-foto', 'tarjetas')),
  created_at timestamptz not null default now()
);

create index if not exists uso_ia_user_created_idx on public.uso_ia (user_id, created_at);

alter table public.uso_ia enable row level security;

-- Ver e insertar lo propio. Sin políticas de update ni delete: nadie puede borrar su uso para saltarse el límite.
create policy "ver mi uso de ia" on public.uso_ia
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "registrar mi uso de ia" on public.uso_ia
  for insert to authenticated with check ((select auth.uid()) = user_id);
