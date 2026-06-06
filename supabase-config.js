// ============================================================
//  CONFIGURAÇÃO DO SUPABASE — formato novo (2025)
// ============================================================

const SUPABASE_URL = 'https://pvlkjzrqmoakufahraeq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kwCKhtS3xXeDJKiwDWWD9g_xVCslMXU'; // sb_publishable_...

// Para pegar a chave:
// Configurações → Chaves API → Chave publicável → copie o valor completo
// Clique no ícone de copiar ao lado da chave "Padrão"

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

const ADMIN_PASS_DEFAULT = 'admin123';
const SUPER_ADMIN_PASS   = 'admin12345';
const VERIFY_CODE        = '1234';
