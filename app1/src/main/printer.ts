import { systemSettings } from './models'
import { BrowserWindow } from 'electron'
import QRCode from 'qrcode'

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

let lastPrintSignature = ''
let lastPrintTime = 0
let isPrintingInProgress = false
const printQueue: Array<() => Promise<void>> = []

// Daily Order / Receipt Counter
let dailyReceiptDate = new Date().toLocaleDateString('tr-TR')
let dailyReceiptCounter = 0

function getNextOrderNumber(): string {
  const today = new Date().toLocaleDateString('tr-TR')
  if (today !== dailyReceiptDate) {
    dailyReceiptDate = today
    dailyReceiptCounter = 0
  }
  dailyReceiptCounter++
  return '#' + String(dailyReceiptCounter).padStart(3, '0')
}

export async function printReceipt(
  customerName: string,
  time: string,
  items: any[],
  totalAmount: number,
  orderNote: string = "",
  waiterName: string = ""
): Promise<void> {
  const printerName = systemSettings["YAZICI_ADI"]
  if (!printerName) {
    console.warn("Yazıcı ayarlanmamış, yazdırma iptal edildi.")
    return
  }

  // Deduplication: prevent double prints of same receipt within 3 seconds
  const itemsSignature = (items || []).map((it: any) => `${it.name}_${it.portion || ''}_${it.price}_${it.quantity || 1}`).join('|')
  const signature = `${customerName}_${totalAmount}_${orderNote}_${itemsSignature}`
  const now = Date.now()

  if (signature === lastPrintSignature && (now - lastPrintTime) < 3000) {
    console.warn(`[PRINTER] Duplicate print request ignored for: ${customerName} (within ${now - lastPrintTime}ms)`)
    return
  }

  lastPrintSignature = signature
  lastPrintTime = now

  const orderNo = getNextOrderNumber()

  // Process via FIFO queue to avoid overlapping BrowserWindow prints
  await new Promise<void>((resolve) => {
    printQueue.push(async () => {
      try {
        await printViaElectron(printerName, customerName, time, items, totalAmount, orderNote, waiterName, orderNo)
      } finally {
        resolve()
      }
    })
    processPrintQueue()
  })
}

async function processPrintQueue() {
  if (isPrintingInProgress || printQueue.length === 0) return
  isPrintingInProgress = true
  const job = printQueue.shift()
  if (job) {
    try {
      await job()
    } catch (e) {
      console.error('[PRINTER] Job error:', e)
    }
  }
  isPrintingInProgress = false
  if (printQueue.length > 0) {
    setTimeout(processPrintQueue, 100)
  }
}

async function printViaElectron(
  printerName: string,
  customerName: string,
  time: string,
  items: any[],
  totalAmount: number,
  orderNote: string = "",
  waiterName: string = "",
  orderNo: string = ""
) {
  return new Promise<void>(async (resolve) => {
    const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true } })
    const receiptTitle = systemSettings["RECEIPT_HEADER_TITLE"] || 'VANTAGE'
    const subheader = systemSettings["RECEIPT_SUBHEADER"] || ''
    const footerText = systemSettings["RECEIPT_FOOTER_TEXT"] !== undefined ? systemSettings["RECEIPT_FOOTER_TEXT"] : 'AFIYET OLSUN'
    const wifiInfo = systemSettings["RECEIPT_WIFI_INFO"] || ''
    const instagram = systemSettings["RECEIPT_INSTAGRAM"] || ''
    const showWaiter = systemSettings["RECEIPT_SHOW_WAITER"] !== false
    const showOrderNo = systemSettings["RECEIPT_SHOW_ORDER_NO"] !== false
    const paperWidth = systemSettings["RECEIPT_PAPER_WIDTH"] === '80mm' ? '360px' : '270px'
    const fontSizeMode = systemSettings["RECEIPT_FONT_SIZE"] || 'normal'
    const copies = Number(systemSettings["RECEIPT_COPIES"]) || 1
    const qrUrl = systemSettings["RECEIPT_QR_CODE_URL"] || ''

    let baseFontSize = 16
    let titleFontSize = 26
    let totalFontSize = 22
    if (fontSizeMode === 'small') {
      baseFontSize = 14
      titleFontSize = 22
      totalFontSize = 18
    } else if (fontSizeMode === 'large') {
      baseFontSize = 18
      titleFontSize = 30
      totalFontSize = 26
    }

    let qrImageHtml = ''
    if (qrUrl && qrUrl.trim()) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qrUrl.trim(), { margin: 1, width: 110 })
        qrImageHtml = `
          <div style="text-align: center; margin-top: 10px;">
            <img src="${qrDataUrl}" style="width: 110px; height: 110px; display: inline-block;" />
          </div>
        `
      } catch (e) {
        console.error('[PRINTER] QR generation error:', e)
      }
    }

    // HTML optimized for Thermal OS Drivers (58mm or 80mm)
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { margin: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: ${baseFontSize}px;
            color: black;
            margin: 0;
            padding: 5px;
            width: ${paperWidth};
            box-sizing: border-box;
          }
          h1 {
            text-align: center;
            font-size: ${titleFontSize}px;
            margin: 0 0 4px 0;
            font-weight: 900;
          }
          .sub {
            text-align: center;
            font-size: ${baseFontSize - 2}px;
            margin-bottom: 6px;
            color: #222;
          }
          hr {
            border: none;
            border-top: 2px dashed black;
            margin: 8px 0;
          }
          .flex {
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <h1>${receiptTitle}</h1>
        ${subheader ? `<div class="sub">${subheader}</div>` : ''}
        <hr/>
        <div class="flex">
          <span>Tarih: ${time}</span>
          ${showOrderNo && orderNo ? `<span><b>${orderNo}</b></span>` : ''}
        </div>
        <div style="font-size: ${baseFontSize + 2}px; font-weight: bold; margin-top: 2px;">Masa: ${customerName}</div>
        ${showWaiter && waiterName ? `<div style="font-size: ${baseFontSize - 1}px; color: #333;">Garson: ${waiterName}</div>` : ''}
        ${orderNote ? `<div style="margin-top: 4px; font-size: ${baseFontSize}px; white-space: pre-wrap; font-weight: bold;">NOT: ${orderNote}</div>` : ''}
        <hr/>
    `

    const groupedItems = (items || []).reduce((acc, k: any) => {
      const key = `${k.name}|${k.portion || 'Standart'}|${k.notes || ''}`
      if (!acc[key]) {
        acc[key] = { ...k, count: 0, totalForGroup: 0 }
      }
      const qty = k.quantity || 1
      acc[key].count += qty
      acc[key].totalForGroup += (k.price || 0) * (k.count ? 1 : qty)
      return acc
    }, {} as Record<string, any>)

    Object.values(groupedItems).forEach((k: any) => {
      const portionStr = k.portion && k.portion !== 'Standart' ? `<span style="font-size: ${baseFontSize - 2}px;"> (${k.portion})</span>` : ''
      const countStr = k.count > 1 ? `${k.count}x ` : ''
      html += `<div class="flex" style="font-size: ${baseFontSize + 1}px; margin-top: 5px;">
        <span style="padding-right: 5px; font-weight: 600;">${countStr}${k.name}${portionStr}</span>
        <span style="white-space: nowrap; font-weight: bold;">${k.totalForGroup} TL</span>
      </div>`
      if (k.notes) {
        const noteStr = k.notes.toUpperCase().startsWith("NOT:") ? k.notes : `NOT: ${k.notes}`
        html += `<div style="margin-left: 8px; font-size: ${baseFontSize - 1}px; white-space: pre-wrap;">${noteStr}</div>`
      }
    })

    html += `
        <hr/>
        <h2 style="text-align: center; margin: 10px 0; font-size: ${totalFontSize}px; font-weight: 900; white-space: nowrap;">TOPLAM: ${totalAmount},00 TL</h2>
        <hr/>
        ${footerText ? `<div style="text-align: center; font-size: ${baseFontSize}px; font-weight: bold; margin-top: 6px;">${footerText}</div>` : ''}
        ${wifiInfo ? `<div style="text-align: center; font-size: ${baseFontSize - 2}px; margin-top: 4px;">📶 ${wifiInfo}</div>` : ''}
        ${instagram ? `<div style="text-align: center; font-size: ${baseFontSize - 2}px; margin-top: 2px;">📸 ${instagram}</div>` : ''}
        ${qrImageHtml}
      </body>
      </html>
    `

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => {
      win.webContents.print({
        silent: true,
        deviceName: printerName,
        copies: copies,
        margins: { marginType: 'none' }
      }, (success, failureReason) => {
        if (!success) console.error("[PRINTER] Printing failed:", failureReason)
        else console.log("[PRINTER] Printing successful:", customerName)
        try {
          win.destroy()
        } catch (e) {}
        resolve()
      })
    }).catch(err => {
      console.error("[PRINTER] LoadURL error:", err)
      try {
        win.destroy()
      } catch (e) {}
      resolve()
    })
  })
}
