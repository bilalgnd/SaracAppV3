import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'

export default function OrderModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [product, setProduct] = useState<any>(null)
  
  const [quantity, setQuantity] = useState(1)
  const [selectedPortion, setSelectedPortion] = useState('')
  const [currentPrice, setCurrentPrice] = useState(0)
  
  const [chips, setChips] = useState<Record<string, boolean>>({})
  const [drinkCounts, setDrinkCounts] = useState<Record<string, number>>({})
  const [customNote, setCustomNote] = useState('')

  const drinkTimerRef = useRef<any>(null)
  const drinkDragging = useRef(false)
  const drinkLongPressed = useRef(false)

  const { addToCart, menu } = useStore()

  useEffect(() => {
    const handleOpen = (e: any) => {
      const item = e.detail
      setProduct(item)
      setQuantity(1)
      const defOpt = item.options.find((o: any) => o.portion === '100gr') || item.options[0]
      setSelectedPortion(defOpt.portion)
      setCurrentPrice(defOpt.price)
      setChips({})
      setDrinkCounts({})
      setCustomNote('')
      setIsOpen(true)
    }

    window.addEventListener('open-order-modal', handleOpen)
    return () => window.removeEventListener('open-order-modal', handleOpen)
  }, [])

  if (!isOpen || !product) return null

  const handlePortionSelect = (portion: string, price: number) => {
    setSelectedPortion(portion)
    setCurrentPrice(price)
  }

  const toggleChip = (name: string) => {
    setChips(prev => {
      const next = { ...prev, [name]: !prev[name] }
      
      if (next[name]) {
        const pairs = [
          ['siz', 'li'], ['sız', 'lı'], ['suz', 'lu'], ['süz', 'lü']
        ]
        
        for (const [neg, pos] of pairs) {
          if (name.endsWith(neg)) {
            const opp = name.substring(0, name.length - neg.length) + pos
            if (next[opp]) next[opp] = false
          }
          if (name.endsWith(pos)) {
            const opp = name.substring(0, name.length - pos.length) + neg
            if (next[opp]) next[opp] = false
          }
        }
      }
      return next
    })
  }

  const getChipColor = (name: string) => {
    const n = name.toLowerCase()
    if (n === 'sade et' || n === 'kayık' || n === 'gemi' || n === 'soslu' || n === 'acılı' || n === 'karışık') return '#00ACC1'
    if (n.endsWith('siz') || n.endsWith('suz') || n.endsWith('sız')) return '#9C27B0'
    if (n.endsWith('li') || n.endsWith('lu') || n.endsWith('lı')) return '#E91E63'
    if (n === 'cheddar' || n === 'kaşarlı' || n === 'kasarli') return '#FBC02D'
    return '#E91E63'
  }

  const getDrinkColor = (name: string) => {
    const n = name.toLowerCase()
    if (n.includes('kutu kola') || n.includes('sise kola') || n.includes('şişe kola')) return '#B71C1C'
    if (n.includes('ayran') && !n.includes('açık') && !n.includes('acik')) return '#AFB42B'
    if (n.includes('açık ayran') || n.includes('acik ayran')) return '#C0CA33'
    if (n.includes('zero')) return '#424242'
    if (n.includes('şalgam') || n.includes('salgam')) return '#6A1B9A'
    if (n === 'su') return '#0288D1'
    if (n.includes('sprite')) return '#2E7D32'
    if (n.includes('fanta')) return '#E65100'
    if (n.includes('soda')) return '#388E3C'
    return '#455A64'
  }

  const handleAdd = () => {
    const notesArr = Object.keys(chips).filter(k => chips[k])
    if (customNote.trim()) {
      notesArr.push(customNote.trim())
    }
    const notesStr = notesArr.join(', ')

    // calculate extra price
    let extraPrice = 0
    if (chips['Cheddar']) extraPrice += 70 // hardcoded example, should use models
    if (chips['Kaşarlı']) extraPrice += 70

    const itemPrice = (currentPrice + extraPrice)

    for (let i = 0; i < quantity; i++) {
      addToCart({
        name: product.name,
        portion: selectedPortion,
        price: itemPrice,
        notes: notesStr
      })
    }

    // Add drinks
    Object.entries(drinkCounts).forEach(([drinkName, count]) => {
      if (count > 0) {
        const drinksCat = menu?.categories?.find((c: any) => c.id === 'drinks' || c.name.toUpperCase().includes('ECEK'))
        const drinksMenu = drinksCat?.items || []
        const drinkItem = drinksMenu.find((d: any) => d.name === drinkName)
        if (drinkItem) {
          for (let i = 0; i < count; i++) {
            addToCart({
              name: drinkItem.name,
              portion: drinkItem.options[0].portion,
              price: drinkItem.options[0].price,
              notes: ''
            })
          }
        }
      }
    })

    setIsOpen(false)
  }

  const ingredients = ['Soğansız', 'Domatessiz', 'Patatessiz', 'Ketçapsız', 'Mayonezsiz', 'Turşusuz', 
                       'Soğanlı', 'Domatesli', 'Patatesli', 'Ketçaplı', 'Mayonezli', 'Turşulu']
  const freeExtras = ['Sade Et', 'Soslu', 'Gemi', 'Kayık', 'Acılı', 'Karışık']
  const paidExtras = ['Cheddar', 'Kaşarlı']

  const allChips = [...ingredients, ...freeExtras, ...paidExtras]

  const isDrink = product.options[0].portion === 'Standart'

  const drinksCat = menu?.categories?.find((c: any) => c.id === 'drinks' || c.name.toUpperCase().includes('ECEK'))
  const drinksMenu = drinksCat?.items || []

  let drinksTotal = 0
  Object.entries(drinkCounts).forEach(([drinkName, count]) => {
    const drinkItem = drinksMenu.find((d: any) => d.name === drinkName)
    if (drinkItem && count > 0) {
      drinksTotal += drinkItem.options[0].price * count
    }
  })
  
  let extraPrice = 0
  if (chips['Cheddar']) extraPrice += 70
  if (chips['Kaşarlı']) extraPrice += 70
  
  const displayTotal = (currentPrice + extraPrice) * quantity + drinksTotal

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 24, margin: 0 }}>{product.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', background: '#1e1e1e', borderRadius: 25, border: '2px solid var(--primary)', padding: '2px 8px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            <button className="btn" style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', color: '#fff', fontSize: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0 }} onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
            <span style={{ width: 40, textAlign: 'center', fontSize: 22, fontWeight: '900', color: 'var(--primary)', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{quantity}</span>
            <button className="btn" style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', color: '#fff', fontSize: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0 }} onClick={() => setQuantity(quantity + 1)}>+</button>
          </div>
        </div>

        <div style={{ padding: '10px 20px', flex: 1, overflowY: 'auto' }}>
          {/* Portions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {product.options.map((opt: any, i: number) => {
              const isSel = selectedPortion === opt.portion
              return (
                <button
                  key={i}
                  className="btn"
                  style={{
                    height: 40,
                    backgroundColor: isSel ? 'var(--success)' : 'transparent',
                    border: `1px solid ${isSel ? 'var(--success)' : '#444'}`,
                    color: isSel ? 'white' : '#B0B0B0'
                  }}
                  onClick={() => handlePortionSelect(opt.portion, opt.price)}
                >
                  {opt.portion === 'Standart' ? `${opt.price} ₺` : `${opt.portion} (${opt.price} ₺)`}
                </button>
              )
            })}
          </div>

          {!isDrink && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {allChips.map((chip, i) => {
                const isSel = !!chips[chip]
                const color = getChipColor(chip)
                return (
                  <button
                    key={i}
                    className="chip"
                    style={{
                      borderWidth: 2,
                      borderStyle: 'solid',
                      borderColor: color,
                      backgroundColor: isSel ? color : 'transparent',
                      color: isSel ? (['Cheddar', 'Kaşarlı'].includes(chip) ? 'black' : 'white') : color
                    }}
                    onClick={() => toggleChip(chip)}
                  >
                    {chip}
                  </button>
                )
              })}
              </div>
          )}

          {!isDrink && drinksMenu.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {drinksMenu.map((drink: any, i: number) => {
                  const count = drinkCounts[drink.name] || 0
                  const dColor = getDrinkColor(drink.name)
                  return (
                    <button
                      key={i}
                      className="btn"
                      style={{
                        position: 'relative',
                        height: 50,
                        backgroundColor: dColor,
                        color: 'white',
                        border: 'none',
                        fontSize: 14,
                        fontWeight: 'bold',
                        touchAction: 'pan-y'
                      }}
                      onPointerDown={() => {
                        drinkDragging.current = false
                        drinkLongPressed.current = false
                        drinkTimerRef.current = setTimeout(() => {
                          if (!drinkDragging.current) {
                            drinkLongPressed.current = true
                            if (navigator.vibrate) navigator.vibrate(50)
                            setDrinkCounts(prev => ({ ...prev, [drink.name]: Math.max(0, (prev[drink.name] || 0) - 1) }))
                          }
                        }, 400)
                      }}
                      onPointerMove={() => {
                        drinkDragging.current = true
                        if (drinkTimerRef.current) clearTimeout(drinkTimerRef.current)
                      }}
                      onPointerUp={() => {
                        if (drinkTimerRef.current) clearTimeout(drinkTimerRef.current)
                        if (!drinkDragging.current && !drinkLongPressed.current) {
                          setDrinkCounts(prev => ({ ...prev, [drink.name]: (prev[drink.name] || 0) + 1 }))
                        }
                        drinkLongPressed.current = false
                      }}
                    >
                      {drink.name}
                      {count > 0 && (
                        <div style={{
                          position: 'absolute', top: -5, right: -5, background: 'white', color: 'black',
                          borderRadius: '50%', width: 20, height: 20, fontSize: 12, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', border: `2px solid ${dColor}`
                        }}>
                          {count}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              
              <div style={{ marginTop: 15 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 'bold' }}>Özel Sipariş Notu:</div>
                <textarea 
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '12px 15px', 
                    background: 'var(--bg-panel)', 
                    border: '1px solid #444', 
                    borderRadius: 8, 
                    color: 'white', 
                    outline: 'none',
                    fontSize: 14,
                    fontFamily: 'Inter',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '15px 20px', background: 'var(--bg-card)', display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1, height: 50, backgroundColor: '#424242', color: 'white' }} onClick={() => setIsOpen(false)}>
            İptal
          </button>
          <button className="btn btn-primary" style={{ flex: 2, height: 50, fontSize: 18, fontWeight: 800 }} onClick={handleAdd}>
            SEPETE EKLE ({displayTotal} ₺)
          </button>
        </div>
      </div>
    </div>
  )
}
