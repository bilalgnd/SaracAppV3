import { customAlert, customConfirm } from "../utils/alert"
import React, { useRef } from 'react'
import { useStore } from '../store'
import addresses from '../utils/addresses.json'

export default function MainPanel() {
  const { activeTab, isSettingsMode, menu } = useStore()
  const [editingPriceItem, setEditingPriceItem] = React.useState<any>(null)

  const getTitle = () => {
    if (isSettingsMode) return '⚙ FİYAT DÜZENLEME'
    if (activeTab === 0) return 'MASALAR'
    if (menu?.categories && menu.categories[activeTab - 1]) {
      return menu.categories[activeTab - 1].name.toUpperCase()
    }
    return ''
  }

  const title = getTitle()

  return (
    <div className="main-panel">
      <div className="main-header">
        <div className="category-title" style={{ color: isSettingsMode ? 'var(--danger)' : 'white' }}>
          {title}
        </div>
      </div>
      <div className="scroll-area">
        {activeTab === 0 ? <TablesGrid /> : <MenuGrid onEditPrice={setEditingPriceItem} />}
      </div>

      {editingPriceItem && (
        <PriceEditModal 
          item={editingPriceItem} 
          onClose={() => setEditingPriceItem(null)} 
        />
      )}
    </div>
  )
}

function PriceEditModal({ item, onClose }: { item: any, onClose: () => void }) {
  const { setMenu } = useStore()
  // local state for each portion's price
  const [prices, setPrices] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    item.options.forEach((opt: any) => {
      init[opt.portion] = opt.price.toString()
    })
    return init
  })

  const handleSave = async () => {
    let updated = false
    for (const opt of item.options) {
      let priceStr = prices[opt.portion]
      if (priceStr) {
        priceStr = priceStr.replace(',', '.')
        if (!isNaN(Number(priceStr)) && priceStr.trim() !== '') {
          await window.api.updatePrice(item.name, opt.portion, Number(priceStr))
          updated = true
        }
      }
    }
    if (updated) {
      window.api.getMenu().then(setMenu)
      customAlert("Fiyat güncellendi!")
    }
    onClose()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ backgroundColor: 'var(--bg-panel)', padding: 30, borderRadius: 12, minWidth: 400, border: '1px solid var(--border-color)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>{item.name} Fiyatı Düzenle</h2>
        
        {item.options.map((opt: any, idx: number) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <span style={{ fontSize: 18 }}>{opt.portion}:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input 
                type="text" 
                value={prices[opt.portion]} 
                onChange={(e) => setPrices({...prices, [opt.portion]: e.target.value})}
                style={{ width: 100, padding: 10, fontSize: 18, borderRadius: 6, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'white' }}
              />
              <span style={{ fontSize: 18 }}>₺</span>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 15, marginTop: 30 }}>
          <button className="btn" style={{ backgroundColor: '#424242', padding: '10px 20px' }} onClick={onClose}>İptal</button>
          <button className="btn btn-success" style={{ padding: '10px 20px' }} onClick={handleSave}>Kaydet</button>
        </div>
      </div>
    </div>
  )
}

const processTgoRawData = (rawData: any, currentOrders: any[], saveFn: any, setFn: any) => {
  try {
    const tgoItems: any[] = [];
    if (rawData && rawData.lines) {
        rawData.lines.forEach((l: any) => {
            const qty = l.items ? l.items.length : 1;
            for (let j = 0; j < qty; j++) {
                let notes = '';
                if (l.modifierProducts && l.modifierProducts.length > 0) {
                   notes = l.modifierProducts.map((m: any) => m.name).join(', ');
                }
                tgoItems.push({
                    name: l.name,
                    portion: '',
                    price: l.price,
                    notes: notes
                });
            }
        });
    }
    let finalNote = rawData ? (rawData.customerNote || '') : '';
    if (rawData && rawData.address) {
      const a = rawData.address;
      const addrParts: string[] = [];
      if (a.neighborhood) addrParts.push(a.neighborhood);
      if (a.address1) addrParts.push(a.address1.trim());
      if (a.address2) addrParts.push(a.address2.trim());
      if (a.apartmentNumber) addrParts.push(`Apt: ${a.apartmentNumber}`);
      if (a.doorNumber) addrParts.push(`No: ${a.doorNumber.trim()}`);
      if (a.floor) addrParts.push(`Kat: ${a.floor}`);
      if (a.addressDescription) addrParts.push(`Tarif: ${a.addressDescription}`);
      if (a.phone) addrParts.push(`Tel: ${a.phone}`);
      
      const addressStr = addrParts.filter(Boolean).join(', ');
      finalNote = finalNote ? `${finalNote}\n[Adres: ${addressStr}]` : `[Adres: ${addressStr}]`;
    }

    const tgoCustomerName = (rawData && rawData.customer) ? `${rawData.customer.firstName} ${rawData.customer.lastName} (TGO)` : 'Bilinmeyen (TGO)';
    const newApp1Order: any = {
        id: (rawData && rawData.orderNumber) ? rawData.orderNumber.toString() : Date.now().toString(),
        customer_name: tgoCustomerName,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        items: tgoItems,
        total_amount: rawData ? rawData.totalPrice : 0,
        status: 'waiting',
        order_note: finalNote
    };
    
    const exists = currentOrders.find(o => String(o.id) === String(newApp1Order.id));
    if (!exists) {
       const newOrders = [newApp1Order, ...currentOrders];
       saveFn(newOrders);
       setFn(newOrders);
    }
  } catch (err) {
    console.error(err);
    alert('JSON parse hatası: ' + err);
  }
};

function TablesGrid() {
  const { orders, setEditingOrder, editingOrderIndex, setOrders, clearCart } = useStore()
  const longPressTimer = useRef<any>(null)
  const isDragging = useRef(false)
  const hasLongPressed = useRef(false)
  const startY = useRef(0)

  React.useEffect(() => {
    if (!window.api || !window.api.onServerEvent) return;
    const unsub = window.api.onServerEvent((action: string, data: any) => {
      if (action === 'tgo_add_order' && data) {
        processTgoRawData(data, useStore.getState().orders, window.api.saveOrders, setOrders);
      }
    });
    return () => {
      if (window.api && window.api.offServerEvent) window.api.offServerEvent(unsub);
    };
  }, [setOrders]);

  if (orders.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: 100, fontSize: 20, color: 'var(--text-muted)' }}>
        Şu an aktif sipariş / masa bulunmuyor.
      </div>
    )
  }

  const handleDeleteAll = async () => {
    if (await customConfirm("Tüm açık masaları silmek istediğinize emin misiniz?")) {
      if (window.api && window.api.savePastOrder) {
        orders.forEach(o => {
          o.status = "İptal"
          o.completedAt = new Date().toISOString()
          window.api.savePastOrder(o)
        })
      }
      window.api.saveOrders([])
      setOrders([])
    }
  }

  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    isDragging.current = false
    hasLongPressed.current = false
    startY.current = e.clientY
    longPressTimer.current = setTimeout(() => {
      if (!isDragging.current) {
        hasLongPressed.current = true
        // Toggle prepared status
        const newOrders = [...orders]
        newOrders[idx].status = newOrders[idx].status === 'prepared' ? 'waiting' : 'prepared'
        window.api.saveOrders(newOrders)
        setOrders(newOrders)
      }
    }, 400)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (Math.abs(e.clientY - startY.current) > 10) {
      isDragging.current = true
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }

  const handlePointerUp = (_e: React.PointerEvent, idx: number) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    if (!isDragging.current && !hasLongPressed.current) {
      if (editingOrderIndex === idx) {
        clearCart()
      } else {
        setEditingOrder(idx)
      }
    }
    hasLongPressed.current = false
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10, gap: '10px' }}>
        <input 
          type="file" 
          accept=".json" 
          style={{ display: 'none' }} 
          id="tgo-json-upload" 
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const rawData = JSON.parse(text);
              processTgoRawData(rawData, useStore.getState().orders, window.api.saveOrders, setOrders);
            } catch (err) {
              console.error(err);
              alert('JSON okunamadı veya parse edilemedi!');
            }
            e.target.value = '';
          }}
        />
        <button 
          className="btn" 
          style={{ height: 40, padding: '0 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }} 
          onClick={() => document.getElementById('tgo-json-upload')?.click()}
        >
          TGO Ekle
        </button>
        <button className="btn btn-danger" style={{ height: 40, padding: '0 20px' }} onClick={handleDeleteAll}>
          Tümünü Sil
        </button>
      </div>
      <div className="grid-cards">
        {orders.map((order, idx) => {
          const isEditing = editingOrderIndex === idx
          return (
            <div 
              key={idx} 
              className={`table-card ${isEditing ? 'editing' : ''}`}
              style={order.color ? { borderColor: order.color } : {}}
              onPointerDown={(e) => handlePointerDown(e, idx)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, idx)}
            >
              {order.status === 'prepared' && (
                <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 24, color: 'var(--success)' }}>✔</div>
              )}
              {isEditing && (
                <button 
                  style={{ position: 'absolute', top: 10, right: 10, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}
                  onClick={async (e) => { 
                    e.stopPropagation(); 
                    if (await customConfirm(`${order.customer_name} masasını iptal edip silmek istediğinize emin misiniz?`)) {
                      const newOrders = [...orders]
                      const removed = newOrders.splice(idx, 1)[0]
                      removed.status = "İptal"
                      removed.completedAt = new Date().toISOString()
                      if (window.api && window.api.savePastOrder) {
                        window.api.savePastOrder(removed)
                      }
                      window.api.saveOrders(newOrders)
                      setOrders(newOrders)
                      clearCart()
                    }
                  }}
                >
                  ✖
                </button>
              )}
              <div className="table-name">{order.customer_name}</div>
              {order.order_note && (
                <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px', whiteSpace: 'pre-wrap', textAlign: 'center' }}>
                  📝 {order.order_note}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5, lineHeight: 1.2 }}>
                {order.items.map((it, i) => (
                  <div key={i} style={{ marginBottom: 3 }}>
                    <span style={{ color: '#fff' }}>{it.quantity && it.quantity > 1 ? `${it.quantity}x ` : ''}{it.name}</span>
                    {it.portion && it.portion !== 'Standart' && <span style={{ color: '#aaa', marginLeft: 4 }}>({it.portion})</span>}
                    {it.notes && <div style={{ color: '#ff5252', fontSize: 11, paddingLeft: 8 }}>- {it.notes}</div>}
                  </div>
                ))}
              </div>
              {isEditing && <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 5 }}>(Düzenleniyor)</div>}
              <div className="table-total">{order.total_amount} ₺</div>
              <div className="table-time">Saat: {order.time}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MenuGrid({ onEditPrice }: { onEditPrice: (item: any) => void }) {
  const { menu, activeTab, isSettingsMode } = useStore()
  
  if (!menu) return null
  
  const getCategoryData = () => {
    if (!menu.categories) return []
    const catIndex = activeTab - 1
    if (catIndex >= 0 && catIndex < menu.categories.length) {
      return menu.categories[catIndex].items
    }
    return []
  }

  const items = getCategoryData()

  const getDrinkColor = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('kutu kola') || n.includes('sise kola') || n.includes('şişe kola')) return 'var(--danger)'
    if (n.includes('ayran') && !n.includes('açık')) return '#827717'
    if (n.includes('açık ayran') || n.includes('acik ayran')) return '#9E9D24'
    if (n.includes('zero')) return '#424242'
    if (n.includes('şalgam') || n.includes('salgam')) return '#6A1B9A'
    if (n === 'su') return 'var(--info)'
    if (n.includes('sprite')) return 'var(--success)'
    if (n.includes('fanta')) return 'var(--primary)'
    if (n.includes('soda')) return '#2E7D32'
    return 'var(--info)'
  }

  const getCardStyle = (name: string, tabIndex: number) => {
    const n = name.toLocaleLowerCase('tr-TR')
    // İçecek (3)
    if (tabIndex === 3) return { bg: getDrinkColor(name), text: 'white' }

    if (n.includes('tombik')) return { bg: '#388E3C', text: 'white' } // yeşil
    if (n.includes('usul')) return { bg: '#D32F2F', text: 'white' } // kırmızı (eski usul, hatay usulü vb)
    if (n.includes('xl dürüm') || n.includes('xl durum')) return { bg: '#F9A825', text: 'black' } // koyu sarı
    if (n.includes('dürüm') || n.includes('durum') || n.includes('döneri')) return { bg: '#FFEB3B', text: 'black' } // sarı (dürüm, biga döneri vb)
    if (['porsiyon', 'beyti', 'iskender', 'pilav üstü', 'pilav ustu'].some(x => n.includes(x))) return { bg: '#B71C1C', text: 'white' }

    return { bg: '#2C2C2C', text: 'white' }
  }

  // To trigger order modal (implemented via global event or simple zustand state for modal)
  // Let's add modal trigger state to zustand.
  const openModal = async (item: any) => {
    if (isSettingsMode) {
      onEditPrice(item)
    } else {
      window.dispatchEvent(new CustomEvent('open-order-modal', { detail: item }))
    }
  }

  const { orderNote, setOrderNote } = useStore()

  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [cycleIndex, setCycleIndex] = React.useState<number>(-1)
  const cycleData = React.useRef({ prefix: "", suffix: "", options: [] as string[] })
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let val = e.target.value
    
    // Auto format 10-digit phone numbers (530 123 45 67)
    const formattedVal = val.replace(/(?<!\d)(\d{10})(?!\d)/g, (match) => {
      return `${match.slice(0,3)} ${match.slice(3,6)} ${match.slice(6,8)} ${match.slice(8,10)}`
    })
    
    let cursorPos = e.target.selectionStart
    if (formattedVal !== val) {
      // If a number was formatted, cursor needs to shift right to account for added spaces
      cursorPos += (formattedVal.length - val.length)
      val = formattedVal
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(cursorPos, cursorPos)
        }
      }, 0)
    }
    
    // Only reset cycle if it's an actual user typing event, not our programmatic update
    // e.nativeEvent exists when the user types
    if (e.nativeEvent) {
      setCycleIndex(-1)
    }
    
    setOrderNote(val)
    
    const textBefore = val.slice(0, cursorPos)
    
    const words = textBefore.split(/\s+/).filter(Boolean)
    let bestSegment = ""
    let bestMatches: string[] = []
    
    const hasMahalle = val.includes(" MAH.")
    
    // Check combinations of the last 1 to 3 words
    for (let i = Math.max(0, words.length - 3); i < words.length; i++) {
      const testSeg = words.slice(i).join(' ')
      if (testSeg.length >= 2) {
        const q = testSeg.toLocaleLowerCase('tr-TR')
        let matches = addresses.filter((a: string) => a.toLocaleLowerCase('tr-TR').includes(q))
        
        if (matches.length > 0) {
          if (!hasMahalle) {
            const mahalleMatches = matches.filter(a => a.endsWith(" MAH."))
            if (mahalleMatches.length > 0) {
              matches = mahalleMatches
            }
          } else {
            matches = matches.filter(a => !a.endsWith(" MAH."))
          }
          
          if (matches.length > 0) {
            bestSegment = testSeg
            
            matches.sort((a: string, b: string) => {
              const aStart = a.toLocaleLowerCase('tr-TR').startsWith(q)
              const bStart = b.toLocaleLowerCase('tr-TR').startsWith(q)
              if (aStart && !bStart) return -1
              if (!aStart && bStart) return 1
              return 0
            })
            
            bestMatches = matches
            break // Found the longest matching phrase
          }
        }
      }
    }

    if (bestMatches.length > 0) {
      setSuggestions(bestMatches.slice(0, 5))
      // Store the matched segment length so applySuggestion knows how much to replace
      textareaRef.current!.dataset.matchLength = bestSegment.length.toString()
    } else {
      setSuggestions([])
      if (textareaRef.current) textareaRef.current.dataset.matchLength = "0"
    }
  }

  const applySuggestion = (sug: string) => {
    if (!textareaRef.current) return
    const cursorPos = textareaRef.current.selectionStart
    
    let prefix = ""
    let suffix = ""
    
    if (cycleIndex !== -1) {
      prefix = cycleData.current.prefix
      suffix = cycleData.current.suffix
    } else {
      const textBefore = orderNote.slice(0, cursorPos)
      const matchLen = parseInt(textareaRef.current.dataset.matchLength || "0", 10)
      prefix = textBefore.slice(0, textBefore.length - matchLen)
      suffix = orderNote.slice(cursorPos)
    }
    
    const newTextBefore = prefix + sug + " "
    const newText = newTextBefore + suffix
    setOrderNote(newText)
    setSuggestions([])
    setCycleIndex(-1)
    
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(newTextBefore.length, newTextBefore.length)
    }, 10)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault()
      
      let nextIndex = 0
      let options = suggestions
      let prefix = ""
      let suffix = ""
      
      if (cycleIndex === -1) {
        // Start cycle
        const cursorPos = textareaRef.current!.selectionStart
        const textBefore = orderNote.slice(0, cursorPos)
        const matchLen = parseInt(textareaRef.current!.dataset.matchLength || "0", 10)
        
        prefix = textBefore.slice(0, textBefore.length - matchLen)
        suffix = orderNote.slice(cursorPos)
        options = suggestions
        
        cycleData.current = { prefix, suffix, options }
        nextIndex = 0
      } else {
        // Continue cycle
        prefix = cycleData.current.prefix
        suffix = cycleData.current.suffix
        options = cycleData.current.options
        nextIndex = (cycleIndex + 1) % options.length
      }
      
      setCycleIndex(nextIndex)
      
      const sug = options[nextIndex]
      const newTextBefore = prefix + sug + " "
      const newText = newTextBefore + suffix
      
      setOrderNote(newText)
      
      setTimeout(() => {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(newTextBefore.length, newTextBefore.length)
      }, 10)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="grid-cards" style={{ flex: 1, alignContent: 'start' }}>
        {items.length === 0 && (
          <div 
            className="menu-card" 
            style={{ backgroundColor: 'transparent', border: '2px dashed var(--primary)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            onClick={() => {
              localStorage.setItem('settings-tab', 'menu')
              window.dispatchEvent(new CustomEvent('open-settings-modal'))
            }}
          >
            <div className="card-title" style={{ textAlign: 'center' }}>+ Ürün Oluştur</div>
          </div>
        )}
        {items.map((item: any, idx: number) => {
          return (
            <div 
              key={idx} 
              className="menu-card" 
              style={{ backgroundColor: item.color || getCardStyle(item.name, activeTab).bg, color: item.textColor || getCardStyle(item.name, activeTab).text }}
              onClick={() => openModal(item)}
            >
              <div className="card-title">{item.name}</div>
              <div className="card-price">
                {isSettingsMode ? 'Fiyat Düzenle' : `${item.options[0].price} ₺`}
              </div>
            </div>
          )
        })}
      </div>
      
      {!isSettingsMode && (
        <div style={{ padding: '15px 20px', marginTop: 'auto', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
              {suggestions.map((s, i) => {
                const isActive = i === cycleIndex
                return (
                  <button 
                    key={i} 
                    onClick={() => applySuggestion(s)}
                    style={{ 
                      whiteSpace: 'nowrap', 
                      backgroundColor: isActive ? '#fff' : '#2a2a2a', 
                      color: isActive ? '#000' : '#fff', 
                      border: '1px solid #444', 
                      borderRadius: '12px', 
                      padding: '4px 10px', 
                      fontSize: '12px', 
                      cursor: 'pointer',
                      transition: 'all 0.1s ease'
                    }}
                  >
                    {s}
                  </button>
                )
              })}
              <div style={{ alignSelf: 'center', fontSize: '11px', color: 'var(--text-muted)', marginLeft: '10px', whiteSpace: 'nowrap' }}>(Hızlı yazmak için Tab'a basın)</div>
            </div>
          )}
          <textarea 
            ref={textareaRef}
            className="cart-input" 
            style={{ width: '100%', fontSize: '14px', minHeight: '130px', backgroundColor: '#0a0a0a', resize: 'vertical', padding: '10px 12px' }}
            placeholder="Sipariş / Adres Notu" 
            value={orderNote}
            onChange={handleNoteChange}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}
    </div>
  )
}
