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
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: 600, height: 500, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h2>Ortak Dosya Paylaşımı</h2>
          <button className="btn" onClick={() => setIsOpen(false)} style={{ padding: 8, background: 'transparent', color: 'white' }}>
            <X size={24} />
          </button>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-upload')?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary)' : '#444'}`,
            borderRadius: 10,
            padding: 30,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragging ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(255,255,255,0.05)',
            marginBottom: 20
          }}
        >
          <UploadCloud size={48} style={{ color: 'var(--primary)', marginBottom: 10 }} />
          <h3>Dosyayı Buraya Sürükleyin</h3>
          <p style={{ color: '#888', marginTop: 5 }}>veya seçmek için tıklayın</p>
          <input type="file" id="file-upload" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>
        
        {uploading && (
          <div style={{ marginBottom: 20, padding: '15px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Yükleniyor...</span>
              <span style={{ color: '#fff' }}>%{uploadProgress}</span>
            </div>
            <div style={{ height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden', marginBottom: 15 }}>
              <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: 'var(--primary)', transition: 'width 0.2s' }}></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button className="btn" onClick={cancelUpload} style={{ padding: '8px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold' }}>
                İptal Et
              </button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10 }}>
          {files.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>Henüz dosya yüklenmemiş.</div>
          ) : (
            files.map((file, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: 10, borderBottom: '1px solid #333' }}>
                <FileText size={24} style={{ color: '#ccc', marginRight: 15 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.time).toLocaleString('tr-TR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={() => downloadFile(file.name)} style={{ padding: '6px 12px', backgroundColor: 'var(--primary)', color: 'white' }}>
                    <Download size={16} />
                  </button>
                  <button className="btn" onClick={() => deleteFile(file.name)} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white' }}>
                    <Trash2 size={16} />
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
