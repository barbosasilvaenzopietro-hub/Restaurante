-- ============================================================
--  BRASA & CIA — banco_de_dados.sql
--  Cole este SQL inteiro no Supabase SQL Editor e execute
-- ============================================================

-- 1. CONFIGURAÇÕES DO APP
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  whatsapp TEXT DEFAULT '',
  admin_pass TEXT DEFAULT 'admin123',
  open BOOLEAN DEFAULT true,
  locked BOOLEAN DEFAULT false,
  lock_msg TEXT DEFAULT 'SISTEMA OFFLINE'
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. CLIENTES
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  orders_count INTEGER DEFAULT 0,
  blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ITENS DO CARDÁPIO
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price DECIMAL(10,2) NOT NULL,
  emoji TEXT DEFAULT '🍽️',
  category TEXT NOT NULL,
  popular BOOLEAN DEFAULT false,
  available BOOLEAN DEFAULT true,
  sizes JSONB DEFAULT '[]',
  addons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MESAS
CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  location TEXT NOT NULL CHECK (location IN ('inside','outside')),
  capacity INTEGER NOT NULL,
  status TEXT DEFAULT 'avail' CHECK (status IN ('avail','reserved','occupied')),
  reserved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PEDIDOS
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  items JSONB DEFAULT '[]',
  total DECIMAL(10,2) NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('delivery','pickup','reserve')),
  address TEXT DEFAULT '',
  table_info TEXT DEFAULT '',
  payment TEXT NOT NULL,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','prep','done')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  DADOS DE EXEMPLO — cardápio inicial
-- ============================================================
INSERT INTO menu_items (name, description, price, emoji, category, popular, available, sizes, addons) VALUES
('Picanha na Brasa',   '450g, acompanha farofa e vinagrete', 89.90, '🥩', 'Pratos Principais', true,  true, '["P","M","G"]', '[{"name":"Farofa extra","price":5},{"name":"Vinagrete","price":3},{"name":"Chimichurri","price":4}]'),
('Costela Assada',     '300g lentamente assada, super macia', 74.90, '🍖', 'Pratos Principais', false, true, '[]',          '[{"name":"Arroz","price":4},{"name":"Feijão","price":4}]'),
('Frango Grelhado',    'Filé temperado com ervas finas',     52.90, '🍗', 'Pratos Principais', false, true, '["P","G"]',   '[{"name":"Molho de ervas","price":3},{"name":"Limão","price":1}]'),
('Porção de Coxinha',  '12 unidades crocantes',              34.90, '🐔', 'Entradas',           true,  true, '["Meia","Inteira"]', '[{"name":"Molho rosé","price":4},{"name":"Molho pimenta","price":3}]'),
('Pão de Alho',        '8 fatias com manteiga e alho',       18.90, '🧄', 'Entradas',           false, true, '[]',          '[{"name":"Queijo extra","price":5}]'),
('Refrigerante Lata',  'Coca, Guaraná ou Sprite 350ml',      7.90,  '🥤', 'Bebidas',            false, true, '[]',          '[]'),
('Suco Natural',       'Laranja, maracujá ou abacaxi 500ml', 12.90, '🍊', 'Bebidas',            false, true, '[]',          '[]'),
('Pudim da Casa',      'Receita especial com calda caramelo',19.90, '🍮', 'Sobremesas',         true,  true, '[]',          '[]');

-- Mesas de exemplo
INSERT INTO tables (location, capacity, status) VALUES
('inside',  4, 'avail'),
('inside',  2, 'avail'),
('inside',  6, 'avail'),
('outside', 4, 'avail'),
('outside', 4, 'avail'),
('outside', 2, 'avail');

-- ============================================================
--  SEGURANÇA — Row Level Security (RLS)
--  Permite leitura pública e escrita pelo app
-- ============================================================
ALTER TABLE settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (anon key)
CREATE POLICY "public_read_settings"   ON settings    FOR SELECT USING (true);
CREATE POLICY "public_write_settings"  ON settings    FOR UPDATE USING (true);

CREATE POLICY "public_read_menu"       ON menu_items  FOR SELECT USING (true);
CREATE POLICY "public_write_menu"      ON menu_items  FOR ALL    USING (true);

CREATE POLICY "public_read_tables"     ON tables      FOR SELECT USING (true);
CREATE POLICY "public_write_tables"    ON tables      FOR ALL    USING (true);

CREATE POLICY "public_read_clients"    ON clients     FOR SELECT USING (true);
CREATE POLICY "public_write_clients"   ON clients     FOR ALL    USING (true);

CREATE POLICY "public_read_orders"     ON orders      FOR SELECT USING (true);
CREATE POLICY "public_write_orders"    ON orders      FOR ALL    USING (true);
