import { useEffect, useState } from 'react'

export default function TitleBar() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [localIp, setLocalIp] = useState('')

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (window.api && window.api.onServerEvent) {
      const sub = window.api.onServerEvent((action: string, status?: any) => {
        if (action === 'network_status') {
          setIsOnline(status === 'online')
        }
      })
      return () => {
        if (window.api && window.api.offServerEvent) {
          window.api.offServerEvent(sub)
        }
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }

    if (window.api && (window.api as any).getNetworkStatus) {
      (window.api as any).getNetworkStatus().then((net: any) => {
        if (net?.localIp) setLocalIp(net.localIp)
      }).catch(() => {})
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!(window as any).electron) {
    return null
  }

  const minimize = () => (window.api as any).minimizeWindow()
  const maximize = () => (window.api as any).maximizeWindow()
  const close = () => (window.api as any).closeWindow()

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '32px',
        backgroundColor: '#111',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        borderBottom: '1px solid #222',
        paddingLeft: '12px'
      } as any}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' } as any}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          borderRadius: '10px',
          backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
          fontSize: '11px',
          fontWeight: 600,
          color: isOnline ? '#10b981' : '#f59e0b'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#10b981' : '#f59e0b',
            boxShadow: `0 0 6px ${isOnline ? '#10b981' : '#f59e0b'}`
          }} />
          {isOnline ? 'Bulut Çevrimiçi' : 'Yerel Mod (Çevrimdışı)'}
        </div>
        {localIp && (
          <span style={{ fontSize: '10px', color: '#666' }}>
            LAN: {localIp}:3005
          </span>
        )}
      </div>

      <div style={{ display: 'flex', height: '100%' }}>
        <button
          onClick={minimize}
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'transparent',
            border: 'none',
            color: '#aaa',
            width: '46px',
            height: '100%',
            cursor: 'pointer',
            fontSize: '16px'
          } as any}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#333')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          &#8211;
        </button>
        <button
          onClick={maximize}
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'transparent',
            border: 'none',
            color: '#aaa',
            width: '46px',
            height: '100%',
            cursor: 'pointer',
            fontSize: '14px'
          } as any}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#333')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          &#9723;
        </button>
        <button
          onClick={close}
          style={{
            WebkitAppRegion: 'no-drag',
            background: 'transparent',
            border: 'none',
            color: '#aaa',
            width: '46px',
            height: '100%',
            cursor: 'pointer',
            fontSize: '16px'
          } as any}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#E81123'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#aaa'
          }}
        >
          &#10005;
        </button>
      </div>
    </div>
  )
}
