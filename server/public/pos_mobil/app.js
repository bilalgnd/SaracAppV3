// SARAÇOGLU DÖNER - POS Mobil App2 Web Build (Full Realtime App1 POS Sync with App1 Product & Text Colors)
const e = React.createElement;
const { useState, useEffect, useRef } = React;

function formatOrderNote(note) {
  if (!note || typeof note !== 'string') return '';
  const trimmed = note.trim();
  if (!trimmed) return '';

  if (trimmed.includes('\n')) {
    return trimmed
      .split('\n')
      .map(l => l.trim().replace(/^[,.\s-]+|[,.\s-]+$/g, ''))
      .filter(Boolean)
      .join('\n');
  }

  let raw = trimmed;
  let phone = '';
  const phoneRegex = /(?:TEL:?\s*)?(?:0?\s*[5][0-9]{2}[\s\.-]?[0-9]{3}[\s\.-]?[0-9]{2}[\s\.-]?[0-9]{2}|0?[5][0-9]{9})/gi;
  const phoneMatch = raw.match(phoneRegex);
  if (phoneMatch && phoneMatch.length > 0) {
    phone = phoneMatch[0].trim();
    raw = raw.replace(phoneMatch[0], '').trim();
  }

  let line1 = '';
  let line2 = '';

  const mahCadMatch = raw.match(/^(.*?\b(?:MAH\.|MAHALLESİ|MAH|CAD\.|CADDESİ|CAD)\b)/i);
  const fullMahCadMatch = raw.match(/^(.*?\b(?:MAH\.|MAHALLESİ|MAH)\b.*?\b(?:CAD\.|CADDESİ|CAD)\b)/i);

  if (fullMahCadMatch) {
    line1 = fullMahCadMatch[1].trim();
    line2 = raw.substring(fullMahCadMatch[1].length).trim();
  } else if (mahCadMatch) {
    line1 = mahCadMatch[1].trim();
    line2 = raw.substring(mahCadMatch[1].length).trim();
  } else {
    const sokakMatch = raw.match(/^(.*?)(?=\b\d+\.?\s*(?:SKK|SK|SOKAK)\b|\b(?:SKK|SK|SOKAK)\b|\b(?:NO|N|D|DAİRE|KAT|BLOK)\s*\d+)/i);
    if (sokakMatch && sokakMatch[1].trim()) {
      line1 = sokakMatch[1].trim();
      line2 = raw.substring(sokakMatch[1].length).trim();
    } else {
      line1 = raw;
    }
  }

  const clean = (s) => s.replace(/^[,.\s-]+|[,.\s-]+$/g, '').trim();
  line1 = clean(line1);
  line2 = clean(line2);
  phone = clean(phone);

  const result = [line1, line2, phone].filter(Boolean);
  return result.join('\n');
}

function App2Mobile() {
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [isMasalarOpen, setIsMasalarOpen] = useState(false); // Initial view: Products Grid
  const [menu, setMenu] = useState({ categories: [] });
  const [menuLoading, setMenuLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [dailyTotal, setDailyTotal] = useState(parseFloat(localStorage.getItem('dailyTotal') || '0'));
  const [waiterColor, setWaiterColor] = useState(localStorage.getItem('waiterColor') || '#E91E63');

  // Table Editing / İlave State
  const [editingOrderIndex, setEditingOrderIndex] = useState(null);
  const [cart, setCart] = useState([]);
  const [orderNote, setOrderNote] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Modals
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Fetch Menu dynamically from logged-in sarac account (App1 backend)
  const fetchMenu = async () => {
    const endpoints = ['/api/public/menu?shop=sarac', '/api/public/menu', '/api/menu', '/menu'];
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (res.ok) {
          const data = await res.json();
          if (data && data.categories && data.categories.length > 0) {
            setMenu(data);
            setMenuLoading(false);
            return;
          }
        }
      } catch (err) {}
    }
    setMenuLoading(false);
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders?shop=sarac');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setOrders(data);
      }
    } catch (e) { console.error('Orders fetch error:', e); }
  };

  const [tvCardScale, setTvCardScale] = useState(100);

  const fetchTvScale = async () => {
    try {
      const res = await fetch('/daily_total?shop=sarac');
      if (res.ok) {
        const data = await res.json();
        if (data && data.tvCardScale) setTvCardScale(data.tvCardScale);
      }
    } catch (e) {}
  };

  // Polling Menu (5s), Orders (3s), and TV Scale (4s) for live sync with App1 & tv-sarac!
  useEffect(() => {
    fetchMenu();
    fetchOrders();
    fetchTvScale();
    const intervalOrders = setInterval(fetchOrders, 3000);
    const intervalMenu = setInterval(fetchMenu, 5000);
    const intervalTvScale = setInterval(fetchTvScale, 4000);
    return () => {
      clearInterval(intervalOrders);
      clearInterval(intervalMenu);
      clearInterval(intervalTvScale);
    };
  }, []);

  const handleSelectWaiterColor = (color) => {
    setWaiterColor(color);
    localStorage.setItem('waiterColor', color);
  };

  const saveOrdersToServer = async (newOrders) => {
    setOrders(newOrders);
    try {
      await fetch('/api/orders?shop=sarac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrders)
      });
    } catch (e) { console.error(e); }
  };

  const handleSendOrder = () => {
    if (cart.length === 0 && !orderNote.trim()) return;

    let targetName = customerName.trim();
    if (!targetName && editingOrderIndex !== null && orders[editingOrderIndex]) {
      targetName = orders[editingOrderIndex].customer_name;
    }
    if (!targetName) {
      let no = 1;
      while (orders.some(o => o.customer_name === `Masa ${no}`)) no++;
      targetName = `Masa ${no}`;
    }

    const cartSum = cart.reduce((s, x) => s + x.price, 0);

    if (editingOrderIndex !== null && orders[editingOrderIndex]) {
      const newOrders = [...orders];
      const existing = newOrders[editingOrderIndex];
      const mergedItems = [...(existing.items || []), ...cart];
      const updatedTotal = mergedItems.reduce((s, x) => s + x.price, 0);

      newOrders[editingOrderIndex] = {
        customer_name: targetName,
        order_note: orderNote.trim() || existing.order_note,
        time: existing.time,
        items: mergedItems,
        total_amount: updatedTotal,
        renk: existing.renk || waiterColor,
        status: existing.status || 'waiting'
      };
      saveOrdersToServer(newOrders);
    } else {
      const newOrder = {
        customer_name: targetName,
        order_note: orderNote.trim(),
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        items: cart,
        total_amount: cartSum,
        renk: waiterColor,
        status: 'waiting'
      };
      saveOrdersToServer([newOrder, ...orders]);
    }

    setCart([]);
    setOrderNote('');
    setCustomerName('');
    setEditingOrderIndex(null);
    setIsMasalarOpen(false); // Stay on product grid after order send
  };

  const handleCancelIlave = () => {
    setCart([]);
    setOrderNote('');
    setCustomerName('');
    setEditingOrderIndex(null);
  };

  const handleCompleteOrder = (idx) => {
    const orderToClose = orders[idx];
    if (!orderToClose) return;
    const newOrders = orders.filter((_, i) => i !== idx);
    saveOrdersToServer(newOrders);

    const newTotal = dailyTotal + orderToClose.total_amount;
    setDailyTotal(newTotal);
    localStorage.setItem('dailyTotal', newTotal.toString());
  };

  // Helper fallback background color if product has no custom color in App1
  const getCardBg = (name, catIdx) => {
    const n = (name || '').toLowerCase();
    if (n.includes('tombik')) return '#FF7F00';
    if (n.includes('xl dürüm') || n.includes('xl durum')) return '#F9A825';
    if (n.includes('dürüm') || n.includes('durum')) return '#F9A825';
    if (n.includes('usul')) return '#D32F2F';
    if (n.includes('porsiyon') || n.includes('beyti') || n.includes('iskender') || n.includes('pilav')) return '#880000';
    if (n.includes('kampy') || n.includes('500gr') || n.includes('gr')) return '#388E3C';
    if (catIdx === 2 || n.includes('kola') || n.includes('ayran') || n === 'su' || n.includes('soda')) return '#1E3A8A';
    return '#D84315';
  };

  const categories = menu.categories || [];
  const currentCategory = categories[activeCategoryIndex] || categories[0] || { items: [] };
  const cartSum = cart.reduce((s, x) => s + x.price, 0);
  const isIlave = editingOrderIndex !== null;

  return e('div', { style: { minHeight: '100vh', backgroundColor: '#000000', color: '#FFFFFF' } },
    
    // Top Header Bar
    e('div', { className: 'mobile-app-header', style: { backgroundColor: isIlave ? '#10B981' : '#000000' } },
      e('div', null,
        isIlave ? (
          e('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            e('button', { style: { background: 'transparent', border: 'none', color: 'white', fontSize: 20, fontWeight: 'bold', cursor: 'pointer' }, onClick: handleCancelIlave }, '‹ Geri'),
            e('div', { style: { fontSize: 20, fontWeight: '800', color: 'white' } }, (orders[editingOrderIndex]?.customer_name || 'Masa') + ' İlave')
          )
        ) : isMasalarOpen ? (
          e('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            e('button', { style: { background: 'transparent', border: 'none', color: 'white', fontSize: 20, fontWeight: 'bold', cursor: 'pointer' }, onClick: () => setIsMasalarOpen(false) }, '‹ Geri'),
            e('div', { style: { fontSize: 22, fontWeight: '900', color: 'white' } }, 'Açık Masalar')
          )
        ) : (
          e('div', null,
            e('div', { className: 'mobile-brand-title' }, 'VANTAGE'),
            e('div', { style: { fontSize: 13, color: '#9CA3AF', fontWeight: '600', marginTop: 2 } }, 'vantage (ACC-WYLTYL)')
          )
        )
      ),
      !isIlave && e('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        e('button', { className: 'header-action-btn', onClick: () => setIsReportsOpen(true), title: 'Günlük Rapor' },
          e('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
            e('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
            e('path', { d: 'M7 16v-4' }),
            e('path', { d: 'M12 16V8' }),
            e('path', { d: 'M17 16v-6' })
          )
        ),
        e('button', { className: 'header-action-btn', onClick: () => setIsSettingsOpen(true), title: 'Ayarlar' },
          e('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
            e('circle', { cx: 12, cy: 12, r: 3 }),
            e('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' })
          )
        )
      )
    ),

    // Category Tabs Bar
    !isMasalarOpen && categories.length > 0 && e('div', { className: 'category-bar-container' },
      categories.map((cat, idx) => 
        e('button', {
          key: idx,
          className: 'category-tab ' + (activeCategoryIndex === idx ? 'active' : ''),
          onClick: () => setActiveCategoryIndex(idx)
        }, cat.name.toUpperCase())
      )
    ),

    // Content Body
    isMasalarOpen ? (
      // AÇIK MASALAR SCREEN
      e('div', { style: { padding: 16, paddingBottom: 100 } },
        orders.length === 0 ? (
          e('div', { style: { textAlign: 'center', marginTop: 80, color: '#888', fontSize: 16 } }, 'Açık masa bulunmuyor.')
        ) : (
          orders.map((ord, idx) => 
            e('div', { key: idx, className: 'app2-table-card', style: { backgroundColor: '#1C1C1E', borderRadius: 20, padding: 18, marginBottom: 16, border: '1px solid #2C2C2E' } },
              
              // Top Title Line: Garson Theme Color Circle Dot + Masa Name (Time) + Edit Pencil + Green Price (22px Bold)
              e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
                e('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                  e('span', { style: { color: ord.renk || waiterColor, fontSize: 16 } }, '●'),
                  e('span', { style: { fontWeight: '900', fontSize: 20, color: '#FFF' } }, ord.customer_name + ' (' + (ord.time || '') + ')'),
                  e('button', { style: { background: 'transparent', border: 'none', color: '#AAA', cursor: 'pointer', fontSize: 16 }, onClick: () => { setEditingOrderIndex(idx); setIsMasalarOpen(false); } }, '✏️')
                ),
                e('div', { style: { color: '#4CAF50', fontWeight: '900', fontSize: 22 } }, ord.total_amount + ' ₺')
              ),

              // Order Note Pencil Edit Row
              ord.order_note ? e('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0 8px' } },
                e('span', { style: { color: '#4CAF50', fontSize: 14, fontWeight: 'bold', textAlign: 'center', whiteSpace: 'pre-wrap', lineHeight: 1.35 } }, '📝 ' + formatOrderNote(ord.order_note)),
                e('button', { style: { background: 'transparent', border: 'none', color: '#AAA', cursor: 'pointer', fontSize: 14, marginLeft: 4 }, onClick: () => { setEditingOrderIndex(idx); setIsMasalarOpen(false); } }, '✏️')
              ) : e('div', { style: { display: 'flex', justifyContent: 'center', margin: '2px 0 6px' } },
                e('button', { style: { background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }, onClick: () => { setEditingOrderIndex(idx); setIsMasalarOpen(false); } }, '📝')
              ),

              // Divider Line
              e('div', { style: { height: 1, backgroundColor: '#333336', margin: '10px 0 14px' } }),

              // Items List
              e('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 } },
                (ord.items || []).map((it, itemIdx) => 
                  e('div', { key: itemIdx },
                    e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 } },
                      e('span', { style: { fontWeight: '800', fontSize: 16, color: '#FFF' } }, '• ' + (it.quantity || 1) + 'x ' + it.name + (it.portion && it.portion !== 'Standart' ? ' (' + it.portion + ')' : '')),
                      e('span', { style: { color: '#4CAF50', fontWeight: '800', fontSize: 16 } }, it.price + ' ₺')
                    ),
                    e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121212', padding: '8px 12px', borderRadius: 10, marginTop: 2 } },
                      e('span', { style: { fontSize: 12, color: '#AAA' } }, '↳ ' + (it.quantity || 1) + 'x ' + it.name + (it.notes ? ' (' + it.notes + ')' : '')),
                      e('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                        e('span', { style: { fontSize: 12, color: '#AAA', marginRight: 6 } }, it.price + ' ₺'),
                        e('button', { style: { background: '#2C2C2E', border: 'none', color: '#FFF', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }, onClick: () => { setEditingOrderIndex(idx); setIsMasalarOpen(false); } }, '✏️'),
                        e('button', { style: { background: '#7F1D1D', border: 'none', color: '#FFF', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }, onClick: () => {
                          const newOrders = [...orders];
                          newOrders[idx].items.splice(itemIdx, 1);
                          newOrders[idx].total_amount = newOrders[idx].items.reduce((s, x) => s + x.price, 0);
                          if (newOrders[idx].items.length === 0) newOrders.splice(idx, 1);
                          saveOrdersToServer(newOrders);
                        } }, '✕')
                      )
                    )
                  )
                )
              ),

              // Red Outline + Button
              e('button', {
                style: {
                  width: '100%', height: 44, borderRadius: 12,
                  border: '1.5px solid #FF5252', background: 'transparent',
                  color: '#FF5252', fontSize: 24, fontWeight: 'bold', cursor: 'pointer',
                  marginBottom: 10
                },
                onClick: () => { setEditingOrderIndex(idx); setIsMasalarOpen(false); }
              }, '+'),

              // Bottom Split Buttons (Printer & Double Check)
              e('div', { style: { display: 'flex', gap: 12 } },
                e('button', {
                  style: {
                    flex: 1, height: 48, borderRadius: 14, border: 'none',
                    background: '#3A3A3C', color: '#FFF', fontSize: 20, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  },
                  onClick: () => {
                    fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ord) }).catch(e => console.error(e));
                  }
                }, '🖨️'),

                e('button', {
                  style: {
                    flex: 1, height: 48, borderRadius: 14, border: 'none',
                    background: '#2E7D32', color: '#FFF', fontSize: 22, fontWeight: 'bold', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  },
                  onClick: () => handleCompleteOrder(idx)
                }, '✓✓')
              )
            )
          )
        )
      )
    ) : (
      // PRODUCT GRID WITH APP1 CUSTOM PRODUCT & TEXT COLORS
      e('div', { className: 'product-grid' },
        menuLoading ? (
          e('div', { style: { gridColumn: 'span 2', textAlign: 'center', marginTop: 80, color: '#888' } }, 'Menü yükleniyor...')
        ) : (currentCategory.items || []).map((prod, idx) => {
          const cardBg = prod.color || getCardBg(prod.name, activeCategoryIndex);
          const cardTextColor = prod.textColor || '#FFFFFF';
          const price = prod.options?.[0]?.price || 0;
          return e('button', { key: idx, className: 'product-card', style: { backgroundColor: cardBg, color: cardTextColor }, onClick: () => setSelectedProduct(prod) },
            e('div', { className: 'product-card-title', style: { color: cardTextColor } }, prod.name),
            e('div', { className: 'product-card-price', style: { color: cardTextColor } }, price + ' ₺')
          );
        })
      )
    ),

    // Floating Masalar FAB (ONLY SHOWN IF OPEN ORDERS COUNT > 0 AND NOT ALREADY ON MASALAR VIEW)
    orders.length > 0 && !isMasalarOpen && !isIlave && e('button', { className: 'masalar-fab', onClick: () => setIsMasalarOpen(true) },
      e('span', null, 'Masalar'),
      e('span', { style: { backgroundColor: 'white', color: '#D84315', borderRadius: '50%', padding: '2px 6px', fontSize: 12, fontWeight: '900' } }, orders.length)
    ),

    // İlave / Cart Bottom Bar
    (cart.length > 0 || isIlave) && e('div', { className: 'ilave-bottom-bar' },
      e('div', { style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: '#1A1A1A', borderRadius: 12, padding: '8px 12px', border: '1px solid #333' } },
        e('span', { style: { color: '#888' } }, '✏️'),
        e('input', { placeholder: 'Sipariş notu...', value: orderNote, onChange: e => setOrderNote(e.target.value), style: { background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%', fontSize: 14 } })
      ),

      e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' } },
        e('div', null,
          e('div', { style: { fontSize: 11, color: '#888', fontWeight: 'bold' } }, 'MASA:'),
          e('div', { style: { fontSize: 20, fontWeight: '900', color: '#FFF' } }, 
            (customerName || (orders[editingOrderIndex]?.customer_name) || 'Masa') + ': ' + cartSum + ' ₺ ', 
            e('span', { style: { fontSize: 13, color: '#10B981', fontWeight: 'normal' } }, '(' + cart.length + ' Ürün)')
          )
        ),
        e('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          e('button', { style: { width: 44, height: 44, borderRadius: 12, border: 'none', background: '#2C2C2E', color: '#FF5252', fontSize: 18, cursor: 'pointer' }, onClick: handleCancelIlave }, '✕'),
          e('button', { style: { height: 44, padding: '0 24px', borderRadius: 12, border: 'none', background: '#10B981', color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' }, onClick: handleSendOrder }, 'Gönder')
        )
      )
    ),

    // Customization Sheet Modal
    selectedProduct && e(ProductCustomizationModal, {
      product: selectedProduct,
      menu: menu,
      currentMasaName: customerName,
      onClose: () => setSelectedProduct(null),
      onAdd: (item, targetMasa) => {
        setCart(prev => [...prev, item]);
        if (targetMasa && targetMasa.trim()) {
          setCustomerName(targetMasa.trim());
        }
      }
    }),

    // Daily Reports Modal
    isReportsOpen && e(DailyReportsModal, { orders: orders, onClose: () => setIsReportsOpen(false) }),

    // Settings Modal
    isSettingsOpen && e(SettingsModal, {
      waiterColor: waiterColor,
      tvCardScale: tvCardScale,
      setTvCardScale: setTvCardScale,
      onSelectColor: handleSelectWaiterColor,
      onClose: () => setIsSettingsOpen(false)
    })
  );
}

function ProductCustomizationModal({ product, menu, currentMasaName, onClose, onAdd }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedPortion, setSelectedPortion] = useState(product.options?.[0]?.portion || '100gr');
  const [portionPrice, setPortionPrice] = useState(product.options?.[0]?.price || 0);
  const [chips, setChips] = useState({});
  const [drinkCounts, setDrinkCounts] = useState({});
  const [customNote, setCustomNote] = useState('');
  const [masaName, setMasaName] = useState(currentMasaName || '');
  const [paymentType, setPaymentType] = useState('');

  const ingredients = ['Soğansız', 'Domatessiz', 'Patatessiz', 'Ketçapsız', 'Mayonezsiz', 'Turşusuz', 'Soğanlı', 'Domatesli', 'Patatesli', 'Ketçaplı', 'Mayonezli', 'Turşulu'];
  const freeExtras = ['Cheddarlı (+70₺)', 'Kaşarlı (+70₺)', 'Karışık', 'Acılı', 'Sade Et', 'Soslu', 'Gemi', 'Kayık'];
  const paymentTypes = ['POS', 'NAKİT', 'Paket'];

  const drinksCat = menu?.categories?.find(c => c.id === 'drinks' || c.name.toLowerCase().includes('içecek') || c.name.toLowerCase().includes('icecek'));
  const drinksMenu = drinksCat?.items || [];

  let extraPrice = 0;
  if (chips['Cheddarlı (+70₺)']) extraPrice += 70;
  if (chips['Kaşarlı (+70₺)']) extraPrice += 70;

  let drinksTotal = 0;
  Object.entries(drinkCounts).forEach(([dName, cnt]) => {
    const dItem = drinksMenu.find(d => d.name === dName);
    if (dItem && cnt > 0) drinksTotal += (dItem.options[0].price * cnt);
  });

  const totalAmount = (portionPrice + extraPrice) * quantity + drinksTotal;

  const handleConfirmAdd = () => {
    const notesArr = Object.keys(chips).filter(k => chips[k]);
    if (paymentType) notesArr.push('Ödeme: ' + paymentType);
    if (customNote.trim()) notesArr.push(customNote.trim());

    const itemPrice = portionPrice + extraPrice;
    const targetMasa = masaName.trim();

    for (let i = 0; i < quantity; i++) {
      onAdd({
        name: product.name,
        portion: selectedPortion,
        price: itemPrice,
        notes: notesArr.join(', ')
      }, targetMasa);
    }

    Object.entries(drinkCounts).forEach(([dName, cnt]) => {
      if (cnt > 0) {
        const dItem = drinksMenu.find(d => d.name === dName);
        if (dItem) {
          for (let i = 0; i < cnt; i++) {
            onAdd({
              name: dItem.name,
              portion: dItem.options[0].portion,
              price: dItem.options[0].price,
              notes: ''
            }, targetMasa);
          }
        }
      }
    });

    onClose();
  };

  return e('div', { className: 'modal-overlay', onClick: onClose },
    e('div', { className: 'modal-sheet', onClick: e => e.stopPropagation() },
      e('div', { style: { display: 'flex', justifyContent: 'center', paddingTop: 10 } },
        e('div', { style: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#555' } })
      ),

      e('div', { style: { padding: '15px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        e('h2', { style: { fontSize: 24, fontWeight: '800', color: '#FFF' } }, product.name),
        e('div', { style: { display: 'flex', alignItems: 'center', background: '#2A2A2A', borderRadius: 14, padding: '4px 10px' } },
          e('button', { style: { width: 32, height: 32, borderRadius: '50%', background: 'transparent', color: '#FFF', fontSize: 22, border: 'none', cursor: 'pointer' }, onClick: () => setQuantity(Math.max(1, quantity - 1)) }, '−'),
          e('span', { style: { width: 36, textAlign: 'center', fontSize: 20, fontWeight: '900', color: '#FF5252' } }, quantity),
          e('button', { style: { width: 32, height: 32, borderRadius: '50%', background: 'transparent', color: '#FFF', fontSize: 22, border: 'none', cursor: 'pointer' }, onClick: () => setQuantity(quantity + 1) }, '+')
        )
      ),

      e('div', { style: { padding: '10px 20px 20px', flex: 1, overflowY: 'auto' } },
        e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 } },
          product.options.map((opt, i) => {
            const isSel = selectedPortion === opt.portion;
            return e('button', {
              key: i,
              style: {
                height: 42, borderRadius: 12, fontSize: 13, fontWeight: 'bold',
                backgroundColor: isSel ? '#4CAF50' : 'transparent',
                border: '1px solid ' + (isSel ? '#4CAF50' : '#444'),
                color: isSel ? '#FFF' : '#CCC', cursor: 'pointer'
              },
              onClick: () => { setSelectedPortion(opt.portion); setPortionPrice(opt.price); }
            }, opt.portion === 'Standart' ? (opt.price + '₺') : (opt.portion + ' (' + opt.price + '₺)'));
          })
        ),

        e('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 } },
            ingredients.map((chip, i) => {
              const isSel = !!chips[chip];
              const color = chip.endsWith('siz') || chip.endsWith('suz') || chip.endsWith('sız') ? '#9C27B0' : '#E91E63';
              return e('button', { key: i, className: 'chip-btn', style: { borderColor: color, backgroundColor: isSel ? color : 'transparent', color: isSel ? '#FFF' : color }, onClick: () => setChips(prev => ({ ...prev, [chip]: !prev[chip] })) }, chip);
            })
          ),

          e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 } },
            freeExtras.map((chip, i) => {
              const isSel = !!chips[chip];
              const color = chip.includes('cheddar') || chip.includes('kaşarlı') ? '#FBC02D' : '#00ACC1';
              return e('button', { key: i, className: 'chip-btn', style: { borderColor: color, backgroundColor: isSel ? color : 'transparent', color: isSel ? '#FFF' : color }, onClick: () => setChips(prev => ({ ...prev, [chip]: !prev[chip] })) }, chip);
            })
          ),

          e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 } },
            paymentTypes.map((pt, i) => {
              const isSel = paymentType === pt;
              return e('button', { key: i, className: 'chip-btn', style: { borderColor: isSel ? '#FFF' : '#666', backgroundColor: isSel ? '#FFF' : 'transparent', color: isSel ? '#000' : '#FFF' }, onClick: () => setPaymentType(isSel ? '' : pt) }, pt);
            })
          )
        ),

        drinksMenu.length > 0 && e('div', { style: { marginTop: 16 } },
          e('div', { style: { fontSize: 14, color: '#FF5722', marginBottom: 8, fontWeight: '800' } }, 'Hızlı İçecek Ekle'),
          e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 } },
            drinksMenu.map((drink, i) => {
              const cnt = drinkCounts[drink.name] || 0;
              return e('button', {
                key: i,
                className: 'drink-quick-btn',
                onClick: () => setDrinkCounts(prev => ({ ...prev, [drink.name]: (prev[drink.name] || 0) + 1 })),
                onContextMenu: (ev) => { ev.preventDefault(); setDrinkCounts(prev => ({ ...prev, [drink.name]: Math.max(0, (prev[drink.name] || 0) - 1) })); }
              },
                drink.name,
                cnt > 0 && e('div', { style: { position: 'absolute', top: -4, right: -4, background: '#FF5252', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, cnt)
              );
            })
          )
        ),

        e('div', { style: { marginTop: 14 } },
          e('input', { placeholder: 'Özel Sipariş Notu (Örn: Çok pişsin)', value: customNote, onChange: e => setCustomNote(e.target.value), style: { width: '100%', padding: '12px 14px', background: '#1A1A1A', border: '1px solid #333', borderRadius: 10, color: 'white', fontSize: 14, marginBottom: 8 } }),
          e('input', { placeholder: 'Masa No / İsim', value: masaName, onChange: e => setMasaName(e.target.value), style: { width: '100%', padding: '12px 14px', background: '#1A1A1A', border: '1px solid #333', borderRadius: 10, color: 'white', fontSize: 14 } })
        )
      ),

      e('div', { style: { padding: '12px 20px calc(env(safe-area-inset-bottom, 12px) + 8px)', background: '#181818' } },
        e('button', { style: { width: '100%', height: 50, borderRadius: 16, backgroundColor: '#FF5252', color: 'white', fontSize: 16, fontWeight: 900, border: 'none', cursor: 'pointer' }, onClick: handleConfirmAdd }, 'Sepete Ekle - TOPLAM: ' + totalAmount + ' ₺')
      )
    )
  );
}

function DailyReportsModal({ orders, onClose }) {
  const todayRev = orders.reduce((s, o) => s + o.total_amount, 0);

  return e('div', { className: 'modal-overlay', onClick: onClose },
    e('div', { className: 'modal-sheet', style: { height: '90vh', padding: 20, overflowY: 'auto' }, onClick: e => e.stopPropagation() },
      e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 } },
        e('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          e('button', { style: { background: 'transparent', border: 'none', color: 'white', fontSize: 20, fontWeight: 'bold', cursor: 'pointer' }, onClick: onClose }, '‹ Geri'),
          e('h2', { style: { fontSize: 22, fontWeight: '900', color: '#FFF' } }, 'Günlük Rapor')
        ),
        e('button', { style: { background: '#D32F2F', border: 'none', color: '#FFF', padding: '8px 14px', borderRadius: 20, fontWeight: 'bold', fontSize: 13 } }, '🗑️ Verileri Sıfırla')
      ),

      e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 } },
        e('div', { style: { background: '#0D2312', border: '1px solid #1E4620', padding: 16, borderRadius: 16 } }, e('div', { style: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 6 } }, 'Bugünkü Ciro'), e('div', { style: { color: '#4CAF50', fontSize: 26, fontWeight: '900' } }, todayRev + ' ₺')),
        e('div', { style: { background: '#1A1A1C', border: '1px solid #2C2C2E', padding: 16, borderRadius: 16 } }, e('div', { style: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 6 } }, 'Haftalık Ciro'), e('div', { style: { color: '#FFF', fontSize: 26, fontWeight: '900' } }, '33680 ₺')),
        e('div', { style: { background: '#1A1A1C', border: '1px solid #2C2C2E', padding: 16, borderRadius: 16 } }, e('div', { style: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 6 } }, 'Bugünkü Sipariş'), e('div', { style: { color: '#FFF', fontSize: 26, fontWeight: '900' } }, orders.length + ' Adet')),
        e('div', { style: { background: '#1A1A1C', border: '1px solid #2C2C2E', padding: 16, borderRadius: 16 } }, e('div', { style: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 6 } }, 'Haftalık Sipariş'), e('div', { style: { color: '#FFF', fontSize: 26, fontWeight: '900' } }, '40 Adet')),
        e('div', { style: { background: '#2A1D0E', border: '1px solid #4A331A', padding: 16, borderRadius: 16 } }, e('div', { style: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 6 } }, 'Favori Döner'), e('div', { style: { color: '#FFB74D', fontSize: 22, fontWeight: '900' } }, 'Et Döner')),
        e('div', { style: { background: '#0D1E32', border: '1px solid #1A365D', padding: 16, borderRadius: 16 } }, e('div', { style: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 6 } }, 'Favori Ürün'), e('div', { style: { color: '#64B5F6', fontSize: 22, fontWeight: '900' } }, 'Et Porsiyon')),
        e('div', { style: { background: '#241417', border: '1px solid #422026', padding: 16, borderRadius: 16 } }, e('div', { style: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 6 } }, 'Satılan Döner'), e('div', { style: { color: '#EF9A9A', fontSize: 18, fontWeight: '900' } }, '0.22 ', e('span', { style: { fontSize: 11 } }, 'kg'))),
        e('div', { style: { background: '#1C152B', border: '1px solid #362952', padding: 16, borderRadius: 16 } }, e('div', { style: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 6 } }, 'Ortalama Sepet'), e('div', { style: { color: '#BA68C8', fontSize: 26, fontWeight: '900' } }, '440 ₺'))
      )
    )
  );
}

function SettingsModal({ waiterColor, tvCardScale, setTvCardScale, onSelectColor, onClose }) {
  const [ipVal, setIpVal] = useState('https://bilalgnd.shop');
  const [tvSaverMode, setTvSaverMode] = useState('dvd');
  const [audioSource, setAudioSource] = useState('spotify');

  const colorsList = [
    '#F44336', '#9C27B0', '#2196F3', '#4CAF50', '#FFEB3B', '#FF9800',
    '#795548', '#FFFFFF', '#E91E63', '#FF4081', '#0D47A1', '#B71C1C'
  ];

  // Send TV Screensaver Mode live to tv-sarac via server WebSockets
  const handleSelectTvSaver = (mode) => {
    setTvSaverMode(mode);
    fetch('/api/set_tv_screensaver?shop=sarac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    }).catch(e => console.error(e));
  };

  // Send TV Audio Source live to tv-sarac via server WebSockets (Spotify / Canlı Radyo)
  const handleSelectAudioSource = (source) => {
    setAudioSource(source);
    fetch('/api/set_tv_audio?shop=sarac', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source })
    }).catch(e => console.error(e));
  };

  return e('div', { className: 'modal-overlay', onClick: onClose },
    e('div', { className: 'modal-sheet', style: { height: '85vh', padding: 20 }, onClick: e => e.stopPropagation() },
      
      // Top Title Bar
      e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
        e('h2', { style: { fontSize: 22, fontWeight: '900', color: '#FFF' } }, '⚙ Ayarlar'),
        e('button', { style: { background: 'transparent', border: 'none', color: '#FFF', fontSize: 24, cursor: 'pointer' }, onClick: onClose }, '✕')
      ),

      // Tab line: Genel (green underline)
      e('div', { style: { borderBottom: '2px solid #4CAF50', color: '#4CAF50', fontWeight: 'bold', paddingBottom: 6, marginBottom: 16, fontSize: 14 } }, 'Genel'),

      // Scrollable Content
      e('div', { style: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 } },
        
        // Outlined Input: Kasa IP
        e('div', { style: { position: 'relative', border: '1px solid #555', borderRadius: 12, padding: '12px 14px', background: 'transparent' } },
          e('div', { style: { position: 'absolute', top: -10, left: 12, background: '#181818', padding: '0 6px', fontSize: 11, color: '#AAA', fontWeight: 'bold' } }, 'Kasa IP'),
          e('input', {
            value: ipVal,
            onChange: e => setIpVal(e.target.value),
            style: { background: 'transparent', border: 'none', color: '#FFF', fontSize: 15, fontWeight: 'bold', outline: 'none', width: '100%' }
          })
        ),

        // Active Account Info
        e('div', { style: { fontSize: 15, fontWeight: 'bold', color: '#FFF' } }, 'Geçerli Hesap: sarac'),

        // Logout Pill Button
        e('button', {
          style: {
            width: '100%', height: 48, borderRadius: 24,
            background: '#F44336', color: 'white', border: 'none',
            fontWeight: 'bold', fontSize: 16, cursor: 'pointer'
          }
        }, 'Çıkış Yap'),

        // TV EKRAN KORUYUCU Section
        e('div', null,
          e('div', { style: { fontSize: 12, color: '#AAA', fontWeight: 'bold', marginBottom: 8 } }, 'TV EKRAN KORUYUCU'),
          e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 } },
            e('button', {
              style: {
                height: 44, borderRadius: 12,
                border: tvSaverMode === 'dvd' ? '1.5px solid #4CAF50' : '1px solid #444',
                background: tvSaverMode === 'dvd' ? '#1B3E20' : '#262628',
                color: tvSaverMode === 'dvd' ? '#4CAF50' : '#FFF',
                fontWeight: 'bold', fontSize: 13, cursor: 'pointer'
              },
              onClick: () => handleSelectTvSaver('dvd')
            }, 'DVD Modu'),

            e('button', {
              style: {
                height: 44, borderRadius: 12,
                border: tvSaverMode === 'spotify' ? '1.5px solid #4CAF50' : '1px solid #444',
                background: tvSaverMode === 'spotify' ? '#1B3E20' : '#262628',
                color: tvSaverMode === 'spotify' ? '#4CAF50' : '#FFF',
                fontWeight: 'bold', fontSize: 13, cursor: 'pointer'
              },
              onClick: () => handleSelectTvSaver('spotify')
            }, 'Spotify Modu'),

            e('button', {
              style: {
                height: 44, borderRadius: 12,
                border: tvSaverMode === 'glow' ? '1.5px solid #4CAF50' : '1px solid #444',
                background: tvSaverMode === 'glow' ? '#1B3E20' : '#262628',
                color: tvSaverMode === 'glow' ? '#4CAF50' : '#FFF',
                fontWeight: 'bold', fontSize: 13, cursor: 'pointer'
              },
              onClick: () => handleSelectTvSaver('glow')
            }, 'Glow Modu'),

            e('button', {
              style: {
                height: 44, borderRadius: 12,
                border: tvSaverMode === 'off' ? '1.5px solid #4CAF50' : '1px solid #444',
                background: tvSaverMode === 'off' ? '#1B3E20' : '#262628',
                color: tvSaverMode === 'off' ? '#4CAF50' : '#FFF',
                fontWeight: 'bold', fontSize: 13, cursor: 'pointer'
              },
              onClick: () => handleSelectTvSaver('off')
            }, 'Off (Kapalı)')
          ),

          // TV KART BOYUTU (BÜYÜTEÇ) Slider
          e('div', { style: { marginTop: 12, background: '#1A1A1C', border: '1px solid #333', padding: '12px 14px', borderRadius: 14 } },
            e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
              e('span', { style: { color: '#FFF', fontWeight: 'bold', fontSize: 13 } }, '🔍 TV Mutfak Kart Boyutu'),
              e('span', { style: { color: '#4CAF50', fontWeight: 'bold', fontSize: 15 } }, (tvCardScale || 100) + '%')
            ),
            e('input', {
              type: 'range',
              min: 70,
              max: 200,
              step: 5,
              value: tvCardScale || 100,
              onChange: (evt) => {
                const val = parseInt(evt.target.value, 10);
                if (setTvCardScale) setTvCardScale(val);
                fetch('/api/set_tv_card_scale?shop=sarac', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scale: val })
                }).catch(e => console.error(e));
              },
              style: { width: '100%', accentColor: '#4CAF50', cursor: 'pointer' }
            })
          )
        ),

        // TV SES KAYNAĞI & RADYO Section
        e('div', null,
          e('div', { style: { fontSize: 12, color: '#AAA', fontWeight: 'bold', marginBottom: 8 } }, 'TV SES KAYNAĞI & RADYO'),
          e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 } },
            e('button', {
              style: {
                height: 44, borderRadius: 14,
                border: audioSource === 'spotify' ? '1.5px solid #FF9800' : '1px solid #444',
                background: audioSource === 'spotify' ? '#3E2723' : '#262628',
                color: audioSource === 'spotify' ? '#FFB74D' : '#FFF',
                fontWeight: 'bold', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              },
              onClick: () => handleSelectAudioSource('spotify')
            }, e('span', { style: { color: '#4CAF50' } }, '🟢'), 'Spotify'),

            e('button', {
              style: {
                height: 44, borderRadius: 14,
                border: audioSource === 'radio' ? '1.5px solid #FF9800' : '1px solid #444',
                background: audioSource === 'radio' ? '#3E2723' : '#262628',
                color: audioSource === 'radio' ? '#FFB74D' : '#FFF',
                fontWeight: 'bold', fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              },
              onClick: () => handleSelectAudioSource('radio')
            }, '📻 Canlı Radyo')
          )
        ),

        // TEMA RENGİ (Garson Theme Color Selector)
        e('div', null,
          e('div', { style: { fontSize: 12, color: '#AAA', fontWeight: 'bold', marginBottom: 10 } }, 'TEMA RENGİ'),
          e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 } },
            colorsList.map((c, i) => {
              const isSel = waiterColor.toLowerCase() === c.toLowerCase();
              return e('button', {
                key: i,
                style: {
                  width: 44, height: 44, borderRadius: '50%',
                  backgroundColor: c,
                  border: isSel ? '3px solid #FFF' : 'none',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isSel ? '0 0 10px ' + c : 'none'
                },
                onClick: () => onSelectColor(c)
              }, isSel && e('span', { style: { color: c === '#FFFFFF' ? '#000' : '#FFF', fontWeight: 'bold', fontSize: 18 } }, '✓'));
            })
          )
        )
      ),

      // Footer: Credits on Left + İptal & Kaydet Buttons on Right
      e('div', { style: { marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #2A2A2A' } },
        e('span', { style: { fontSize: 12, color: '#888' } }, 'v5.3.3 | Credits: bilalgnd'),
        e('div', { style: { display: 'flex', gap: 10 } },
          e('button', { style: { background: 'transparent', border: 'none', color: '#AAA', fontSize: 14, cursor: 'pointer' }, onClick: onClose }, 'İptal'),
          e('button', { style: { padding: '10px 24px', borderRadius: 14, background: '#4CAF50', color: 'white', border: 'none', fontWeight: 'bold', fontSize: 15, cursor: 'pointer' }, onClick: onClose }, 'Kaydet')
        )
      )
    )
  );
}

// Render React 18 Root
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(e(App2Mobile));
}
