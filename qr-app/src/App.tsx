import { useState, useEffect } from 'react'
import { ShoppingBag, Plus, Minus, X, Check, Clock, ChefHat, CheckCircle2, ArrowLeft, Bell } from 'lucide-react'

// Backend structure definitions
type ItemOption = {
  portion: string
  price: number
}

type MenuItem = {
  name: string
  options: ItemOption[]
}

type MenuCategory = {
  id: string
  name: string
  items: MenuItem[]
}

type MenuResponse = {
  categories: MenuCategory[]
}

// Frontend Cart structure
type CartItem = {
  cartId: string // Unique ID for cart list (name + portion + notes)
  name: string
  portion: string
  price: number
  qty: number
  notes: string
}

// Constants for Ingredients
const DEFAULT_INGREDIENTS = ['Soğan', 'Domates', 'Patates']

const PRODUCT_TRANSLATIONS: Record<string, string> = {
  // Categories
  'ET DÖNER': 'BEEF DONER',
  'TAVUK DÖNER': 'CHICKEN DONER',
  'İÇECEK': 'DRINKS',
  'İÇECEKLER': 'DRINKS',

  // Products - Beef
  'Et Tombik': 'Beef Pita Doner',
  'Et Dürüm': 'Beef Doner Wrap',
  'Et XL Dürüm': 'Beef XL Doner Wrap',
  'Et Eski Usul': 'Classic Beef Doner',
  'Et Porsiyon': 'Beef Doner Plate',
  'Et Pilav Üstü': 'Beef Doner over Rice',
  'Beyti': 'Beef Beyti Doner',
  'İskender': 'Iskender Kebab',
  'Et Kampy': 'Beef Kampy Doner',
  '500gr Et': '500g Beef Doner',

  // Products - Chicken
  'Tavuk Tombik': 'Chicken Pita Doner',
  'Tavuk Dürüm': 'Chicken Doner Wrap',
  'Tavuk XL Dürüm': 'Chicken XL Doner Wrap',
  'Tavuk Eski Usul': 'Classic Chicken Doner',
  'Hatay Usulü': 'Hatay Style Chicken Wrap',
  'Biga Döneri': 'Biga Style Chicken Doner',
  'Tavuk Porsiyon': 'Chicken Doner Plate',
  'Tavuk Pilav Üstü': 'Chicken Doner over Rice',
  'Tavuk Kampy': 'Chicken Kampy Doner',
  '500gr Tavuk': '500g Chicken Doner',

  // Drinks
  'Kutu Kola': 'Canned Coca-Cola',
  'Ayran': 'Ayran',
  'Açık Ayran': 'Draft Ayran',
  'Şişe Kola': 'Bottle Coca-Cola',
  'Su': 'Water',
  'Sprite': 'Sprite',
  'Ice Tea': 'Ice Tea',
  'Fanta': 'Fanta',
  'Cola Zero': 'Coca-Cola Zero',
  'Şalgam': 'Turnip Juice',
  'Soda': 'Sparkling Water',
  '1L Kola': '1L Coca-Cola',
  '1L Ayran': '1L Ayran',

  // Ingredients
  'Soğan': 'Onion',
  'Domates': 'Tomato',
  'Patates': 'Fries',

  // Portions
  'Standart': 'Standard',
  'Tek': 'Single',
  'Duble': 'Double',
  'Dublex': 'Double',
}

function translateText(text: string, lang: 'tr' | 'en'): string {
  if (lang === 'tr' || !text) return text
  if (PRODUCT_TRANSLATIONS[text]) return PRODUCT_TRANSLATIONS[text]

  return text
    .replace(/\bTombik\b/gi, 'Pita Doner')
    .replace(/\bTavuk\b/gi, 'Chicken')
    .replace(/\bEt\b/gi, 'Beef')
    .replace(/\bDürüm\b/gi, 'Wrap')
    .replace(/\bPorsiyon\b/gi, 'Plate')
    .replace(/\bPilav Üstü\b/gi, 'over Rice')
    .replace(/\bEski Usul\b/gi, 'Classic')
    .replace(/\bHatay Usulü\b/gi, 'Hatay Style')
    .replace(/\bAçık Ayran\b/gi, 'Draft Ayran')
    .replace(/\bKutu\b/gi, 'Canned')
    .replace(/\bŞişe\b/gi, 'Bottle')
    .replace(/\bKola\b/gi, 'Cola')
    .replace(/gr\b/gi, 'g')
}

export default function App() {
  const [lang, setLang] = useState<'tr' | 'en'>(() => (localStorage.getItem('sarac_lang') as 'tr' | 'en') || 'tr')
  const [customerName, setCustomerName] = useState('')

  const toggleLang = () => {
    const newLang = lang === 'tr' ? 'en' : 'tr'
    setLang(newLang)
    localStorage.setItem('sarac_lang', newLang)
  }
  const [isNameSet, setIsNameSet] = useState(false)
  const [menuData, setMenuData] = useState<MenuResponse | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string>('')
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [orderStatus, setOrderStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null)
  const [trackingOrderItems, setTrackingOrderItems] = useState<CartItem[]>([])
  const [trackingOrderTotal, setTrackingOrderTotal] = useState<number>(0)

  // Tracking state
  const [serverOrderStatus, setServerOrderStatus] = useState<string>('')
  const [isTrackingVisible, setIsTrackingVisible] = useState(true)

  // Progressive Waiter Call Cooldown (1st: 20s, 2nd: 40s, 3rd: 50s, 4th+: 60s)
  const getCooldownDuration = (count: number) => {
    if (count <= 1) return 20;
    if (count === 2) return 40;
    if (count === 3) return 50;
    return 60;
  };

  const [waiterCallCount, setWaiterCallCount] = useState<number>(() => {
    return parseInt(localStorage.getItem('qr_waiter_call_count') || '0', 10);
  });

  const [cooldownRemaining, setCooldownRemaining] = useState<number>(() => {
    const until = parseInt(localStorage.getItem('qr_waiter_cooldown_until') || '0', 10);
    const diff = Math.ceil((until - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active countdown effect
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      const until = parseInt(localStorage.getItem('qr_waiter_cooldown_until') || '0', 10);
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining <= 0) {
        setCooldownRemaining(0);
        clearInterval(timer);
      } else {
        setCooldownRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleCallWaiter = async () => {
    if (cooldownRemaining > 0 || isCallingWaiter) return;

    setIsCallingWaiter(true);
    const nextCount = waiterCallCount + 1;
    const cooldownSec = getCooldownDuration(nextCount);
    const cooldownUntil = Date.now() + cooldownSec * 1000;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tableParam = urlParams.get('table') || urlParams.get('masa') || '';
      const shopParam = urlParams.get('shop') || '';

      const res = await fetch('/api/public/call_waiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          table: tableParam,
          id: trackingOrderId || undefined,
          shop: shopParam || undefined
        })
      });

      if (res.ok) {
        setWaiterCallCount(nextCount);
        setCooldownRemaining(cooldownSec);
        localStorage.setItem('qr_waiter_call_count', String(nextCount));
        localStorage.setItem('qr_waiter_cooldown_until', String(cooldownUntil));

        const msg = lang === 'tr' 
          ? '🔔 Garson çağrısı iletildi! En kısa sürede masanıza gelinecektir.' 
          : '🔔 Waiter has been called! We will be with you shortly.';
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        alert(lang === 'tr' ? 'Garson çağrısı gönderilemedi. Lütfen tekrar deneyin.' : 'Failed to call waiter. Please try again.');
      }
    } catch (e) {
      console.error('Call waiter error:', e);
      alert(lang === 'tr' ? 'Bağlantı hatası!' : 'Connection error!');
    } finally {
      setIsCallingWaiter(false);
    }
  };

  // Portion & Ingredient Modal state
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null)
  const [selectedPortion, setSelectedPortion] = useState<ItemOption | null>(null)
  // Which ingredients are kept (default: all kept)
  const [keptIngredients, setKeptIngredients] = useState<Record<string, boolean>>({
    'Soğan': true,
    'Domates': true,
    'Patates': true
  })

  useEffect(() => {
    // Check if name is in local storage
    const storedName = localStorage.getItem('qr_customer_name')
    if (storedName) {
      setCustomerName(storedName)
      setIsNameSet(true)
    }
    
    // Check if there is an active tracking order
    const storedOrderId = localStorage.getItem('qr_active_order_id')
    if (storedOrderId) {
      setTrackingOrderId(storedOrderId)
      try {
        const storedItems = localStorage.getItem('qr_active_order_items')
        if (storedItems) setTrackingOrderItems(JSON.parse(storedItems))
        const storedTotal = localStorage.getItem('qr_active_order_total')
        if (storedTotal) setTrackingOrderTotal(Number(storedTotal))
      } catch (e) {}
    }

    // Fetch menu
    fetch('/api/public/menu')
      .then(res => res.json())
      .then((data: MenuResponse) => {
        setMenuData(data)
        if (data.categories && data.categories.length > 0) {
          setActiveCategoryId(data.categories[0].id)
        }
      })
      .catch(err => console.error('Failed to load menu:', err))
  }, [])

  // Poll order status if tracking
  useEffect(() => {
    if (!trackingOrderId) return

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/public/order_status?id=${trackingOrderId}`)
        if (res.ok) {
          const data = await res.json()
          setServerOrderStatus(data.status)
        }
      } catch(e) {}
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [trackingOrderId])

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (customerName.trim().length > 1) {
      localStorage.setItem('qr_customer_name', customerName.trim())
      setIsNameSet(true)
    }
  }

  const openProductModal = (item: MenuItem) => {
    setSelectedProduct(item)
    // Select lowest price portion by default
    const minPriceOpt = item.options.length > 0 
      ? item.options.reduce((prev, curr) => curr.price < prev.price ? curr : prev) 
      : null
    setSelectedPortion(minPriceOpt)
    
    // Reset ingredients
    setKeptIngredients({
      'Soğan': true,
      'Domates': true,
      'Patates': true
    })
  }

  const handleAddFromModal = () => {
    if (!selectedProduct || !selectedPortion) return
    
    // Determine removed ingredients for notes
    const removed = DEFAULT_INGREDIENTS.filter(ing => !keptIngredients[ing])
    const notesStr = removed.length > 0 ? removed.map(r => r + 'sız').join(', ') : ''

    addToCart(selectedProduct.name, selectedPortion.portion, selectedPortion.price, notesStr)
    setSelectedProduct(null)
  }

  const addToCart = (name: string, portion: string, price: number, notes: string = '') => {
    const cartId = `${name}-${portion}-${notes}`
    setCart(prev => {
      const existing = prev.find(i => i.cartId === cartId)
      if (existing) {
        return prev.map(i => i.cartId === cartId ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { cartId, name, portion, price, qty: 1, notes }]
    })
  }

  const removeFromCart = (cartId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.cartId === cartId)
      if (existing && existing.qty > 1) {
        return prev.map(i => i.cartId === cartId ? { ...i, qty: i.qty - 1 } : i)
      }
      return prev.filter(i => i.cartId !== cartId)
    })
  }

  const submitOrder = async () => {
    if (cart.length === 0) return
    setOrderStatus('submitting')
    
    try {
      const res = await fetch('/api/public/submit_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          items: cart.map(i => ({ 
            name: i.name, 
            price: i.price, 
            quantity: i.qty,
            portion: i.portion,
            notes: i.notes
          })),
          totalAmount: cartTotal
        })
      })
      if (res.ok) {
        const data = await res.json()
        setOrderStatus('success')
        setCart([])
        setIsCartOpen(false)
        setServerOrderStatus('Yeni (QR)')
        
        if (data.orderId) {
          localStorage.setItem('qr_active_order_id', data.orderId)
          localStorage.setItem('qr_active_order_items', JSON.stringify(cart))
          localStorage.setItem('qr_active_order_total', String(cartTotal))
          setTrackingOrderId(data.orderId)
          setTrackingOrderItems(cart)
          setTrackingOrderTotal(cartTotal)
        }
        
      } else {
        alert('Sipariş gönderilemedi. Lütfen tekrar deneyin.')
        setOrderStatus('idle')
      }
    } catch (err) {
      console.error(err)
      alert('Bağlantı hatası!')
      setOrderStatus('idle')
    }
  }

  const finishTracking = () => {
    setTrackingOrderId(null)
    setServerOrderStatus('')
    setOrderStatus('idle')
    setTrackingOrderItems([])
    setTrackingOrderTotal(0)
    localStorage.removeItem('qr_active_order_id')
    localStorage.removeItem('qr_active_order_items')
    localStorage.removeItem('qr_active_order_total')
  }

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0)
  const cartItemCount = cart.reduce((acc, item) => acc + item.qty, 0)

  // Tracking Screen View
  if (trackingOrderId && serverOrderStatus && isTrackingVisible) {
    const s = serverOrderStatus.toLowerCase()
    
    const isPrep = s.includes('prepared') || s.includes('hazır')
    const isServed = s.includes('served') || s.includes('yola')
    const isDone = s.includes('tamam') || s.includes('iptal')
    
    const step1Complete = true 
    const step2Complete = isPrep || isServed || isDone
    const step3Complete = isServed || isDone
    const step4Complete = isDone
    
    return (
      <div className="tracking-container">
        <div className="tracking-header">
          <button className="back-btn" onClick={() => isDone ? finishTracking() : setIsTrackingVisible(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', position: 'absolute', left: '20px', top: '25px' }}>
            <ArrowLeft size={24} />
          </button>
          <h2 style={{ marginTop: '5px' }}>Sipariş Takibi</h2>
          <p>Siparişinizin durumunu canlı izleyebilirsiniz.</p>
        </div>
        
        <div className="status-timeline">
          <div className={`status-step ${step1Complete ? 'completed' : 'active'}`}>
            <div className="step-icon"><Check size={14} /></div>
            <div className="step-content">
              <h4>Sipariş Alındı</h4>
              <p>Siparişiniz sisteme ulaştı, onay bekleniyor.</p>
            </div>
          </div>
          
          <div className={`status-step ${step2Complete ? 'completed' : (step1Complete && !step3Complete ? 'active' : '')}`}>
            <div className="step-icon">{step2Complete ? <Check size={14} /> : <Clock size={14} />}</div>
            <div className="step-content">
              <h4>Hazırlanıyor</h4>
              <p>Şefimiz siparişinizi hazırlamaya başladı.</p>
            </div>
          </div>
          
          <div className={`status-step ${step3Complete ? 'completed' : (step2Complete && !step4Complete ? 'active' : '')}`}>
            <div className="step-icon">{step3Complete ? <Check size={14} /> : <ChefHat size={14} />}</div>
            <div className="step-content">
              <h4>Servis Yapıldı</h4>
              <p>Siparişiniz masanıza getirildi.</p>
            </div>
          </div>
          
          <div className={`status-step ${step4Complete ? 'completed' : (step3Complete ? 'active' : '')}`}>
            <div className="step-icon"><CheckCircle2 size={14} /></div>
            <div className="step-content">
              <h4>Tamamlandı</h4>
              <p>Afiyet olsun! Yine bekleriz.</p>
            </div>
          </div>
        </div>

        {trackingOrderItems && trackingOrderItems.length > 0 && (
          <div className="order-summary" style={{ margin: '20px 0', padding: '15px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
            <h4 style={{ marginBottom: '10px', fontSize: '16px', color: 'var(--text)' }}>Sipariş Özeti</h4>
            {trackingOrderItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--text-dim)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{item.qty}x {item.name} {item.portion !== 'Standart' ? `(${item.portion})` : ''}</span>
                  {item.notes && <span style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '2px' }}>- {item.notes}</span>}
                </div>
                <span>{item.price * item.qty} ₺</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--primary)' }}>
              <span>Toplam</span>
              <span>{trackingOrderTotal} ₺</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!isDone && (
            <button 
              className={`btn ${cooldownRemaining > 0 ? 'cooldown' : ''}`} 
              style={{ 
                backgroundColor: cooldownRemaining > 0 ? '#374151' : '#eab308', 
                color: cooldownRemaining > 0 ? '#9ca3af' : '#000',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                cursor: cooldownRemaining > 0 ? 'not-allowed' : 'pointer'
              }} 
              onClick={handleCallWaiter}
              disabled={cooldownRemaining > 0 || isCallingWaiter}
            >
              <Bell size={18} />
              {isCallingWaiter 
                ? (lang === 'tr' ? 'Çağrılıyor...' : 'Calling...')
                : cooldownRemaining > 0 
                  ? (lang === 'tr' ? `Garson Çağrıldı (${cooldownRemaining}s)` : `Waiter Called (${cooldownRemaining}s)`)
                  : (lang === 'tr' ? 'Garson Çağır' : 'Call Waiter')}
            </button>
          )}
          {isDone && (
            <button className="btn" onClick={finishTracking}>
              {lang === 'tr' ? 'Yeni Sipariş Ver' : 'Place New Order'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Name Prompt Screen
  if (!isNameSet) {
    return (
      <div className="auth-container" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '16px', right: '18px' }}>
          <div id="lang-toggle" onClick={toggleLang}>
            <button id="btn-lang" type="button" title="Dil değiştir / Change language">
              <span id="lang-tr" className={lang === 'tr' ? 'active' : ''}>TR</span>
              <span className="lang-divider">/</span>
              <span id="lang-en" className={lang === 'en' ? 'active' : ''}>EN</span>
            </button>
          </div>
        </div>
        <div className="auth-card">
          <h1>{lang === 'tr' ? 'Hoş Geldiniz 👋' : 'Welcome 👋'}</h1>
          <p>{lang === 'tr' ? 'Siparişinizi doğru şekilde teslim edebilmemiz için lütfen adınızı girin.' : 'Please enter your name so we can deliver your order correctly.'}</p>
          <form onSubmit={handleNameSubmit}>
            <input 
              type="text" 
              className="auth-input"
              placeholder={lang === 'tr' ? 'Adınız...' : 'Your Name...'} 
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
            />
            <button type="submit" className="btn">{lang === 'tr' ? 'Menüye Geç' : 'Enter Menu'}</button>
          </form>
        </div>
      </div>
    )
  }

  const categories = menuData?.categories || []
  const currentCategory = categories.find(c => c.id === activeCategoryId)
  const currentItems = currentCategory?.items || []

  const getDisplayStatus = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('prep') || s.includes('hazır')) return lang === 'tr' ? 'Hazırlanıyor' : 'Preparing';
    if (s.includes('served') || s.includes('yola')) return lang === 'tr' ? 'Servis Yapıldı' : 'Served';
    if (s.includes('tamam') || s.includes('done') || s.includes('iptal')) return lang === 'tr' ? 'Tamamlandı' : 'Completed';
    if (s.includes('waiting') || s.includes('bekliyor') || s.includes('yeni')) return lang === 'tr' ? 'Onay Bekliyor' : 'Awaiting Approval';
    return status;
  }

  return (
    <>
      {toastMessage && (
        <div className="toast-notice">
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontFamily: "'UniversityRomanBold', sans-serif", letterSpacing: '1px', fontSize: '28px', color: '#ffffff' }}>VANTAGE</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div id="lang-toggle" onClick={toggleLang}>
              <button id="btn-lang" type="button" title="Dil değiştir / Change language">
                <span id="lang-tr" className={lang === 'tr' ? 'active' : ''}>TR</span>
                <span className="lang-divider">/</span>
                <span id="lang-en" className={lang === 'en' ? 'active' : ''}>EN</span>
              </button>
            </div>
            <button 
              className="btn-logout"
              onClick={() => {
                localStorage.removeItem('qr_customer_name');
                localStorage.removeItem('qr_active_order_id');
                localStorage.removeItem('qr_active_order_items');
                localStorage.removeItem('qr_active_order_total');
                setCustomerName('');
                setIsNameSet(false);
                setTrackingOrderId(null);
                setTrackingOrderItems([]);
                setTrackingOrderTotal(0);
                setCart([]);
                setServerOrderStatus('');
                setOrderStatus('idle');
              }}
            >
              {lang === 'tr' ? 'Çıkış Yap' : 'Log Out'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '15px' }}>👋 {lang === 'tr' ? 'Merhaba' : 'Hello'}, <span style={{ fontWeight: 600, color: '#fff' }}>{customerName}</span></p>
          <button 
            type="button"
            className={`btn-call-waiter ${cooldownRemaining > 0 ? 'cooldown' : ''}`}
            onClick={handleCallWaiter}
            disabled={cooldownRemaining > 0 || isCallingWaiter}
          >
            <Bell size={15} />
            <span>
              {isCallingWaiter 
                ? (lang === 'tr' ? 'Çağrılıyor...' : 'Calling...')
                : cooldownRemaining > 0 
                  ? (lang === 'tr' ? `Garson Çağrıldı (${cooldownRemaining}s)` : `Waiter Called (${cooldownRemaining}s)`)
                  : (lang === 'tr' ? 'Garson Çağır' : 'Call Waiter')}
            </span>
          </button>
        </div>
      </div>

      <div className="category-tabs">
        {categories.map((cat, idx) => (
          <div 
            key={cat.id} 
            className={`cat-tab theme-${idx % 5} ${activeCategoryId === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategoryId(cat.id)}
          >
            {translateText(cat.name, lang)}
          </div>
        ))}
      </div>

      <div className="menu-grid">
        {currentItems.map((item, idx) => {
          const minPrice = item.options.length > 0 ? Math.min(...item.options.map(o => o.price)) : 0
          
          return (
            <div 
              className="menu-item" 
              key={idx}
              onClick={() => {
                if (trackingOrderId) {
                  alert(lang === 'tr' ? 'Mevcut siparişiniz sonuçlanmadan yeni sipariş ekleyemezsiniz.' : 'You cannot add a new order until your current order is completed.');
                  return;
                }
                openProductModal(item);
              }}
              style={trackingOrderId ? { opacity: 0.5, cursor: 'not-allowed' } : { cursor: 'pointer' }}
            >
              <div>
                <div className="item-name">{translateText(item.name, lang)}</div>
                {item.options.length > 1 && (
                  <div className="item-desc">{lang === 'tr' ? 'Farklı porsiyon seçenekleri mevcut' : 'Multiple portion options available'}</div>
                )}
              </div>
              <div className="item-bottom">
                <span className="item-price">{minPrice} ₺</span>
                <button 
                  className="add-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (trackingOrderId) {
                      alert(lang === 'tr' ? 'Mevcut siparişiniz sonuçlanmadan yeni sipariş ekleyemezsiniz.' : 'You cannot add a new order until your current order is completed.');
                      return;
                    }
                    openProductModal(item);
                  }}
                  style={trackingOrderId ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!trackingOrderId && cartItemCount > 0 && (
        <div className="cart-fab" onClick={() => setIsCartOpen(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingBag />
            <span>{cartItemCount} {lang === 'tr' ? 'Ürün' : 'Items'}</span>
          </div>
          <span>{cartTotal} ₺</span>
        </div>
      )}

      {trackingOrderId && serverOrderStatus && !isTrackingVisible && (
        <div className="cart-fab" onClick={() => setIsTrackingVisible(true)} style={{ bottom: cartItemCount > 0 ? '90px' : '20px', backgroundColor: '#3b82f6', zIndex: 99 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock />
            <span>{lang === 'tr' ? 'Siparişim' : 'My Order'} ({getDisplayStatus(serverOrderStatus)})</span>
          </div>
        </div>
      )}

      {/* Product Details Modal (Portion & Ingredients) */}
      {selectedProduct && selectedPortion && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle"></div>
            <div className="sheet-header">
              <h3>{translateText(selectedProduct.name, lang)}</h3>
              <button onClick={() => setSelectedProduct(null)} style={{ background: 'none', border: 'none', color: 'white' }}>
                <X size={24} />
              </button>
            </div>
            
            {selectedProduct.options.length > 1 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '12px' }}>{lang === 'tr' ? 'Porsiyon Seçin' : 'Select Portion'}</h4>
                <div>
                  {selectedProduct.options.map((opt, i) => (
                    <div 
                      key={i} 
                      className="portion-option"
                      style={{ 
                        borderColor: selectedPortion.portion === opt.portion ? 'var(--primary)' : 'var(--border)',
                        background: selectedPortion.portion === opt.portion ? 'rgba(74, 222, 128, 0.1)' : 'transparent'
                      }}
                      onClick={() => setSelectedPortion(opt)}
                    >
                      <span className="portion-name">{translateText(opt.portion, lang)}</span>
                      <span className="portion-price">{opt.price} ₺</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="ingredients-section">
              <h4>{lang === 'tr' ? 'İçindekiler (Çıkarmak için dokunun)' : 'Ingredients (Tap to remove)'}</h4>
              <div className="ingredients-list">
                {DEFAULT_INGREDIENTS.map(ing => (
                  <div 
                    key={ing} 
                    className={`ingredient-chip ${keptIngredients[ing] ? 'selected' : 'unselected'}`}
                    onClick={() => setKeptIngredients({...keptIngredients, [ing]: !keptIngredients[ing]})}
                  >
                    {translateText(ing, lang)}
                  </div>
                ))}
              </div>
            </div>

            <button className="btn" style={{ marginTop: '10px' }} onClick={handleAddFromModal}>
              {lang === 'tr' ? 'Sepete Ekle' : 'Add to Cart'} - {selectedPortion.price} ₺
            </button>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {isCartOpen && (
        <div className="modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle"></div>
            <div className="sheet-header">
              <h3>{lang === 'tr' ? 'Sepetim' : 'My Cart'}</h3>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', color: 'white' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ paddingBottom: '10px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '20px 0' }}>{lang === 'tr' ? 'Sepetiniz boş.' : 'Your cart is empty.'}</div>
              ) : (
                cart.map((item) => (
                  <div className="cart-item" key={item.cartId}>
                    <div className="cart-item-info">
                      <h4>{translateText(item.name, lang)}</h4>
                      {item.portion !== 'Standart' && <span style={{ fontSize: '13px', color: 'var(--text-dim)', display: 'block' }}>{translateText(item.portion, lang)}</span>}
                      {item.notes && <span style={{ fontSize: '12px', color: 'var(--danger)', display: 'block', marginTop: '2px' }}>- {item.notes}</span>}
                      <p style={{ marginTop: '4px' }}>{item.price * item.qty} ₺</p>
                    </div>
                    <div className="qty-controls">
                      <button className="qty-btn" onClick={() => removeFromCart(item.cartId)}><Minus size={18} /></button>
                      <span style={{ fontWeight: 'bold', width: '20px', textAlign: 'center' }}>{item.qty}</span>
                      <button className="qty-btn" onClick={() => addToCart(item.name, item.portion, item.price, item.notes)}><Plus size={18} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <>
                <div className="cart-total">
                  <span>{lang === 'tr' ? 'Toplam' : 'Total'}</span>
                  <span>{cartTotal} ₺</span>
                </div>
                <button 
                  className="btn" 
                  onClick={submitOrder}
                  disabled={orderStatus === 'submitting'}
                >
                  {orderStatus === 'submitting' ? (lang === 'tr' ? 'Sipariş İletiliyor...' : 'Submitting Order...') : (lang === 'tr' ? 'Siparişi Onayla' : 'Confirm Order')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
