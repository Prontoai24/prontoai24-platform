-- ProntoAI24 — gestione stato account e amministratori
-- Applicare dopo 0001_schema_iniziale.sql.

alter table profiles
  add column if not exists status account_status not null default 'active';

create index if not exists profiles_role_status_idx on profiles(role, status);

comment on column profiles.status is 'Stato operativo dell’account: active, suspended, expired o in_setup.';
