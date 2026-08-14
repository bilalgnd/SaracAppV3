import { customConfirm } from "../utils/alert"
import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { LayoutGrid, Beef, Drumstick, Tags, Coffee, Settings, LogOut, RefreshCcw, UserX } from 'lucide-react'

export default function Sidebar() {
  const { activeTab, setActiveTab, menu } = useStore()

  const tabs = [
    { name: 'MASALAR', icon: <LayoutGrid size={20} /> }
  ]
  
  if (menu && menu.categories) {
    menu.categories.forEach(cat => {
      let icon = <Tags size={20} />
      const nameLower = cat.name.toLowerCase()
      if (nameLower.includes('et')) icon = <Beef size={20} />
      if (nameLower.includes('tavuk')) icon = <Drumstick size={20} />
      if (nameLower.includes('içecek') || nameLower.includes('icecek')) icon = <Coffee size={20} />
      
      tabs.push({ name: cat.name.toUpperCase(), icon })
    })
  }

  const [dailyTotal, setDailyTotal] = useState(0)

  useEffect(() => {
    const total = parseFloat(localStorage.getItem('dailyTotal') || '0')
    setDailyTotal(total)

    const handleUpdate = () => {
      setDailyTotal(parseFloat(localStorage.getItem('dailyTotal') || '0'))
    }

    window.addEventListener('daily-total-updated', handleUpdate)

    return () => {
      window.removeEventListener('daily-total-updated', handleUpdate)
    }
  }, [])

  // Sync dailyTotal to backend for TV Mode via IPC
  useEffect(() => {
    if (window.api && window.api.updateDailyTotal) {
      window.api.updateDailyTotal(dailyTotal)
    }
  }, [dailyTotal])

  const resetDailyTotal = async () => {
    if (await customConfirm('Günlük kazancı sıfırlamak istediğinize emin misiniz?')) {
      localStorage.setItem('dailyTotal', '0')
      setDailyTotal(0)
    }
  }



  const handleExit = () => {
    window.api.exitApp()
  }

  const handleLogoff = async () => {
    if (await customConfirm('Hesabınızdan çıkış yapmak istediğinize emin misiniz? (Tekrar giriş yapmanız gerekecektir)')) {
      const settings = await window.api.getSettings()
      settings.API_TOKEN = ''
      window.api.saveSettings(settings)
      
      localStorage.removeItem('pos_token')
      localStorage.removeItem('saved_username')
      localStorage.removeItem('saved_password')
      
      setTimeout(() => {
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
          window.location.href = '/'
        } else {
          window.location.reload()
        }
      }, 300)
    }
  }

  return (
    <div className="sidebar">
      <div 
        className="logo-container" 
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => window.open('https://bilalgnd.shop/', '_blank')}
        title="bilalgnd.shop sitesine git"
      >
        <div className="logo-title">VANTAGE</div>
        <div className="logo-subtitle">DASHBOARD</div>
      </div>

      <div className="nav-tabs-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            className={`nav-btn ${activeTab === idx ? 'active' : ''}`}
            onClick={() => setActiveTab(idx)}
          >
            {tab.icon} {tab.name}
          </button>
        ))}

        {tabs.length === 1 && (
          <button
            className="nav-btn"
            style={{ borderStyle: 'dashed', borderColor: 'var(--primary)', color: 'var(--primary)', marginTop: 10, justifyContent: 'center' }}
            onClick={() => {
              localStorage.setItem('settings-tab', 'menu')
              window.dispatchEvent(new CustomEvent('open-settings-modal'))
            }}
          >
            + Kategori Oluştur
          </button>
        )}

        <div id="dailyTotalBadge" style={{ 
          margin: '14px 12px 0',
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(16, 185, 129, 0.03) 100%)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          transition: 'border-color 0.2s ease'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                GÜNLÜK KAZANÇ
              </span>
            </div>
            <span style={{ color: '#4ade80', fontSize: '18px', fontWeight: 800, letterSpacing: '0.2px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {dailyTotal.toLocaleString('tr-TR')} ₺
            </span>
          </div>
          <button 
            style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              border: '1px solid rgba(255, 255, 255, 0.08)', 
              color: '#9ca3af', 
              cursor: 'pointer', 
              width: '30px', 
              height: '30px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.color = '#9ca3af'
            }}
            onClick={resetDailyTotal}
            title="Günlük Kazancı Sıfırla"
          >
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>

      <div className="sidebar-bottom">
        <button 
          className="btn" 
          style={{ height: 44, backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.08)' }}
          onClick={() => window.dispatchEvent(new CustomEvent('open-settings-modal'))}
        >
          <Settings size={18} style={{ marginRight: 8 }} /> Sistem Ayarları
        </button>
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: '12px', padding: '8px 10px', gap: '8px', marginTop: '8px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingLeft: '2px' }}>
            <div style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.5px' }}>Oturum</div>
            <div style={{ fontSize: '13px', color: '#eee', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} title={localStorage.getItem('saved_username') || 'Bilinmiyor'}>
              {localStorage.getItem('saved_username') || 'Bilinmiyor'}
            </div>
          </div>
          
          <button 
            className="btn"
            onClick={handleLogoff}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', width: '34px', height: '34px', borderRadius: '8px', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="Sisteme yeni bir hesapla girmek için oturumu kapatır."
          >
            <UserX size={16} />
          </button>
          
          <button 
            className="btn"
            onClick={handleExit}
            style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(185, 28, 28, 0.35))', border: '1px solid rgba(239, 68, 68, 0.3)', width: '34px', height: '34px', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            title="Kasa uygulamasını tamamen kapatır."
          >
            <LogOut size={16} />
          </button>
          
        </div>
      </div>
    </div>
  )
}
