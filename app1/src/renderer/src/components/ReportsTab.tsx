import { useMemo, useState } from 'react'
import { TrendingUp, Trash2, Calendar } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

export default function ReportsTab({ pastOrders }: { pastOrders: any[] }) {
  const [timeRange, setTimeRange] = useState('Günlük')

  const stats = useMemo(() => {
    // Only count completed orders
    const completedOrders = pastOrders.filter(
      (o) => o.status && o.status.toLowerCase().includes('tamamlan')
    )

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Find all unique dates in pastOrders (format: DD MM YYYY)
    const availableDates = Array.from(new Set(
      completedOrders.map(o => {
        if (!o.completedAt) return null
        const d = new Date(o.completedAt)
        return `${d.getDate().toString().padStart(2, '0')} ${(d.getMonth()+1).toString().padStart(2, '0')} ${d.getFullYear()}`
      }).filter(Boolean)
    )).sort((a: any, b: any) => {
      const parse = (str: string) => { const parts = str.split(' '); return new Date(Number(parts[2]), Number(parts[1])-1, Number(parts[0])).getTime() }
      return parse(b) - parse(a)
    })

    let isSpecificDate = false
    let targetDateOnly = new Date(0)
    if (timeRange.match(/^\d{2} \d{2} \d{4}$/)) {
      isSpecificDate = true
      const [dd, mm, yyyy] = timeRange.split(' ').map(Number)
      targetDateOnly = new Date(yyyy, mm - 1, dd)
    }

    // Determine boundary based on timeRange
    let daysToLookBack = 6
    if (timeRange === 'Saatlik') daysToLookBack = 0
    if (timeRange === 'Haftalık') daysToLookBack = 29
    
    const boundaryDate = new Date(today)
    boundaryDate.setDate(today.getDate() - daysToLookBack)

    let todayMeatGrams = 0
    let todayChickenGrams = 0

    let todayRev = 0
    let weeklyRev = 0
    let todayCount = 0
    let weeklyCount = 0
    let todayCancelCount = 0

    // Trend data map
    const trendMap = new Map<string, number>()
    
    if (timeRange === 'Saatlik' || isSpecificDate) {
      // Hourly map for today or the specific day
      for (let i = 0; i <= 23; i++) {
        const hourStr = `${i.toString().padStart(2, '0')}:00`
        trendMap.set(hourStr, 0)
      }
    } else {
      // Daily map for 7 or 30 days
      for (let i = daysToLookBack; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        // ISO Date YYYY-MM-DD using local time manually to avoid timezone shift
        const year = d.getFullYear()
        const month = (d.getMonth() + 1).toString().padStart(2, '0')
        const day = d.getDate().toString().padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        trendMap.set(dateStr, 0)
      }
    }

    // Product breakdown
    const productSales = new Map<string, { count: number; rev: number }>()

    // Category breakdown
    const categorySales = {
      meat: { name: 'Et Döner', count: 0, rev: 0, color: '#f59e0b' },
      chicken: { name: 'Tavuk Döner', count: 0, rev: 0, color: '#3b82f6' },
      drinks: { name: 'İçecekler', count: 0, rev: 0, color: '#10b981' },
      other: { name: 'Diğer', count: 0, rev: 0, color: '#8b5cf6' }
    }

    completedOrders.forEach((order) => {
      if (!order.completedAt) return
      const orderDate = new Date(order.completedAt)
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate())
      
      let isPrimaryDay = false
      let isWithinRange = false
      
      if (isSpecificDate) {
        isPrimaryDay = orderDateOnly.getTime() === targetDateOnly.getTime()
        isWithinRange = isPrimaryDay
      } else {
        isPrimaryDay = orderDateOnly.getTime() === today.getTime()
        isWithinRange = orderDateOnly >= boundaryDate && orderDateOnly <= today
      }

      if (isPrimaryDay) {
        todayRev += order.total_amount || 0
        todayCount++
      }
      
      if (isWithinRange) {
        weeklyRev += order.total_amount || 0
        weeklyCount++
        
        // Add to trend map
        if (timeRange === 'Saatlik' || isSpecificDate) {
          if (isPrimaryDay) {
            const hourStr = `${orderDate.getHours().toString().padStart(2, '0')}:00`
            if (trendMap.has(hourStr)) {
              trendMap.set(hourStr, trendMap.get(hourStr)! + (order.total_amount || 0))
            }
          }
        } else {
          const year = orderDate.getFullYear()
          const month = (orderDate.getMonth() + 1).toString().padStart(2, '0')
          const day = orderDate.getDate().toString().padStart(2, '0')
          const dateStr = `${year}-${month}-${day}`
          if (trendMap.has(dateStr)) {
            trendMap.set(dateStr, trendMap.get(dateStr)! + (order.total_amount || 0))
          }
        }

        // Add to product and category maps
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const safePrice = parseFloat(item.price) || 0
            // Product Sales
            const pKey = `${item.name} (${item.portion})`
            if (!productSales.has(pKey)) productSales.set(pKey, { count: 0, rev: 0 })
            const pData = productSales.get(pKey)!
            pData.count += 1
            pData.rev += safePrice
            productSales.set(pKey, pData)

            // Category Sales
            const iName = item.name.toLowerCase()
            if (iName.includes('tavuk')) {
              categorySales.chicken.count++
              categorySales.chicken.rev += safePrice
              if (isPrimaryDay) {
                let g = 0
                const mP = (item.portion || '').match(/(\d+)gr/i)
                const mN = (item.name || '').match(/(\d+)gr/i)
                if (mP) g = parseInt(mP[1], 10)
                else if (mN) g = parseInt(mN[1], 10)
                else if (iName.includes('kampy') || iName.includes('biga')) g = 100
                todayChickenGrams += g
              }
            } else if (iName.includes('et') || iName.includes('iskender') || iName.includes('beyti')) {
              categorySales.meat.count++
              categorySales.meat.rev += safePrice
              if (isPrimaryDay) {
                let g = 0
                const mP = (item.portion || '').match(/(\d+)gr/i)
                const mN = (item.name || '').match(/(\d+)gr/i)
                if (mP) g = parseInt(mP[1], 10)
                else if (mN) g = parseInt(mN[1], 10)
                else if (iName.includes('kampy') || iName.includes('biga')) g = 100
                else if (iName.includes('iskender') || iName.includes('beyti')) g = 150
                todayMeatGrams += g
              }
            } else if (iName.includes('kola') || iName.includes('su') || iName.includes('ayran') || iName.includes('şalgam') || iName.includes('fanta') || iName.includes('sprite')) {
              categorySales.drinks.count++
              categorySales.drinks.rev += safePrice
            } else {
              categorySales.other.count++
              categorySales.other.rev += safePrice
            }
          })
        }
      }
    })

    // Format trend data for Recharts
    const trendData = Array.from(trendMap.entries()).map(([key, value]) => {
      let displayName = key
      if (timeRange !== 'Saatlik' && !isSpecificDate) {
        const [y, m, d] = key.split('-').map(Number)
        const dateObj = new Date(y, m - 1, d)
        displayName = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
      }
      return {
        name: displayName,
        value: value
      }
    })

    // Format Category data for Recharts
    const totalCatSales = categorySales.meat.count + categorySales.chicken.count + categorySales.drinks.count + categorySales.other.count
    const catData = Object.values(categorySales).filter(c => c.count > 0).map(c => ({
      name: c.name,
      value: c.count,
      color: c.color,
      percentage: totalCatSales > 0 ? Math.round((c.count / totalCatSales) * 100) : 0
    }))

    // Format Product data
    const sortedProducts = Array.from(productSales.entries())
      .map(([name, data]) => ({ name, count: data.count, rev: data.rev }))
      .sort((a, b) => b.count - a.count)

    // Calculate canceled orders for today
    pastOrders.forEach((o) => {
      if (o.status && o.status.toLowerCase().includes('iptal') && o.completedAt) {
        const orderDate = new Date(o.completedAt)
        const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate())
        
        let isPrimaryDay = false
        if (isSpecificDate) {
          isPrimaryDay = orderDateOnly.getTime() === targetDateOnly.getTime()
        } else {
          isPrimaryDay = orderDateOnly.getTime() === today.getTime()
        }
        
        if (isPrimaryDay) {
          todayCancelCount++
        }
      }
    })
    
    const cancelRate = todayCount + todayCancelCount > 0 ? Math.round((todayCancelCount / (todayCount + todayCancelCount)) * 100) : 0

    const todayMeatKg = (todayMeatGrams / 1000).toFixed(2)
    const todayChickenKg = (todayChickenGrams / 1000).toFixed(2)

    return { todayRev, weeklyRev, todayCount, weeklyCount, todayCancelCount, cancelRate, trendData, catData, sortedProducts, categorySales, availableDates, isSpecificDate, todayMeatKg, todayChickenKg }
  }, [pastOrders, timeRange])

  const maxProductCount = stats.sortedProducts.length > 0 ? stats.sortedProducts[0].count : 1

  const favoriDoner = stats.categorySales.meat.count > stats.categorySales.chicken.count ? 'Et Döner' : 'Tavuk Döner'
  const favoriDonerCount = Math.max(stats.categorySales.meat.count, stats.categorySales.chicken.count)
  const favoriUrun = stats.sortedProducts.length > 0 ? stats.sortedProducts[0].name : '-'
  const favoriUrunCount = stats.sortedProducts.length > 0 ? stats.sortedProducts[0].count : 0
  const ortalamaSepet = stats.todayCount > 0 ? Math.round(stats.todayRev / stats.todayCount) : 0

  const handleClearData = async () => {
    if (confirm('Tüm rapor verilerini (geçmiş siparişleri) tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
      await window.api.clearPastOrders()
      window.location.reload()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', boxSizing: 'border-box', paddingBottom: '40px' }}>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>İSTATİSTİK VE RAPORLAR</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={(e) => {
                const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                if (input && input.showPicker) input.showPicker();
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', outline: 'none' }}
            >
              {stats.isSpecificDate ? timeRange.replace(/ /g, '/') : 'Tarih Seç'}
              <Calendar size={16} />
            </button>
            <input 
              type="date"
              style={{ position: 'absolute', right: 0, opacity: 0, pointerEvents: 'none', width: '10px' }}
              value={stats.isSpecificDate ? (() => { const [dd, mm, yyyy] = timeRange.split(' '); return `${yyyy}-${mm}-${dd}` })() : ''}
              onChange={(e) => {
                if (e.target.value) {
                  const [yyyy, mm, dd] = e.target.value.split('-')
                  setTimeRange(`${dd} ${mm} ${yyyy}`)
                } else {
                  setTimeRange('Saatlik')
                }
              }}
            />
          </div>
          <button onClick={handleClearData} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', outline: 'none' }}>
            <Trash2 size={16} /> Verileri Sıfırla
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 100%)', border: '1px solid rgba(34,197,94,0.2)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            {stats.isSpecificDate ? 'Seçilen Gün Cirosu' : 'Bugünkü Ciro'}
            {!stats.isSpecificDate && <span style={{ color: '#4ade80', fontSize: '12px', display: 'flex', alignItems: 'center' }}><TrendingUp size={14} style={{marginRight:'4px'}}/> +%15</span>}
          </div>
          <div style={{ color: '#4ade80', fontSize: '32px', fontWeight: 'bold' }}>{stats.todayRev.toLocaleString('tr-TR')} ₺</div>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px' }}>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>Haftalık Ciro</div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>{stats.weeklyRev.toLocaleString('tr-TR')} ₺</div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px' }}>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>{stats.isSpecificDate ? 'Seçilen Gün Sipariş' : 'Bugünkü Sipariş'}</div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>{stats.todayCount} <span style={{fontSize:'16px', color:'#aaa'}}>Adet</span></div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px' }}>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>Haftalık Sipariş</div>
          <div style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>{stats.weeklyCount} <span style={{fontSize:'16px', color:'#aaa'}}>Adet</span></div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.05) 100%)', border: '1px solid rgba(245,158,11,0.2)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>Favori Döner</div>
          <div style={{ color: '#fcd34d', fontSize: '24px', fontWeight: 'bold' }}>{favoriDoner}</div>
          <div style={{ color: '#aaa', fontSize: '14px', marginTop: '4px' }}>{favoriDonerCount} Satış</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 100%)', border: '1px solid rgba(59,130,246,0.2)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)', overflow: 'hidden' }}>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>Favori Ürün</div>
          <div style={{ width: '100%', overflow: 'hidden', whiteSpace: 'nowrap', height: '36px' }}>
            <div style={{ display: 'inline-block', paddingLeft: '100%', animation: 'marquee 10s linear infinite', color: '#93c5fd', fontSize: '24px', fontWeight: 'bold' }}>
              {favoriUrun}
            </div>
          </div>
          <div style={{ color: '#aaa', fontSize: '14px', marginTop: '4px' }}>{favoriUrunCount} Satış</div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.05) 100%)', border: '1px solid rgba(239,68,68,0.2)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '12px' }}>
            {stats.isSpecificDate ? 'Seçilen Gün Satılan Döner' : 'Bugün Satılan Döner'}
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#fca5a5', fontSize: '20px', fontWeight: 'bold' }}>{stats.todayMeatKg} <span style={{fontSize:'12px', color:'#aaa'}}>kg</span></div>
              <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>Et Döner</div>
            </div>
            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }}></div>
            <div>
              <div style={{ color: '#93c5fd', fontSize: '20px', fontWeight: 'bold' }}>{stats.todayChickenKg} <span style={{fontSize:'12px', color:'#aaa'}}>kg</span></div>
              <div style={{ color: '#aaa', fontSize: '12px', marginTop: '2px' }}>Tavuk Döner</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(168,85,247,0.05) 100%)', border: '1px solid rgba(168,85,247,0.2)', padding: '20px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>Ortalama Sepet Tutarı</div>
          <div style={{ color: '#d8b4fe', fontSize: '24px', fontWeight: 'bold' }}>{ortalamaSepet.toLocaleString('tr-TR')} ₺</div>
          <div style={{ color: '#aaa', fontSize: '14px', marginTop: '4px' }}>Sipariş Başına ({stats.isSpecificDate ? timeRange : 'Bugün'})</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Trend Chart */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Günlük Satış Trendi ({timeRange})</h3>
            <select style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '8px', padding: '4px 12px', outline: 'none' }} value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option value="Saatlik" style={{ background: '#1a1a1a', color: '#fff' }}>Saatlik</option>
              <option value="Günlük" style={{ background: '#1a1a1a', color: '#fff' }}>Günlük</option>
              <option value="Haftalık" style={{ background: '#1a1a1a', color: '#fff' }}>Haftalık</option>
              {stats.isSpecificDate && (
                <option value={timeRange} hidden style={{ background: '#1a1a1a', color: '#fff' }}>{timeRange}</option>
              )}
            </select>
          </div>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#666" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                <RechartsTooltip 
                  contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#4ade80' }}
                  formatter={(value: any) => [`${value} ₺`, 'Ciro']}
                />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', marginBottom: '20px' }}>Kategori Bazlı Satışlar</h3>
          <div style={{ display: 'flex', height: '200px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.catData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.catData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Text overlay */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
                {stats.catData.reduce((acc, curr) => acc + curr.value, 0)}
              </span>
              <span style={{ fontSize: '12px', color: '#aaa' }}>Satışlar</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
            {stats.catData.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#aaa' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c.color, marginRight: '6px' }} />
                <span style={{ color: '#fff', marginRight: '4px' }}>{c.name}</span> ({c.percentage}%) • {c.value} Adet
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', marginBottom: '24px' }}>En Çok Satan Ürünler (Haftalık)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {stats.sortedProducts.slice(0, 4).map((p, i) => {
            const colors = ['#f59e0b', '#3b82f6', '#0ea5e9', '#10b981']
            const widthPct = Math.max((p.count / maxProductCount) * 100, 2)
            
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '120px', color: '#aaa', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name}
                </div>
                <div style={{ flex: 1, height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${widthPct}%`, height: '100%', background: colors[i%colors.length], borderRadius: '6px' }} />
                </div>
                <div style={{ width: '60px', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{p.count} Adet</div>
                <div style={{ width: '80px', color: '#aaa', fontSize: '14px', textAlign: 'right' }}>{p.rev.toLocaleString('tr-TR')} ₺</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Sales Report Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px', paddingBottom: '40px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', marginBottom: '20px' }}>Ürün Satış Raporu</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}>
              <th style={{ padding: '12px 8px', fontWeight: 'normal' }}>Ürün Adı</th>
              <th style={{ padding: '12px 8px', fontWeight: 'normal' }}>Adet</th>
              <th style={{ padding: '12px 8px', fontWeight: 'normal' }}>Toplam Tutar</th>
              <th style={{ padding: '12px 8px', fontWeight: 'normal' }}>Trend</th>
            </tr>
          </thead>
          <tbody>
            {stats.sortedProducts.slice(0, 10).map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
                <td style={{ padding: '16px 8px' }}>{p.name}</td>
                <td style={{ padding: '16px 8px' }}>{p.count}</td>
                <td style={{ padding: '16px 8px' }}>{p.rev.toLocaleString('tr-TR')} ₺</td>
                <td style={{ padding: '16px 8px', color: i < 3 ? '#4ade80' : '#aaa' }}>
                  {i < 3 ? <TrendingUp size={16} /> : <TrendingUp size={16} style={{opacity: 0.5}} />}
                </td>
              </tr>
            ))}
            {stats.sortedProducts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#666' }}>Geçmiş sipariş verisi bulunamadı.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
