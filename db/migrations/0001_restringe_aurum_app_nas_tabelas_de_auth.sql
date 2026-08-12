-- Os privilégios default de docker/postgres/init/00-roles.sh são amplos de
-- propósito: valem para toda tabela que aurum_auth criar, inclusive as de
-- domínio que ainda nem existem. O efeito colateral é que aurum_app nasceu com
-- acesso às tabelas de autenticação — incluindo account.password (hash de
-- senha) e os tokens de OAuth e de confirmação de e-mail.
--
-- Nada de domínio precisa dessas três tabelas: quem fala com elas é o Better
-- Auth, sempre por dbAuth. Então o acesso simplesmente sai.

revoke all on table account      from aurum_app;
revoke all on table verification from aurum_app;
revoke all on table session      from aurum_app;

-- profiles fica legível: a fase 4 precisa mostrar quem lançou o quê num
-- workspace compartilhado. Mas quem escreve em perfil é o Better Auth.
-- A policy que limita QUAIS perfis são visíveis entra junto com a RLS.
revoke insert, update, delete on table profiles from aurum_app;
