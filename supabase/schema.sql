drop table if exists tickets;
drop table if exists groups;

create table guests (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  companions     int not null default 0 check (companions >= 0),
  checked_in_at  timestamptz,
  created_at     timestamptz not null default now()
);

alter table guests enable row level security;
