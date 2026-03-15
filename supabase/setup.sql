create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('company', 'customer')),
  name text not null check (char_length(name) <= 120),
  location text not null check (char_length(location) <= 120),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  category text not null check (
    category in (
      'Mobiles',
      'Vehicles',
      'Property',
      'Electronics & Appliances',
      'Furniture',
      'Fashion & Beauty',
      'Books, Sports & Hobbies',
      'Jobs',
      'Services',
      'Pets'
    )
  ),
  condition text not null check (condition in ('New', 'Used', 'Refurbished')),
  price numeric(12, 2) not null check (price > 0),
  location text not null check (char_length(location) <= 120),
  description text not null check (char_length(description) <= 3000),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, listing_id)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (listing_id, buyer_id, seller_id),
  check (buyer_id <> seller_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists listings_created_at_idx on public.listings(created_at desc);
create index if not exists listings_seller_id_idx on public.listings(seller_id);
create index if not exists favorites_listing_id_idx on public.favorites(listing_id);
create index if not exists chats_updated_at_idx on public.chats(updated_at desc);
create index if not exists messages_chat_id_idx on public.messages(chat_id, created_at asc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, location)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'customer'),
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'location', ''), 'Location pending')
  )
  on conflict (id) do update
  set
    role = excluded.role,
    name = excluded.name,
    location = excluded.location;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_chat_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats
  set updated_at = new.created_at
  where id = new.chat_id;

  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute procedure public.touch_chat_updated_at();

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.listings to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert on public.chats to authenticated;
grant select, insert on public.messages to authenticated;

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.favorites enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "listings are public" on public.listings;
create policy "listings are public"
  on public.listings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "users can insert own listings" on public.listings;
create policy "users can insert own listings"
  on public.listings
  for insert
  to authenticated
  with check (auth.uid() = seller_id);

drop policy if exists "users can update own listings" on public.listings;
create policy "users can update own listings"
  on public.listings
  for update
  to authenticated
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

drop policy if exists "users can delete own listings" on public.listings;
create policy "users can delete own listings"
  on public.listings
  for delete
  to authenticated
  using (auth.uid() = seller_id);

drop policy if exists "users can view own favorites" on public.favorites;
create policy "users can view own favorites"
  on public.favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can insert own favorites" on public.favorites;
create policy "users can insert own favorites"
  on public.favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own favorites" on public.favorites;
create policy "users can delete own favorites"
  on public.favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "chat participants can read chats" on public.chats;
create policy "chat participants can read chats"
  on public.chats
  for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "buyers can open chats" on public.chats;
create policy "buyers can open chats"
  on public.chats
  for insert
  to authenticated
  with check (
    auth.uid() = buyer_id
    and buyer_id <> seller_id
    and exists (
      select 1
      from public.listings
      where public.listings.id = public.chats.listing_id
        and public.listings.seller_id = public.chats.seller_id
    )
  );

drop policy if exists "chat participants can read messages" on public.messages;
create policy "chat participants can read messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.chats
      where public.chats.id = messages.chat_id
        and (public.chats.buyer_id = auth.uid() or public.chats.seller_id = auth.uid())
    )
  );

drop policy if exists "chat participants can send messages" on public.messages;
create policy "chat participants can send messages"
  on public.messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.chats
      where public.chats.id = messages.chat_id
        and (public.chats.buyer_id = auth.uid() or public.chats.seller_id = auth.uid())
    )
  );
