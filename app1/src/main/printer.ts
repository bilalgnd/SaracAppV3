import { systemSettings } from './models'
import { BrowserWindow } from 'electron'

// Clean Turkish characters for hardware compatibility
export function normalizeTurkishChars(text: string): string {
  if (!text) return ''
  return text
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
}

export async function printReceipt(customerName: string, time: string, items: any[], totalAmount: number, orderNote: string = ""): Promise<void> {
  const printerName = systemSettings["YAZICI_ADI"]
  if (!printerName) {
    console.warn("Yazıcı ayarlanmamış, yazdırma iptal edildi.")
    return
  }

  // Thermal printer API hangs on Windows without native bindings.
  // We use Electron's built-in webContents.print which is instant and works with any driver.
  await printViaElectron(printerName, customerName, time, items, totalAmount, orderNote)
}

async function printViaElectron(printerName: string, customerName: string, time: string, items: any[], totalAmount: number, orderNote: string = "") {
  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true } })
  
  // HTML optimized for Thermal OS Drivers (58mm or 80mm)
  // - Fixed width (300px) prevents Windows from scaling down A4 size to 80mm.
  // - Extra bold to prevent dithering (faded text)
  // - Clean layout
  let html = `
    <html>
    <head>
      <style>
        @page { margin: 0; }
        body {
          font-family: 'Courier New', Courier, monospace;
          margin: 0;
          padding: 0;
          padding-right: 15px; /* Prevent right edge cutoff */
          color: black;
          font-weight: 900;
          font-size: 16px;
          line-height: 1.3;
          width: 270px; /* Reduced from 300px for 58mm printers */
          box-sizing: border-box;
        }
        h1 {
          text-align: center;
          font-size: 26px;
          margin: 0 0 10px 0;
          font-weight: 900;
        }
        hr {
          border: none;
          border-top: 2px dashed black;
          margin: 10px 0;
        }
        .flex {
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <h1>SARACOGLU DONER</h1>
      <div style="font-size: 18px;">Tarih/Saat: ${time}</div>
      <div style="font-size: 18px;">Masa: ${customerName}</div>
      ${orderNote ? `<div style="margin-top: 5px; text-align: center; font-size: 18px; white-space: pre-wrap;">NOT: ${orderNote}</div>` : ''}
      <hr/>
  `
  
  const groupedItems = items.reduce((acc, k: any) => {
    const key = `${k.name}|${k.portion || 'Standart'}|${k.notes || ''}`
    if (!acc[key]) {
      acc[key] = { ...k, count: 0, totalForGroup: 0 }
    }
    acc[key].count += 1
    acc[key].totalForGroup += (k.price || 0)
    return acc
  }, {} as Record<string, any>)

  Object.values(groupedItems).forEach((k: any) => {
    const portionStr = k.portion && k.portion !== 'Standart' ? `<span style="font-size: 14px;"> (${k.portion})</span>` : ''
    const countStr = k.count > 1 ? `${k.count}x ` : ''
    html += `<div class="flex" style="font-size: 18px; margin-top: 5px;">
      <span style="padding-right: 5px;">${countStr}${k.name}${portionStr}</span>
      <span style="white-space: nowrap;">${k.totalForGroup} TL</span>
    </div>`
    if (k.notes) {
      const noteStr = k.notes.toUpperCase().startsWith("NOT:") ? k.notes : `NOT: ${k.notes}`
      html += `<div style="margin-left: 10px; font-size: 16px; white-space: pre-wrap;">${noteStr}</div>`
    }
  })
  
  html += `
      <hr/>
      <h2 style="text-align: center; margin: 15px 0; font-size: 22px; font-weight: 900; white-space: nowrap;">TOPLAM: ${totalAmount},00 TL</h2>
      <hr/>
      <div style="text-align: center; font-size: 16px; margin-top: 10px;">AFIYET OLSUN</div>
    </body>
    </html>
  `
  
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  
  win.webContents.print({
    silent: true,
    deviceName: printerName,
    copies: 1,
    margins: { marginType: 'none' }
  }, (success, failureReason) => {
    if (!success) console.error("Printing failed:", failureReason)
    else console.log("Printing successful:", customerName)
    win.destroy()
  })
}
