import { useEffect, useState } from 'react'
import { useStore, Order } from '../store'
import { ChevronUp, X } from 'lucide-react'

export default function CartPanel() {
  const { cart, orders, editingOrderIndex, clearCart, setOrders, removeFromCart, setCart, customerName, setCustomerName, orderNote, setOrderNote } = useStore()
  const [isMobileExpanded, setIsMobileExpanded] = useState(false)

  const isEditing = editingOrderIndex !== null

  useEffect(() => {
    if (isEditing && orders[editingOrderIndex]) {
      setCustomerName(orders[editingOrderIndex].customer_name)
      setOrderNote(orders[editingOrderIndex].order_note || '')
      setCart(orders[editingOrderIndex].items)
    }
  }, [editingOrderIndex])

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0)

  const handleSave = async () => {
    if (!customerName.trim() && cart.length === 0) return
    
    let finalCustomerName = customerName.trim()
    if (!finalCustomerName) {
      let no = 1;
      while (orders.some(o => o.customer_name === `Masa ${no}`)) no++;
      finalCustomerName = `Masa ${no}`;
    }

    const newOrder: Order = {
      customer_name: finalCustomerName,
      order_note: orderNote,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      items: cart,
      total_amount: cartTotal,
      status: 'waiting'
    }
    const newOrders = [newOrder, ...orders]
    window.api.saveOrders(newOrders)
    setOrders(newOrders)
    clearCart()
    setCustomerName('')
    setOrderNote('')
  }

  const handleUpdate = () => {
    if (!isEditing) return
    const newOrders = [...orders]
    newOrders[editingOrderIndex] = {
      ...newOrders[editingOrderIndex],
      customer_name: customerName,
      order_note: orderNote,
      items: cart,
      total_amount: cartTotal
    }
    window.api.saveOrders(newOrders)
    setOrders(newOrders)
    clearCart()
    setCustomerName('')
    setOrderNote('')
  }

  const handleCloseBill = () => {
    if (!isEditing) return
    const orderToClose = orders[editingOrderIndex]
    const newOrders = orders.filter((_, i) => i !== editingOrderIndex)
    window.api.saveOrders(newOrders)
    setOrders(newOrders)
    
    // Günlük kazanca ekle
    const currentTotal = parseFloat(localStorage.getItem('dailyTotal') || '0')
    localStorage.setItem('dailyTotal', (currentTotal + orderToClose.total_amount).toString())
    window.dispatchEvent(new Event('daily-total-updated'))

    orderToClose.status = 'Tamamlandı'
    orderToClose.completedAt = new Date().toISOString()
    if (window.api && window.api.savePastOrder) {
      window.api.savePastOrder(orderToClose)
    }

    clearCart()
    setCustomerName('')
  }

  const handlePrint = () => {
    window.api.printReceipt({
      customerName: customerName || 'Yeni Sipariş',
      order_note: orderNote,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      items: cart,
      totalAmount: cartTotal
    })
  }

  const getCartItemStyle = (name: string) => {
    const n = name.toLocaleLowerCase('tr-TR')
    
    // İçecekler kendi renklerinde
    if (n.includes('kutu kola') || n.includes('sise kola') || n.includes('şişe kola')) return { bg: '#B71C1C', text: 'white' }
    if (n.includes('ayran') && !n.includes('açık') && !n.includes('acik')) return { bg: '#827717', text: 'white' }
    if (n.includes('açık ayran') || n.includes('acik ayran')) return { bg: '#9E9D24', text: 'white' }
    if (n.includes('zero')) return { bg: '#424242', text: 'white' }
    if (n.includes('şalgam') || n.includes('salgam')) return { bg: '#6A1B9A', text: 'white' }
    if (n === 'su') return { bg: '#0288D1', text: 'white' }
    if (n.includes('sprite')) return { bg: '#2E7D32', text: 'white' }
    if (n.includes('fanta')) return { bg: '#E65100', text: 'white' }
    if (n.includes('soda')) return { bg: '#388E3C', text: 'white' }

    if (n.includes('tombik')) return { bg: '#388E3C', text: 'white' }
    if (n.includes('usul')) return { bg: '#D32F2F', text: 'white' }
    if (n.includes('xl dürüm') || n.includes('xl durum')) return { bg: '#F9A825', text: 'black' }
    if (n.includes('dürüm') || n.includes('durum') || n.includes('döneri')) return { bg: '#FFEB3B', text: 'black' }
    if (['porsiyon', 'beyti', 'iskender', 'pilav üstü', 'pilav ustu'].some(x => n.includes(x))) return { bg: '#B71C1C', text: 'white' }
    
    return { bg: '#2C2C2C', text: 'white' }
  }

  return (
    <>
      <div className="cart-mobile-mini-bar" onClick={() => setIsMobileExpanded(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ChevronUp size={20} />
          <span>Sepeti Gör ({cart.length} Ürün)</span>
        </div>
        <div>{cartTotal} ₺</div>
      </div>

      <div className={`cart-panel ${isMobileExpanded ? 'expanded' : ''}`}>
        <div className="cart-mobile-header" style={{ display: 'none', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--bg-hover)' }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Sepetim</span>
          <button onClick={() => setIsMobileExpanded(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}>
            <X size={24} />
          </button>
        </div>

        <div className="cart-header" style={{ padding: '10px', backgroundColor: 'transparent', borderBottom: 'none' }}>
        <input 
          className="cart-input" 
          placeholder="Masa No / İsim" 
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          style={{ width: '100%', backgroundColor: '#0a0a0a', padding: '10px 12px', fontSize: '16px', fontWeight: 'bold', color: isEditing ? 'var(--primary)' : 'white' }}
        />
      </div>

      <div className="cart-items">
        {cart.map((item, idx) => {
          const style = getCartItemStyle(item.name)
          return (
            <div key={idx} className="cart-item" style={{ backgroundColor: style.bg, color: style.text, borderColor: style.bg }}>
              <div className="cart-item-header">
                <div className="cart-item-name" style={{ color: style.text }}>{item.name} {item.portion && item.portion !== 'Standart' ? `(${item.portion})` : ''}</div>
                <div className="cart-item-price" style={{ color: style.text === 'black' ? '#1B5E20' : 'var(--success)' }}>{item.price} ₺</div>
              </div>
              {item.notes && <div className="cart-item-notes" style={{ color: style.text === 'black' ? '#444' : 'rgba(255, 255, 255, 0.7)' }}>{item.notes}</div>}
              <div style={{ textAlign: 'right' }}>
                <button 
                  className="btn btn-danger" 
                  style={{ padding: '4px 10px', fontSize: 12, backgroundColor: style.text === 'black' ? '#D32F2F' : undefined, color: 'white', border: 'none' }}
                  onClick={() => removeFromCart(idx)}
                >
                  Sil
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="cart-total-box">
        <div className="cart-total-val">{cartTotal} ₺</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" style={{ flex: 1, height: 35, backgroundColor: '#424242', color: 'white' }} onClick={clearCart}>
          İptal
        </button>
        <button className="btn btn-info" style={{ flex: 1, height: 35 }} onClick={handlePrint}>
          Yazdır
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
        {!isEditing ? (
          <button className="btn" style={{ flex: 1, height: 45, backgroundColor: 'var(--primary)', color: 'black' }} onClick={handleSave}>
            MASAYI AÇ
          </button>
        ) : (
          <>
            <button className="btn btn-info" style={{ flex: 1, height: 45 }} onClick={handleUpdate}>
              GÜNCELLE
            </button>
            <button className="btn btn-success" style={{ flex: 1, height: 45 }} onClick={handleCloseBill}>
              ÖDENDİ
            </button>
          </>
        )}
      </div>
    </div>
    </>
  )
}
