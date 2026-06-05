// ============================================================
//  BRASA & CIA — app.js
//  Lógica principal com banco de dados Supabase
// ============================================================

// ---- Estado global ----
let currentUser = null;
let cart = {};
let menuItems = [];
let tables = [];
let orders = [];
let clients = [];
let settings = { whatsapp: '', adminPass: ADMIN_PASS_DEFAULT, open: true, locked: false, lockMsg: '' };
let pendingReg = null;
let selectedCat = 'Todos';
let orderType = 'delivery';
let payMethod = 'dinheiro';
let needTroco = false;
let selectedLoc = 'inside';
let selectedTable = null;
let curAdmTab = 'pedidos';
let curSaTab = 'visao';
let editingItemId = null;
let editingAddons = [];
let nextOrderNum = 100;
let confirmAction = null;

const fmt = v => 'R$ ' + v.toFixed(2).replace('.', ',');
const dig = v => v.replace(/\D/g, '');

// ============================================================
//  INICIALIZAÇÃO — carrega dados do banco
// ============================================================
async function init() {
  showLoading(true);
  try {
    await loadSettings();
    await loadMenu();
    await loadTables();
    checkLockdown();
    renderMenu();
    updateCartBar();
    updateUBtn();
  } catch (e) {
    console.error('Erro ao iniciar:', e);
    showToast('⚠️', 'Erro de conexão. Verifique o supabase-config.js');
  }
  showLoading(false);
}

function showLoading(show) {
  let el = document.getElementById('loading-overlay');
  if (show && !el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.innerHTML = '<div style="text-align:center"><div style="font-size:40px;margin-bottom:12px">🔥</div><p style="font-family:Syne,sans-serif;font-size:16px;color:#ff6b35">Carregando...</p></div>';
    el.style.cssText = 'position:fixed;inset:0;background:#0e0e10;display:flex;align-items:center;justify-content:center;z-index:999';
    document.body.appendChild(el);
  } else if (!show && el) {
    el.remove();
  }
}

// ============================================================
//  SETTINGS — salva/carrega configurações no banco
// ============================================================
async function loadSettings() {
  const { data } = await supabase.from('settings').select('*').single();
  if (data) {
    settings.whatsapp = data.whatsapp || '';
    settings.adminPass = data.admin_pass || ADMIN_PASS_DEFAULT;
    settings.open = data.open !== false;
    settings.locked = data.locked || false;
    settings.lockMsg = data.lock_msg || 'SISTEMA OFFLINE';
  } else {
    // Cria linha de configurações se não existir
    await supabase.from('settings').insert({
      whatsapp: '', admin_pass: ADMIN_PASS_DEFAULT, open: true, locked: false, lock_msg: 'SISTEMA OFFLINE'
    });
  }
}

async function saveSettings(updates) {
  Object.assign(settings, updates);
  await supabase.from('settings').update(updates).eq('id', 1);
}

// ============================================================
//  LOCKDOWN
// ============================================================
function checkLockdown() {
  const overlay = document.getElementById('lockdown');
  if (settings.locked) {
    document.getElementById('lock-msg').textContent = settings.lockMsg || 'SISTEMA OFFLINE';
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

// ============================================================
//  MENU — carrega do banco
// ============================================================
async function loadMenu() {
  const { data } = await supabase.from('menu_items').select('*').order('category').order('name');
  menuItems = (data || []).map(item => ({
    id: item.id,
    name: item.name,
    desc: item.description,
    price: item.price,
    emoji: item.emoji,
    cat: item.category,
    popular: item.popular,
    avail: item.available,
    sizes: item.sizes || [],
    addons: item.addons || []
  }));
}

async function loadTables() {
  const { data } = await supabase.from('tables').select('*').order('id');
  tables = data || [];
}

async function loadOrders() {
  const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  orders = data || [];
}

async function loadClients() {
  const { data } = await supabase.from('clients').select('*').order('name');
  clients = data || [];
}

// ============================================================
//  NAVEGAÇÃO
// ============================================================
function showS(id) {
  if (settings.locked && !['s-adm-login', 's-sadm', 's-adm'].includes(id)) {
    checkLockdown();
    return;
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'sm') { renderMenu(); updateCartBar(); }
  if (id === 'sc') { renderCart(); renderTChips(); }
  if (id === 's-adm') renderAdmTab();
  if (id === 's-sadm') renderSaTab();
  updateUBtn();
}

function goAdmin() { showS('s-adm-login'); }

function handleUser() {
  if (settings.locked) { showToast('🔒', 'Sistema suspenso.'); return; }
  if (currentUser) showToast('👋', 'Olá, ' + currentUser.name.split(' ')[0] + '!');
  else showS('s-reg');
}

function updateUBtn() {
  const l = document.getElementById('ulbl');
  if (l) l.textContent = currentUser ? currentUser.name.split(' ')[0] : 'Entrar';
}

// ============================================================
//  AUTENTICAÇÃO DE CLIENTES
// ============================================================
async function doRegister() {
  if (settings.locked) { showToast('🔒', 'Sistema suspenso.'); return; }
  const name = document.getElementById('rn').value.trim();
  const ph = document.getElementById('rph').value.trim();
  const pw = document.getElementById('rpw').value;
  const err = document.getElementById('re-err');

  if (!name || !ph || pw.length < 4) {
    showErr(err, 'Preencha todos os campos (senha mín. 4 dígitos).'); return;
  }
  const d = dig(ph);
  if (d.length < 10 || d.length > 11) {
    showErr(err, 'Número de celular inválido.'); return;
  }

  // Verifica se já existe no banco
  const { data: existing } = await supabase
    .from('clients').select('id').eq('phone', d).single();
  if (existing) {
    showErr(err, 'Número já cadastrado. Faça login.'); return;
  }

  err.style.display = 'none';
  pendingReg = { name, phone: d, pass: pw };

  document.getElementById('vph').textContent = ph;
  [0, 1, 2, 3].forEach(i => document.getElementById('o' + i).value = '');
  document.getElementById('otp-err').textContent = '';
  document.getElementById('otp-err').style.display = 'none';

  showS('s-verify');
  // Em produção: chame sua API para enviar o código via WhatsApp
  // Por enquanto, o código é VERIFY_CODE (definido em supabase-config.js como '1234')
  showToast('📱', 'Digite o código enviado pelo atendente via WhatsApp.');
}

function om(i) {
  const v = document.getElementById('o' + i).value;
  if (v && i < 3) document.getElementById('o' + (i + 1)).focus();
}

async function confirmOTP() {
  const code = [0, 1, 2, 3].map(i => document.getElementById('o' + i).value).join('');
  const errEl = document.getElementById('otp-err');
  if (code !== VERIFY_CODE) {
    showErr(errEl, 'Código incorreto. Tente novamente.'); return;
  }
  errEl.style.display = 'none';

  // Salva no banco
  const { data, error } = await supabase.from('clients').insert({
    name: pendingReg.name,
    phone: pendingReg.phone,
    pass_hash: pendingReg.pass, // Em produção use hashing real
    orders_count: 0,
    blocked: false
  }).select().single();

  if (error) { showToast('⚠️', 'Erro ao salvar cadastro.'); return; }

  currentUser = {
    id: data.id, name: data.name, phone: data.phone,
    pass: data.pass_hash, orders: 0, blocked: false
  };
  pendingReg = null;
  updateUBtn();
  showS('sm');
  showToast('✅', 'Bem-vindo(a), ' + currentUser.name.split(' ')[0] + '!');
}

async function doLogin() {
  if (settings.locked) { showToast('🔒', 'Sistema suspenso.'); return; }
  const ph = document.getElementById('lph').value.trim();
  const pw = document.getElementById('lpw').value;
  const err = document.getElementById('li-err');

  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('phone', dig(ph))
    .eq('pass_hash', pw)
    .single();

  if (!data) { showErr(err, 'Dados incorretos.'); return; }
  if (data.blocked) { showErr(err, 'Conta bloqueada. Contate o restaurante.'); return; }

  err.style.display = 'none';
  currentUser = { id: data.id, name: data.name, phone: data.phone, pass: data.pass_hash, orders: data.orders_count, blocked: data.blocked };
  updateUBtn();
  showS('sm');
  showToast('✅', 'Olá, ' + currentUser.name.split(' ')[0] + '!');
}

// ============================================================
//  MENU — renderização
// ============================================================
const selSizes = {};

function getCats() {
  return ['Todos', ...new Set(menuItems.filter(i => i.avail).map(i => i.cat))];
}

function renderMenu() {
  const cats = getCats();
  document.getElementById('catbar').innerHTML = cats.map(c =>
    `<button class="catbtn${c === selectedCat ? ' active' : ''}" onclick="selCat('${c}')">${c}</button>`
  ).join('');

  const items = selectedCat === 'Todos'
    ? menuItems.filter(i => i.avail)
    : menuItems.filter(i => i.avail && i.cat === selectedCat);

  const byCat = {};
  items.forEach(i => { if (!byCat[i.cat]) byCat[i.cat] = []; byCat[i.cat].push(i); });

  let h = '';
  for (const [cat, arr] of Object.entries(byCat)) {
    if (selectedCat === 'Todos') h += `<p class="stitle">${cat}</p>`;
    h += `<div class="mgrid">`;
    arr.forEach(item => {
      h += `<div class="mcard">
        <div class="mcimg">${item.emoji}${item.popular ? '<span class="bpop">⭐ Popular</span>' : ''}</div>
        <div class="mcbody">
          <p class="mcname">${item.name}</p>
          <p class="mcdesc">${item.desc}</p>
          ${item.sizes && item.sizes.length
          ? `<div class="sizerow" id="sz-${item.id}">${item.sizes.map((s, si) =>
            `<span class="sopt${si === 0 ? ' active' : ''}" onclick="selSize(${item.id},${si},'${s}')">${s}</span>`
          ).join('')}</div>` : ''}
          <div class="mcfoot" style="margin-top:7px">
            <span class="price">${fmt(item.price)}</span>
            <button class="badd" onclick="addCart(${item.id})">+ Adicionar</button>
          </div>
        </div>
      </div>`;
    });
    h += `</div>`;
  }
  document.getElementById('mbody').innerHTML = h || '<div class="empty"><p>Nenhum item disponível.</p></div>';
}

function selSize(id, idx, s) {
  selSizes[id] = s;
  document.querySelectorAll(`#sz-${id} .sopt`).forEach((el, i) => el.classList.toggle('active', i === idx));
}
function selCat(c) { selectedCat = c; renderMenu(); }

// ============================================================
//  CARRINHO
// ============================================================
function addCart(id) {
  if (settings.locked) { showToast('🔒', 'Sistema suspenso.'); return; }
  if (!currentUser) { showToast('⚠️', 'Faça login para pedir.'); showS('s-reg'); return; }
  const item = menuItems.find(i => i.id === id);
  const size = selSizes[id] || (item.sizes && item.sizes.length ? item.sizes[0] : '');
  const key = id + '|' + size;
  if (!cart[key]) cart[key] = { itemId: id, size, addons: [], qty: 1 };
  else cart[key].qty++;
  updateCartBar();
  showToast('🛒', 'Adicionado!');
}

function remCart(key) {
  if (cart[key] && cart[key].qty > 1) cart[key].qty--;
  else delete cart[key];
  renderCart(); updateCartBar();
}

function addQty(key) { cart[key].qty++; renderCart(); updateCartBar(); }

function toggleAddon(key, an) {
  const a = cart[key].addons;
  const i = a.indexOf(an);
  if (i >= 0) a.splice(i, 1); else a.push(an);
  renderCart();
}

function cartTotal() {
  return Object.entries(cart).reduce((s, [k, v]) => {
    const item = menuItems.find(i => i.id === v.itemId);
    if (!item) return s;
    let b = item.price * v.qty;
    v.addons.forEach(an => {
      const ad = item.addons.find(a => a.name === an);
      if (ad) b += ad.price * v.qty;
    });
    return s + b;
  }, 0);
}

function cartCount() { return Object.values(cart).reduce((s, v) => s + v.qty, 0); }

function updateCartBar() {
  const cnt = cartCount(), tot = cartTotal();
  document.getElementById('ccnt').textContent = cnt;
  document.getElementById('cbc').textContent = cnt + (cnt === 1 ? ' item' : ' itens');
  document.getElementById('cbt').textContent = fmt(tot);
  const bar = document.getElementById('cartbar'), btn = document.getElementById('cbtn');
  if (cnt > 0) { bar.classList.remove('hidden'); btn.style.display = 'flex'; }
  else { bar.classList.add('hidden'); btn.style.display = 'none'; }
}

function renderCart() {
  const list = document.getElementById('citems');
  if (!Object.keys(cart).length) {
    list.innerHTML = '<div class="empty"><p>Carrinho vazio.</p></div>';
    document.getElementById('csum').innerHTML = '';
    return;
  }
  let h = '';
  Object.entries(cart).forEach(([key, v]) => {
    const item = menuItems.find(i => i.id === v.itemId); if (!item) return;
    let sub = item.price * v.qty;
    v.addons.forEach(an => { const ad = item.addons.find(a => a.name === an); if (ad) sub += ad.price * v.qty; });
    h += `<div class="citem">
      <span class="ciem">${item.emoji}</span>
      <div class="ciinfo">
        <p class="ciname">${item.name}${v.size ? ' (' + v.size + ')' : ''}</p>
        ${item.addons && item.addons.length
        ? `<div class="addon-list">${item.addons.map(a =>
          `<span class="achip${v.addons.includes(a.name) ? ' active' : ''}" onclick="toggleAddon('${key}','${a.name}')">${a.name}${a.price > 0 ? ' +' + fmt(a.price) : ''}</span>`
        ).join('')}</div>` : ''}
        <p class="ciprice">${fmt(sub)}</p>
      </div>
      <div class="qrow">
        <button class="qbtn" onclick="remCart('${key}')">−</button>
        <span class="qn">${v.qty}</span>
        <button class="qbtn" onclick="addQty('${key}')">+</button>
      </div>
    </div>`;
  });
  list.innerHTML = h;
  const taxa = orderType === 'delivery' ? 5 : 0;
  const tot = cartTotal();
  document.getElementById('csum').innerHTML = `
    <div class="srow"><span>Subtotal</span><span>${fmt(tot)}</span></div>
    ${taxa ? `<div class="srow"><span>Taxa de entrega</span><span>${fmt(taxa)}</span></div>` : ''}
    <div class="srow tot"><span>Total</span><span>${fmt(tot + taxa)}</span></div>`;
}

function setOT(t) {
  orderType = t;
  ['delivery', 'pickup', 'reserve'].forEach(x => {
    document.getElementById('ot-' + x).classList.toggle('active', x === t);
    document.getElementById('f-' + x).style.display = x === t ? 'block' : 'none';
  });
  renderCart();
}

function setLoc(l) {
  selectedLoc = l; selectedTable = null;
  document.getElementById('loc-i').classList.toggle('active', l === 'inside');
  document.getElementById('loc-o').classList.toggle('active', l === 'outside');
  renderTChips();
}

function renderTChips() {
  const c = document.getElementById('tchips'); if (!c) return;
  const av = tables.filter(t => t.location === selectedLoc && t.status === 'avail');
  if (!av.length) { c.innerHTML = '<p style="font-size:12px;color:var(--text3)">Nenhuma mesa disponível.</p>'; return; }
  c.innerHTML = av.map(t =>
    `<span class="tchip${selectedTable === t.id ? ' active' : ''}" onclick="selTable(${t.id})">Mesa ${t.id} (${t.capacity} lug.)</span>`
  ).join('');
}

function selTable(id) {
  selectedTable = id;
  document.querySelectorAll('.tchip').forEach(el => el.classList.toggle('active', el.textContent.startsWith('Mesa ' + id)));
}

function setPay(p) {
  payMethod = p;
  ['dinheiro', 'pix', 'debito', 'credito'].forEach(x => document.getElementById('py-' + x).classList.toggle('active', x === p));
  document.getElementById('trocof').style.display = p === 'dinheiro' ? 'block' : 'none';
}

function setTroco(v) {
  needTroco = v;
  document.getElementById('tr-s').classList.toggle('active', v);
  document.getElementById('tr-n').classList.toggle('active', !v);
  document.getElementById('trv').style.display = v ? 'block' : 'none';
}

// ============================================================
//  CONFIRMAR PEDIDO — salva no banco
// ============================================================
async function confirmOrder() {
  if (settings.locked) { showToast('🔒', 'Sistema suspenso.'); return; }
  if (!Object.keys(cart).length) { showToast('⚠️', 'Adicione itens!'); return; }
  if (orderType === 'delivery' && !document.getElementById('a1').value.trim()) { showToast('⚠️', 'Informe o endereço.'); return; }
  if (orderType === 'reserve' && !selectedTable) { showToast('⚠️', 'Selecione uma mesa.'); return; }

  const itemsList = Object.values(cart).map(v => {
    const item = menuItems.find(i => i.id === v.itemId);
    const add = v.addons.length ? ' + ' + v.addons.join(', ') : '';
    return `${v.qty}x ${item.name}${v.size ? ' (' + v.size + ')' : ''}${add}`;
  });

  const taxa = orderType === 'delivery' ? 5 : 0;
  const total = cartTotal() + taxa;
  const troco = needTroco ? document.getElementById('trvv').value : '';
  const addr = orderType === 'delivery'
    ? [document.getElementById('a1').value, document.getElementById('a2').value, document.getElementById('a3').value].filter(Boolean).join(', ')
    : '';
  const tableInfo = orderType === 'reserve' && selectedTable
    ? `Mesa ${selectedTable} (${selectedLoc === 'inside' ? 'interna' : 'externa'})` : '';
  const obs = document.getElementById('obs').value;

  // Salva pedido no banco
  const { data: orderData, error } = await supabase.from('orders').insert({
    client_name: currentUser ? currentUser.name : '—',
    client_phone: currentUser ? currentUser.phone : '—',
    client_id: currentUser ? currentUser.id : null,
    items: itemsList,
    total,
    order_type: orderType,
    address: addr,
    table_info: tableInfo,
    payment: payMethod + (troco ? ` (troco p/ R$${troco})` : ''),
    notes: obs,
    status: 'pending'
  }).select().single();

  if (error) { showToast('⚠️', 'Erro ao salvar pedido.'); return; }

  // Atualiza mesa se reserva
  if (orderType === 'reserve' && selectedTable) {
    await supabase.from('tables').update({
      status: 'reserved',
      reserved_by: currentUser ? currentUser.name : 'Cliente'
    }).eq('id', selectedTable);
    await loadTables();
  }

  // Incrementa pedidos do cliente
  if (currentUser) {
    await supabase.from('clients').update({ orders_count: (currentUser.orders || 0) + 1 }).eq('id', currentUser.id);
    currentUser.orders = (currentUser.orders || 0) + 1;
  }

  // Envia WhatsApp se número configurado
  if (settings.whatsapp) {
    const msg = encodeURIComponent(
      `🔔 NOVO PEDIDO #${orderData.id}\n\nCliente: ${orderData.client_name}\nTelefone: ${orderData.client_phone}\nTipo: ${orderType === 'delivery' ? 'Entrega' : orderType === 'pickup' ? 'Retirada' : 'Reserva'}\n${addr ? 'Endereço: ' + addr + '\n' : ''}${tableInfo ? 'Mesa: ' + tableInfo + '\n' : ''}\nItens:\n${itemsList.join('\n')}\n\nPagamento: ${orderData.payment}\nTotal: ${fmt(total)}${obs ? '\nObs: ' + obs : ''}`
    );
    window.open('https://wa.me/55' + dig(settings.whatsapp) + '?text=' + msg, '_blank');
  }

  document.getElementById('snum').textContent = '#' + orderData.id;
  cart = {}; selectedTable = null;
  updateCartBar(); updatePNC();
  showS('ss');
}

// ============================================================
//  ADMIN LOGIN
// ============================================================
function doAdmLogin() {
  const p = document.getElementById('adm-pw').value;
  const err = document.getElementById('adm-err');
  if (p === SUPER_ADMIN_PASS) {
    err.style.display = 'none';
    document.getElementById('adm-pw').value = '';
    showS('s-sadm');
    return;
  }
  if (p !== settings.adminPass) { showErr(err, 'Senha incorreta.'); return; }
  err.style.display = 'none';
  document.getElementById('adm-pw').value = '';
  showS('s-adm');
}

// ============================================================
//  ADMIN TABS
// ============================================================
function admTab(t) {
  curAdmTab = t;
  ['pedidos', 'mesas', 'cardapio', 'clientes', 'config'].forEach(x =>
    document.getElementById('at-' + x).classList.toggle('active', x === t)
  );
  renderAdmTab();
}

function renderAdmTab() {
  if (curAdmTab === 'pedidos') renderOrders();
  else if (curAdmTab === 'mesas') renderTables();
  else if (curAdmTab === 'cardapio') renderMenuAdm();
  else if (curAdmTab === 'clientes') renderClients();
  else renderConfig();
  updatePNC();
}

function updatePNC() {
  const n = orders.filter(o => o.status === 'pending').length;
  const el = document.getElementById('pnc');
  if (el) { el.style.display = n > 0 ? 'inline' : 'none'; el.textContent = n; }
}

// ---- PEDIDOS ----
async function renderOrders() {
  await loadOrders();
  const b = document.getElementById('admbody');
  if (!orders.length) { b.innerHTML = '<div class="empty"><p>Nenhum pedido ainda.</p></div>'; return; }
  b.innerHTML = orders.map((o, i) => `
    <div class="ocrd${o.status === 'pending' ? ' new' : ''}">
      <div class="oc-hd"><span class="ocid">#${o.id}</span><span class="octm">${new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="ocit">${(o.items || []).join(' · ')}</div>
      <div class="occl">👤 ${o.client_name} · 📱 ${o.client_phone}</div>
      <div class="occl">${o.order_type === 'delivery' ? '🛵 ' + o.address : o.order_type === 'pickup' ? '🏃 Retirada' : '🪑 ' + o.table_info}</div>
      <div class="occl">💳 ${o.payment}</div>
      ${o.notes ? `<div class="ocobs">📝 ${o.notes}</div>` : ''}
      <div class="ocft">
        <span class="octot">${fmt(o.total)}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${settings.whatsapp ? `<button class="wabtn" onclick="waReply('${o.client_phone}','${o.client_name}','#${o.id}')">📲 WA</button>` : ''}
          <span class="spill ${o.status === 'pending' ? 'sp0' : o.status === 'prep' ? 'sp1' : 'sp2'}" onclick="cycleStatus('${o.id}',${i})">
            ${o.status === 'pending' ? '⏳ Pendente' : o.status === 'prep' ? '🔥 Preparo' : '✅ Pronto'}
          </span>
        </div>
      </div>
    </div>`).join('');
  updatePNC();
}

async function cycleStatus(id, i) {
  const s = orders[i].status;
  const next = s === 'pending' ? 'prep' : s === 'prep' ? 'done' : 'pending';
  await supabase.from('orders').update({ status: next }).eq('id', id);
  orders[i].status = next;
  updatePNC(); renderOrders();
}

function waReply(phone, name, orderId) {
  const msg = encodeURIComponent(`Olá ${name.split(' ')[0]}! Seu pedido ${orderId} está em andamento. 🍖`);
  window.open('https://wa.me/55' + dig(phone) + '?text=' + msg, '_blank');
}

// ---- MESAS ----
function renderTables() {
  const b = document.getElementById('admbody');
  const inside = tables.filter(t => t.location === 'inside');
  const outside = tables.filter(t => t.location === 'outside');
  const tc = arr => arr.map(t => `
    <div class="tcrd ${t.status}" onclick="openTModal(${t.id})">
      <div class="tcnum">${t.id}</div>
      <div class="tcin">${t.capacity} lug.</div>
      <div class="tcst ts-${t.status}">${t.status === 'avail' ? 'Livre' : t.status === 'reserved' ? 'Reservada' : 'Ocupada'}</div>
      ${t.reserved_by ? `<div style="font-size:9px;color:var(--text3);margin-top:2px">${t.reserved_by}</div>` : ''}
    </div>`).join('');
  b.innerHTML = `
    <div style="display:flex;gap:12px;margin-bottom:11px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--success)">● Disponível</span>
      <span style="font-size:11px;color:var(--accent)">● Reservada</span>
      <span style="font-size:11px;color:var(--info)">● Ocupada</span>
    </div>
    <button class="adash" onclick="openM('m-addtable')">+ Adicionar mesa</button>
    <p class="stitle">Parte interna</p>
    <div class="tgrid">${tc(inside) || '<p style="font-size:12px;color:var(--text3)">Sem mesas internas.</p>'}</div>
    <p class="stitle">Parte externa</p>
    <div class="tgrid">${tc(outside) || '<p style="font-size:12px;color:var(--text3)">Sem mesas externas.</p>'}</div>`;
}

function openTModal(id) {
  const t = tables.find(x => x.id === id);
  document.getElementById('mt-tit').textContent = `Mesa ${t.id} — ${t.location === 'inside' ? 'Interna' : 'Externa'}`;
  document.getElementById('mt-body').innerHTML = `
    <div class="srow"><span>Capacidade</span><span>${t.capacity} lugares</span></div>
    <div class="srow"><span>Status</span><span style="color:${t.status === 'avail' ? 'var(--success)' : t.status === 'reserved' ? 'var(--accent)' : 'var(--info)'}">${t.status === 'avail' ? 'Livre' : t.status === 'reserved' ? 'Reservada' : 'Ocupada'}</span></div>
    ${t.reserved_by ? `<div class="srow"><span>Reservado por</span><span>${t.reserved_by}</span></div>` : ''}`;
  const btn = document.getElementById('mt-act');
  if (t.status === 'avail') {
    btn.textContent = 'Marcar ocupada';
    btn.onclick = async () => {
      await supabase.from('tables').update({ status: 'occupied' }).eq('id', id);
      await loadTables(); closeM('m-table'); renderTables();
    };
  } else {
    btn.textContent = 'Liberar mesa';
    btn.onclick = async () => {
      await supabase.from('tables').update({ status: 'avail', reserved_by: null }).eq('id', id);
      await loadTables(); closeM('m-table'); renderTables();
    };
  }
  openM('m-table');
}

async function addTable() {
  const loc = document.getElementById('at-loc').value;
  const cap = parseInt(document.getElementById('at-cap').value);
  if (!cap || cap < 1) { showToast('⚠️', 'Informe a capacidade.'); return; }
  await supabase.from('tables').insert({ location: loc, capacity: cap, status: 'avail' });
  await loadTables();
  closeM('m-addtable'); renderTables(); showToast('✅', 'Mesa adicionada!');
}

// ---- CARDÁPIO ADMIN ----
async function renderMenuAdm() {
  await loadMenu();
  const b = document.getElementById('admbody');
  const cats = [...new Set(menuItems.map(i => i.cat))];
  let h = `<button class="adash" onclick="openItemModal(null)">+ Adicionar item</button>`;
  cats.forEach(cat => {
    h += `<p class="stitle" style="margin-bottom:7px">${cat}</p>`;
    menuItems.filter(i => i.cat === cat).forEach(item => {
      h += `<div class="aitem">
        <span class="aiem">${item.emoji}</span>
        <div class="aiinf">
          <p class="ainm">${item.name}</p>
          <p class="aipr">${fmt(item.price)}${item.sizes && item.sizes.length ? ' · ' + item.sizes.join('/') : ''}${item.addons && item.addons.length ? ' · ' + item.addons.length + ' adicionais' : ''}</p>
        </div>
        <label class="toggle">
          <input type="checkbox" ${item.avail ? 'checked' : ''} onchange="toggleAvailItem(${item.id},this.checked)">
          <span class="togsl"></span>
        </label>
        <div class="aiact">
          <button class="bsm" onclick="openItemModal(${item.id})">✏️</button>
          <button class="bsm del" onclick="deleteItem(${item.id})">🗑️</button>
        </div>
      </div>`;
    });
  });
  b.innerHTML = h;
}

async function toggleAvailItem(id, v) {
  await supabase.from('menu_items').update({ available: v }).eq('id', id);
  const item = menuItems.find(i => i.id === id);
  if (item) item.avail = v;
}

function openItemModal(id) {
  editingItemId = id;
  document.getElementById('mi-tit').textContent = id ? 'Editar item' : 'Novo item';
  if (id) {
    const item = menuItems.find(i => i.id === id);
    document.getElementById('mi-e').value = item.emoji;
    document.getElementById('mi-n').value = item.name;
    document.getElementById('mi-d').value = item.desc;
    document.getElementById('mi-p').value = item.price;
    document.getElementById('mi-c').value = item.cat;
    document.getElementById('mi-s').value = (item.sizes || []).join(',');
    editingAddons = (item.addons || []).map(a => ({ ...a }));
  } else {
    ['mi-e', 'mi-n', 'mi-d', 'mi-p', 'mi-s'].forEach(x => document.getElementById(x).value = '');
    document.getElementById('mi-c').value = 'Pratos Principais';
    editingAddons = [];
  }
  renderAddonEditor();
  openM('m-item');
}

function renderAddonEditor() {
  const c = document.getElementById('addon-editor'); if (!c) return;
  c.innerHTML = editingAddons.map((a, i) => `
    <div class="addon-row">
      <input placeholder="Nome do adicional" value="${a.name || ''}" oninput="editingAddons[${i}].name=this.value">
      <input class="apr" type="number" step="0.01" min="0" placeholder="0.00" value="${a.price || 0}" oninput="editingAddons[${i}].price=parseFloat(this.value)||0">
      <button class="bdel-a" onclick="removeAddonRow(${i})">✕</button>
    </div>`).join('');
}

function addAddonRow() { editingAddons.push({ name: '', price: 0 }); renderAddonEditor(); }
function removeAddonRow(i) { editingAddons.splice(i, 1); renderAddonEditor(); }

async function saveItem() {
  const name = document.getElementById('mi-n').value.trim();
  const price = parseFloat(document.getElementById('mi-p').value);
  if (!name || isNaN(price)) { showToast('⚠️', 'Preencha nome e preço.'); return; }
  const sizes = document.getElementById('mi-s').value.split(',').map(s => s.trim()).filter(Boolean);
  const addons = editingAddons.filter(a => a.name.trim()).map(a => ({ name: a.name.trim(), price: parseFloat(a.price) || 0 }));
  const payload = {
    emoji: document.getElementById('mi-e').value || '🍽️',
    name, description: document.getElementById('mi-d').value,
    price, category: document.getElementById('mi-c').value,
    sizes, addons
  };
  if (editingItemId) {
    await supabase.from('menu_items').update(payload).eq('id', editingItemId);
    showToast('✅', 'Item atualizado!');
  } else {
    await supabase.from('menu_items').insert({ ...payload, popular: false, available: true });
    showToast('✅', 'Item adicionado!');
  }
  await loadMenu();
  closeM('m-item'); renderMenuAdm();
}

async function deleteItem(id) {
  await supabase.from('menu_items').delete().eq('id', id);
  showToast('🗑️', 'Removido.'); await loadMenu(); renderMenuAdm();
}

// ---- CLIENTES ----
async function renderClients() {
  await loadClients();
  const b = document.getElementById('admbody');
  if (!clients.length) { b.innerHTML = '<div class="empty"><p>Nenhum cliente cadastrado.</p></div>'; return; }
  b.innerHTML = `<p style="font-size:12px;color:var(--text2);margin-bottom:11px">${clients.length} cliente(s)</p>` +
    clients.map(c => `
      <div class="crow">
        <div class="cav">${c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
        <div class="cinf">
          <p class="cnm">${c.name}${c.blocked ? '<span style="margin-left:6px;background:rgba(255,68,68,.15);color:var(--danger);border:.5px solid rgba(255,68,68,.3);border-radius:10px;font-size:10px;padding:2px 7px">Bloqueado</span>' : ''}</p>
          <p class="cph">${c.phone}</p>
          <p class="cord">${c.orders_count || 0} pedido(s)</p>
        </div>
      </div>`).join('');
}

// ---- CONFIG ----
function renderConfig() {
  const b = document.getElementById('admbody');
  b.innerHTML = `
    <div class="ssec">
      <p class="sstit">WhatsApp do dono</p>
      <label class="lbl">Número (DDD + número, sem código do país)</label>
      <input class="inp" id="cfg-wa" value="${settings.whatsapp}" placeholder="Ex: 35999990000" oninput="checkWA()" style="margin-bottom:6px">
      <div class="wa-status" id="wa-status">${settings.whatsapp ? '<span style="color:var(--success)">✔ Número salvo: ' + settings.whatsapp + '</span>' : ''}</div>
      <button class="bsec" style="margin-top:8px" id="wa-save-btn" onclick="saveCfgWA()">Salvar número</button>
    </div>
    <div class="ssec">
      <p class="sstit">Alterar senha do admin</p>
      <label class="lbl">Nova senha (mín. 4 dígitos)</label>
      <input class="inp" id="cfg-pass" type="password" placeholder="Nova senha" style="margin-bottom:7px">
      <button class="bsec" style="margin-top:0" onclick="saveCfgPass()">Alterar senha</button>
    </div>
    <div class="ssec">
      <p class="sstit">Restaurante</p>
      <div class="srow2">
        <div><p class="slbl">Aberto para pedidos</p><p class="ssub2">Clientes podem fazer pedidos</p></div>
        <label class="toggle">
          <input type="checkbox" ${settings.open ? 'checked' : ''} onchange="saveSettings({open:this.checked});showToast('✅',this.checked?'Aberto!':'Fechado.')">
          <span class="togsl"></span>
        </label>
      </div>
    </div>`;
}

function validateWA(n) {
  const d = dig(n);
  if (d.length === 10 || d.length === 11) return { ok: true, msg: 'Número válido (' + d + ')' };
  if (d.length === 0) return { ok: null, msg: '' };
  return { ok: false, msg: 'Inválido: use DDD + número (10 ou 11 dígitos)' };
}
function checkWA() {
  const val = document.getElementById('cfg-wa').value;
  const r = validateWA(val);
  const s = document.getElementById('wa-status');
  const btn = document.getElementById('wa-save-btn');
  if (r.ok === null) { s.innerHTML = ''; btn.disabled = false; return; }
  if (r.ok) { s.innerHTML = `<span style="color:var(--success)">✔ ${r.msg}</span>`; btn.disabled = false; }
  else { s.innerHTML = `<span style="color:var(--danger)">✖ ${r.msg}</span>`; btn.disabled = true; }
}
async function saveCfgWA() {
  const val = document.getElementById('cfg-wa').value.trim();
  const r = validateWA(val);
  if (!r.ok && val !== '') { showToast('⚠️', 'Número inválido.'); return; }
  await saveSettings({ whatsapp: val });
  showToast('✅', val ? 'WhatsApp salvo!' : 'WhatsApp removido.');
}
async function saveCfgPass() {
  const p = document.getElementById('cfg-pass').value;
  if (p.length < 4) { showToast('⚠️', 'Senha mínima de 4 dígitos.'); return; }
  if (p === SUPER_ADMIN_PASS) { showToast('⚠️', 'Essa senha é reservada.'); return; }
  await saveSettings({ admin_pass: p });
  document.getElementById('cfg-pass').value = '';
  showToast('✅', 'Senha alterada!');
}

// ============================================================
//  SUPER ADMIN
// ============================================================
function saTab(t) {
  curSaTab = t;
  ['visao', 'usuarios', 'sistema'].forEach(x => document.getElementById('sat-' + x).classList.toggle('active', x === t));
  renderSaTab();
}

function renderSaTab() {
  if (curSaTab === 'visao') renderSaVisao();
  else if (curSaTab === 'usuarios') renderSaUsuarios();
  else renderSaSistema();
}

async function renderSaVisao() {
  await loadClients();
  await loadOrders();
  const b = document.getElementById('sadmbody');
  const blocked = clients.filter(c => c.blocked).length;
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  b.innerHTML = `
    <div style="background:rgba(192,0,74,.06);border:.5px solid rgba(192,0,74,.2);border-radius:var(--r);padding:13px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <span style="font-size:22px">🛡</span>
      <div><p style="font-size:13px;font-weight:600">Acesso Super Admin</p><p style="font-size:11px;color:#5a2040;margin-top:2px">Painel de controle avançado — use com responsabilidade.</p></div>
    </div>
    <div class="sa-stat-grid">
      <div class="sa-stat"><div class="sa-stat-val">${clients.length}</div><div class="sa-stat-lbl">Clientes</div></div>
      <div class="sa-stat"><div class="sa-stat-val">${blocked}</div><div class="sa-stat-lbl">Bloqueados</div></div>
      <div class="sa-stat"><div class="sa-stat-val">${orders.length}</div><div class="sa-stat-lbl">Pedidos</div></div>
      <div class="sa-stat"><div class="sa-stat-val" style="font-size:15px">${fmt(revenue)}</div><div class="sa-stat-lbl">Receita</div></div>
    </div>
    <div class="danger-card">
      <p class="dc-title">🔴 Status do sistema</p>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <p style="font-size:13px;font-weight:600">${settings.locked ? '🔴 Sistema bloqueado' : '🟢 Sistema ativo'}</p>
          <p style="font-size:11px;color:#5a2040;margin-top:3px">${settings.locked ? 'Nenhum usuário pode acessar' : 'Acesso normal para todos'}</p>
        </div>
        <button onclick="saTab('sistema')" style="background:#1a0010;border:.5px solid rgba(192,0,74,.25);color:#c0004a;border-radius:var(--rs);padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Gerenciar</button>
      </div>
    </div>`;
}

async function renderSaUsuarios() {
  await loadClients();
  const b = document.getElementById('sadmbody');
  if (!clients.length) { b.innerHTML = '<div class="empty" style="color:#5a2040"><p>Nenhum cliente cadastrado.</p></div>'; return; }
  b.innerHTML = `<p style="font-size:12px;color:#5a2040;margin-bottom:11px">${clients.length} conta(s)</p>` +
    clients.map((c, i) => `
      <div class="sa-client-row${c.blocked ? ' sa-blocked' : ''}">
        <div class="sa-cav">${c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
        <div class="sa-cinf">
          <p class="sa-cnm">${c.name} ${c.blocked ? '<span class="badge-blocked">Bloqueado</span>' : ''}</p>
          <p class="sa-cph">${c.phone}</p>
          <p class="sa-cord">${c.orders_count || 0} pedido(s)</p>
        </div>
        <div class="sa-actions">
          ${c.blocked
        ? `<button class="sa-btn btn-unblock" onclick="confirmSA('unblock',${i})">🔓 Desbloquear</button>`
        : `<button class="sa-btn btn-block" onclick="confirmSA('block_user',${i})">🚫 Bloquear</button>`}
          <button class="sa-btn btn-del" onclick="confirmSA('delete',${i})">🗑️</button>
        </div>
      </div>`).join('');
}

function renderSaSistema() {
  const b = document.getElementById('sadmbody');
  b.innerHTML = `
    <div class="danger-card">
      <p class="dc-title">⚡ Controle do sistema</p>
      <p style="font-size:13px;color:#f0ede8;margin-bottom:6px">Status: <strong style="color:${settings.locked ? '#c0004a' : 'var(--success)'}">${settings.locked ? '🔴 BLOQUEADO' : '🟢 ATIVO'}</strong></p>
      <p style="font-size:12px;color:#5a2040;margin-bottom:12px">
        ${settings.locked
      ? 'O app está bloqueado. Clique abaixo para reativar.'
      : 'Ao bloquear, nenhum cliente conseguirá acessar o app.'}
      </p>
      ${settings.locked
      ? `<button class="sadm-btn-green" onclick="confirmSA('unlock')">🔓 Reativar sistema</button>`
      : `<label class="lbl" style="color:#7a4060">Motivo do bloqueio (aparece na tela para clientes)</label>
           <input class="sa-inp" id="lock-reason" placeholder="Ex: Manutenção, fechado hoje..." style="margin-bottom:10px">
           <button class="sadm-btn-red" onclick="confirmSA('lock')">🔒 Bloquear sistema agora</button>`}
    </div>
    <div class="danger-card" style="margin-top:10px">
      <p class="dc-title">🗑️ Limpar dados</p>
      <button class="sadm-btn-red" style="margin-bottom:8px" onclick="confirmSA('clearOrders')">🔄 Limpar todos os pedidos</button>
      <button class="sadm-btn-red" onclick="confirmSA('clearClients')">👥 Remover todos os clientes</button>
    </div>`;
}

// ---- CONFIRM SUPER ADMIN ----
function confirmSA(action, idx) {
  const msgs = {
    lock: ['🔒', 'Bloquear o sistema?', 'Todos os clientes perderão acesso imediatamente.', 'Bloquear'],
    unlock: ['🔓', 'Reativar o sistema?', 'O app voltará a funcionar normalmente.', 'Reativar'],
    delete: ['🗑️', 'Excluir cadastro?', `"${clients[idx]?.name}" será removido permanentemente.`, 'Excluir'],
    block_user: ['🚫', 'Bloquear usuário?', `"${clients[idx]?.name}" não conseguirá mais fazer login.`, 'Bloquear'],
    unblock: ['✅', 'Desbloquear usuário?', `"${clients[idx]?.name}" voltará a ter acesso.`, 'Desbloquear'],
    clearOrders: ['🔄', 'Limpar pedidos?', 'Todos os pedidos serão excluídos. Ação irreversível.', 'Limpar'],
    clearClients: ['👥', 'Remover clientes?', 'Todos os cadastros serão excluídos permanentemente.', 'Remover'],
  };
  const [icon, title, sub, btn] = msgs[action] || ['⚠️', 'Confirmar', 'Tem certeza?', 'Confirmar'];
  document.getElementById('cm-icon').textContent = icon;
  document.getElementById('cm-title').textContent = title;
  document.getElementById('cm-sub').textContent = sub;
  document.getElementById('cm-btn').textContent = btn;
  confirmAction = { action, idx };
  openM('m-confirm');
}

async function execConfirm() {
  if (!confirmAction) return;
  const { action, idx } = confirmAction;
  closeM('m-confirm');

  if (action === 'lock') {
    const reason = document.getElementById('lock-reason')?.value || 'Sistema temporariamente indisponível';
    await saveSettings({ locked: true, lock_msg: reason.toUpperCase() });
    checkLockdown();
    showToast('🔒', 'Sistema bloqueado!');
    renderSaSistema();
  }
  else if (action === 'unlock') {
    await saveSettings({ locked: false });
    checkLockdown();
    showToast('🟢', 'Sistema reativado!');
    renderSaSistema();
  }
  else if (action === 'delete' && idx !== undefined) {
    const c = clients[idx];
    await supabase.from('clients').delete().eq('id', c.id);
    if (currentUser && currentUser.id === c.id) { currentUser = null; updateUBtn(); }
    showToast('🗑️', 'Cadastro excluído.');
    renderSaUsuarios();
  }
  else if (action === 'block_user' && idx !== undefined) {
    const c = clients[idx];
    await supabase.from('clients').update({ blocked: true }).eq('id', c.id);
    if (currentUser && currentUser.id === c.id) { currentUser = null; updateUBtn(); }
    showToast('🚫', 'Usuário bloqueado.');
    renderSaUsuarios();
  }
  else if (action === 'unblock' && idx !== undefined) {
    await supabase.from('clients').update({ blocked: false }).eq('id', clients[idx].id);
    showToast('✅', 'Usuário desbloqueado.');
    renderSaUsuarios();
  }
  else if (action === 'clearOrders') {
    await supabase.from('orders').delete().neq('id', 0);
    orders = [];
    showToast('🔄', 'Pedidos removidos.');
    renderSaSistema();
  }
  else if (action === 'clearClients') {
    await supabase.from('clients').delete().neq('id', 0);
    clients = []; currentUser = null; updateUBtn();
    showToast('👥', 'Clientes removidos.');
    renderSaUsuarios();
  }
  confirmAction = null;
}

// ============================================================
//  UTILITÁRIOS
// ============================================================
function openM(id) { document.getElementById(id).classList.add('open'); }
function closeM(id) { document.getElementById(id).classList.remove('open'); }

function showErr(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

let toastTimer;
function showToast(icon, msg) {
  const t = document.getElementById('toast');
  document.getElementById('ti').textContent = icon;
  document.getElementById('tm').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ---- Inicia o app ----
window.addEventListener('DOMContentLoaded', () => {
  init();
  setOT('delivery');
  setPay('dinheiro');
  setTroco(false);
});
