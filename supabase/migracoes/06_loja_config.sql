-- Configuração da loja — primeira peça do editor de catálogo (requisito 9).
--
-- Por quê: o WhatsApp que recebe os pedidos estava em variável de ambiente, o
-- que obriga deploy para trocar um número. Passa a ser configuração editável
-- pelo dono, com teste antes de valer.
--
-- Regra: o número só vai para o catálogo depois de TESTADO e salvo
-- (`whatsapp_ativo`). Assim um número errado nunca chega ao cliente final —
-- o visitante lê a coluna gerada `whatsapp_publico`, nula enquanto não liberado.
-- Mesmo truque de `produtos.disponivel`: o anon recebe o dado derivado.

create table if not exists public.loja_config (
  id                    boolean primary key default true,
  nome_loja             text not null default 'Minha Loja',
  whatsapp              text,
  whatsapp_ativo        boolean not null default false,
  whatsapp_testado_em   timestamptz,
  atualizado_em         timestamptz not null default now(),
  atualizado_por        uuid references public.perfis,

  constraint linha_unica          check (id),
  constraint whatsapp_so_digitos  check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  constraint nome_loja_nao_vazio  check (length(btrim(nome_loja)) > 0),
  constraint ativo_exige_numero   check (not whatsapp_ativo or whatsapp is not null)
);

alter table public.loja_config
  add column if not exists whatsapp_publico text
  generated always as (case when whatsapp_ativo then whatsapp end) stored;

insert into public.loja_config (id) values (true) on conflict (id) do nothing;

alter table public.loja_config enable row level security;

drop policy if exists loja_config_leitura on public.loja_config;
create policy loja_config_leitura on public.loja_config
  for select to authenticated
  using ((select private.perfil_ativo()));

drop policy if exists loja_config_edicao_dono on public.loja_config;
create policy loja_config_edicao_dono on public.loja_config
  for update to authenticated
  using ((select private.eh_dono()))
  with check ((select private.eh_dono()));

drop policy if exists loja_config_publica on public.loja_config;
create policy loja_config_publica on public.loja_config
  for select to anon
  using (true);

revoke all on public.loja_config from anon;
grant select (id, nome_loja, whatsapp_publico) on public.loja_config to anon;
