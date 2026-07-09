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

export default function App() {
  const [customerName, setCustomerName] = useState('')
  const [isNameSet, setIsNameSet] = useState(false)
  const [menuData, setMenuData] = useState<MenuResponse | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string>('')
  
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [orderStatus, setOrderStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null)

  // Tracking state
  const [serverOrderStatus, setServerOrderStatus] = useState<string>('')
  const [waiterCalled, setWaiterCalled] = useState(false)

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
          setTrackingOrderId(data.orderId)
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
    localStorage.removeItem('qr_active_order_id')
  }

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0)
  const cartItemCount = cart.reduce((acc, item) => acc + item.qty, 0)

  // Tracking Screen View
  if (trackingOrderId && serverOrderStatus) {
    const s = serverOrderStatus.toLowerCase()
    
    const isPrep = s.includes('prepared') || s.includes('hazır')
    const isServed = s.includes('served') || s.includes('yola')
    const isDone = s.includes('tamam') || s.includes('iptal')
    
    const callWaiter = async () => {
      if (waiterCalled) return;
      try {
        await fetch('https://bilalgnd.shop/api/public/call_waiter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: trackingOrderId })
        });
        setWaiterCalled(true);
        setTimeout(() => setWaiterCalled(false), 60000); // 60s cooldown
      } catch (e) {}
    }
    
    const step1Complete = true 
    const step2Complete = isPrep || isServed || isDone
    const step3Complete = isServed || isDone
    const step4Complete = isDone
    
    return (
      <div className="tracking-container">
        <div className="tracking-header">
          {isDone && (
            <button className="back-btn" onClick={finishTracking}>
              <ArrowLeft size={20} />
            </button>
          )}
          <h2>Sipariş Takibi</h2>
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

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!isDone && (
            <button 
              className="btn" 
              style={{ backgroundColor: waiterCalled ? '#4b5563' : '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} 
              onClick={callWaiter}
              disabled={waiterCalled}
            >
              <Bell size={18} />
              {waiterCalled ? 'Garson Çağrıldı' : 'Garson Çağır'}
            </button>
          )}
          {isDone && (
            <button className="btn" onClick={finishTracking}>
              Yeni Sipariş Ver
            </button>
          )}
        </div>
      </div>
    )
  }

  // Name Prompt Screen
  if (!isNameSet) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Hoş Geldiniz 👋</h1>
          <p>Siparişinizi doğru şekilde teslim edebilmemiz için lütfen adınızı girin.</p>
          <form onSubmit={handleNameSubmit}>
            <input 
              type="text" 
              className="auth-input"
              placeholder="Adınız..." 
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
            />
            <button type="submit" className="btn">Menüye Geç</button>
          </form>
        </div>
      </div>
    )
  }

  const categories = menuData?.categories || []
  const currentCategory = categories.find(c => c.id === activeCategoryId)
  const currentItems = currentCategory?.items || []

  return (
    <>
      <div className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'UniversityRomanBold, sans-serif', letterSpacing: '1px' }}>SARACOGLU DONER</h2>
          <button 
            onClick={() => {
              localStorage.removeItem('qr_customer_name');
              setCustomerName('');
              setIsNameSet(false);
            }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#aaa', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
          >
            Çıkış Yap
          </button>
        </div>
        <p style={{ marginTop: '8px' }}>👋 Merhaba, {customerName}</p>
      </div>

      <div className="category-tabs">
        {categories.map(cat => (
          <div 
            key={cat.id} 
            className={`cat-tab ${activeCategoryId === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategoryId(cat.id)}
          >
            {cat.name}
          </div>
        ))}
      </div>

      <div className="menu-grid">
        {currentItems.map((item, idx) => {
          const minPrice = item.options.length > 0 ? Math.min(...item.options.map(o => o.price)) : 0
          
          return (
            <div className="menu-item" key={idx}>
              <div>
                <div className="item-name">{item.name}</div>
                {item.options.length > 1 && (
                  <div className="item-desc">Farklı porsiyon seçenekleri mevcut</div>
                )}
              </div>
              <div className="item-bottom">
                <span className="item-price">{minPrice} ₺</span>
                <button 
                  className="add-btn" 
                  onClick={() => openProductModal(item)}
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {cartItemCount > 0 && (
        <div className="cart-fab" onClick={() => setIsCartOpen(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingBag />
            <span>{cartItemCount} Ürün</span>
          </div>
          <span>{cartTotal} ₺</span>
        </div>
      )}

      {/* Product Details Modal (Portion & Ingredients) */}
      {selectedProduct && selectedPortion && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle"></div>
            <div className="sheet-header">
              <h3>{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} style={{ background: 'none', border: 'none', color: 'white' }}>
                <X size={24} />
              </button>
            </div>
            
            {selectedProduct.options.length > 1 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '12px' }}>Porsiyon Seçin</h4>
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
                      <span className="portion-name">{opt.portion}</span>
                      <span className="portion-price">{opt.price} ₺</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="ingredients-section">
              <h4>İçindekiler (Çıkarmak için dokunun)</h4>
              <div className="ingredients-list">
                {DEFAULT_INGREDIENTS.map(ing => (
                  <div 
                    key={ing} 
                    className={`ingredient-chip ${keptIngredients[ing] ? 'selected' : 'unselected'}`}
                    onClick={() => setKeptIngredients({...keptIngredients, [ing]: !keptIngredients[ing]})}
                  >
                    {ing}
                  </div>
                ))}
              </div>
            </div>

            <button className="btn" style={{ marginTop: '10px' }} onClick={handleAddFromModal}>
              Sepete Ekle - {selectedPortion.price} ₺
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
              <h3>Sepetim</h3>
              <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', color: 'white' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ paddingBottom: '10px' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '20px 0' }}>Sepetiniz boş.</div>
              ) : (
                cart.map((item) => (
                  <div className="cart-item" key={item.cartId}>
                    <div className="cart-item-info">
                      <h4>{item.name}</h4>
                      {item.portion !== 'Standart' && <span style={{ fontSize: '13px', color: 'var(--text-dim)', display: 'block' }}>{item.portion}</span>}
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
                  <span>Toplam</span>
                  <span>{cartTotal} ₺</span>
                </div>
                <button 
                  className="btn" 
                  onClick={submitOrder}
                  disabled={orderStatus === 'submitting'}
                >
                  {orderStatus === 'submitting' ? 'Sipariş İletiliyor...' : 'Siparişi Onayla'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
