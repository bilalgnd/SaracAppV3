import { customAlert, customConfirm } from '../utils/alert'
import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import ReportsTab from './ReportsTab'

export default function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  
  const [settings, setSettings] = useState<any>({})
  const [printers, setPrinters] = useState<any[]>([])
  
  const [latestRelease, setLatestRelease] = useState<any>(null)
  const [updaterState, setUpdaterState] = useState<{ status: string, progress?: any, info?: any, error?: string }>({ status: 'idle' })
  
  const [networkStatus, setNetworkStatus] = useState<any>(null)
  const [pastOrders, setPastOrders] = useState<any[]>([])
  const [menuData, setMenuData] = useState<any>(null)
  // tvLink unused

  // Custom Prompt States
  const [promptData, setPromptData] = useState<{ type: 'add' | 'edit' | 'color' | 'textColor' | 'globalTextColor' | 'addCategory' | 'renameCategory', category?: string, idx?: number, catIdx?: number, oldName?: string, title: string } | null>(null)
  const [inputVal1, setInputVal1] = useState('') // Used for Product Name or Color
  const [portions, setPortions] = useState<{portion: string, price: string}[]>([{portion: 'Standart', price: ''}])
  
  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState<{ catIdx: number, idx: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [activeTab])
  


  useEffect(() => {
    const handleOpen = (e: any) => {
      window.api.getSettings().then((data) => setSettings(data || {}))
      fetchNetworkStatus()
      fetchPastOrders()
      setMenuData(useStore.getState().menu)
      const fallbackTab = localStorage.getItem('settings-tab')
      if (fallbackTab) {
        setActiveTab(fallbackTab)
        localStorage.removeItem('settings-tab')
      } else if (e && e.detail && e.detail.tab) {
        setActiveTab(e.detail.tab)
      }
      setIsOpen(true)
    }
    window.addEventListener('open-settings-modal', handleOpen)
    
    const unsubUpdater = window.api.onUpdaterEvent((action: string, data: any) => {
      if (action === 'checking') setUpdaterState({ status: 'checking' })
      else if (action === 'update-available') setUpdaterState({ status: 'available', info: data })
      else if (action === 'update-not-available') setUpdaterState({ status: 'not-available', info: data })
      else if (action === 'download-progress') setUpdaterState(prev => ({ ...prev, status: 'downloading', progress: data }))
      else if (action === 'update-downloaded') setUpdaterState({ status: 'downloaded', info: data })
      else if (action === 'error') setUpdaterState({ status: 'error', error: data })
    })

    return () => {
      window.removeEventListener('open-settings-modal', handleOpen)
      window.api.offUpdaterEvent(unsubUpdater)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'spotify') {
      // window.api.getTvLink()
    }
  }, [activeTab])

  const fetchNetworkStatus = async () => {
    try {
      const res = await window.api.getNetworkStatus()
      setNetworkStatus(res)
    } catch (e) { console.error(e) }
  }

  const fetchPastOrders = async () => {
    try {
      const res = await window.api.getPastOrders()
      setPastOrders(res || [])
    } catch (e) { console.error(e) }
  }

  const handleDeletePastOrder = async (index: number) => {
    if (await customConfirm('Bu siparişi geçmişten silmek istediğinize emin misiniz?')) {
      if (window.api && window.api.deletePastOrder) {
        window.api.deletePastOrder(index)
        setPastOrders(prev => prev.filter((_, i) => i !== index))
      }
    }
  }

  const handleClearPastOrders = async () => {
    if (await customConfirm('Tüm geçmiş siparişleri kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
      if (window.api && window.api.clearPastOrders) {
        window.api.clearPastOrders()
        setPastOrders([])
      }
    }
  }

  

  if (!isOpen) return null

  const handleSaveSettings = () => {
    window.api.saveSettings(settings)
    customAlert("Ayarlar kaydedildi!")
  }

  const handleSettingChange = (key: string, value: string) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }))
  }

  const loadPrinters = async () => {
    const prns = await window.api.getPrinters()
    setPrinters(prns)
  }

  const selectPrinter = (printerName: string) => {
    handleSettingChange('YAZICI_ADI', printerName)
    window.api.saveSettings({ ...settings, YAZICI_ADI: printerName })
    customAlert(`Yazıcı seçildi: ${printerName}`)
  }

  const triggerSpotifyLogin = async () => {
    const link = await (window.api as any).getSpotifyLoginLink();
    window.open(link, '_blank');
  }
  // openWebPanel unused

  const checkUpdates = async () => {
    setUpdaterState({ status: 'checking' })
    // 1. Electron autoUpdater for .exe
    window.api.checkForUpdates()
    
    // 2. Fetch latest release from GitHub for .apk downloads
    try {
      const res = await fetch('https://api.github.com/repos/bilalgnd/saracapp/releases/latest', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setLatestRelease(data)
      }
    } catch (e) {
      console.error("Guncelleme kontrolu basarisiz", e)
    }
  }
  const downloadUpdate = () => window.api.downloadUpdate()
  const installUpdate = () => window.api.installUpdate()

  const sendUpdateToPhones = async (url: string) => {
    if (await customConfirm("Bu guncellemeyi (APK) tum garson telefonlarina yollamak istediginize emin misiniz?")) {
      window.api.sendUpdateToPhones(url)
      customAlert("Guncelleme komutu tum telefonlara gonderildi!")
    }
  }
  
  const openAddCategoryPrompt = () => {
    setInputVal1('')
    setPromptData({ type: 'addCategory', title: 'Yeni Kategori Ekle' })
  }

  const openRenameCategoryPrompt = (catIdx: number, oldName: string) => {
    setInputVal1(oldName)
    setPromptData({ type: 'renameCategory', catIdx, title: 'Kategori Adını Değiştir', oldName })
  }

  const handleDeleteCategory = async (catIdx: number, catName: string) => {
    if (!(await customConfirm(`'${catName}' kategorisini ve içindeki TÜM ürünleri silmek istediğinize emin misiniz?`))) return
    const newMenu = { ...menuData }
    newMenu.categories = newMenu.categories.filter((_: any, i: number) => i !== catIdx)
    
    setMenuData(newMenu)
    useStore.getState().setMenu(newMenu)
    
    try {
      if (window.api && window.api.saveMenu) {
        window.api.saveMenu(newMenu)
      }
    } catch (e) {
      console.error("Save menu error", e)
    }
  }

  const openAddProductPrompt = (catIdx: number) => {
    setInputVal1('')
    setPortions([{portion: 'Standart', price: ''}])
    setPromptData({ type: 'add', catIdx, title: 'Yeni Ürün Ekle' })
  }

  const openEditProductPrompt = (catIdx: number, idx: number, prod: any) => {
    setInputVal1(prod.name)
    setPortions(prod.options.map((o: any) => ({ portion: o.portion, price: o.price.toString() })))
    setPromptData({ type: 'edit', catIdx, idx, title: 'Ürünü Düzenle' })
  }

  const openColorPrompt = (catIdx: number, idx: number, currentColor: string) => {
    setInputVal1(currentColor || '#333333')
    setPromptData({ type: 'color', catIdx, idx, title: 'Ürün Arka Plan Rengini Değiştir' })
  }

  const openTextColorPrompt = (catIdx: number, idx: number, currentTextColor: string) => {
    setInputVal1(currentTextColor || '#FFFFFF')
    setPromptData({ type: 'textColor', catIdx, idx, title: 'Ürün Yazı Rengini Değiştir' })
  }

  const openGlobalTextColorPrompt = () => {
    setInputVal1('')
    setPromptData({ type: 'globalTextColor', title: 'Tüm Menünün Yazı Rengini Değiştir' })
  }

  const handleDeleteProduct = async (catIdx: number, idx: number) => {
    if (!(await customConfirm("Bu ürünü silmek istediğinize emin misiniz?"))) return
    const newMenu = { ...menuData }
    const newCatItems = newMenu.categories[catIdx].items.filter((_: any, i: number) => i !== idx)
    newMenu.categories[catIdx].items = newCatItems
    
    setMenuData(newMenu)
    useStore.getState().setMenu(newMenu)
    
    try {
      if (window.api && window.api.saveMenu) {
        window.api.saveMenu(newMenu)
      }
    } catch (e) {
      console.error("Save menu error", e)
    }
  }

  // Drag and Drop Handlers
  const handleDragStart = (catIdx: number, idx: number) => {
    setDraggedItem({ catIdx, idx })
  }

  const handleDragOver = (e: React.DragEvent, _catIdx: number) => {
    e.preventDefault() // Gerekli: drop işlemine izin ver
  }

  const handleDrop = (catIdx: number, dropIdx: number) => {
    if (!draggedItem || draggedItem.catIdx !== catIdx || draggedItem.idx === dropIdx) {
      setDraggedItem(null)
      return
    }

    const newMenu = { ...menuData }
    const catItems = [...newMenu.categories[catIdx].items]
    
    // Öğeyi eski yerinden çıkar
    const [removedItem] = catItems.splice(draggedItem.idx, 1)
    // Yeni yerine ekle
    catItems.splice(dropIdx, 0, removedItem)
    
    newMenu.categories[catIdx].items = catItems
    setMenuData(newMenu)
    useStore.getState().setMenu(newMenu)
    
    try {
      if (window.api && window.api.saveMenu) {
        window.api.saveMenu(newMenu)
      }
    } catch (e) {}
    
    setDraggedItem(null)
  }

  const submitPrompt = () => {
    if (!promptData) return
    const newMenu = { ...menuData }
    
    if (promptData.type === 'add') {
      if (!inputVal1 || portions.some(p => !p.portion || !p.price)) {
        customAlert('Lütfen ürün adını ve tüm porsiyon/fiyat bilgilerini eksiksiz girin.')
        return
      }
      const newItem = {
        name: inputVal1,
        color: '#333333',
        textColor: '#FFFFFF',
        options: portions.map(p => ({ portion: p.portion, price: parseInt(p.price) }))
      }
      newMenu.categories[promptData.catIdx!].items = [newItem, ...newMenu.categories[promptData.catIdx!].items]
    } 
    else if (promptData.type === 'edit') {
      if (!inputVal1 || portions.some(p => !p.portion || !p.price)) {
        customAlert('Lütfen ürün adını ve tüm porsiyon/fiyat bilgilerini eksiksiz girin.')
        return
      }
      newMenu.categories[promptData.catIdx!].items[promptData.idx!] = {
        ...newMenu.categories[promptData.catIdx!].items[promptData.idx!],
        name: inputVal1,
        options: portions.map(p => ({ portion: p.portion, price: parseInt(p.price) }))
      }
    }
    else if (promptData.type === 'color') {
      if (!inputVal1) return
      newMenu.categories[promptData.catIdx!].items[promptData.idx!].color = inputVal1
    }
    else if (promptData.type === 'textColor') {
      if (!inputVal1) return
      newMenu.categories[promptData.catIdx!].items[promptData.idx!].textColor = inputVal1
    }
    else if (promptData.type === 'globalTextColor') {
      if (!inputVal1) return
      if (newMenu.categories) {
        newMenu.categories.forEach((cat: any) => {
          cat.items = cat.items.map((item: any) => ({ ...item, textColor: inputVal1 }))
        })
      }
    }
    else if (promptData.type === 'addCategory') {
      if (!inputVal1) return
      if (!newMenu.categories) newMenu.categories = []
      newMenu.categories.push({ id: `cat_${Date.now()}`, name: inputVal1, items: [] })
    }
    else if (promptData.type === 'renameCategory') {
      if (!inputVal1) return
      newMenu.categories[promptData.catIdx!].name = inputVal1
    }
    
    setMenuData(newMenu)
    useStore.getState().setMenu(newMenu)
    
    try {
      if (window.api && window.api.saveMenu) {
        window.api.saveMenu(newMenu)
      }
    } catch (e) {
      console.error("Save menu error", e)
    }
    
    setPromptData(null)
  }

  return (
    <div className="settings-overlay" onClick={() => setIsOpen(false)}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <button className="settings-close-btn" onClick={() => setIsOpen(false)}>✕</button>
        
        {/* Custom Prompt Modal (Overlay over settings modal) */}
        {promptData && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
            <div style={{ backgroundColor: '#1A1A1A', padding: 30, borderRadius: 10, width: 450, border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxHeight: '80vh', overflowY: 'auto' }}>
              <h3 style={{ color: 'white', marginBottom: 20 }}>{promptData.title}</h3>
              
              {promptData.type === 'addCategory' || promptData.type === 'renameCategory' ? (
                <>
                  <label style={{ display: 'block', color: '#ccc', marginBottom: 5 }}>Kategori Adı:</label>
                  <input autoFocus className="settings-input" value={inputVal1} onChange={e => setInputVal1(e.target.value)} placeholder="Örn: Tatlılar" />
                </>
              ) : promptData.type === 'add' || promptData.type === 'edit' ? (
                <>
                  <label style={{ display: 'block', color: '#ccc', marginBottom: 5 }}>Ürün Adı:</label>
                  <input autoFocus className="settings-input" value={inputVal1} onChange={e => setInputVal1(e.target.value)} placeholder="Örn: Et Döner" />
                  
                  <label style={{ display: 'block', color: '#ccc', marginBottom: 5, marginTop: 15 }}>Porsiyonlar ve Fiyatlar:</label>
                  {portions.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      <input className="settings-input" style={{ marginBottom: 0, flex: 1 }} value={p.portion} onChange={e => {
                        const newP = [...portions]; newP[i].portion = e.target.value; setPortions(newP)
                      }} placeholder="Porsiyon (Örn: Dürüm, 100gr)" />
                      <input type="number" className="settings-input" style={{ marginBottom: 0, width: 100 }} value={p.price} onChange={e => {
                        const newP = [...portions]; newP[i].price = e.target.value; setPortions(newP)
                      }} placeholder="Fiyat (TL)" />
                      {portions.length > 1 && (
                        <button className="settings-btn danger" style={{ padding: '0 15px' }} onClick={() => setPortions(portions.filter((_, idx) => idx !== i))}>X</button>
                      )}
                    </div>
                  ))}
                  <button className="settings-btn" style={{ width: '100%', marginTop: 5, padding: 8, fontSize: 13, borderStyle: 'dashed' }} onClick={() => setPortions([...portions, {portion: '', price: ''}])}>+ Yeni Gramaj/Porsiyon Ekle</button>
                </>
              ) : (
                <>
                  <label style={{ display: 'block', color: '#ccc', marginBottom: 5 }}>Yeni Renk Kodu (Ad veya HEX):</label>
                  <input autoFocus className="settings-input" value={inputVal1} onChange={e => setInputVal1(e.target.value)} placeholder="Örn: #FFFFFF, black, white" />
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button style={{ flex: 1, height: 30, backgroundColor: '#FFFFFF', border: 'none', color: 'black' }} onClick={() => setInputVal1('#FFFFFF')}>Beyaz</button>
                    <button style={{ flex: 1, height: 30, backgroundColor: '#000000', border: '1px solid #333', color: 'white' }} onClick={() => setInputVal1('#000000')}>Siyah</button>
                    {promptData.type === 'color' && (
                      <>
                        <button style={{ flex: 1, height: 30, backgroundColor: '#D32F2F', border: 'none' }} onClick={() => setInputVal1('#D32F2F')} />
                        <button style={{ flex: 1, height: 30, backgroundColor: '#388E3C', border: 'none' }} onClick={() => setInputVal1('#388E3C')} />
                        <button style={{ flex: 1, height: 30, backgroundColor: '#F9A825', border: 'none' }} onClick={() => setInputVal1('#F9A825')} />
                      </>
                    )}
                  </div>
                </>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 25 }}>
                <button className="settings-btn" onClick={() => setPromptData(null)}>İptal</button>
                <button className="settings-btn success" onClick={submitPrompt}>Onayla</button>
              </div>
            </div>
          </div>
        )}

        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
            <h2>Ayarlar</h2>
          </div>
          <button className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`} onClick={() => { setActiveTab('general'); fetchNetworkStatus(); }}>Genel</button>
          <button className={`settings-tab ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => { setActiveTab('reports'); fetchPastOrders(); }}>Raporlar</button>
          <button className={`settings-tab ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}>Menü Yönetimi</button>
          <button className={`settings-tab ${activeTab === 'past_orders' ? 'active' : ''}`} onClick={() => { setActiveTab('past_orders'); fetchPastOrders(); }}>Geçmiş Siparişler</button>
          <button className={`settings-tab ${activeTab === 'printer' ? 'active' : ''}`} onClick={() => { setActiveTab('printer'); loadPrinters(); }}>Yazıcı</button>
          <button className={`settings-tab ${activeTab === 'spotify' ? 'active' : ''}`} onClick={() => setActiveTab('spotify')}>API Keys</button>
          <button className={`settings-tab ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => { setActiveTab('updates'); checkUpdates(); }}>Güncellemeler</button>
        </div>

        <div className="settings-content" ref={scrollRef}>
          {activeTab === 'general' && (
            <div>
              <div className="settings-section-title">Genel Ayarlar</div>
              

              <div className="settings-card">
                <div className="settings-card-title">TV Ekran Koruyucu (Bekleme Modu)</div>
                <p style={{ fontSize: 12, color: 'gray', marginBottom: 15 }}>Televizyon bekleme ekranındayken (sipariş yokken) hangi animasyonun gösterileceğini seçin. Bu ayarı garson cihazlarından (App2) da değiştirebilirsiniz.</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[
                    { val: 'off', label: 'Kapalı' },
                    { val: 'spotify', label: 'Spotify Müzik Çalar' },
                    { val: 'glow', label: 'Nefes Alan Arkaplan' },
                    { val: 'dvd', label: 'DVD Logo' }
                  ].map(opt => (
                    <button 
                      key={opt.val}
                      onClick={() => {
                        handleSettingChange('TV_SCREENSAVER', opt.val);
                        const updatedSettings = { ...settings, TV_SCREENSAVER: opt.val };
                        window.api.saveSettings(updatedSettings);
                      }}
                      style={{ 
                        padding: '10px 18px', 
                        borderRadius: '20px', 
                        border: 'none', 
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: '0.2s',
                        backgroundColor: (settings.TV_SCREENSAVER || 'off') === opt.val ? '#4CAF50' : '#2a2a2a',
                        color: (settings.TV_SCREENSAVER || 'off') === opt.val ? 'white' : '#aaa'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-card" style={{ marginTop: 20 }}>
                <div className="settings-card-title">Sipariş Yakalama Yöntemleri (Çift Siparişi Önleme)</div>
                <p style={{ fontSize: 12, color: 'gray', marginBottom: 15 }}>Farklı yöntemler aynı siparişi çift düşürebilir. Sadece güvendiğiniz tek bir yöntemi aktif bırakmanız önerilir.</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {/* 1. Eklenti */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>1. Chrome Eklentisi (Tavsiye Edilen)</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>Tarayıcıya kurduğunuz eklentiden gelen verileri kabul eder.</div>
                    </div>
                    <button 
                      className={`settings-btn ${settings.ENABLE_EXTENSION ? 'success' : 'danger'}`}
                      onClick={() => {
                        const newVal = !settings.ENABLE_EXTENSION;
                        handleSettingChange('ENABLE_EXTENSION', newVal);
                        window.api.saveSettings({ ...settings, ENABLE_EXTENSION: newVal });
                      }}
                      style={{ padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', width: '100px' }}
                    >
                      {settings.ENABLE_EXTENSION ? 'Açık' : 'Kapalı'}
                    </button>
                  </div>

                  {/* 2. Yerel Bot */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>2. Yerel Kasa Botu (Puppeteer)</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>Arka planda Chrome'a bağlanıp verileri Belgelerim'e kaydeder.</div>
                    </div>
                    <button 
                      className={`settings-btn ${settings.ENABLE_LOCAL_BOT ? 'success' : 'danger'}`}
                      onClick={() => {
                        const newVal = !settings.ENABLE_LOCAL_BOT;
                        handleSettingChange('ENABLE_LOCAL_BOT', newVal);
                        window.api.saveSettings({ ...settings, ENABLE_LOCAL_BOT: newVal });
                      }}
                      style={{ padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', width: '100px' }}
                    >
                      {settings.ENABLE_LOCAL_BOT ? 'Açık' : 'Kapalı'}
                    </button>
                  </div>

                  {/* 3. Dosya Okuyucu */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>3. Yerel Belge Okuyucu (Log İzleyici)</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>Belgelerim/logs klasörüne düşen PDF ve TXT dosyalarını okur.</div>
                    </div>
                    <button 
                      className={`settings-btn ${settings.ENABLE_FILE_WATCHER ? 'success' : 'danger'}`}
                      onClick={() => {
                        const newVal = !settings.ENABLE_FILE_WATCHER;
                        handleSettingChange('ENABLE_FILE_WATCHER', newVal);
                        window.api.saveSettings({ ...settings, ENABLE_FILE_WATCHER: newVal });
                      }}
                      style={{ padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', width: '100px' }}
                    >
                      {settings.ENABLE_FILE_WATCHER ? 'Açık' : 'Kapalı'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="settings-card" style={{ marginTop: 20 }}>
                <div className="settings-card-title">Aktif Garson Cihazları (App2)</div>
                {networkStatus?.connectedDevices?.length > 0 ? (
                  <ul style={{ paddingLeft: 20, color: '#4CAF50', fontWeight: 'bold' }}>
                    {networkStatus.connectedDevices.map((ip: string, i: number) => (
                      <li key={i} style={{ marginBottom: 5 }}>Cihaz: {ip}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: '#F44336' }}>Şu an hiçbir garson cihazı bağlı değil.</p>
                )}
                <button className="settings-btn" style={{ marginTop: 15 }} onClick={fetchNetworkStatus}>Yenile</button>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <ReportsTab pastOrders={pastOrders} />
          )}

          {activeTab === 'menu' && (
            <div>
              <div style={{ marginBottom: 25, borderBottom: '1px solid #2A2A2A', paddingBottom: 10 }}>
                <div className="settings-section-title" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>Menü Yönetimi</div>
              </div>
              
              <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>💡 İpucu: Ürünlerin sırasını değiştirmek için tablonun en sağındaki "☰" (Sürükle) simgesinden tutup yukarı veya aşağı kaydırabilirsiniz. Yeni kategori eklemek için aşağıdaki butonu kullanın.</div>
              
              {menuData?.categories?.map((cat: any, catIdx: number) => (
                <div key={cat.id || catIdx} className="settings-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <div className="settings-card-title" style={{ margin: 0, textTransform: 'capitalize', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      Kategori: {cat.name}
                      <button className="settings-btn primary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => openRenameCategoryPrompt(catIdx, cat.name)}>Adını Düzenle</button>
                      <button className="settings-btn danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleDeleteCategory(catIdx, cat.name)}>Kategoriyi Sil</button>
                    </div>
                    <button className="settings-btn success" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => openAddProductPrompt(catIdx)}>+ Yeni Ürün</button>
                  </div>
                  <table className="settings-table">
                    <thead>
                      <tr>
                        <th>Ürün Adı</th>
                        <th>Renkler</th>
                        <th>İşlem</th>
                        <th style={{ width: 40, textAlign: 'center' }}>Sıra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.items?.map((prod: any, i: number) => (
                        <tr 
                          key={i}
                          draggable
                          onDragStart={() => handleDragStart(catIdx, i)}
                          onDragOver={(e) => handleDragOver(e, catIdx)}
                          onDrop={() => handleDrop(catIdx, i)}
                          style={{ 
                            backgroundColor: draggedItem?.catIdx === catIdx && draggedItem?.idx === i ? '#333' : 'transparent',
                            opacity: draggedItem?.catIdx === catIdx && draggedItem?.idx === i ? 0.5 : 1
                          }}
                        >
                          <td>
                            <div style={{ fontWeight: 600 }}>{prod.name}</div>
                            <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
                              {prod.options?.map((o:any) => `${o.portion}: ${o.price}₺`).join(' | ')}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                              <div style={{ width: 14, height: 14, backgroundColor: prod.color || '#333', borderRadius: 4 }}></div>
                              <span style={{ fontSize: 11, color: '#aaa' }}>Arka: {prod.color || '#333'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 14, height: 14, backgroundColor: prod.textColor || '#fff', borderRadius: 4, border: '1px solid #555' }}></div>
                              <span style={{ fontSize: 11, color: '#aaa' }}>Yazı: {prod.textColor || '#fff'}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button className="settings-btn primary" style={{ padding: '5px 10px', fontSize: 11, color: 'black' }} onClick={() => openEditProductPrompt(catIdx, i, prod)}>Düzenle</button>
                              <button className="settings-btn danger" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => handleDeleteProduct(catIdx, i)}>Sil</button>
                              <button className="settings-btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => openColorPrompt(catIdx, i, prod.color)}>Arka Plan</button>
                              <button className="settings-btn" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => openTextColorPrompt(catIdx, i, prod.textColor)}>Yazı Rengi</button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', cursor: 'grab', fontSize: 18, color: '#666' }}>
                            ☰
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: 20 }}>
                <button className="settings-btn success" style={{ padding: '10px 20px', fontSize: 14 }} onClick={openAddCategoryPrompt}>+ YENİ KATEGORİ EKLE</button>
                <button className="settings-btn" style={{ padding: '10px 20px', fontSize: 14, borderStyle: 'dashed' }} onClick={openGlobalTextColorPrompt}>Tüm Ürünlerin Yazı Rengini Değiştir</button>
              </div>

              <div className="settings-card" style={{ marginTop: 20 }}>
                <div className="settings-card-title">Veri Taşıma (Export / Import)</div>
                <p style={{ fontSize: 12, color: 'gray', marginBottom: 15 }}>Mevcut dükkanınızın menüsünü ve fiyatlarını bilgisayarınıza yedekleyebilir veya yeni açtığınız boş bir dükkana yükleyebilirsiniz.</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="settings-btn" onClick={async () => {
                    const token = (useStore.getState() as any).globalSettings?.API_TOKEN;
                    const data = await (window.api as any).exportMenu(token);
                    if (data) {
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'menu_yedek.json';
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}>Menüyü İndir (Yedekle)</button>
                  <label className="settings-btn primary" style={{ cursor: 'pointer' }}>
                    Yedek Dosyası Seç (Yükle)
                    <input type="file" accept=".json,.js" style={{ display: 'none' }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        try {
                          const text = event.target?.result as string;
                          let data;
                          try {
                            data = JSON.parse(text);
                          } catch (err) {
                            if (file.name.endsWith('.js')) {
                              const cleanText = text.replace(/export const/g, 'const').replace(/export let/g, 'let');
                              const fn = new Function(cleanText + '; return typeof default_menu !== "undefined" ? default_menu : (typeof customMenu !== "undefined" ? customMenu : null);');
                              data = fn();
                            } else {
                              throw err;
                            }
                          }

                          if (data && data.categories) {
                            data = { customMenu: data };
                          }

                          const token = (useStore.getState() as any).globalSettings?.API_TOKEN;
                          const res = await (window.api as any).importMenu(token, data);
                          if (res?.success) alert('Menü başarıyla yüklendi! Lütfen programı yeniden başlatın.');
                        } catch (e) {
                          alert('Geçersiz dosya formatı!');
                        }
                      };
                      reader.readAsText(file);
                    }} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'past_orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>Geçmiş Siparişler <span style={{ fontSize: 14, color: '#888', fontWeight: 'normal' }}>(Son 500)</span></h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      placeholder="Sipariş Ara..." 
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '10px 16px 10px 40px', color: '#fff', fontSize: '14px', width: '250px', outline: 'none' }}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase();
                        const rows = document.querySelectorAll('.past-order-row');
                        rows.forEach((row: any) => {
                          const text = row.innerText.toLowerCase();
                          row.style.display = text.includes(val) ? 'flex' : 'none';
                        });
                      }}
                    />
                    <svg style={{ position: 'absolute', left: '14px', top: '10px', color: '#888' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  {pastOrders.length > 0 && (
                    <button className="settings-btn danger" style={{ borderRadius: '20px', padding: '0 20px' }} onClick={handleClearPastOrders}>Tümünü Temizle</button>
                  )}
                </div>
              </div>
              <div className="table-responsive" style={{ overflowX: 'auto', paddingBottom: '10px' }}>
                <div style={{ minWidth: '950px' }}>
                  {/* Table Header */}
                  <div style={{ display: 'flex', padding: '0 20px', color: '#888', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <div style={{ width: '110px' }}>Sipariş ID</div>
                    <div style={{ width: '150px' }}>ID</div>
                    <div style={{ flex: 1 }}>Sipariş Detayı</div>
                    <div style={{ width: '120px' }}>Müşteri / Masa</div>
                    <div style={{ width: '100px' }}>Tutar</div>
                    <div style={{ width: '120px' }}>Tarih</div>
                    <div style={{ width: '100px', textAlign: 'center' }}>Durum</div>
                    <div style={{ width: '60px', textAlign: 'right' }}>İşlem</div>
                  </div>

                  {/* Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    {pastOrders.length === 0 && <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>Kayıt bulunamadı.</div>}
                    {pastOrders.map((o, i) => {
                      const dt = o.completedAt ? new Date(o.completedAt) : new Date();
                      const timeStr = dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                      const dateStr = dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                      const garson = o.createdBy || 'Kasa';
                      const isCancel = o.status === 'İptal';
                      const orderId = `#ORD-${String(pastOrders.length - i).padStart(4, '0')}`;

                      return (
                        <div key={i} className="past-order-row" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', transition: 'background 0.2s', fontSize: '14px' }}>
                          <div style={{ width: '110px', color: '#888', fontWeight: '500' }}>{orderId}</div>
                          
                          <div style={{ width: '150px', display: 'flex', alignItems: 'center' }}>
                            <span style={{ color: o.color || '#fff', fontWeight: 'bold' }}>{garson}</span>
                          </div>
                          
                          <div style={{ flex: 1, paddingRight: '20px' }}>
                            {o.items && o.items.length > 0 ? (
                              <div style={{ color: '#ccc', lineHeight: '1.4' }}>
                                {o.items.map((it:any) => `${it.quantity || 1}x ${it.name}${it.portion && it.portion !== 'Standart' ? ` (${it.portion})` : ''}`).join(', ')}
                              </div>
                            ) : (
                              <div style={{ color: '#666' }}>Detay yok</div>
                            )}
                            {o.order_note && (
                              <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>Not: {o.order_note}</div>
                            )}
                          </div>
                          
                          <div style={{ width: '120px', color: '#fff', fontWeight: '600' }}>{o.customer_name}</div>
                          
                          <div style={{ width: '100px', color: isCancel ? '#ef4444' : '#4ade80', fontWeight: 'bold', fontSize: '15px' }}>{o.total_amount} ₺</div>
                          
                          <div style={{ width: '120px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                              {dateStr}
                            </div>
                            <span style={{ fontSize: '12px', marginLeft: '16px' }}>{timeStr}</span>
                          </div>
                          
                          <div style={{ width: '100px', display: 'flex', justifyContent: 'center' }}>
                            <div style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: isCancel ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: isCancel ? '#ef4444' : '#4ade80' }}>
                              {isCancel ? 'İptal' : (o.status || 'Tamamlandı')}
                            </div>
                          </div>
                          
                          <div style={{ width: '60px', textAlign: 'right' }}>
                            <button className="settings-btn danger" style={{ padding: '6px', minWidth: 'auto', width: '32px', height: '32px', borderRadius: '8px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => handleDeletePastOrder(i)} title="Sil">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}



          {activeTab === 'printer' && (
            <div>
              <div className="settings-section-title">Yazıcı Ayarları</div>
              <div className="settings-card">
                <div className="settings-card-title">Mevcut Yazıcı: <span style={{ color: '#FF9800' }}>{settings.YAZICI_ADI || 'Seçilmedi'}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 15 }}>
                  {printers.map((p, i) => (
                    <button key={i} className="settings-btn" style={{ textAlign: 'left', padding: 15 }} onClick={() => selectPrinter(p.name)}>
                      🖨️ {p.name} {p.isDefault ? '(Varsayılan)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'spotify' && (
            <div>
              <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>API Keys (Spotify)</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="settings-btn" style={{ padding: '8px 15px', fontSize: 13, backgroundColor: '#2a2a2a' }} onClick={async () => {
                    const result = await window.api.importApiKeys()
                    if (result.success) {
                      setSettings(result.settings)
                      customAlert("Anahtarlar başarıyla içe aktarıldı!", "success")
                    } else if (result.error) {
                      customAlert("Hata: " + result.error, "error")
                    }
                  }}>İçe Aktar (.jsonl)</button>
                  <button className="settings-btn" style={{ padding: '8px 15px', fontSize: 13, backgroundColor: '#2a2a2a' }} onClick={async () => {
                    const result = await window.api.exportApiKeys(settings)
                    if (result.success) {
                      customAlert("Anahtarlar dışa aktarıldı!", "success")
                    } else if (result.error) {
                      customAlert("Hata: " + result.error, "error")
                    }
                  }}>Dışa Aktar</button>
                </div>
              </div>
              
              <div className="settings-card">
                <div className="settings-card-title">API Keys</div>
                <label style={{ display: 'block', fontSize: 12, color: 'gray', marginBottom: 5 }}>Client ID</label>
                <input className="settings-input" value={settings.SPOTIFY_CLIENT_ID || ''} onChange={e => handleSettingChange('SPOTIFY_CLIENT_ID', e.target.value)} />
                
                <label style={{ display: 'block', fontSize: 12, color: 'gray', marginBottom: 5 }}>Client Secret</label>
                <input className="settings-input" value={settings.SPOTIFY_CLIENT_SECRET || ''} onChange={e => handleSettingChange('SPOTIFY_CLIENT_SECRET', e.target.value)} />
                
                <div className="settings-row" style={{ marginTop: 20 }}>
                  <button className="settings-btn primary" onClick={handleSaveSettings}>Değişiklikleri Kaydet</button>
                  <button className="settings-btn success" onClick={triggerSpotifyLogin}>Spotify'ı Yetkilendir (Login)</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'updates' && (
            <div>
              <div className="settings-section-title">Uygulama Güncellemeleri</div>
              <div className="settings-card" style={{ textAlign: 'center', padding: 40, display: 'flex', flexDirection: 'column', gap: 30 }}>
                {/* 1. Kasa Uygulaması (EXE) Güncelleme */}
                <div>
                  <h3 style={{ borderBottom: '1px solid #333', paddingBottom: 10, marginBottom: 20 }}>Kasa (Windows) Güncellemesi</h3>
                  {updaterState.status === 'idle' && <h2 style={{ color: '#aaa', fontSize: 20 }}>Güncelleme durumu kontrol edilebilir.</h2>}
                  {updaterState.status === 'checking' && <h2 style={{ color: '#4CAF50', fontSize: 24 }}>Kontrol ediliyor...</h2>}
                  {updaterState.status === 'not-available' && <h2 style={{ color: '#aaa', fontSize: 24 }}>Kasa Uygulaması Güncel.</h2>}
                  {updaterState.status === 'error' && <h2 style={{ color: '#F44336', fontSize: 20 }}>Hata: {updaterState.error}</h2>}
                  
                  {updaterState.status === 'available' && (
                    <div>
                      <h2 style={{ color: '#FF9800', fontSize: 24, marginBottom: 15 }}>Yeni Bir Güncelleme Bulundu!</h2>
                      <p style={{ color: '#ddd', marginBottom: 20 }}>Versiyon: {updaterState.info?.version}</p>
                      <button className="settings-btn primary" onClick={downloadUpdate} style={{ fontSize: 16, padding: '10px 25px' }}>Şimdi İndir (Kasa)</button>
                    </div>
                  )}
                  
                  {updaterState.status === 'downloading' && (
                    <div>
                      <h2 style={{ color: '#2196F3', fontSize: 24, marginBottom: 15 }}>İndiriliyor...</h2>
                      <div style={{ width: '100%', background: '#333', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ width: `${updaterState.progress?.percent || 0}%`, background: '#4CAF50', height: '100%' }}></div>
                      </div>
                      <p style={{ color: '#aaa' }}>{Math.round(updaterState.progress?.percent || 0)}% - {(updaterState.progress?.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s</p>
                    </div>
                  )}
                  
                  {updaterState.status === 'downloaded' && (
                    <div>
                      <h2 style={{ color: '#4CAF50', fontSize: 24, marginBottom: 15 }}>Güncelleme İndirildi!</h2>
                      <p style={{ color: '#ddd', marginBottom: 20 }}>Yüklemek için uygulamanın yeniden başlatılması gerekiyor.</p>
                      <button className="settings-btn success" onClick={installUpdate} style={{ fontSize: 16, padding: '10px 25px' }}>Kasa'yı Yeniden Başlat ve Kur</button>
                    </div>
                  )}
                  
                  {(updaterState.status === 'idle' || updaterState.status === 'not-available' || updaterState.status === 'error') && (
                    <button className="settings-btn" onClick={checkUpdates} style={{ marginTop: 30 }}>Tüm Güncellemeleri Kontrol Et</button>
                  )}
                </div>

                {/* 2. Garson Telefonu (APK) Güncelleme */}
                {latestRelease && (
                  <div>
                    <h3 style={{ borderBottom: '1px solid #333', paddingBottom: 10, marginBottom: 20 }}>Garson Telefonları (Android) Güncellemesi</h3>
                    <h2 style={{ color: '#4CAF50', fontSize: 20, marginBottom: 20 }}>
                      En Son Bulunan APK Versiyonu: {latestRelease.name || latestRelease.tag_name}
                    </h2>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15, alignItems: 'center' }}>
                      {latestRelease.assets?.filter((a: any) => a.name.endsWith('.apk')).map((asset: any) => (
                        <div key={asset.id} className="settings-row" style={{ justifyContent: 'center' }}>
                          <button className="settings-btn" onClick={() => window.open(asset.browser_download_url, '_blank')}>
                            APK İndir (Manuel)
                          </button>
                          <button className="settings-btn primary" onClick={() => sendUpdateToPhones(asset.browser_download_url)}>
                            Garsonlara Otomatik Kurdur (Tüm Telefonlara Gönder)
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
