import { useState, useEffect, useRef } from 'react'
import { X, UploadCloud, Trash2, Download, FileText } from 'lucide-react'
import { customAlert, customConfirm } from '../utils/alert'

export default function FileShareModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true)
      fetchFiles()
    }
    window.addEventListener('open-fileshare-modal', handleOpen)
    return () => window.removeEventListener('open-fileshare-modal', handleOpen)
  }, [])

  const fetchFiles = async () => {
    try {
      const res = await fetch(`https://bilalgnd.shop/api/shared`)
      const data = await res.json()
      setFiles(data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      await uploadFile(droppedFiles[0])
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFile(e.target.files[0])
    }
  }

  const uploadFile = (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        setUploadProgress(percentComplete)
      }
    }

    xhr.onload = async () => {
      setUploading(false)
      xhrRef.current = null
      if (xhr.status >= 200 && xhr.status < 300) {
        await fetchFiles()
      } else {
        const errText = xhr.responseText || 'Bilinmeyen Hata'
        customAlert(`Dosya yüklenirken hata oluştu. (Kod: ${xhr.status}, Detay: ${errText.substring(0, 100)})`)
      }
    }

    xhr.onerror = () => {
      setUploading(false)
      xhrRef.current = null
      customAlert('Sunucuya bağlanılamadı.')
    }

    xhr.onabort = () => {
      setUploading(false)
      xhrRef.current = null
      customAlert('Yükleme iptal edildi.')
    }

    xhr.open('POST', `https://bilalgnd.shop/api/shared/upload`)
    xhr.send(formData)
  }

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort()
    }
  }

  const deleteFile = async (filename: string) => {
    if (await customConfirm(`${filename} dosyasını silmek istediğinize emin misiniz?`)) {
      try {
        await fetch(`https://bilalgnd.shop/api/shared/${filename}`, { method: 'DELETE' })
        fetchFiles()
      } catch (e) {
        customAlert('Silinirken hata oluştu.')
      }
    }
  }

  const downloadFile = (filename: string) => {
    window.open(`https://bilalgnd.shop/shared_files/${filename}`, '_blank')
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: 620, 
          maxHeight: '88vh', 
          padding: '24px', 
          display: 'flex', 
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>Ortak Dosya Paylaşımı</h2>
          <button 
            className="btn" 
            onClick={() => setIsOpen(false)} 
            style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              backgroundColor: '#2A2A2A', 
              color: '#aaa', 
              border: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              padding: 0
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload')?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary)' : '#444'}`,
            borderRadius: 12,
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragging ? 'rgba(245, 78, 78, 0.1)' : 'rgba(255,255,255,0.03)',
            marginBottom: '16px',
            transition: 'all 0.2s'
          }}
        >
          <UploadCloud size={44} style={{ color: 'var(--primary)', marginBottom: 8 }} />
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>Dosyayı Buraya Sürükleyin</h3>
          <p style={{ color: '#888', marginTop: 4, marginBottom: 0, fontSize: '13px' }}>veya seçmek için tıklayın</p>
          <input type="file" id="file-upload" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>
        
        {uploading && (
          <div style={{ marginBottom: 16, padding: '14px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '13px' }}>Yükleniyor...</span>
              <span style={{ color: '#fff', fontSize: '13px' }}>%{uploadProgress}</span>
            </div>
            <div style={{ height: 6, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: 'var(--primary)', transition: 'width 0.2s' }}></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="btn" onClick={cancelUpload} style={{ padding: '6px 18px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                İptal Et
              </button>
            </div>
          </div>
        )}

        <div className="order-modal-body" style={{ flex: 1, minHeight: '180px', maxHeight: '280px', overflowY: 'auto', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          {files.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: '30px 20px', fontSize: '14px' }}>Henüz dosya yüklenmemiş.</div>
          ) : (
            files.map((file, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: idx !== files.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', borderRadius: 8, transition: 'background 0.15s' }}>
                <FileText size={22} style={{ color: '#9ca3af', marginRight: 12, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#eee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.time).toLocaleString('tr-TR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 12, flexShrink: 0 }}>
                  <button className="btn" onClick={() => downloadFile(file.name)} title="İndir" style={{ padding: '6px 10px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: 6 }}>
                    <Download size={15} />
                  </button>
                  <button className="btn" onClick={() => deleteFile(file.name)} title="Sil" style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', borderRadius: 6 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
