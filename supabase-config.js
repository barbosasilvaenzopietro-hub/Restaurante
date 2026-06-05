// ============================================================
//  CONFIGURAÇÃO DO SUPABASE
//  Preencha com suas credenciais após criar o projeto
//  Veja o tutorial em TUTORIAL.md para saber onde encontrá-las
// ============================================================

const SUPABASE_URL = 'COLE_SUA_URL_AQUI';
const SUPABASE_ANON_KEY = 'COLE_SUA_CHAVE_AQUI';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Senha do admin normal (pode trocar aqui ou no painel Config)
const ADMIN_PASS_DEFAULT = 'admin123';

// Senha do super admin (NÃO MUDE — acesso restrito)
const SUPER_ADMIN_PASS = 'admin12345';

// Código de verificação fixo (troque quando tiver API de WhatsApp)
const VERIFY_CODE = '1234';
