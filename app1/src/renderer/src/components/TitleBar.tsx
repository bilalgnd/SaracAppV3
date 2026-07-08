export default function TitleBar() {
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
        justifyContent: 'flex-end',
        alignItems: 'center',
        height: '32px',
        backgroundColor: '#111',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
        borderBottom: '1px solid #333'
      } as any}
    >
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
