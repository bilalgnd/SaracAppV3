import { customAlert, customConfirm } from '../utils/alert'
import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import ReportsTab from './ReportsTab'
import { Smartphone, FolderUp, Sliders, BarChart3, UtensilsCrossed, History, Printer, Layers, RefreshCw } from 'lucide-react'

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
  const [trendyolStatus, setTrendyolStatus] = useState<any>(null)
  const [isTestingTrendyol, setIsTestingTrendyol] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isUpdatingStoreStatus, setIsUpdatingStoreStatus] = useState(false)
  const [storeStatusResult, setStoreStatusResult] = useState<{ success: boolean; message: string } | null>(null)
  // tvLink unused

  // Product Customization States
  const [customizationMode, setCustomizationMode] = useState<'global' | 'product'>('global')
  const [selectedCustomProduct, setSelectedCustomProduct] = useState<string>('')

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

  useEffect(() => {
    let interval: any
    if (isOpen && activeTab === 'general') {
      interval = setInterval(fetchNetworkStatus, 3000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isOpen, activeTab])

  const fetchTrendyolStatus = async () => {
    try {
      if (window.api && window.api.getTrendyolStatus) {
        const res = await window.api.getTrendyolStatus()
        setTrendyolStatus(res)
      }
    } catch (e) {
      console.error('getTrendyolStatus error', e)
    }
  }

  const handleTestTrendyol = async () => {
    setIsTestingTrendyol(true)
    setTestResult(null)
    try {
      if (window.api && window.api.saveSettings) {
        window.api.saveSettings(settings)
      }
      if (window.api && window.api.testTrendyolConnection) {
        const res = await window.api.testTrendyolConnection()
        setTestResult(res)
        fetchTrendyolStatus()
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Test sırasında hata oluştu' })
    } finally {
      setIsTestingTrendyol(false)
    }
  }

  const handlePollTrendyolNow = async () => {
    try {
      if (window.api && window.api.triggerTrendyolPoll) {
        const res = await window.api.triggerTrendyolPoll()
        setTrendyolStatus(res)
        customAlert("Trendyol siparişleri kontrol edildi!", "success")
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdateTrendyolStoreStatus = async (newStatus: 'OPEN' | 'CLOSED') => {
    setIsUpdatingStoreStatus(true)
    setStoreStatusResult(null)
    try {
      if (window.api && window.api.saveSettings) {
        window.api.saveSettings(settings)
      }
      if (window.api && window.api.updateTrendyolStoreStatus) {
        const res = await window.api.updateTrendyolStoreStatus(newStatus)
        setStoreStatusResult(res)
        fetchTrendyolStatus()
      }
    } catch (e: any) {
      setStoreStatusResult({ success: false, message: e.message || 'Restoran çalışma durumu güncellenemedi' })
    } finally {
      setIsUpdatingStoreStatus(false)
    }
  }

  const handleFetchTrendyolStoreStatus = async () => {
    try {
      if (window.api && window.api.getTrendyolStoreStatus) {
        const res = await window.api.getTrendyolStoreStatus()
        if (res.success && res.status) {
          setTrendyolStatus((prev: any) => ({ ...prev, storeStatus: res.status, storeId: res.storeId, storeName: res.storeName }))
          if (res.storeId) {
            setSettings((prev: any) => ({ ...prev, TRENDYOL_STORE_ID: String(res.storeId) }))
          }
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    let interval: any
    if (isOpen && ['integrations', 'trendyol'].includes(activeTab)) {
      fetchTrendyolStatus()
      interval = setInterval(fetchTrendyolStatus, 4000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isOpen, activeTab])

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

  const handleSettingChange = (key: string, value: any) => {
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
          <button className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`} onClick={() => { setActiveTab('general'); fetchNetworkStatus(); }}>
            <Sliders size={18} />
            <span>Genel</span>
          </button>
          <button className={`settings-tab ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => { setActiveTab('reports'); fetchPastOrders(); }}>
            <BarChart3 size={18} />
            <span>Raporlar</span>
          </button>
          <button className={`settings-tab ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}>
            <UtensilsCrossed size={18} />
            <span>Menü Yönetimi</span>
          </button>
          <button className={`settings-tab ${activeTab === 'past_orders' ? 'active' : ''}`} onClick={() => { setActiveTab('past_orders'); fetchPastOrders(); }}>
            <History size={18} />
            <span>Geçmiş Siparişler</span>
          </button>
          <button className={`settings-tab ${activeTab === 'printer' ? 'active' : ''}`} onClick={() => { setActiveTab('printer'); loadPrinters(); }}>
            <Printer size={18} />
            <span>Yazıcı</span>
          </button>
          <button className={`settings-tab ${['integrations', 'spotify', 'trendyol'].includes(activeTab) ? 'active' : ''}`} onClick={() => setActiveTab('integrations')}>
            <Layers size={18} />
            <span>Integrations</span>
          </button>
          <button className={`settings-tab ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => { setActiveTab('updates'); checkUpdates(); }}>
            <RefreshCw size={18} />
            <span>Güncellemeler</span>
          </button>
        </div>

        <div className="settings-content" ref={scrollRef}>
          {activeTab === 'general' && (
            <div>
              <div className="settings-section-title">Genel Ayarlar</div>

              <div className="settings-card" style={{ marginBottom: 20 }}>
                <div className="settings-card-title">Cihaz & Dosya Bağlantıları</div>
                <p style={{ fontSize: 12, color: 'gray', marginBottom: 15 }}>Garson uygulamalarının (App2) kasaya bağlanması için QR kod ve 6 haneli eşleşme kodunu görüntüleyin veya bağlı cihazlarla dosya paylaşın.</p>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="settings-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      height: '42px',
                      backgroundColor: 'rgba(16, 185, 129, 0.18)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      padding: '0 20px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxSizing: 'border-box'
                    }}
                    onClick={() => window.dispatchEvent(new CustomEvent('open-pair-modal'))}
                  >
                    <Smartphone size={18} />
                    <span>Garson Eşleşme (QR Kod)</span>
                  </button>
                  <button
                    className="settings-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      height: '42px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#eee',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '0 20px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxSizing: 'border-box'
                    }}
                    onClick={() => window.dispatchEvent(new CustomEvent('open-fileshare-modal'))}
                  >
                    <FolderUp size={18} />
                    <span>Dosya Paylaşım</span>
                  </button>
                </div>
              </div>

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
                        window.api.logSystemEvent(`Ayarlar: TV Ekran Koruyucu -> ${opt.label}`, 'info');
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
                <div className="settings-card-title">Bağlı Cihazlar</div>
                {networkStatus?.connectedDevices?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Group by device type */}
                    {['Masaüstü (Kasa)', 'Garson Uygulaması', 'TV Ekranı', 'Bilinmeyen Cihaz', 'Harici Bağlantı', 'Cihaz'].map((typeLabel) => {
                      const group = networkStatus.connectedDevices.filter((d: any) => {
                        const isObj = typeof d === 'object' && d !== null;
                        const devType = isObj ? d.type : 'Cihaz';
                        return devType === typeLabel;
                      });
                      
                      if (group.length === 0) return null;
                      
                      return (
                        <div key={typeLabel}>
                          <div style={{ fontSize: '13px', color: '#4caf50', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                            {typeLabel}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {group.map((device: any, i: number) => {
                              const isObj = typeof device === 'object' && device !== null;
                              const devId = isObj ? device.id : device;
                              const devIp = isObj ? device.ip : 'Bilinmeyen IP';
                              const timeStr = isObj && device.connectedAt ? new Date(device.connectedAt).toLocaleTimeString('tr-TR') : '';
                              
                              return (
                                <div key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{devId}</div>
                                    <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>IP: {devIp}</div>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#888', textAlign: 'right' }}>
                                    <div style={{ color: '#4caf50', marginBottom: '4px', fontWeight: 'bold' }}>● Aktif</div>
                                    {timeStr}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#F44336', fontSize: '14px' }}>Şu an hiçbir cihaz bağlı değil.</p>
                )}
                <button className="settings-btn" style={{ marginTop: 15 }} onClick={() => {
                  window.api.logSystemEvent('Ayarlar: Bağlı Cihazlar listesi yenilendi', 'info');
                  fetchNetworkStatus();
                }}>Yenile</button>
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
                              <button
                                className="settings-btn"
                                style={{
                                  padding: '5px 10px',
                                  fontSize: 11,
                                  background: menuData?.productCustomizations?.[prod.name] ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                  borderColor: menuData?.productCustomizations?.[prod.name] ? '#3b82f6' : '#444',
                                  color: menuData?.productCustomizations?.[prod.name] ? '#60a5fa' : '#ddd',
                                  fontWeight: menuData?.productCustomizations?.[prod.name] ? 600 : 400
                                }}
                                onClick={() => {
                                  setCustomizationMode('product')
                                  setSelectedCustomProduct(prod.name)
                                  setTimeout(() => {
                                    const el = document.getElementById('customization-section')
                                    if (el) {
                                      el.scrollIntoView({ behavior: 'smooth' })
                                    }
                                  }, 50)
                                }}
                              >
                                {menuData?.productCustomizations?.[prod.name] ? '★ İçerik' : 'İçerik'}
                              </button>
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

              {/* İçerik ve Adisyon Özelleştirme Yönetimi */}
              <div id="customization-section" className="settings-card" style={{ marginTop: 25, border: '1px solid #3b82f644', background: 'rgba(59, 130, 246, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10 }}>
                  <div className="settings-card-title" style={{ margin: 0, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🍔 İçerik ve Adisyon Özelleştirme Yönetimi</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Sipariş alınırken çıkan butonları genel veya ürüne özel olarak yönetebilirsiniz</span>
                </div>

                {/* Mod Seçimi (Genel vs Ürüne Özel) */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
                  <button
                    onClick={() => setCustomizationMode('global')}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: customizationMode === 'global' ? '#3b82f6' : 'transparent',
                      color: customizationMode === 'global' ? '#fff' : '#94a3b8',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    🌐 Genel İçerikler (Varsayılan)
                  </button>
                  <button
                    onClick={() => {
                      setCustomizationMode('product')
                      if (!selectedCustomProduct) {
                        const first = menuData?.categories?.[0]?.items?.[0]?.name
                        if (first) setSelectedCustomProduct(first)
                      }
                    }}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 8,
                      border: 'none',
                      background: customizationMode === 'product' ? '#3b82f6' : 'transparent',
                      color: customizationMode === 'product' ? '#fff' : '#94a3b8',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    🎯 Ürüne Özel İçerik Tanımla
                  </button>
                </div>

                {/* 1. GENEL İÇERİKLER */}
                {customizationMode === 'global' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {/* 1.1 Temel Malzemeler (Soğanlı/Soğansız vb.) */}
                    <div style={{ background: '#1e1e24', padding: 14, borderRadius: 12, border: '1px solid #2e2e38' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f43f5e', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Malzemeler (Çıkar/Ekle)</span>
                        <span style={{ fontSize: 10, color: '#888' }}>-suz / -lu</span>
                      </div>
                      <p style={{ fontSize: 11, color: '#888', margin: '0 0 10px 0' }}>Sipariş ekranında Soğansız/Soğanlı gibi çift yönlü buton üretir.</p>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 40 }}>
                        {(menuData?.ingredients || ['Soğan', 'Domates', 'Patates', 'Ketçap', 'Mayonez', 'Turşu']).map((ing: string, idx: number) => (
                          <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#272732', padding: '4px 10px', borderRadius: 20, border: '1px solid #3f3f50', fontSize: 12 }}>
                            <span>{ing}</span>
                            <button
                              onClick={() => {
                                const current = menuData?.ingredients || ['Soğan', 'Domates', 'Patates', 'Ketçap', 'Mayonez', 'Turşu'];
                                const next = current.filter((_: any, i: number) => i !== idx);
                                const newM = { ...menuData, ingredients: next };
                                setMenuData(newM);
                                useStore.getState().setMenu(newM);
                                window.api?.saveMenu?.(newM);
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                            >✕</button>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          id="new-ingredient-input"
                          placeholder="Örn: Biber, Yeşillik"
                          className="settings-input"
                          style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (!val) return;
                              const current = menuData?.ingredients || ['Soğan', 'Domates', 'Patates', 'Ketçap', 'Mayonez', 'Turşu'];
                              if (current.includes(val)) return;
                              const next = [...current, val];
                              const newM = { ...menuData, ingredients: next };
                              setMenuData(newM);
                              useStore.getState().setMenu(newM);
                              window.api?.saveMenu?.(newM);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                        <button
                          className="settings-btn primary"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => {
                            const inp = document.getElementById('new-ingredient-input') as HTMLInputElement;
                            const val = inp?.value.trim();
                            if (!val) return;
                            const current = menuData?.ingredients || ['Soğan', 'Domates', 'Patates', 'Ketçap', 'Mayonez', 'Turşu'];
                            if (current.includes(val)) return;
                            const next = [...current, val];
                            const newM = { ...menuData, ingredients: next };
                            setMenuData(newM);
                            useStore.getState().setMenu(newM);
                            window.api?.saveMenu?.(newM);
                            inp.value = '';
                          }}
                        >+ Ekle</button>
                      </div>
                    </div>

                    {/* 1.2 Ücretsiz Seçenekler & Pişirme Özellikleri */}
                    <div style={{ background: '#1e1e24', padding: 14, borderRadius: 12, border: '1px solid #2e2e38' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#06b6d4', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Ücretsiz Ekstralar / Tercihler</span>
                        <span style={{ fontSize: 10, color: '#888' }}>Ücretsiz</span>
                      </div>
                      <p style={{ fontSize: 11, color: '#888', margin: '0 0 10px 0' }}>Sade Et, Soslu, Gemi, Kayık, Acılı, Karışık vb. tercihler.</p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 40 }}>
                        {(menuData?.freeExtras || ['Sade Et', 'Soslu', 'Gemi', 'Kayık', 'Acılı', 'Karışık']).map((ext: string, idx: number) => (
                          <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#272732', padding: '4px 10px', borderRadius: 20, border: '1px solid #3f3f50', fontSize: 12 }}>
                            <span>{ext}</span>
                            <button
                              onClick={() => {
                                const current = menuData?.freeExtras || ['Sade Et', 'Soslu', 'Gemi', 'Kayık', 'Acılı', 'Karışık'];
                                const next = current.filter((_: any, i: number) => i !== idx);
                                const newM = { ...menuData, freeExtras: next };
                                setMenuData(newM);
                                useStore.getState().setMenu(newM);
                                window.api?.saveMenu?.(newM);
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                            >✕</button>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          id="new-free-extra-input"
                          placeholder="Örn: Az Pişmiş, Duble Sos"
                          className="settings-input"
                          style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (!val) return;
                              const current = menuData?.freeExtras || ['Sade Et', 'Soslu', 'Gemi', 'Kayık', 'Acılı', 'Karışık'];
                              if (current.includes(val)) return;
                              const next = [...current, val];
                              const newM = { ...menuData, freeExtras: next };
                              setMenuData(newM);
                              useStore.getState().setMenu(newM);
                              window.api?.saveMenu?.(newM);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                        <button
                          className="settings-btn primary"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => {
                            const inp = document.getElementById('new-free-extra-input') as HTMLInputElement;
                            const val = inp?.value.trim();
                            if (!val) return;
                            const current = menuData?.freeExtras || ['Sade Et', 'Soslu', 'Gemi', 'Kayık', 'Acılı', 'Karışık'];
                            if (current.includes(val)) return;
                            const next = [...current, val];
                            const newM = { ...menuData, freeExtras: next };
                            setMenuData(newM);
                            useStore.getState().setMenu(newM);
                            window.api?.saveMenu?.(newM);
                            inp.value = '';
                          }}
                        >+ Ekle</button>
                      </div>
                    </div>

                    {/* 1.3 Ücretli Ekstralar & Fiyatları */}
                    <div style={{ background: '#1e1e24', padding: 14, borderRadius: 12, border: '1px solid #2e2e38' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#eab308', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Ücretli Ekstralar</span>
                        <span style={{ fontSize: 10, color: '#888' }}>+Fiyat</span>
                      </div>
                      <p style={{ fontSize: 11, color: '#888', margin: '0 0 10px 0' }}>Seçildiğinde adisyon tutarına eklenen ücretli malzemeler.</p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, minHeight: 40 }}>
                        {Object.entries(menuData?.paidExtras || menuData?.extras || { 'Cheddar': 70, 'Kaşarlı': 70 }).map(([name, price]: [string, any], idx: number) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#272732', padding: '6px 10px', borderRadius: 8, border: '1px solid #3f3f50' }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="number"
                                defaultValue={price}
                                style={{ width: 60, padding: '2px 6px', fontSize: 12, background: '#18181b', border: '1px solid #444', color: '#eab308', borderRadius: 4, textAlign: 'right' }}
                                onBlur={(e) => {
                                  const newP = Number(e.target.value) || 0;
                                  const current = { ...(menuData?.paidExtras || menuData?.extras || { 'Cheddar': 70, 'Kaşarlı': 70 }) };
                                  current[name] = newP;
                                  const newM = { ...menuData, paidExtras: current, extras: current };
                                  setMenuData(newM);
                                  useStore.getState().setMenu(newM);
                                  window.api?.saveMenu?.(newM);
                                }}
                              />
                              <span style={{ fontSize: 11, color: '#888' }}>₺</span>
                              <button
                                onClick={() => {
                                  const current = { ...(menuData?.paidExtras || menuData?.extras || { 'Cheddar': 70, 'Kaşarlı': 70 }) };
                                  delete current[name];
                                  const newM = { ...menuData, paidExtras: current, extras: current };
                                  setMenuData(newM);
                                  useStore.getState().setMenu(newM);
                                  window.api?.saveMenu?.(newM);
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: 14, marginLeft: 4 }}
                              >✕</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          id="new-paid-extra-name"
                          placeholder="İsim (Örn: Çift Kaşar)"
                          className="settings-input"
                          style={{ flex: 1.4, padding: '6px 10px', fontSize: 12 }}
                        />
                        <input
                          type="number"
                          id="new-paid-extra-price"
                          placeholder="₺"
                          className="settings-input"
                          style={{ width: 60, padding: '6px 8px', fontSize: 12, textAlign: 'center' }}
                        />
                        <button
                          className="settings-btn primary"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => {
                            const nameInp = document.getElementById('new-paid-extra-name') as HTMLInputElement;
                            const priceInp = document.getElementById('new-paid-extra-price') as HTMLInputElement;
                            const name = nameInp?.value.trim();
                            const price = Number(priceInp?.value) || 0;
                            if (!name) return;
                            const current = { ...(menuData?.paidExtras || menuData?.extras || { 'Cheddar': 70, 'Kaşarlı': 70 }) };
                            current[name] = price;
                            const newM = { ...menuData, paidExtras: current, extras: current };
                            setMenuData(newM);
                            useStore.getState().setMenu(newM);
                            window.api?.saveMenu?.(newM);
                            nameInp.value = '';
                            priceInp.value = '';
                          }}
                        >+ Ekle</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ÜRÜNE ÖZEL İÇERİKLER */}
                {customizationMode === 'product' && (() => {
                  const allProducts: { name: string; categoryName: string }[] = []
                  menuData?.categories?.forEach((cat: any) => {
                    cat.items?.forEach((item: any) => {
                      allProducts.push({ name: item.name, categoryName: cat.name })
                    })
                  })
                  const currentProdName = selectedCustomProduct || (allProducts[0]?.name || '')
                  const hasCustom = !!menuData?.productCustomizations?.[currentProdName]
                  const prodCustom = menuData?.productCustomizations?.[currentProdName] || {
                    ingredients: menuData?.ingredients || ['Soğan', 'Domates', 'Patates', 'Ketçap', 'Mayonez', 'Turşu'],
                    freeExtras: menuData?.freeExtras || ['Sade Et', 'Soslu', 'Gemi', 'Kayık', 'Acılı', 'Karışık'],
                    paidExtras: menuData?.paidExtras || menuData?.extras || { 'Cheddar': 70, 'Kaşarlı': 70 }
                  }

                  const customizedProductNames = Object.keys(menuData?.productCustomizations || {})

                  const saveProdChanges = (updated: any) => {
                    const newCustomMap = { ...(menuData?.productCustomizations || {}) }
                    if (updated === null) {
                      delete newCustomMap[currentProdName]
                    } else {
                      newCustomMap[currentProdName] = updated
                    }
                    const newM = { ...menuData, productCustomizations: newCustomMap }
                    setMenuData(newM)
                    useStore.getState().setMenu(newM)
                    window.api?.saveMenu?.(newM)
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Ürün Seçim Çubuğu */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', borderRadius: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 'bold', color: '#fff' }}>Ürün Seçin:</span>
                          <select
                            value={currentProdName}
                            onChange={(e) => setSelectedCustomProduct(e.target.value)}
                            style={{
                              background: '#18181b',
                              color: '#fff',
                              border: '1px solid #3f3f46',
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 13,
                              fontWeight: 600,
                              outline: 'none',
                              cursor: 'pointer',
                              minWidth: 220
                            }}
                          >
                            {menuData?.categories?.map((cat: any, cIdx: number) => (
                              <optgroup key={cIdx} label={cat.name} style={{ background: '#27272a', color: '#a1a1aa' }}>
                                {cat.items?.map((it: any, iIdx: number) => {
                                  const isCustom = !!menuData?.productCustomizations?.[it.name]
                                  return (
                                    <option key={iIdx} value={it.name} style={{ background: '#18181b', color: isCustom ? '#4ade80' : '#fff' }}>
                                      {isCustom ? '★ ' : ''}{it.name} {isCustom ? '(Özel İçerikli)' : ''}
                                    </option>
                                  )
                                })}
                              </optgroup>
                            ))}
                          </select>

                          {hasCustom && (
                            <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#4ade80', fontSize: 11, fontWeight: 'bold', padding: '3px 8px', borderRadius: 6 }}>
                              ✓ Özelleştirildi
                            </span>
                          )}
                        </div>

                        {hasCustom && (
                          <button
                            onClick={() => saveProdChanges(null)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            🔄 Genel İçeriklere Sıfırla
                          </button>
                        )}
                      </div>

                      {/* Özel İçerikli Ürünler Hızlı Erişim */}
                      {customizedProductNames.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11, color: '#aaa' }}>
                          <span style={{ fontWeight: 'bold' }}>Özel İçerikli Ürünler:</span>
                          {customizedProductNames.map((name, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedCustomProduct(name)}
                              style={{
                                background: currentProdName === name ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.06)',
                                border: currentProdName === name ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.1)',
                                color: currentProdName === name ? '#4ade80' : '#ccc',
                                borderRadius: 12,
                                padding: '2px 8px',
                                fontSize: 11,
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              ★ {name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 3 Özel Kart */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                        {/* 2.1 Ürüne Özel Malzemeler */}
                        <div style={{ background: '#1e1e24', padding: 14, borderRadius: 12, border: hasCustom ? '1px solid #3b82f666' : '1px solid #2e2e38' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#f43f5e', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{currentProdName} Malzemeleri</span>
                            <span style={{ fontSize: 10, color: '#888' }}>-suz / -lu</span>
                          </div>
                          <p style={{ fontSize: 11, color: '#888', margin: '0 0 10px 0' }}>Sadece bu ürün seçildiğinde çıkan temel malzemeler.</p>
                          
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 40 }}>
                            {(prodCustom.ingredients || []).map((ing: string, idx: number) => (
                              <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#272732', padding: '4px 10px', borderRadius: 20, border: '1px solid #3f3f50', fontSize: 12 }}>
                                <span>{ing}</span>
                                <button
                                  onClick={() => {
                                    const next = (prodCustom.ingredients || []).filter((_: any, i: number) => i !== idx);
                                    saveProdChanges({ ...prodCustom, ingredients: next });
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                                >✕</button>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              id="new-prod-ingredient-input"
                              placeholder="Örn: Biber, Mantar"
                              className="settings-input"
                              style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  if (!val) return;
                                  const current = prodCustom.ingredients || [];
                                  if (current.includes(val)) return;
                                  saveProdChanges({ ...prodCustom, ingredients: [...current, val] });
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                            />
                            <button
                              className="settings-btn primary"
                              style={{ padding: '6px 12px', fontSize: 12 }}
                              onClick={() => {
                                const inp = document.getElementById('new-prod-ingredient-input') as HTMLInputElement;
                                const val = inp?.value.trim();
                                if (!val) return;
                                const current = prodCustom.ingredients || [];
                                if (current.includes(val)) return;
                                saveProdChanges({ ...prodCustom, ingredients: [...current, val] });
                                inp.value = '';
                              }}
                            >+ Ekle</button>
                          </div>
                        </div>

                        {/* 2.2 Ürüne Özel Ücretsiz Tercihler */}
                        <div style={{ background: '#1e1e24', padding: 14, borderRadius: 12, border: hasCustom ? '1px solid #3b82f666' : '1px solid #2e2e38' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#06b6d4', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{currentProdName} Tercihleri</span>
                            <span style={{ fontSize: 10, color: '#888' }}>Ücretsiz</span>
                          </div>
                          <p style={{ fontSize: 11, color: '#888', margin: '0 0 10px 0' }}>Sadece bu ürüne özel ücretsiz tercihler.</p>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 40 }}>
                            {(prodCustom.freeExtras || []).map((ext: string, idx: number) => (
                              <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#272732', padding: '4px 10px', borderRadius: 20, border: '1px solid #3f3f50', fontSize: 12 }}>
                                <span>{ext}</span>
                                <button
                                  onClick={() => {
                                    const next = (prodCustom.freeExtras || []).filter((_: any, i: number) => i !== idx);
                                    saveProdChanges({ ...prodCustom, freeExtras: next });
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                                >✕</button>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              id="new-prod-free-extra-input"
                              placeholder="Örn: Az Pişmiş, Duble Lavaş"
                              className="settings-input"
                              style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  if (!val) return;
                                  const current = prodCustom.freeExtras || [];
                                  if (current.includes(val)) return;
                                  saveProdChanges({ ...prodCustom, freeExtras: [...current, val] });
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                            />
                            <button
                              className="settings-btn primary"
                              style={{ padding: '6px 12px', fontSize: 12 }}
                              onClick={() => {
                                const inp = document.getElementById('new-prod-free-extra-input') as HTMLInputElement;
                                const val = inp?.value.trim();
                                if (!val) return;
                                const current = prodCustom.freeExtras || [];
                                if (current.includes(val)) return;
                                saveProdChanges({ ...prodCustom, freeExtras: [...current, val] });
                                inp.value = '';
                              }}
                            >+ Ekle</button>
                          </div>
                        </div>

                        {/* 2.3 Ürüne Özel Ücretli Ekstralar */}
                        <div style={{ background: '#1e1e24', padding: 14, borderRadius: 12, border: hasCustom ? '1px solid #3b82f666' : '1px solid #2e2e38' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#eab308', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{currentProdName} Ücretli Ekstralar</span>
                            <span style={{ fontSize: 10, color: '#888' }}>+Fiyat</span>
                          </div>
                          <p style={{ fontSize: 11, color: '#888', margin: '0 0 10px 0' }}>Sadece bu ürüne özel ücretli ekstralar ve fiyatları.</p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, minHeight: 40 }}>
                            {Object.entries(prodCustom.paidExtras || {}).map(([name, price]: [string, any], idx: number) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#272732', padding: '6px 10px', borderRadius: 8, border: '1px solid #3f3f50' }}>
                                <span style={{ fontSize: 12, fontWeight: 600 }}>{name}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <input
                                    type="number"
                                    defaultValue={price}
                                    style={{ width: 60, padding: '2px 6px', fontSize: 12, background: '#18181b', border: '1px solid #444', color: '#eab308', borderRadius: 4, textAlign: 'right' }}
                                    onBlur={(e) => {
                                      const newP = Number(e.target.value) || 0;
                                      const current = { ...(prodCustom.paidExtras || {}) };
                                      current[name] = newP;
                                      saveProdChanges({ ...prodCustom, paidExtras: current });
                                    }}
                                  />
                                  <span style={{ fontSize: 11, color: '#888' }}>₺</span>
                                  <button
                                    onClick={() => {
                                      const current = { ...(prodCustom.paidExtras || {}) };
                                      delete current[name];
                                      saveProdChanges({ ...prodCustom, paidExtras: current });
                                    }}
                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: 14, marginLeft: 4 }}
                                  >✕</button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              id="new-prod-paid-extra-name"
                              placeholder="İsim (Örn: Ekstra Kaşar)"
                              className="settings-input"
                              style={{ flex: 1.4, padding: '6px 10px', fontSize: 12 }}
                            />
                            <input
                              type="number"
                              id="new-prod-paid-extra-price"
                              placeholder="₺"
                              className="settings-input"
                              style={{ width: 60, padding: '6px 8px', fontSize: 12, textAlign: 'center' }}
                            />
                            <button
                              className="settings-btn primary"
                              style={{ padding: '6px 12px', fontSize: 12 }}
                              onClick={() => {
                                const nameInp = document.getElementById('new-prod-paid-extra-name') as HTMLInputElement;
                                const priceInp = document.getElementById('new-prod-paid-extra-price') as HTMLInputElement;
                                const name = nameInp?.value.trim();
                                const price = Number(priceInp?.value) || 0;
                                if (!name) return;
                                const current = { ...(prodCustom.paidExtras || {}) };
                                current[name] = price;
                                saveProdChanges({ ...prodCustom, paidExtras: current });
                                nameInp.value = '';
                                priceInp.value = '';
                              }}
                            >+ Ekle</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
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
                <div style={{ minWidth: '780px' }}>
                  {/* Table Header */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', color: '#888', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <div style={{ width: '85px' }}>Sipariş ID</div>
                    <div style={{ width: '100px' }}>Garson</div>
                    <div style={{ flex: 1, paddingRight: '12px' }}>Sipariş Detayı</div>
                    <div style={{ width: '85px' }}>Masa / İsim</div>
                    <div style={{ width: '75px' }}>Tutar</div>
                    <div style={{ width: '90px' }}>Tarih</div>
                    <div style={{ width: '80px', textAlign: 'center' }}>Durum</div>
                    <div style={{ width: '40px', textAlign: 'right' }}>İşlem</div>
                  </div>

                  {/* Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    {pastOrders.length === 0 && <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>Kayıt bulunamadı.</div>}
                    {pastOrders.map((o, i) => {
                      const dt = o.completedAt ? new Date(o.completedAt) : new Date();
                      const timeStr = dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                      const dateStr = dt.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                      const garson = o.createdBy || 'Kasa';
                      const isCancel = o.status === 'İptal';
                      const orderId = `#ORD-${String(pastOrders.length - i).padStart(4, '0')}`;

                      return (
                        <div key={i} className="past-order-row" style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', transition: 'background 0.2s', fontSize: '13px' }}>
                          <div style={{ width: '85px', color: '#888', fontWeight: '500', fontSize: '12px' }}>{orderId}</div>
                          
                          <div style={{ width: '100px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            {garson && garson !== 'Kasa' ? (
                              <span style={{
                                backgroundColor: o.color || '#10b981',
                                color: '#fff',
                                fontWeight: 'bold',
                                fontSize: '11px',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '95px'
                              }} title={garson}>
                                👤 {garson}
                              </span>
                            ) : (
                              <span style={{
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: '#aaa',
                                fontWeight: '500',
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}>
                                Kasa
                              </span>
                            )}
                          </div>
                          
                          <div style={{ flex: 1, paddingRight: '12px' }}>
                            {o.items && o.items.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', maxHeight: '72px', overflowY: 'auto' }} className="order-modal-body">
                                {(() => {
                                  const groupedMap = new Map<string, { name: string; portion?: string; notes?: string; quantity: number }>()
                                  for (const it of o.items) {
                                    const qty = it.quantity || 1
                                    const portion = (it.portion && it.portion !== 'Standart') ? it.portion : ''
                                    const notes = it.notes ? String(it.notes).trim() : ''
                                    const key = `${it.name}|${portion}|${notes}`
                                    if (groupedMap.has(key)) {
                                      groupedMap.get(key)!.quantity += qty
                                    } else {
                                      groupedMap.set(key, { name: it.name, portion, notes, quantity: qty })
                                    }
                                  }
                                  return Array.from(groupedMap.values()).map((it, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '6px',
                                        padding: '2px 6px',
                                        fontSize: '11px',
                                        lineHeight: 1.2
                                      }}
                                    >
                                      <span style={{
                                        color: it.quantity > 1 ? '#f59e0b' : '#9ca3af',
                                        fontWeight: '800',
                                        fontSize: '10px',
                                        backgroundColor: it.quantity > 1 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                        padding: '0 4px',
                                        borderRadius: '3px'
                                      }}>
                                        {it.quantity}x
                                      </span>
                                      <span style={{ color: '#eee', fontWeight: '500' }}>
                                        {it.name}
                                        {it.portion ? <span style={{ color: '#aaa', marginLeft: '2px' }}>({it.portion})</span> : ''}
                                      </span>
                                      {it.notes && (
                                        <span style={{ color: '#f87171', fontSize: '10px', marginLeft: '2px' }}>
                                          [{it.notes}]
                                        </span>
                                      )}
                                    </div>
                                  ))
                                })()}
                              </div>
                            ) : (
                              <div style={{ color: '#666' }}>Detay yok</div>
                            )}
                            {o.order_note && (
                              <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>📝</span> <span>{o.order_note}</span>
                              </div>
                            )}
                          </div>
                          
                          <div style={{ width: '85px', color: '#fff', fontWeight: '600', fontSize: '13px' }}>{o.customer_name}</div>
                          
                          <div style={{ width: '75px', color: isCancel ? '#ef4444' : '#4ade80', fontWeight: 'bold', fontSize: '14px' }}>{o.total_amount} ₺</div>
                          
                          <div style={{ width: '90px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '1px', fontSize: '11px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                              {dateStr}
                            </div>
                            <span style={{ fontSize: '11px', marginLeft: '13px' }}>{timeStr}</span>
                          </div>
                          
                          <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                            <div style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: isCancel ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: isCancel ? '#ef4444' : '#4ade80' }}>
                              {isCancel ? 'İptal' : (o.status || 'Tamamlandı')}
                            </div>
                          </div>
                          
                          <div style={{ width: '40px', textAlign: 'right' }}>
                            <button className="settings-btn danger" style={{ padding: '4px', minWidth: 'auto', width: '28px', height: '28px', borderRadius: '6px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => handleDeletePastOrder(i)} title="Sil">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
                <div className="settings-card-title">Mevcut Yazıcı: <span style={{ color: 'var(--primary)' }}>{settings.YAZICI_ADI || 'Seçilmedi'}</span></div>
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

          {['integrations', 'spotify', 'trendyol'].includes(activeTab) && (
            <div>
              <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Integrations</span>
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
                <div className="settings-card-title">Spotify Entegrasyonu (API Keys)</div>
                <label style={{ display: 'block', fontSize: 12, color: 'gray', marginBottom: 5 }}>Client ID</label>
                <input className="settings-input" value={settings.SPOTIFY_CLIENT_ID || ''} onChange={e => handleSettingChange('SPOTIFY_CLIENT_ID', e.target.value)} />
                
                <label style={{ display: 'block', fontSize: 12, color: 'gray', marginBottom: 5 }}>Client Secret</label>
                <input className="settings-input" value={settings.SPOTIFY_CLIENT_SECRET || ''} onChange={e => handleSettingChange('SPOTIFY_CLIENT_SECRET', e.target.value)} />
                
                <div className="settings-row" style={{ marginTop: 20 }}>
                  <button className="settings-btn primary" onClick={handleSaveSettings}>Değişiklikleri Kaydet</button>
                  <button className="settings-btn success" onClick={triggerSpotifyLogin}>Spotify'ı Yetkilendir (Login)</button>
                </div>
              </div>

              <div className="settings-card" style={{ marginTop: 20 }}>
                <div className="settings-card-title">Trendyol (TGO) Entegrasyonu</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: 15 }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>Trendyol Sipariş Servisi (API)</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>Trendyol API üzerinden gelen siparişleri otomatik olarak çeker ve kasaya aktarır.</div>
                    </div>
                    <button 
                      className={`settings-btn ${settings.ENABLE_TRENDYOL ? 'success' : 'danger'}`}
                      onClick={() => {
                        const newVal = settings.ENABLE_TRENDYOL ? false : true;
                        handleSettingChange('ENABLE_TRENDYOL', newVal);
                        window.api.saveSettings({ ...settings, ENABLE_TRENDYOL: newVal });
                        setTimeout(fetchTrendyolStatus, 300);
                      }}
                      style={{ padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', width: '100px' }}
                    >
                      {settings.ENABLE_TRENDYOL ? 'Açık' : 'Kapalı'}
                    </button>
                  </div>
                  
                  {/* Trendyol API Status & Statistics Dashboard Card */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>API Bağlantı Durumu</span>
                        {(() => {
                          const st = trendyolStatus?.status || 'unconfigured';
                          const isEnabled = settings.ENABLE_TRENDYOL;
                          if (!isEnabled) {
                            return (
                              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(255,255,255,0.1)', color: '#aaa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                ⚪ Servis Kapalı
                              </span>
                            );
                          }
                          if (st === 'connected') {
                            return (
                              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', border: '1px solid rgba(76, 175, 80, 0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4caf50', boxShadow: '0 0 8px #4caf50' }}></span>
                                Bağlantı Aktif (200 OK)
                              </span>
                            );
                          } else if (st === 'checking') {
                            return (
                              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(255, 152, 0, 0.2)', color: '#ff9800', border: '1px solid rgba(255, 152, 0, 0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                🟡 Kontrol Ediliyor...
                              </span>
                            );
                          } else if (st === 'error') {
                            return (
                              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(244, 67, 54, 0.2)', color: '#f44336', border: '1px solid rgba(244, 67, 54, 0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                🔴 Bağlantı Hatası
                              </span>
                            );
                          } else {
                            return (
                              <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(255, 152, 0, 0.2)', color: '#ff9800', border: '1px solid rgba(255, 152, 0, 0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                🟠 Yapılandırma Eksik
                              </span>
                            );
                          }
                        })()}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="settings-btn"
                          disabled={isTestingTrendyol}
                          onClick={handleTestTrendyol}
                          style={{ padding: '6px 12px', fontSize: '12px', background: '#3b82f6', color: '#fff', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                        >
                          {isTestingTrendyol ? '⚡ Test Ediliyor...' : '⚡ Bağlantıyı Test Et'}
                        </button>
                        <button
                          className="settings-btn"
                          onClick={handlePollTrendyolNow}
                          style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                          title="Siparişleri Şimdi Kontrol Et"
                        >
                          🔄 Şimdi Kontrol Et
                        </button>
                      </div>
                    </div>

                    {/* Restoran Çalışma Durumu (Store Working Status) Bar */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                          🏪 Restoran Durumu{trendyolStatus?.storeName ? ` (${trendyolStatus.storeName})` : ''}:
                        </span>
                        {(() => {
                          const st = trendyolStatus?.storeStatus;
                          if (st === 'OPEN') {
                            return (
                              <span style={{ padding: '3px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 'bold', background: 'rgba(76, 175, 80, 0.25)', color: '#4caf50', border: '1px solid rgba(76, 175, 80, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                🟢 AÇIK (OPEN)
                              </span>
                            );
                          } else if (st === 'CLOSED') {
                            return (
                              <span style={{ padding: '3px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 'bold', background: 'rgba(244, 67, 54, 0.25)', color: '#f44336', border: '1px solid rgba(244, 67, 54, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                🔴 KAPALI (CLOSED)
                              </span>
                            );
                          } else {
                            return (
                              <span style={{ padding: '3px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.1)', color: '#aaa', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                ⚪ BİLİNMİYOR
                              </span>
                            );
                          }
                        })()}
                        {trendyolStatus?.storeId && (
                          <span style={{ fontSize: '11px', color: '#888', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
                            Mağaza ID: {trendyolStatus.storeId}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          className="settings-btn"
                          disabled={isUpdatingStoreStatus || !settings.ENABLE_TRENDYOL}
                          onClick={() => handleUpdateTrendyolStoreStatus('OPEN')}
                          style={{ padding: '6px 14px', fontSize: '12px', background: trendyolStatus?.storeStatus === 'OPEN' ? '#2e7d32' : 'rgba(76, 175, 80, 0.2)', color: '#4caf50', border: '1px solid #4caf50', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          {isUpdatingStoreStatus ? '...' : '🟢 Restoranı Aç'}
                        </button>
                        <button
                          className="settings-btn"
                          disabled={isUpdatingStoreStatus || !settings.ENABLE_TRENDYOL}
                          onClick={() => handleUpdateTrendyolStoreStatus('CLOSED')}
                          style={{ padding: '6px 14px', fontSize: '12px', background: trendyolStatus?.storeStatus === 'CLOSED' ? '#c62828' : 'rgba(244, 67, 54, 0.2)', color: '#f44336', border: '1px solid #f44336', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          {isUpdatingStoreStatus ? '...' : '🔴 Restoranı Kapat'}
                        </button>
                        <button
                          className="settings-btn"
                          onClick={handleFetchTrendyolStoreStatus}
                          style={{ padding: '6px 10px', fontSize: '11px', background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                          title="Sorgula"
                        >
                          🔍 Sorgula
                        </button>
                      </div>
                    </div>

                    {storeStatusResult && (
                      <div style={{ background: storeStatusResult.success ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)', border: `1px solid ${storeStatusResult.success ? '#4caf50' : '#f44336'}`, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '12px', color: storeStatusResult.success ? '#81c784' : '#ff8a80' }}>
                        <strong>Çalışma Durumu İletisi:</strong> {storeStatusResult.message}
                      </div>
                    )}

                    {trendyolStatus?.lastError && settings.ENABLE_TRENDYOL && (
                      <div style={{ background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#ff8a80' }}>
                        <strong>Son Hata Ayrıntısı:</strong> {trendyolStatus.lastError}
                      </div>
                    )}

                    {testResult && (
                      <div style={{ background: testResult.success ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)', border: `1px solid ${testResult.success ? '#4caf50' : '#f44336'}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: testResult.success ? '#81c784' : '#ff8a80' }}>
                        <strong>Test Sonucu:</strong> {testResult.message}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>📦 Toplam Alınan</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff9800' }}>
                          {trendyolStatus?.totalOrdersReceived || 0}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>📅 Bugünkü Sipariş</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4caf50' }}>
                          {trendyolStatus?.todayOrdersCount || 0}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>🕒 Son Sipariş</div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {trendyolStatus?.lastOrderId ? `#${trendyolStatus.lastOrderId} (${trendyolStatus.lastOrderTime})` : 'Yok'}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>⏱️ Son Başarılı Kontrol</div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2196f3', marginTop: '4px' }}>
                          {trendyolStatus?.lastSuccessTime || 'Henüz Yok'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#aaa' }}>Satıcı ID (Supplier ID)</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={settings.TRENDYOL_SUPPLIER_ID || ''}
                      onChange={(e) => handleSettingChange('TRENDYOL_SUPPLIER_ID', e.target.value)}
                      placeholder="6647850"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#aaa' }}>Mağaza ID (Store ID - Boş bırakılırsa Satıcı ID kullanılır)</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={settings.TRENDYOL_STORE_ID || ''}
                      onChange={(e) => handleSettingChange('TRENDYOL_STORE_ID', e.target.value)}
                      placeholder={settings.TRENDYOL_SUPPLIER_ID || '6647850'}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#aaa' }}>API Key</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={settings.TRENDYOL_API_KEY || ''}
                      onChange={(e) => handleSettingChange('TRENDYOL_API_KEY', e.target.value)}
                      placeholder="bYv2F8LWu5QAHfucbind"
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#aaa' }}>API Secret</label>
                    <input 
                      type="password" 
                      className="settings-input" 
                      value={settings.TRENDYOL_API_SECRET || ''}
                      onChange={(e) => handleSettingChange('TRENDYOL_API_SECRET', e.target.value)}
                      placeholder="zCFUGzkEL4kjXkdZ9ZRN"
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#aaa' }}>Entg. Ref Code</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={settings.TRENDYOL_REF_CODE || ''}
                      onChange={(e) => handleSettingChange('TRENDYOL_REF_CODE', e.target.value)}
                      placeholder="2dbebaa4-6410-4882-9d78-44722e87db9a"
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', color: '#aaa' }}>Token</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={settings.TRENDYOL_TOKEN || ''}
                      onChange={(e) => handleSettingChange('TRENDYOL_TOKEN', e.target.value)}
                      placeholder="Yll2MkY4TFd1NVFBSGZ1Y2JpbmQ6ekNGVUd6a0VMNGtqWGtkWjlaUk4="
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <label style={{ fontSize: '13px', color: '#aaa' }}>Trendyol API Endpoint</label>
                      <button
                        className="settings-btn"
                        style={{ padding: '2px 8px', fontSize: '11px', background: 'rgba(255,255,255,0.1)' }}
                        onClick={() => {
                          const defaultUrl = 'https://api.tgoapis.com/integrator/order/meal/suppliers/' + (settings.TRENDYOL_SUPPLIER_ID || '') + '/packages?packageStatuses=Created,Approved,Preparing,Picking&size=50';
                          handleSettingChange('TRENDYOL_API_URL', defaultUrl);
                        }}
                      >
                        Sıfırla (Trendyol Yemek API)
                      </button>
                    </div>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={settings.TRENDYOL_API_URL || 'https://api.tgoapis.com/integrator/order/meal/suppliers/' + (settings.TRENDYOL_SUPPLIER_ID || '') + '/packages?packageStatuses=Created,Approved,Preparing,Picking&size=50'}
                      onChange={(e) => handleSettingChange('TRENDYOL_API_URL', e.target.value)}
                      placeholder="https://api.tgoapis.com/integrator/order/meal/suppliers/{supplierId}/packages?packageStatuses=Created,Approved,Preparing,Picking&size=50"
                    />
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <button className="settings-btn success" onClick={handleSaveSettings}>
                      Ayarları Kaydet
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {activeTab === 'updates' && (
            <div>
              <div className="settings-section-title">Uygulama Güncellemeleri</div>
              <div className="settings-card" style={{ padding: 25, display: 'flex', flexDirection: 'column', gap: 25 }}>
                {/* 1. Kasa Uygulaması (Windows) Güncelleme */}
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ borderBottom: '1px solid #333', paddingBottom: 10, marginBottom: 20 }}>Kasa (Windows) Otomatik Güncellemesi</h3>

                  {updaterState.status === 'idle' && <h2 style={{ color: '#aaa', fontSize: 20 }}>Güncelleme durumu kontrol edilebilir.</h2>}
                  {updaterState.status === 'checking' && <h2 style={{ color: '#4CAF50', fontSize: 24 }}>Kontrol ediliyor...</h2>}
                  {updaterState.status === 'not-available' && <h2 style={{ color: '#aaa', fontSize: 24 }}>Kasa Uygulaması Güncel.</h2>}
                  {updaterState.status === 'error' && <h2 style={{ color: '#F44336', fontSize: 20 }}>Hata: {updaterState.error}</h2>}
                  
                  {updaterState.status === 'available' && (
                    <div>
                      <h2 style={{ color: '#FF9800', fontSize: 24, marginBottom: 15 }}>Yeni Bir Güncelleme Bulundu!</h2>
                      <p style={{ color: '#ddd', marginBottom: 20 }}>Sürüm: {updaterState.info?.version || 'Yeni Sürüm'}</p>
                      <button className="settings-btn primary" onClick={downloadUpdate} style={{ fontSize: 16, padding: '10px 25px' }}>Şimdi İndir ve Güncelle</button>
                    </div>
                  )}
                  
                  {updaterState.status === 'downloading' && (
                    <div>
                      <h2 style={{ color: '#2196F3', fontSize: 24, marginBottom: 15 }}>Güncelleme İndiriliyor...</h2>
                      <div style={{ width: '100%', background: '#333', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ width: `${updaterState.progress?.percent || 0}%`, background: '#4CAF50', height: '100%' }}></div>
                      </div>
                      <p style={{ color: '#aaa' }}>{Math.round(updaterState.progress?.percent || 0)}%</p>
                    </div>
                  )}
                  
                  {updaterState.status === 'downloaded' && (
                    <div>
                      <h2 style={{ color: '#4CAF50', fontSize: 24, marginBottom: 15 }}>Güncelleme Dosyaları Hazır!</h2>
                      <p style={{ color: '#ddd', marginBottom: 20 }}>Uygulama yeniden başlatılarak güncellenecektir.</p>
                      <button className="settings-btn success" onClick={installUpdate} style={{ fontSize: 16, padding: '10px 25px' }}>Yeniden Başlat ve Kur</button>
                    </div>
                  )}
                  
                  {(updaterState.status === 'idle' || updaterState.status === 'not-available' || updaterState.status === 'error') && (
                    <button className="settings-btn" onClick={checkUpdates} style={{ marginTop: 20 }}>Güncellemeleri Kontrol Et</button>
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
