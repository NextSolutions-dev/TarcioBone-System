-- =============================================================================
-- VarejoFlow — seed da loja-demo "Aba Reta" (bonés)
-- Dados 100% fictícios. Nenhum dado de cliente real vive neste projeto.
--
-- O estoque entra por MOVIMENTO, nunca escrevendo estoque_atual direto: o
-- trigger é quem move o espelho, igual acontece em produção.
-- =============================================================================

insert into public.categorias (nome, ordem) values
  ('Aba Reta', 1), ('Aba Curva', 2), ('Trucker', 3), ('Dad Hat', 4)
on conflict (nome) do nothing;

insert into public.produtos (sku, modelo, cor, categoria_id, preco_centavos, estoque_minimo, descricao)
select d.sku, d.modelo, d.cor, c.id, d.preco, d.mini, d.descricao
  from (values
    ('ABR-001', 'Snapback Clássico',        'Preto',           'Aba Reta',  8990,  5, 'Aba reta, seis gomos, fecho snapback ajustável.'),
    ('ABR-002', 'Snapback Clássico',        'Branco',          'Aba Reta',  8990,  5, 'Aba reta, seis gomos, fecho snapback ajustável.'),
    ('ABR-003', 'Snapback Bordado',         'Marinho',         'Aba Reta',  9990,  4, 'Bordado frontal em alto relevo, aba reta.'),
    ('ABR-004', 'Snapback Street',          'Vermelho',        'Aba Reta',  9490,  4, 'Modelo urbano com aba reta e forro interno.'),
    ('ABR-005', 'Snapback Edição Limitada', 'Dourado/Preto',   'Aba Reta', 12990,  2, 'Tiragem limitada, bordado metalizado.'),
    ('ABC-001', 'Strapback Curva',          'Preto',           'Aba Curva', 7490,  5, 'Aba curva com fecho de fivela metálica.'),
    ('ABC-002', 'Strapback Curva',          'Verde Militar',   'Aba Curva', 7490,  4, 'Aba curva com fecho de fivela metálica.'),
    ('ABC-003', 'Boné Curvo Bordado',       'Bege',            'Aba Curva', 6990,  4, 'Algodão lavado, aba curva pré-moldada.'),
    ('TRK-001', 'Trucker Telada',           'Preto/Branco',    'Trucker',   7990,  6, 'Frente em algodão e traseira em tela, fecho snapback.'),
    ('TRK-002', 'Trucker Telada',           'Azul/Branco',     'Trucker',   7990,  6, 'Frente em algodão e traseira em tela, fecho snapback.'),
    ('TRK-003', 'Trucker Bordada',          'Vermelho/Preto',  'Trucker',   8490,  4, 'Bordado frontal, traseira telada respirável.'),
    ('DAD-001', 'Dad Hat Lavada',           'Jeans',           'Dad Hat',   6490,  5, 'Caimento baixo, tecido lavado, fecho de fivela.'),
    ('DAD-002', 'Dad Hat Lisa',             'Rosa',            'Dad Hat',   5990,  5, 'Algodão macio, sem estampa, caimento baixo.'),
    ('DAD-003', 'Dad Hat Logo',             'Off-white',       'Dad Hat',   6990,  4, 'Logo bordado discreto na frente.')
  ) as d(sku, modelo, cor, categoria, preco, mini, descricao)
  join public.categorias c on c.nome = d.categoria
on conflict (sku) do nothing;

insert into public.estoque_movimentos (produto_id, tipo, quantidade, motivo)
select p.id, 'entrada', q.qtd, 'Carga inicial'
  from (values
    ('ABR-001', 24), ('ABR-002', 18), ('ABR-003', 12), ('ABR-004',  9),
    ('ABR-005',  4), ('ABC-001', 20), ('ABC-002', 11), ('ABC-003', 15),
    ('TRK-001', 30), ('TRK-002', 22), ('TRK-003',  7), ('DAD-001', 16),
    ('DAD-002',  3), ('DAD-003', 13)
  ) as q(sku, qtd)
  join public.produtos p on p.sku = q.sku;

-- -----------------------------------------------------------------------------
-- Usuários da demonstração (senha: abareta2026)
-- -----------------------------------------------------------------------------
do $seed$
declare
  v_dono  uuid := gen_random_uuid();
  v_vend  uuid := gen_random_uuid();
  v_vend2 uuid := gen_random_uuid();
  r record;
begin
  for r in
    select * from (values
      (v_dono,  'dono@abareta.com.br',   'Rafael Mendes', 'dono'),
      (v_vend,  'camila@abareta.com.br', 'Camila Souza',  'vendedor'),
      (v_vend2, 'diego@abareta.com.br',  'Diego Alves',   'vendedor')
    ) as t(uid, email, nome, papel)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', r.uid, 'authenticated', 'authenticated',
      r.email, extensions.crypt('abareta2026', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', r.nome),
      '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.uid,
      jsonb_build_object('sub', r.uid::text, 'email', r.email),
      'email', r.email, now(), now(), now()
    ) on conflict do nothing;

    insert into public.perfis (id, nome, papel)
    values (r.uid, r.nome, r.papel)
    on conflict (id) do nothing;
  end loop;
end
$seed$;

-- -----------------------------------------------------------------------------
-- Histórico de ~30 dias, para painel e faturamento não abrirem vazios.
-- Só vende produto com folga de saldo, e a venda sem item é descartada no fim —
-- cabeçalho órfão é exatamente o defeito que a RPC impede no sistema real.
-- -----------------------------------------------------------------------------
do $seed$
declare
  v_venda uuid; v_data timestamptz; v_vend uuid; v_prod record;
  v_qtd int; v_total int; v_itens int; v_pgto text; v_origem text; v_cliente text;
  v_nomes text[] := array['Lucas Ferreira','Mariana Dias','Pedro Henrique','Juliana Castro',
                          'Bruno Rocha','Larissa Nunes','Thiago Barbosa','Amanda Reis',
                          'Vinícius Melo','Carla Antunes'];
  i int; j int;
begin
  for i in 1..58 loop
    v_data := now() - (random() * 29)::int * interval '1 day'
                    - (random() * 10 + 8)::int * interval '1 hour';
    select id into v_vend from public.perfis order by random() limit 1;
    v_pgto    := (array['pix','dinheiro','debito','credito','pix','pix','debito'])[floor(random() * 7 + 1)];
    v_origem  := case when random() < 0.22 then 'catalogo' else 'sistema' end;
    v_cliente := case when random() < 0.5 then v_nomes[floor(random() * 10 + 1)] else null end;

    insert into public.vendas (vendedor_id, forma_pagamento, origem, criada_em, cliente_nome)
    values (v_vend, v_pgto, v_origem, v_data, v_cliente)
    returning id into v_venda;

    v_total := 0;
    v_itens := floor(random() * 2 + 1)::int;

    for j in 1..v_itens loop
      select id, preco_centavos into v_prod
        from public.produtos where estoque_atual > 8 order by random() limit 1;
      exit when v_prod.id is null;

      v_qtd := floor(random() * 2 + 1)::int;

      insert into public.venda_itens (venda_id, produto_id, quantidade, preco_unitario_centavos)
      values (v_venda, v_prod.id, v_qtd, v_prod.preco_centavos);

      insert into public.estoque_movimentos (produto_id, tipo, quantidade, motivo, venda_id, criado_por, criado_em)
      values (v_prod.id, 'saida', -v_qtd, 'Venda', v_venda, v_vend, v_data);

      v_total := v_total + v_qtd * v_prod.preco_centavos;
    end loop;

    update public.vendas set total_centavos = v_total where id = v_venda;
  end loop;
end
$seed$;

delete from public.vendas v
 where not exists (select 1 from public.venda_itens i where i.venda_id = v.id);
