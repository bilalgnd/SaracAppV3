import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'

interface ItemConfig {
  selectedPortion: string
  currentPrice: number
  chips: Record<string, boolean>
  customNote: string
}

export default function OrderModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [product, setProduct] = useState<any>(null)
  
  const [items, setItems] = useState<ItemConfig[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [drinkCounts, setDrinkCounts] = useState<Record<string, number>>({})

  const { addToCart, menu } = useStore()

  const createDefaultItem = (prod: any): ItemConfig => {
    const defOpt = prod?.options?.find((o: any) => o.portion === '100gr') || prod?.options?.[0] || { portion: 'Standart', price: 0 }
    return {
      selectedPortion: defOpt.portion,
      currentPrice: defOpt.price,
      chips: {},
      customNote: ''
    }
  }

  useEffect(() => {
    const handleOpen = (e: any) => {
      const item = e.detail
      setProduct(item)
      const initialItem = createDefaultItem(item)
      setItems([initialItem])
      setActiveIndex(0)
      setDrinkCounts({})
      setIsOpen(true)
    }

    window.addEventListener('open-order-modal', handleOpen)
    return () => window.removeEventListener('open-order-modal', handleOpen)
  }, [])

  if (!isOpen || !product || items.length === 0) return null

  const activeItem = items[activeIndex] || items[0]

  const handlePortionSelect = (portion: string, price: number) => {
    setItems(prev => {
      const next = [...prev]
      next[activeIndex] = {
        ...next[activeIndex],
        selectedPortion: portion,
        currentPrice: price
      }
      return next
    })
  }

  const toggleChip = (name: string) => {
    setItems(prev => {
      const next = [...prev]
      const currentChips = { ...next[activeIndex].chips }
      currentChips[name] = !currentChips[name]

      if (currentChips[name]) {
        const pairs = [
          ['siz', 'li'], ['sız', 'lı'], ['suz', 'lu'], ['süz', 'lü']
        ]
        
        for (const [neg, pos] of pairs) {
          if (name.endsWith(neg)) {
            const opp = name.substring(0, name.length - neg.length) + pos
            if (currentChips[opp]) currentChips[opp] = false
          }
          if (name.endsWith(pos)) {
            const opp = name.substring(0, name.length - pos.length) + neg
            if (currentChips[opp]) currentChips[opp] = false
          }
        }
      }

      next[activeIndex] = {
        ...next[activeIndex],
        chips: currentChips
      }
      return next
    })
  }

  const handleCustomNoteChange = (note: string) => {
    setItems(prev => {
      const next = [...prev]
      next[activeIndex] = {
        ...next[activeIndex],
        customNote: note
      }
      return next
    })
  }

  const handleIncreaseQuantity = () => {
    setItems(prev => {
      const lastItem = prev[prev.length - 1] || createDefaultItem(product)
      const newItem: ItemConfig = {
        selectedPortion: lastItem.selectedPortion,
        currentPrice: lastItem.currentPrice,
        chips: { ...lastItem.chips },
        customNote: lastItem.customNote
      }
      const next = [...prev, newItem]
      setActiveIndex(next.length - 1)
      return next
    })
  }

  const handleDecreaseQuantity = () => {
    if (items.length > 1) {
      setItems(prev => {
        const next = prev.slice(0, -1)
        if (activeIndex >= next.length) {
          setActiveIndex(next.length - 1)
        }
        return next
      })
    }
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

  const productCustom = menu?.productCustomizations?.[product?.name] || product?.customization || (product?.ingredients || product?.freeExtras || product?.paidExtras ? product : null)

  const paidExtrasMap: Record<string, number> = productCustom?.paidExtras || menu?.paidExtras || menu?.extras || { 'Cheddar': 70, 'Kaşarlı': 70 }
  const paidExtras = Object.keys(paidExtrasMap)

  const getItemExtraPrice = (chipsObj: Record<string, boolean>) => {
    let extra = 0
    Object.entries(paidExtrasMap).forEach(([name, price]) => {
      if (chipsObj[name]) extra += Number(price) || 0
    })
    return extra
  }

  const handleAdd = () => {
    // Add each configured item to cart
    items.forEach(it => {
      const notesArr = Object.keys(it.chips).filter(k => it.chips[k])
      if (it.customNote.trim()) {
        notesArr.push(it.customNote.trim())
      }
      const notesStr = notesArr.join(', ')
      const extra = getItemExtraPrice(it.chips)
      const itemTotalPrice = it.currentPrice + extra

      addToCart({
        name: product.name,
        portion: it.selectedPortion,
        price: itemTotalPrice,
        notes: notesStr
      })
    })

    // Add drinks
    Object.entries(drinkCounts).forEach(([drinkName, count]) => {
      if (count > 0) {
        const drinksCat = menu?.categories?.find((c: any) => c.id === 'drinks' || c.name.toUpperCase().includes('İÇECEK') || c.name.toUpperCase().includes('ICECEK') || c.name.toUpperCase().includes('ECEK'))
        const drinksMenu = drinksCat?.items || []
        const drinkItem = drinksMenu.find((d: any) => d.name === drinkName)
        if (drinkItem) {
          for (let i = 0; i < count; i++) {
            addToCart({
              name: drinkItem.name,
              portion: drinkItem.options[0]?.portion || 'Standart',
              price: drinkItem.options[0]?.price || 0,
              notes: ''
            })
          }
        }
      }
    })

    setIsOpen(false)
  }

  const toWithout = (name: string) => {
    const lower = name.toLowerCase()
    const lastVowel = [...lower].reverse().find(c => 'aeıioöuü'.includes(c))
    if (['a', 'ı'].includes(lastVowel || '')) return name + 'sız'
    if (['e', 'i'].includes(lastVowel || '')) return name + 'siz'
    if (['o', 'u'].includes(lastVowel || '')) return name + 'suz'
    if (['ö', 'ü'].includes(lastVowel || '')) return name + 'süz'
    return name + 'sız'
  }

  const toWith = (name: string) => {
    const lower = name.toLowerCase()
    const lastVowel = [...lower].reverse().find(c => 'aeıioöuü'.includes(c))
    if (['a', 'ı'].includes(lastVowel || '')) return name + 'lı'
    if (['e', 'i'].includes(lastVowel || '')) return name + 'li'
    if (['o', 'u'].includes(lastVowel || '')) return name + 'lu'
    if (['ö', 'ü'].includes(lastVowel || '')) return name + 'lü'
    return name + 'lı'
  }

  const rawIngredients: string[] = productCustom?.ingredients || menu?.ingredients || ['Soğan', 'Domates', 'Patates', 'Ketçap', 'Mayonez', 'Turşu']
  const ingredients = [
    ...rawIngredients.map(toWithout),
    ...rawIngredients.map(toWith)
  ]
  const freeExtras: string[] = productCustom?.freeExtras || menu?.freeExtras || ['Sade Et', 'Soslu', 'Gemi', 'Kayık', 'Acılı', 'Karışık']

  const allChips = [...ingredients, ...freeExtras, ...paidExtras]

  const drinkNames = ['kola', 'ayran', 'su', 'sprite', 'ice tea', 'fanta', 'zero', 'şalgam', 'salgam', 'soda']
  const isDrinkCategory = product.category === 'drinks' || 
    !!(menu?.categories?.find((c: any) => c.items?.some((i: any) => i.name === product.name))?.name?.toUpperCase()?.includes('İÇECEK')) ||
    !!(menu?.categories?.find((c: any) => c.items?.some((i: any) => i.name === product.name))?.name?.toUpperCase()?.includes('ICECEK'))
  const isDrink = !!(isDrinkCategory || drinkNames.some(d => {
    const nameLower = product.name.toLowerCase()
    if (d === 'su') return /\bsu\b/.test(nameLower)
    return nameLower.includes(d)
  }))

  const drinksCat = menu?.categories?.find((c: any) => c.id === 'drinks' || c.name.toUpperCase().includes('İÇECEK') || c.name.toUpperCase().includes('ICECEK'))
  const drinksMenu = drinksCat?.items || []

  let drinksTotal = 0
  Object.entries(drinkCounts).forEach(([drinkName, count]) => {
    const drinkItem = drinksMenu.find((d: any) => d.name === drinkName)
    if (drinkItem && count > 0) {
      drinksTotal += drinkItem.options[0].price * count
    }
  })
  
  const itemsTotal = items.reduce((sum, it) => sum + it.currentPrice + getItemExtraPrice(it.chips), 0)
  const displayTotal = itemsTotal + drinksTotal

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 24, margin: 0 }}>{product.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', background: '#1e1e1e', borderRadius: 25, border: '2px solid var(--primary)', padding: '2px 8px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            <button className="btn" style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', color: '#fff', fontSize: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0 }} onClick={handleDecreaseQuantity}>−</button>
            <span style={{ width: 40, textAlign: 'center', fontSize: 22, fontWeight: '900', color: 'var(--primary)', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{items.length}</span>
            <button className="btn" style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', color: '#fff', fontSize: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 0 }} onClick={handleIncreaseQuantity}>+</button>
          </div>
        </div>

        {/* Tabs for Multiple Items */}
        {items.length > 1 && (
          <div 
            className="order-tabs-bar"
            onWheel={(e) => {
              e.currentTarget.scrollLeft += e.deltaY;
            }}
            style={{ 
              display: 'flex', 
              gap: '8px', 
              overflowX: 'auto', 
              padding: '10px 20px 12px', 
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(0,0,0,0.25)'
            }}
          >
            {items.map((it, idx) => {
              const isSel = activeIndex === idx
              const portionText = it.selectedPortion && it.selectedPortion !== 'Standart' ? it.selectedPortion : 'Standart'
              return (
                <button
                  key={idx}
                  ref={el => {
                    if (isSel && el) {
                      el.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
                    }
                  }}
                  className="btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    backgroundColor: isSel ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                    color: isSel ? '#fff' : '#bbb',
                    border: isSel ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.12)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSel ? '0 2px 10px rgba(245, 78, 78, 0.4)' : 'none'
                  }}
                  onClick={() => setActiveIndex(idx)}
                >
                  <span style={{
                    backgroundColor: isSel ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.12)',
                    borderRadius: '6px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    fontWeight: '800'
                  }}>
                    {idx + 1}
                  </span>
                  <span>{portionText}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="order-modal-body" style={{ padding: '15px 20px', flex: 1, overflowY: 'auto' }}>
          {/* Portions for active item */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {product.options.map((opt: any, i: number) => {
              const isSel = activeItem.selectedPortion === opt.portion
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

          {/* Chips for active item */}
          {!isDrink && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {allChips.map((chip, i) => {
                const isSel = !!activeItem.chips[chip]
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

          {/* Drinks & Custom Note */}
          {!isDrink && drinksMenu.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {drinksMenu.map((drink: any, i: number) => {
                  const count = drinkCounts[drink.name] || 0
                  const dColor = getDrinkColor(drink.name)
                  return (
                    <DrinkButtonItem
                      key={i}
                      drink={drink}
                      count={count}
                      dColor={dColor}
                      onIncrement={() => setDrinkCounts(prev => ({ ...prev, [drink.name]: (prev[drink.name] || 0) + 1 }))}
                      onDecrement={() => setDrinkCounts(prev => ({ ...prev, [drink.name]: Math.max(0, (prev[drink.name] || 0) - 1) }))}
                    />
                  )
                })}
              </div>
              
              <div style={{ marginTop: 15 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 5, fontWeight: 'bold' }}>
                  {items.length > 1 ? `${activeIndex + 1}. Ürün İçin Özel Sipariş Notu:` : 'Özel Sipariş Notu:'}
                </div>
                <textarea 
                  className="cart-input"
                  placeholder="✍️ Özel not ekleyin..."
                  value={activeItem.customNote}
                  onChange={e => handleCustomNoteChange(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '12px 15px', 
                    minHeight: '70px',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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

function DrinkButtonItem({
  drink,
  count,
  dColor,
  onIncrement,
  onDecrement
}: {
  drink: any
  count: number
  dColor: string
  onIncrement: () => void
  onDecrement: () => void
}) {
  const timerRef = useRef<any>(null)
  const isLongPressRef = useRef(false)

  const handleStart = (_e: React.SyntheticEvent) => {
    isLongPressRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)
    
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      if (navigator.vibrate) navigator.vibrate(50)
      onDecrement()
    }, 400)
  }

  const handleEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isLongPressRef.current) {
      isLongPressRef.current = false
      return
    }
    onIncrement()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleEnd()
    onDecrement()
  }

  return (
    <button
      type="button"
      className="btn"
      style={{
        position: 'relative',
        height: 50,
        backgroundColor: dColor,
        color: 'white',
        border: count > 0 ? '2px solid rgba(255,255,255,0.9)' : 'none',
        borderRadius: '8px',
        fontSize: 14,
        fontWeight: 'bold',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        boxShadow: count > 0 ? '0 4px 10px rgba(0,0,0,0.35)' : 'none',
        transform: count > 0 ? 'scale(1.02)' : 'none',
        transition: 'transform 0.1s ease, border 0.1s ease',
        cursor: 'pointer'
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      {drink.name}
      {count > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            backgroundColor: '#ffffff',
            color: '#111111',
            borderRadius: '50%',
            width: 22,
            height: 22,
            fontSize: 12,
            fontWeight: '900',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${dColor}`,
            boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
            zIndex: 10,
            boxSizing: 'border-box',
            pointerEvents: 'none'
          }}
        >
          {count}
        </div>
      )}
    </button>
  )
}
