import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { spawn } from 'child_process'
import { systemSettings } from './models'
import { sendLogToServer } from './index'

export interface UpdateInfo {
  version?: string
  hasUpdate: boolean
  sourcePath?: string
  asarSize?: number
  asarMtime?: number
  reason?: string
}

let stagedUpdateDir = path.join(app.getPath('temp'), 'SaracAppUpdate')
let isDownloading = false

function getFileHash(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return ''
    const fileBuffer = fs.readFileSync(filePath)
    const hashSum = crypto.createHash('sha256')
    hashSum.update(fileBuffer)
    return hashSum.digest('hex')
  } catch (e) {
    return ''
  }
}

export function getInstalledAsarPath(): string {
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    return path.join(app.getAppPath(), 'dist', 'win-unpacked', 'resources', 'app.asar')
  }
  return path.join(process.resourcesPath, 'app.asar')
}

export function getSourceWinUnpackedPath(): string {
  const userHome = app.getPath('home')
  
  const candidatePaths = [
    systemSettings.UPDATE_LOCAL_PATH,
    'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\app1\\dist\\win-unpacked',
    path.join(userHome, 'Google Drive', 'saracapp', 'win-unpacked'),
    path.join(userHome, 'Google Drive', 'SARACAPP', 'win-unpacked'),
    path.join(userHome, 'GoogleDrive', 'saracapp', 'win-unpacked'),
    'G:\\My Drive\\saracapp\\win-unpacked',
    'G:\\My Drive\\SARACAPP\\win-unpacked',
    'G:\\Drive\'ım\\saracapp\\win-unpacked'
  ]

  for (const candidate of candidatePaths) {
    if (candidate && fs.existsSync(candidate)) {
      if (fs.existsSync(path.join(candidate, 'resources', 'app.asar'))) {
        return candidate
      }
    }
  }

  return ''
}

export async function checkCustomUpdate(): Promise<UpdateInfo> {
  try {
    const sourcePath = getSourceWinUnpackedPath()
    if (!sourcePath) {
      return { hasUpdate: false, reason: 'Güncelleme klasörü (win-unpacked) bulunamadı.' }
    }

    const sourceAsar = path.join(sourcePath, 'resources', 'app.asar')
    const currentAsar = getInstalledAsarPath()

    if (!fs.existsSync(sourceAsar)) {
      return { hasUpdate: false, reason: 'Kaynak app.asar bulunamadı.' }
    }

    if (!fs.existsSync(currentAsar)) {
      return { hasUpdate: true, sourcePath, reason: 'Mevcut app.asar bulunamadı.' }
    }

    const sourceStats = fs.statSync(sourceAsar)
    const currentStats = fs.statSync(currentAsar)

    // Check version.json if available
    let sourceVersion = ''
    const versionJsonPath = path.join(sourcePath, 'version.json')
    if (fs.existsSync(versionJsonPath)) {
      try {
        const vData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'))
        sourceVersion = vData.version || ''
      } catch (e) {}
    }

    // Compare file sizes and modification times first for speed
    if (sourceStats.size !== currentStats.size || sourceStats.mtimeMs > currentStats.mtimeMs + 2000) {
      // Confirm with Hash if needed
      const sourceHash = getFileHash(sourceAsar)
      const currentHash = getFileHash(currentAsar)

      if (sourceHash !== currentHash) {
        return {
          hasUpdate: true,
          version: sourceVersion || `Build-${new Date(sourceStats.mtimeMs).toLocaleDateString('tr-TR')}`,
          sourcePath,
          asarSize: sourceStats.size,
          asarMtime: sourceStats.mtimeMs
        }
      }
    }

    return { hasUpdate: false, reason: 'Uygulama zaten en son sürümde.' }
  } catch (err: any) {
    console.error('[CUSTOM UPDATER] Check error:', err)
    return { hasUpdate: false, reason: `Kontrol hatası: ${err.message}` }
  }
}

export async function downloadCustomUpdate(window?: BrowserWindow): Promise<boolean> {
  if (isDownloading) return false
  isDownloading = true

  try {
    const checkResult = await checkCustomUpdate()
    if (!checkResult.hasUpdate || !checkResult.sourcePath) {
      window?.webContents.send('updater-event', { action: 'error', data: checkResult.reason || 'Güncelleme yok' })
      isDownloading = false
      return false
    }

    const sourceAsar = path.join(checkResult.sourcePath, 'resources', 'app.asar')
    if (!fs.existsSync(stagedUpdateDir)) {
      fs.mkdirSync(stagedUpdateDir, { recursive: true })
    }

    const targetAsar = path.join(stagedUpdateDir, 'app.asar')

    window?.webContents.send('updater-event', { action: 'download-progress', data: { percent: 30, bytesPerSecond: 1024 * 1024 * 5 } })

    // Copy app.asar to staging temp directory
    fs.copyFileSync(sourceAsar, targetAsar)

    // Save info file
    fs.writeFileSync(path.join(stagedUpdateDir, 'update_info.json'), JSON.stringify(checkResult, null, 2))

    window?.webContents.send('updater-event', { action: 'download-progress', data: { percent: 100, bytesPerSecond: 1024 * 1024 * 10 } })
    window?.webContents.send('updater-event', { action: 'update-downloaded', data: { version: checkResult.version } })

    sendLogToServer('success', `Yeni fark güncellemesi (app.asar) hazırlandı: Sürüm ${checkResult.version}`)
    isDownloading = false
    return true
  } catch (err: any) {
    console.error('[CUSTOM UPDATER] Download error:', err)
    window?.webContents.send('updater-event', { action: 'error', data: `İndirme hatası: ${err.message}` })
    isDownloading = false
    return false
  }
}

export function installCustomUpdate(): void {
  try {
    const stagedAsar = path.join(stagedUpdateDir, 'app.asar')
    if (!fs.existsSync(stagedAsar)) {
      console.error('[CUSTOM UPDATER] Staged app.asar not found!')
      return
    }

    const currentAsar = getInstalledAsarPath()
    const exePath = app.getPath('exe')

    const batPath = path.join(app.getPath('temp'), 'apply_saracapp_update.bat')
    const batContent = `@echo off
chcp 65001 > NUL
timeout /t 2 /nobreak > NUL
copy /y "${stagedAsar}" "${currentAsar}"
start "" "${exePath}"
del "%~f0"
`

    fs.writeFileSync(batPath, batContent, 'utf8')

    sendLogToServer('info', 'App1 güncellemeyi uygulamak için kapatılıyor ve yeniden başlatılıyor...')

    const child = spawn('cmd.exe', ['/c', batPath], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore'
    })

    child.unref()
    app.quit()
  } catch (err: any) {
    console.error('[CUSTOM UPDATER] Install error:', err)
  }
}
