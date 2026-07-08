import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

const userDataPath = app.getPath('userData')

export const storePaths = {
  prices: path.join(userDataPath, 'saracoglu_prices.json'),
  settings: path.join(userDataPath, 'saracoglu_settings.json'),
  orders: path.join(userDataPath, 'active_orders.json'),
  menu: path.join(userDataPath, 'custom_menu.json'),
  past_orders: path.join(userDataPath, 'past_orders.json')
}

// Write queue to prevent blocking and overlapping writes
class WriteQueue {
  private queue: Promise<void> = Promise.resolve()

  add(task: () => Promise<void>) {
    this.queue = this.queue.then(task).catch((err) => {
      console.error('Error in write queue:', err)
    })
    return this.queue
  }
}

const writeQueue = new WriteQueue()

export async function loadJson<T>(filePath: string, defaultVal: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data) as T
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error(`Error reading ${filePath}:`, error)
    }
    return defaultVal
  }
}

export function saveJson(filePath: string, data: any): void {
  // Deep copy to prevent reference mutation during async write
  const dataCopy = JSON.parse(JSON.stringify(data))
  
  writeQueue.add(async () => {
    try {
      await fs.writeFile(filePath, JSON.stringify(dataCopy, null, 2), 'utf-8')
    } catch (error) {
      console.error(`Error writing ${filePath}:`, error)
    }
  })
}
