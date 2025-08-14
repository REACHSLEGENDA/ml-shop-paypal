import React from "react";

/**
 * Shop estilo Mercado Libre (client-only)
 * - Catálogo amplio + filtros, búsqueda y ordenamiento
 * - Vistas: Inicio, Categorías, Carrito, Checkout, Detalle, PayPal (Sim), Éxito, Cancelado
 * - Carrito con localStorage
 * - Pago: SIMULADO + **PayPal Simulado (pantalla estilo PayPal)** sin backend
 */

// ------------------------ Self-tests (no UI) ------------------------
function runSelfTests(){
  try{
    console.assert(fmtMoney(1234,"MXN").includes("$"),"fmtMoney debería formatear moneda");
    console.assert(clamp(200,0,100)===100,"clamp límite superior");
    console.assert(clamp(-1,0,10)===0,"clamp límite inferior");
    // Validación de Client ID (se conserva para tests; no cargamos SDK)
    console.assert(validateClientId("").ok===false,"clientId vacío inválido");
    console.assert(validateClientId("abcd").ok===false,"clientId muy corto inválido");
    console.assert(validateClientId("PV7FVRP28JNHG").ok===false,"clientId corto de ejemplo inválido");
    console.assert(validateClientId("correo@dominio.com").ok===false,"emails no son Client ID (REST)");
    console.assert(validateClientId("A".repeat(28)).ok===true,"clientId largo válido");
    // buildSdkUrl tests (solo string)
    const url = buildSdkUrl({clientId:"A".repeat(28), currency:"MXN", intent:"CAPTURE", components:"buttons"});
    console.assert(url.startsWith("https://www.paypal.com/sdk/js?"),"URL base SDK");
    console.assert(url.includes("client-id="),"URL contiene client-id");
    console.assert(url.includes("currency=MXN"),"URL currency");
    // Simulated payments
    const o = simulateCreateOrder({amount: 123.45, currency: 'MXN'});
    console.assert(o && o.id.startsWith('SIM-') && o.status==='CREATED', 'simulateCreateOrder');
    const c = simulateCaptureOrder(o);
    console.assert(c && c.status==='COMPLETED' && c.purchase_units[0].payments.captures[0].status==='COMPLETED', 'simulateCaptureOrder');
    // PayPal Standard payload (no usado en UI, solo test)
    const baseReturn = 'https://tenda.test/return';
    const payload = buildPayPalStandardPayload({
      business:'seller@example.com', amount: 10, currency:'MXN', item_name:'Prueba', returnUrl:baseReturn, cancelUrl: baseReturn+'?cancel=1'
    });
    console.assert(payload.cmd === '_xclick', 'cmd _xclick');
    console.assert(payload.business === 'seller@example.com', 'business presente');
    console.assert(payload.currency_code === 'MXN', 'currency_code MXN');
    console.assert(payload.amount === '10.00', 'monto formateado');
    console.assert(/^https?:\/\//.test(payload.return) && /^https?:\/\//.test(payload.cancel_return), 'URLs válidas');
    console.log("✅ Self-tests núcleo OK");
  }catch(e){ console.warn("⚠️ Self-tests núcleo fallidos",e); }
}
runSelfTests();

// ---------------- Utilidades & hooks ----------------
function useLocalStorage(key, initial) {
  const [val, setVal] = React.useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; } catch { return initial; }
  });
  React.useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}
function fmtMoney(n = 0, currency = "MXN") {
  try { return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(n); }
  catch { return `$${Number(n || 0).toFixed(2)}`; }
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function placeholder(t = "?") {
  const code = encodeURIComponent(String(t).slice(0, 2).toUpperCase());
  return `https://dummyimage.com/600x450/e2e8f0/475569&text=${code}`;
}
function mask(id=""){ const s=String(id); return s.length>10? `${s.slice(0,6)}…${s.slice(-4)}` : s; }
function validateClientId(id){
  const s = String(id||"").trim();
  if(!s) return {ok:false, reason:"Falta el Client ID"};
  if(/@|\s|https?:\/\//i.test(s)) return {ok:false, reason:"No pegues un correo/URL; pega el Client ID de tu app PayPal (REST)"};
  if(s.length < 20 || s.length > 180) return {ok:false, reason:"Client ID con longitud inválida"};
  if(!/^[A-Za-z0-9_-]+$/.test(s)) return {ok:false, reason:"Caracteres inválidos en Client ID"};
  if(/^sb$/i.test(s)) return {ok:false, reason:"'sb' no es un Client ID válido"};
  return {ok:true};
}

// --- PayPal SDK helpers (solo para tests; NO se usa en UI) ---
function buildSdkUrl({ clientId, currency="MXN", intent="CAPTURE", components="buttons", debug=false }){
  const params = new URLSearchParams();
  params.set("client-id", clientId);
  params.set("currency", currency);
  params.set("intent", intent);
  params.set("components", components);
  params.set("enable-funding", "paypal");
  params.set("data-sdk-integration-source", "custom-react");
  if(debug) params.set("debug", "true");
  return `https://www.paypal.com/sdk/js?${params.toString()}`;
}

// --- Simulación REST estilo PayPal (no hay llamadas reales) ---
function simulateCreateOrder({ amount, currency='MXN' }){
  const id = `SIM-${Date.now()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  return {
    id,
    status: 'CREATED',
    intent: 'CAPTURE',
    purchase_units: [
      { amount: { currency_code: currency, value: (Math.round(amount*100)/100).toFixed(2) } }
    ]
  };
}
function simulateCaptureOrder(order){
  const value = order?.purchase_units?.[0]?.amount?.value || '0.00';
  const currency = order?.purchase_units?.[0]?.amount?.currency_code || 'MXN';
  return {
    id: order.id,
    status: 'COMPLETED',
    purchase_units: [
      {
        payments: {
          captures: [
            { id: `CAP-${Date.now()}`, status: 'COMPLETED', amount: { value, currency_code: currency } }
          ]
        }
      }
    ],
    payer: { name: { given_name: 'Demo', surname: 'User' }, email_address: 'demo@buyer.test' }
  };
}

// --- PayPal Standard (Redirect) helpers — no usado en UI, se deja por si lo activas luego ---
function buildPayPalStandardPayload({business, amount, currency, item_name, returnUrl, cancelUrl}){
  return {
    cmd: '_xclick',
    business: String(business||'').trim(),
    currency_code: currency || 'MXN',
    amount: (Math.round((amount||0)*100)/100).toFixed(2),
    item_name: item_name || 'Compra Kovex Shop',
    no_note: '1',
    bn: 'PP-BuyNowBF:btn_buynow_LG.gif:NonHostedGuest',
    return: returnUrl,
    cancel_return: cancelUrl
  };
}
function postRedirect(action, payload){
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.target = '_self';
  Object.entries(payload).forEach(([k,v])=>{
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k; input.value = String(v);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  setTimeout(()=>{ try{form.remove();}catch{} }, 1000);
}

// ---------------- Catálogo (más productos) ----------------
const CATALOG = [
  // Cómputo
  { id: "p-101", title: "Laptop 15\" Ryzen 7", price: 18999, category: "Cómputo", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop", discount: 10 },
  { id: "p-102", title: "Laptop Ultrabook i5 13\"", price: 14999, category: "Cómputo", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-103", title: "SSD NVMe 1TB Gen4", price: 1399, category: "Cómputo", image: "https://images.unsplash.com/photo-1542751110-97427bbecf20?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-104", title: "Teclado Mecánico RGB", price: 899, category: "Cómputo", image: "https://images.unsplash.com/photo-1517502166878-35c93a0072a7?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-105", title: "Mouse Gamer 8K", price: 599, category: "Cómputo", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop" },
  // Gaming
  { id: "p-201", title: "Nintendo Switch OLED", price: 6999, category: "Gaming", image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop", discount: 5 },
  { id: "p-202", title: "Control Xbox Wireless", price: 1299, category: "Gaming", image: "https://images.unsplash.com/photo-1542751110-97427bbecf20?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-203", title: "Silla Gamer Ergonómica", price: 2599, category: "Gaming", image: "https://images.unsplash.com/photo-1597784087572-4f2c0c7c3c15?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-204", title: "Monitor 27\" 144Hz", price: 4299, category: "Gaming", image: "https://images.unsplash.com/photo-1517059224940-d4af9eec41e5?q=80&w=1200&auto=format&fit=crop" },
  // Audio
  { id: "p-301", title: "Audífonos Bluetooth ANC", price: 1299, category: "Audio", image: "https://images.unsplash.com/photo-1518441902110-5815b1fd70a6?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-302", title: "Barra de Sonido 2.1", price: 1899, category: "Audio", image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-303", title: "Micrófono USB Pro", price: 1499, category: "Audio", image: "https://images.unsplash.com/photo-1512273222628-4daea6e55abb?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-304", title: "Bocina Portátil IPX7", price: 999, category: "Audio", image: "https://images.unsplash.com/photo-1518441902110-5815b1fd70a6?q=80&w=1200&auto=format&fit=crop", discount: 15 },
  // Hogar
  { id: "p-401", title: "Aspiradora Robot Smart", price: 4999, category: "Hogar", image: "https://images.unsplash.com/photo-1560185008-b033106af2cf?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-402", title: "Cámara WiFi 1080p", price: 549, category: "Hogar", image: "https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-403", title: "Tira LED RGB 5m", price: 299, category: "Hogar", image: "https://images.unsplash.com/photo-1545235617-9465d2a55698?q=80&w=1200&auto=format&fit=crop" },
  // Móviles & Wearables
  { id: "p-501", title: "Smartphone 6.7\" 256GB", price: 12999, category: "Móviles", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-502", title: "Cargador 65W GaN", price: 499, category: "Móviles", image: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-503", title: "Smartwatch AMOLED", price: 1899, category: "Wearables", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-504", title: "True Wireless Earbuds", price: 899, category: "Wearables", image: "https://images.unsplash.com/photo-1518441902110-5815b1fd70a6?q=80&w=1200&auto=format&fit=crop" },
  // Accesorios
  { id: "p-601", title: "Mochila Antirrobo 15\"", price: 699, category: "Accesorios", image: "https://images.unsplash.com/photo-1520975954732-35dd222996f6?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-602", title: "Hub USB-C 8 en 1", price: 749, category: "Accesorios", image: "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-603", title: "Webcam 1080p", price: 649, category: "Accesorios", image: "https://images.unsplash.com/photo-1517059224940-d4af9eec41e5?q=80&w=1200&auto=format&fit=crop" },
  { id: "p-604", title: "Base Enfriadora Laptop", price: 399, category: "Accesorios", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop" }
];
const CATEGORIES = ["Todo", ...Array.from(new Set(CATALOG.map(p => p.category)))];

// ---------------- Estilos rápidos ----------------
function StyleTag() {
  return (
    <style>{`
*{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
:root{--bg:#f8fafc;--card:#fff;--muted:#667085;--ring:#e5e7eb;--text:#0f172a;--accent:#142C8E;--accent2:#0070ba}
.app{min-height:100vh;background:linear-gradient(120deg,#f8fafc,#eef2ff)}
.container{max-width:1200px;margin:0 auto;padding:20px}
.header{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.85);backdrop-filter:blur(8px);border-bottom:1px solid #e5e7eb}
.header .inner{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 20px}
.brand{display:flex;align-items:center;gap:10px}
.logo{font-size:22px;font-weight:900;color:#0f172a}
.badge{padding:4px 10px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:12px;border:1px solid #c7d2fe}
.nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.tab{border:1px solid var(--ring);background:#fff;padding:8px 12px;border-radius:10px;cursor:pointer}
.tab.active{background:var(--accent2);color:#fff;border-color:var(--accent2)}
.searchbar{display:flex;gap:8px;flex-wrap:wrap}
.searchbar input, .searchbar select{padding:10px 12px;border:1px solid var(--ring);border-radius:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--ring);border-radius:14px;overflow:hidden}
.card-img{height:160px}
.card-img img{width:100%;height:100%;object-fit:cover;display:block}
.card-body{padding:12px;display:grid;gap:8px}
.price{font-weight:800;font-size:18px}
.button{appearance:none;border:0;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;background:var(--accent2);color:#fff}
.button:hover{filter:brightness(.95)}
.button.alt{background:#2C2E83}
.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}
.hero{display:grid;grid-template-columns:1fr;gap:12px;margin:16px 0}
.hero .banner{border:1px solid var(--ring);border-radius:16px;padding:18px;background:#fff}
.list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
.list li{display:grid;grid-template-columns:64px 1fr auto auto;gap:12px;align-items:center}
.list img{width:64px;height:64px;object-fit:cover;border-radius:8px}
.qty{display:inline-flex;align-items:center;border:1px solid var(--ring);border-radius:8px;overflow:hidden}
.qty input{width:56px;border-left:1px solid var(--ring);border-right:1px solid var(--ring);text-align:center}
.summary{display:grid;gap:6px;padding-top:10px;border-top:1px solid var(--ring);margin-top:10px}
.footer{border-top:1px solid var(--ring);padding:18px;text-align:center;color:#64748b;background:#fff;margin-top:30px}
.detail{display:grid;grid-template-columns:1fr;gap:18px}
.detail .gallery{border:1px solid var(--ring);border-radius:16px;background:#fff}
.detail .info{border:1px solid var(--ring);border-radius:16px;background:#fff;padding:16px}
@media(min-width:960px){.detail{grid-template-columns:1.2fr 1fr}}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:40}
.modal{background:#fff;border:1px solid var(--ring);border-radius:16px;max-width:720px;width:96%;padding:16px}
.error{background:#fee2e2;color:#991b1b;border:1px solid #fecaca;border-radius:12px;padding:10px}
.infoBox{background:#ecfeff;border:1px solid #a5f3fc;border-radius:12px;padding:10px}
.spinner{display:inline-block;width:18px;height:18px;border:3px solid #cbd5e1;border-top-color:#4f46e5;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* PayPal Sim look */
.pp-head{background:linear-gradient(90deg,#003087,#009cde);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px;border-radius:12px}
.pp-logo{font-weight:900;letter-spacing:0.5px}
.pp-box{border:1px solid #dbeafe;background:#f8fafc;border-radius:12px;padding:16px}
`}</style>
  );
}

// ---------------- Componentes ----------------
function Header({ view, setView, cartCount, totalAmount }) {
  return (
    <div className="header">
      <div className="inner">
        <div className="brand">
          <div className="logo">Kovex Shop</div>
          <span className="badge">ML-style</span>
        </div>
        <div className="nav">
          {[['home','Inicio'],['cats','Categorías'],['cart','Carrito'],['checkout','Checkout']].map(([v,label]) => (
            <button key={v} className={`tab ${view===v?'active':''}`} onClick={()=>setView(v)}>{label}</button>
          ))}
          <div style={{display:'flex',alignItems:'center',gap:8,borderLeft:'1px solid #e5e7eb',paddingLeft:10}}>
            <span>🛒 <b>{cartCount}</b> · <b>{fmtMoney(totalAmount)}</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ p, onAdd, onOpen }) {
  return (
    <article className="card">
      <div className="card-img">
        <img
          src={p.image}
          alt={p.title}
          onError={(e)=>{ e.currentTarget.src = placeholder(p.title); }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      <div className="card-body">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:800}}>{p.title}</h3>
          {p.discount ? <span className="badge" style={{background:'#fef3c7',borderColor:'#fde68a',color:'#92400e'}}> -{p.discount}% </span> : null}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div className="price">{fmtMoney(p.price)}</div>
          <div style={{display:'flex',gap:8}}>
            <button className="button alt" onClick={() => onOpen(p)}>Ver</button>
            <button className="button" onClick={() => onAdd(p)}>Agregar</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CartList({ cart, changeQty, removeItem }) {
  return (
    <ul className="list">
      {cart.map(it => (
        <li key={it.id}>
          <img src={it.image || placeholder(it.title)} alt="" />
          <div className="meta" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>{it.title}</div>
            <div style={{ color:'#667085' }}>{it.quantity} × {fmtMoney(it.price)}</div>
            <div className="qty">
              <button onClick={() => changeQty(it.id, it.quantity - 1)} style={{ padding: "6px 10px", border: 0, background: "#fff" }}>−</button>
              <input type="number" min="1" max="99" value={it.quantity} onChange={e => changeQty(it.id, parseInt(e.target.value || "1"))} />
              <button onClick={() => changeQty(it.id, it.quantity + 1)} style={{ padding: "6px 10px", border: 0, background: "#fff" }}>+</button>
            </div>
          </div>
          <div className="item-price">{fmtMoney(it.price * it.quantity)}</div>
          <button className="tab" onClick={() => removeItem(it.id)} style={{color:'#be123c',borderColor:'#fecdd3'}}>Quitar</button>
        </li>
      ))}
    </ul>
  );
}

function FiltersBar({ search, setSearch, category, setCategory, sort, setSort }) {
  return (
    <div className="searchbar" style={{margin:'12px 0'}}>
      <input placeholder="Buscar producto…" value={search} onChange={e=>setSearch(e.target.value)} />
      <select value={category} onChange={e=>setCategory(e.target.value)}>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={sort} onChange={e=>setSort(e.target.value)}>
        <option value="rel">Relevancia</option>
        <option value="asc">Precio: menor a mayor</option>
        <option value="desc">Precio: mayor a menor</option>
        <option value="off">Con descuento</option>
      </select>
    </div>
  );
}

function HomeView({ products, onAdd, onOpen, search, setSearch, category, setCategory, sort, setSort }) {
  return (
    <div className="container">
      <section className="hero">
        <div className="banner">
          <b>Ofertas relámpago</b>
          <div style={{color:'#64748b',marginTop:6}}>Aprovecha descuentos en audio, gaming y cómputo. ¡Hoy termina!</div>
        </div>
        <div className="banner">
          <b>Envíos rápidos</b>
          <div style={{color:'#64748b',marginTop:6}}>Entrega en 24-48h en zonas seleccionadas.</div>
        </div>
      </section>
      <FiltersBar {...{search,setSearch,category,setCategory,sort,setSort}} />
      <section className="grid">
        {products.map(p => (
          <ProductCard key={p.id} p={p} onAdd={onAdd} onOpen={onOpen} />
        ))}
      </section>
    </div>
  );
}

function CategoriesView({ setCategory, category, products, onAdd, onOpen }) {
  const cats = category === "Todo" ? CATEGORIES.filter(c => c !== "Todo") : [category];
  const groups = cats.map(c => ({ name: c, items: products.filter(p => p.category === c) }));
  return (
    <div className="container">
      <div className="toolbar">
        {CATEGORIES.map(c => (
          <button key={c} className={`tab ${category===c?'active':''}`} onClick={()=>setCategory(c)}>{c}</button>
        ))}
      </div>
      {groups.map(g => (
        <div key={g.name} style={{margin:'18px 0'}}>
          <h3 style={{margin:'8px 0'}}>{g.name}</h3>
          <div className="grid">
            {g.items.map(p => <ProductCard key={p.id} p={p} onAdd={onAdd} onOpen={onOpen} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function CartView({ cart, changeQty, removeItem, totalQty, totalAmount, onCheckout }) {
  return (
    <div className="container">
      <h2>Tu carrito</h2>
      {cart.length === 0 ? <div style={{color:'#64748b'}}>Aún no agregas productos.</div> : (
        <>
          <CartList cart={cart} changeQty={changeQty} removeItem={removeItem} />
          <div className="summary">
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Artículos</span><b>{totalQty}</b></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Subtotal</span><b>{fmtMoney(totalAmount)}</b></div>
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <button className="button" onClick={onCheckout}>Ir a pagar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Pago SIMULADO (no hay red, estructura tipo REST) ---
function SimulatedPayArea({ amount, currency, onSuccess }){
  const [processing, setProcessing] = React.useState(false);
  const handlePay = async ()=>{
    setProcessing(true);
    await new Promise(r=>setTimeout(r, 700));
    const order = simulateCreateOrder({ amount, currency });
    const details = simulateCaptureOrder(order);
    setProcessing(false);
    onSuccess?.(details);
  };
  return (
    <div className="pp-box">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div>
          <div><b>Pago simulado</b> (sin cargos reales)</div>
          <div style={{fontSize:12,color:'#64748b'}}>Devuelve objeto tipo REST (<code>id</code>, <code>status</code>, <code>captures[0]</code>…)</div>
        </div>
        <button className="button" onClick={handlePay} disabled={processing}>{processing? 'Procesando…' : 'Pagar simulado'}</button>
      </div>
    </div>
  );
}

// --- PayPal Simulado (pantalla estilo PayPal) ---
function PayPalSimView({ pending, setPending, onSuccess, onCancel }){
  const amount = Number(pending?.amount||0);
  const currency = pending?.currency || 'MXN';
  const merchant = pending?.merchant || 'Kovex Shop';

  const approve = async()=>{
    const order = simulateCreateOrder({ amount, currency });
    const details = simulateCaptureOrder(order);
    onSuccess?.(details);
    setPending(null);
  };
  const cancel = ()=>{ setPending(null); onCancel?.(); };

  return (
    <div className="container" style={{maxWidth:740}}>
      <div className="pp-head" style={{marginTop:16}}>
        <span className="pp-logo">PayPal</span>
        <span style={{opacity:.9}}>· Pago seguro</span>
      </div>
      <div className="pp-box" style={{marginTop:12}}>
        <div style={{display:'grid',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:14,color:'#475569'}}>Comercio</div>
              <div style={{fontWeight:800}}>{merchant}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:14,color:'#475569'}}>Total</div>
              <div style={{fontSize:22,fontWeight:900}}>{fmtMoney(amount,currency)}</div>
            </div>
          </div>

          <div style={{display:'grid',gap:8,marginTop:6}}>
            <label style={{display:'grid',gap:4}}>
              <span style={{fontSize:12,color:'#64748b'}}>Correo del comprador (simulado)</span>
              <input placeholder="buyer@paypal.test" defaultValue="buyer@paypal.test" style={{padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:10}}/>
            </label>
            <label style={{display:'grid',gap:4}}>
              <span style={{fontSize:12,color:'#64748b'}}>Nombre (simulado)</span>
              <input placeholder="Demo User" defaultValue="Demo User" style={{padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:10}}/>
            </label>
          </div>

          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8,flexWrap:'wrap'}}>
            <button className="tab" onClick={cancel}>Cancelar</button>
            <button className="button" onClick={approve}>Aceptar y pagar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutView({ cart, totalQty, totalAmount, clearCart, setView, setLastPayment, setPending }) {
  const currency = "MXN";
  const handleSuccess = (details)=>{
    const capture = details?.purchase_units?.[0]?.payments?.captures?.[0];
    setLastPayment({
      orderID: details?.id,
      payerName: details?.payer?.name?.given_name ? `${details.payer.name.given_name} ${details.payer.name.surname||''}`.trim() : 'Cliente',
      payerEmail: details?.payer?.email_address || '',
      amount: capture?.amount || { value: (Math.round(totalAmount*100)/100).toFixed(2), currency_code: currency },
      status: capture?.status || details?.status || 'COMPLETED'
    });
    clearCart();
    setView('success');
  };

  return (
    <div className="container">
      <h2>Checkout</h2>
      {cart.length === 0 ? (
        <div style={{color:'#64748b'}}>Tu carrito está vacío.</div>
      ) : (
        <div className="detail">
          <div className="gallery">
            <ul className="list" style={{padding:16}}>
              {cart.map(it => (
                <li key={it.id}>
                  <img src={it.image || placeholder(it.title)} alt="" />
                  <div style={{fontWeight:700}}>{it.title}</div>
                  <div style={{color:'#64748b'}}>{it.quantity} × {fmtMoney(it.price)}</div>
                  <div className="item-price">{fmtMoney(it.price*it.quantity)}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="info">
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Artículos</span><b>{totalQty}</b></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:18,marginTop:8}}><b>Total</b><b>{fmtMoney(totalAmount)}</b></div>

            <div style={{display:'grid',gap:12,marginTop:14}}>
              <SimulatedPayArea amount={totalAmount} currency={currency} onSuccess={handleSuccess} />
              <div style={{textAlign:'center',color:'#94a3b8'}}>o</div>
              <div className="pp-box">
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <div>
                    <div style={{fontWeight:800}}>Pagar con PayPal (simulado)</div>
                    <div style={{fontSize:12,color:'#64748b'}}>Redirige a una pantalla estilo PayPal dentro de la app.</div>
                  </div>
                  <button className="button" onClick={()=>{
                    setPending({ amount: totalAmount, currency, merchant: 'Kovex Shop' });
                    setView('pp-sim');
                  }}>Ir a PayPal</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

function SuccessView({ payment, onGoHome }){
  return (
    <div className="container">
      <h2>¡Pago completado!</h2>
      {payment ? (
        <div className="detail">
          <div className="info">
            <div style={{marginBottom:8}}><b>Orden:</b> {payment.orderID}</div>
            <div style={{marginBottom:8}}><b>Pagado por:</b> {payment.payerName} {payment.payerEmail ? `(${payment.payerEmail})` : ''}</div>
            <div style={{fontSize:18}}><b>Total:</b> <b>{fmtMoney(Number(payment.amount?.value||0))}</b></div>
            <div className="summary" style={{marginTop:12}}>
              <button className="button" onClick={onGoHome}>Seguir comprando</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="info">No hay información de pago.</div>
      )}
    </div>
  );
}

function CancelView({ onGoHome }){
  return (
    <div className="container">
      <h2>Pago cancelado</h2>
      <p className="muted">Puedes intentar de nuevo cuando quieras.</p>
      <button className="button" onClick={onGoHome}>Regresar a la tienda</button>
    </div>
  );
}

function ProductDetail({ product, onAdd, onClose }) {
  if (!product) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div style={{borderRadius:12,overflow:'hidden',border:'1px solid #e5e7eb',height:320,background:`url(${product.image}) center/cover no-repeat`}} />
          <div>
            <h3 style={{marginTop:0}}>{product.title}</h3>
            <div className="price">{fmtMoney(product.price)}</div>
            <div style={{color:'#64748b',margin:'8px 0'}}>Categoría: {product.category}</div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button className="button" onClick={()=>onAdd(product)}>Agregar al carrito</button>
              <button className="tab" onClick={onClose}>Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- App principal ----------------
export default function App() {
  const [view, setView] = React.useState("home");
  const [cart, setCart] = useLocalStorage("cart", []);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("Todo");
  const [sort, setSort] = React.useState("rel");
  const [activeProduct, setActiveProduct] = React.useState(null);
  const [lastPayment, setLastPayment] = React.useState(null);
  const [pendingPP, setPendingPP] = React.useState(null);

  const totalQty = cart.reduce((a, b) => a + b.quantity, 0);
  const totalAmount = cart.reduce((a, b) => a + (b.price * b.quantity), 0);

  React.useEffect(()=>{ window.scrollTo({top:0, behavior:'smooth'}); },[view]);

  function addToCart(p) {
    setCart(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = { ...copy[idx], quantity: clamp(copy[idx].quantity + 1, 1, 99) }; return copy; }
      return [...prev, { ...p, quantity: 1 }];
    });
  }
  const changeQty = (id, qty) => setCart(prev => prev.map(x => x.id === id ? { ...x, quantity: clamp(qty, 1, 99) } : x));
  const removeItem = (id) => setCart(prev => prev.filter(x => x.id !== id));
  const clearCart = () => setCart([]);

  // Filtro/ordenamiento
  const filtered = React.useMemo(() => {
    let arr = CATALOG.slice();
    if (category !== "Todo") arr = arr.filter(p => p.category === category);
    if (search.trim()) { const t = search.toLowerCase(); arr = arr.filter(p => p.title.toLowerCase().includes(t)); }
    switch (sort) { case "asc": arr.sort((a, b) => a.price - b.price); break; case "desc": arr.sort((a, b) => b.price - a.price); break; case "off": arr = arr.filter(p => p.discount); break; default: break; }
    return arr;
  }, [search, category, sort]);

  return (
    <div className="app">
      <StyleTag />
      <Header {...{ view, setView, cartCount: totalQty, totalAmount }} />

      {view === "home" && (
        <HomeView products={filtered} onAdd={addToCart} onOpen={setActiveProduct} {...{search,setSearch,category,setCategory,sort,setSort}} />
      )}

      {view === "cats" && (
        <CategoriesView setCategory={setCategory} category={category} products={CATALOG} onAdd={addToCart} onOpen={setActiveProduct} />
      )}

      {view === "cart" && (
        <CartView cart={cart} changeQty={changeQty} removeItem={removeItem} totalQty={totalQty} totalAmount={totalAmount} onCheckout={() => setView("checkout")} />
      )}

      {view === "checkout" && (
        <CheckoutView cart={cart} totalQty={totalQty} totalAmount={totalAmount} clearCart={clearCart} setView={setView} setLastPayment={setLastPayment} setPending={setPendingPP} />
      )}

      {view === "pp-sim" && (
        <PayPalSimView
          pending={pendingPP}
          setPending={setPendingPP}
          onSuccess={(details)=>{
            const capture = details?.purchase_units?.[0]?.payments?.captures?.[0];
            setLastPayment({
              orderID: details?.id,
              payerName: 'Cliente',
              payerEmail: 'buyer@paypal.test',
              amount: capture?.amount,
              status: capture?.status || 'COMPLETED'
            });
            clearCart();
            setView('success');
          }}
          onCancel={()=> setView('cancel')}
        />
      )}

      {view === "success" && (
        <SuccessView payment={lastPayment} onGoHome={() => setView('home')} />
      )}

      {view === "cancel" && (
        <CancelView onGoHome={() => setView('home')} />
      )}

      {activeProduct && (
        <ProductDetail product={activeProduct} onAdd={addToCart} onClose={()=>setActiveProduct(null)} />
      )}

      <footer className="footer">Hecho con ❤️ para demos tipo marketplace.</footer>
    </div>
  );
}
