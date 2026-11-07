update guests set checked_in_at = null, companions = 0;

select
  count(*) filter (where checked_in_at is not null) as llegaron,
  coalesce(sum(1 + companions) filter (where checked_in_at is not null), 0) as personas_dentro,
  count(*) as en_lista
from guests;

select name, companions, to_char(checked_in_at at time zone 'America/Bogota', 'HH24:MI') as hora
from guests
where checked_in_at is not null
order by checked_in_at;
