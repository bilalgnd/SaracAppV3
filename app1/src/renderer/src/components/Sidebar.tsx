import { customConfirm } from "../utils/alert"
import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { LayoutGrid, Beef, Drumstick, Tags, Coffee, Settings, LogOut, RefreshCcw, UserX, FolderUp } from 'lucide-react'

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
          marginTop: '15px', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(46, 204, 113, 0.12)',
          border: '1px solid rgba(46, 204, 113, 0.35)',
          borderRadius: '20px',
          padding: '6px 14px',
          boxShadow: '0 0 12px rgba(46, 204, 113, 0.15)',
          margin: '15px 6px 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#aaa', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: 'system-ui, -apple-system, sans-serif' }}>GÜNLÜK</span>
            <span style={{ color: '#2ECC71', fontSize: '16px', fontWeight: 800, fontFamily: 'system-ui, -apple-system, sans-serif', textShadow: '0 0 8px rgba(46, 204, 113, 0.4)' }}>
              {dailyTotal.toLocaleString('tr-TR')} ₺
            </span>
          </div>
          <button 
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
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
          style={{ height: 44, backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'white', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.08)' }}
          onClick={() => window.dispatchEvent(new CustomEvent('open-fileshare-modal'))}
        >
          <FolderUp size={18} style={{ marginRight: 8 }} /> Dosya Paylaşım
        </button>
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
