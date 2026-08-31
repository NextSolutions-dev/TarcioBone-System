-- Fase 1.2 — fotos de produto.
--
-- Bucket PÚBLICO para leitura de propósito: foto de produto é conteúdo público
-- do catálogo. URL assinada seria errado — expira, e a página é cacheada. O que
-- precisa de proteção é a ESCRITA, e essa é só do dono.
--
-- Limite de tamanho e tipos permitidos ficam no bucket: validação do servidor
-- do Supabase, não da nossa tela. HEIC fica FORA da lista de propósito — lição
-- do ShalomFlow, foto de iPhone em HEIC sobe e não aparece. O upload converte
-- para JPEG antes de enviar (src/lib/imagem.ts); se escapar, o bucket recusa.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 3145728,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 3145728,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists produtos_foto_leitura on storage.objects;
create policy produtos_foto_leitura on storage.objects
  for select using (bucket_id = 'produtos');

drop policy if exists produtos_foto_envio_dono on storage.objects;
create policy produtos_foto_envio_dono on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and (select private.eh_dono()));

drop policy if exists produtos_foto_troca_dono on storage.objects;
create policy produtos_foto_troca_dono on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and (select private.eh_dono()))
  with check (bucket_id = 'produtos' and (select private.eh_dono()));

drop policy if exists produtos_foto_exclusao_dono on storage.objects;
create policy produtos_foto_exclusao_dono on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and (select private.eh_dono()));

-- ⚠️ PENDÊNCIA CONHECIDA: excluir um produto NÃO apaga a foto dele no Storage.
-- Arquivo órfão acumula e consome cota. Storage não aceita delete por SQL (a
-- própria Supabase barra), então a limpeza tem de sair pela API, na mesma ação
-- que exclui o produto. Registrar quando a exclusão de produto for implementada.
