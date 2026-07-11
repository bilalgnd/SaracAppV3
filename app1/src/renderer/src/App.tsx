import React, { useEffect } from 'react'
import Swal from 'sweetalert2'
import { useStore } from './store'
import Sidebar from './components/Sidebar'
import MainPanel from './components/MainPanel'
import CartPanel from './components/CartPanel'
import OrderModal from './components/OrderModal'
import SettingsModal from './components/SettingsModal'
import OcrProcessor from './components/OcrProcessor'

import TitleBar from './components/TitleBar'

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = React.useState(localStorage.getItem('saved_username') || '')
  const [password, setPassword] = React.useState(localStorage.getItem('saved_password') || '')
  const [isAutoLoggingIn, setIsAutoLoggingIn] = React.useState(false)
  const [error, setError] = React.useState('')

  useEffect(() => {
    if (username && password) {
      setIsAutoLoggingIn(true)
      window.api.login({ username, password }).then((res: any) => {
        setIsAutoLoggingIn(false)
        if (res.success) {
          onLogin()
        }
      })
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await window.api.login({ username, password })
    if (res.success) {
      localStorage.setItem('saved_username', username)
      localStorage.setItem('saved_password', password)
      onLogin()
    } else {
      setError(res.error || 'Giriş başarısız')
    }
  }

  return (
    <div style={{ height: (!(window as any).electron) ? '100vh' : 'calc(100vh - 32px)', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)' }}>
      <form onSubmit={handleSubmit} style={{ padding: '40px', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-panel)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', width: '350px', display: 'flex', flexDirection: 'column', gap: '15px', transform: 'translateY(-50px)' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 15px 0', fontSize: '28px', fontWeight: 800, letterSpacing: '1px' }}>Login</h2>
        <input className="cart-input" placeholder="Kullanıcı Adı" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: '12px 15px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-dark)' }} />
        <input className="cart-input" type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '12px 15px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-dark)' }} />
        {error && <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>{error}</div>}
        <button type="submit" disabled={isAutoLoggingIn} className="btn btn-primary" style={{ height: '45px', fontSize: '16px', marginTop: '10px' }}>
          {isAutoLoggingIn ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
        </button>
        <button type="button" onClick={() => (window.api as any).exitApp()} className="btn" style={{ height: '40px', backgroundColor: '#ef4444', border: 'none', color: '#fff', fontSize: '14px', marginTop: '2px' }}>
          Çıkış Yap (Kapat)
        </button>
      </form>
    </div>
  )
}

function App() {
  const { setOrders, setMenu } = useStore()
  
  const [isLoggedIn, setIsLoggedIn] = React.useState(false)
  const [isLoadingData, setIsLoadingData] = React.useState(false)
  const [isOffline, setIsOffline] = React.useState(false)

  useEffect(() => {
    const token = localStorage.getItem('pos_token')
    if (token) {
      setIsLoggedIn(true)
    }
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return

    setIsLoadingData(true)
    
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => {
      setIsOffline(false)
      window.location.reload()
    }
    
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    
    if (!navigator.onLine) {
      setIsOffline(true)
    }

    if (window.api && window.api.getSettings) {
      window.api.getSettings().then((settings: any) => {
        if (settings && settings.dailyTotal !== undefined) {
          localStorage.setItem('dailyTotal', settings.dailyTotal.toString())
          window.dispatchEvent(new CustomEvent('daily-total-updated'))
        }
      })
    }
    
    const handleOrders = (orders: any[]) => {
      setOrders(orders)
      let maxSira = 0
      orders.forEach((o: any) => {
        if (o.customer_name && o.customer_name.startsWith('Sıra ')) {
          const num = parseInt(o.customer_name.replace('Sıra ', ''), 10)
          if (!isNaN(num) && num > maxSira) {
            maxSira = num
          }
        }
      })
      useStore.setState({ orderSequence: maxSira + 1 })
    }

    window.api.getOrders().then(handleOrders)
    window.api.getMenu().then(setMenu)
    setIsLoadingData(false)

    const handleServerEvent = (action: string, data?: any) => {
      if (action === 'order_deleted' && data) {
        if (data.newDailyTotal !== undefined) {
          localStorage.setItem('dailyTotal', data.newDailyTotal.toString())
        } else if (data.totalAmount) {
          const currentTotal = parseFloat(localStorage.getItem('dailyTotal') || '0')
          localStorage.setItem('dailyTotal', (currentTotal + data.totalAmount).toString())
        }
        window.dispatchEvent(new CustomEvent('daily-total-updated'))
      }

      if (action === 'request_update' || action === 'order_received' || action === 'order_deleted' || action === 'update_status' || action === 'new_order') {
        window.api.getOrders().then(handleOrders)
      }

      if (action === 'print_receipt' && data && data.customerName) {
        window.api.getOrders().then(orders => {
          const order = orders.find(o => o.customer_name === data.customerName)
          if (order) {
            window.api.printReceipt(order)
          }
        })
      }
    }

    const handleUpdaterEvent = (action: string, _data?: any) => {
      if (action === 'update-downloaded') {
        Swal.fire({
          title: 'Yeni Sürüm Hazır!',
          text: 'Güncel versiyon arka planda indirildi. Şimdi çıkıp kurulsun mu?',
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: 'Evet, Kur ve Yeniden Başlat',
          cancelButtonText: 'Daha Sonra',
          background: '#222',
          color: '#fff',
          confirmButtonColor: '#10b981'
        }).then((result) => {
          if (result.isConfirmed) {
            window.api.installUpdate()
          }
        })
      }
    }

    const sub = window.api.onServerEvent(handleServerEvent)
    const updaterSub = window.api.onUpdaterEvent(handleUpdaterEvent)
    return () => {
      window.api.offServerEvent(sub)
      window.api.offUpdaterEvent(updaterSub)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [isLoggedIn, setOrders, setMenu])

  return (
    <>
      <TitleBar />
      {!isLoggedIn ? (
        <LoginScreen onLogin={() => setIsLoggedIn(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: (!(window as any).electron) ? '100vh' : 'calc(100vh - 32px)', width: '100vw', overflow: 'hidden' }}>
          <div className="app-container" style={{ height: '100%' }}>
            <Sidebar />
            <MainPanel />
            <CartPanel />
            <OrderModal />
            <SettingsModal />
            <OcrProcessor />
          </div>
        </div>
      )}

      {isLoggedIn && isLoadingData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff', backdropFilter: 'blur(5px)' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Sunucuya Bağlanılıyor...</div>
        </div>
      )}
      
      {isLoggedIn && isOffline && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff', backdropFilter: 'blur(5px)' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#ef4444' }}>Bağlantı Koptu</div>
          <div style={{ fontSize: '16px', opacity: 0.8 }}>Yeniden bağlanılıyor, lütfen bekleyin...</div>
        </div>
      )}
    </>
  )
}

export default App
