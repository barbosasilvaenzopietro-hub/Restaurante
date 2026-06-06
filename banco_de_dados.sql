-- ============================================================
--  BRASA & CIA — banco_de_dados.sql
--  Cole tudo no SQL Editor do Supabase e clique em Run
-- ============================================================

-- 1. CONFIGURAÇÕES
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

-- 3. CARDÁPIO
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
--  CARDÁPIO INICIAL
-- ============================================================
INSERT INTO menu_items (name, description, price, emoji, category, popular, available, sizes, addons) VALUES
('Picanha na Brasa',  '450g, acompanha farofa e vinagrete', 89.90,'🥩','Pratos Principais',true, true,'["P","M","G"]','[{"name":"Farofa extra","price":5},{"name":"Vinagrete","price":3},{"name":"Chimichurri","price":4}]'),
('Costela Assada',    '300g lentamente assada, super macia',74.90,'🍖','Pratos Principais',false,true,'[]',          '[{"name":"Arroz","price":4},{"name":"Feijão","price":4}]'),
('Frango Grelhado',   'Filé temperado com ervas finas',    52.90,'🍗','Pratos Principais',false,true,'["P","G"]',   '[{"name":"Molho de ervas","price":3},{"name":"Limão","price":1}]'),
('Porção de Coxinha', '12 unidades crocantes',             34.90,'🐔','Entradas',         true, true,'["Meia","Inteira"]','[{"name":"Molho rosé","price":4},{"name":"Molho pimenta","price":3}]'),
('Pão de Alho',       '8 fatias com manteiga e alho',      18.90,'🧄','Entradas',         false,true,'[]',          '[{"name":"Queijo extra","price":5}]'),
('Refrigerante Lata', 'Coca, Guaraná ou Sprite 350ml',      7.90,'🥤','Bebidas',          false,true,'[]',          '[]'),
('Suco Natural',      'Laranja, maracujá ou abacaxi 500ml', 12.90,'🍊','Bebidas',          false,true,'[]',          '[]'),
('Pudim da Casa',     'Receita especial com calda caramelo',19.90,'🍮','Sobremesas',       true, true,'[]',          '[]');

-- Mesas iniciais
INSERT INTO tables (location, capacity, status) VALUES
('inside', 4,'avail'),('inside', 2,'avail'),('inside', 6,'avail'),
('outside',4,'avail'),('outside',4,'avail'),('outside',2,'avail');

-- ============================================================
--  SEGURANÇA (RLS) — permite acesso pelo app
-- ============================================================
ALTER TABLE settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_settings"    ON settings;
DROP POLICY IF EXISTS "allow_all_clients"     ON clients;
DROP POLICY IF EXISTS "allow_all_menu"        ON menu_items;
DROP POLICY IF EXISTS "allow_all_tables"      ON tables;
DROP POLICY IF EXISTS "allow_all_orders"      ON orders;

CREATE POLICY "allow_all_settings"    ON settings    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_clients"     ON clients     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_menu"        ON menu_items  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tables"      ON tables      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_orders"      ON orders      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
