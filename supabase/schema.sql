-- GeoCam · Semana 8 · Esquema remoto en Supabase (ejecutar en el SQL Editor)
-- Tabla photos con RLS por dueño y bucket privado geocam con una carpeta por usuario.

create table public.photos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null unique,      -- UUID creado en el teléfono: identifica la misma foto en ambos lados
  storage_path text not null unique,
  latitude double precision,
  longitude double precision,
  note text,
  favorite boolean not null default false,
  source text not null check (source in ('camera', 'gallery')),
  taken_at timestamptz not null,
  updated_at timestamptz not null,     -- última modificación hecha por el usuario (base de la Semana 9)
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

-- Cada usuario solo ve, crea y borra sus propias filas
create policy "ver las mías" on public.photos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "crear las mías" on public.photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "borrar las mías" on public.photos
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Bucket privado: sin política de lectura nadie puede ver los archivos
insert into storage.buckets (id, name, public) values ('geocam', 'geocam', false);

create policy "subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "leer mi carpeta" on storage.objects
  for select to authenticated
  using (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'geocam' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- ---------------------------------------------------------------------------
-- Trabajo para la casa (C2): la subida usa upsert por client_id para no duplicar filas.
-- Upsert necesita poder ACTUALIZAR la fila existente; sin esta política, repetir la
-- subida de una foto (o subir una nota editada) falla por RLS.
create policy "actualizar las mías" on public.photos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Trabajo para la casa (C4): la pestaña Nube recibe los cambios en tiempo real.
-- Las políticas RLS también aplican a lo que llega por el canal.
alter publication supabase_realtime add table public.photos;

-- ===========================================================================
-- GeoCam · Semana 9 · Sincronización en dos sentidos (ejecutar en el SQL Editor)
-- ===========================================================================

-- T1. Reloj del servidor: cuándo llegó cada cambio a Supabase (cursor de bajada).
-- updated_at lo escribe el teléfono y decide conflictos; server_updated_at lo escribe
-- PostgreSQL y sirve para pedir "lo que llegó después de X".
alter table public.photos
  add column if not exists server_updated_at timestamptz not null default now();

create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

drop trigger if exists photos_touch_server_updated_at on public.photos;
create trigger photos_touch_server_updated_at
  before insert or update on public.photos
  for each row execute function public.touch_server_updated_at();

create index if not exists photos_user_server_updated_idx
  on public.photos (user_id, server_updated_at);

-- La política de update que pide el T1 ("editar las mías") ya existe desde el C2 de la
-- Semana 8 con el nombre "actualizar las mías": no se vuelve a crear.

-- C1. Borrado lógico: borrar = marcar. La fila queda para que los demás teléfonos se enteren.
alter table public.photos
  add column if not exists deleted_at timestamptz;

-- C2. El feed de la pestaña Nube pagina por created_at (cursor)
create index if not exists photos_user_created_idx
  on public.photos (user_id, created_at desc);
