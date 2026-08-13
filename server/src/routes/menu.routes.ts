import { Router } from 'express';
import { getShop } from '../models';
import { requireAuth } from '../middleware/auth';

export const menuApiRouter = Router();
export const menuRootRouter = Router();

let notifyUI: any = () => {};
export function setNotifyUI(fn: any) {
  notifyUI = fn;
}

menuRootRouter.get('/menu', requireAuth, (req: any, res) => {
  res.json(getShop().getFullMenu())
})

menuRootRouter.post('/menu', requireAuth, (req: any, res: any): any => {
  if (req.body) {
    getShop().updateCustomMenu(req.body)
    res.json({ success: true })
  } else {
    res.status(400).json({ error: 'Body required' })
  }
})

menuApiRouter.get('/menu', (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  try {
    const shop = getShop()
    if (shop && typeof shop.getFullMenu === 'function') {
      const fullMenu = shop.getFullMenu()
      if (fullMenu && fullMenu.categories && fullMenu.categories.length > 0) {
        return res.json(fullMenu)
      }
    }
  } catch (e) {}

  res.json({
    categories: [
      {
        name: 'ET DÖNER',
        items: [
          { name: 'Et Tombik', color: '#FF7F00', textColor: '#FFFFFF', options: [{ portion: '50gr', price: 250 }, { portion: '100gr', price: 350 }, { portion: '150gr', price: 450 }] },
          { name: 'Et Dürüm', color: '#F9A825', textColor: '#FFFFFF', options: [{ portion: '50gr', price: 250 }, { portion: '100gr', price: 350 }, { portion: '150gr', price: 450 }] },
          { name: 'Et XL Dürüm', color: '#F9A825', textColor: '#FFFFFF', options: [{ portion: '120gr', price: 400 }, { portion: '170gr', price: 500 }, { portion: '220gr', price: 600 }] },
          { name: 'Et Eski Usul', color: '#D32F2F', textColor: '#FFFFFF', options: [{ portion: '50gr', price: 250 }, { portion: '100gr', price: 350 }, { portion: '150gr', price: 450 }] },
          { name: 'Et Porsiyon', color: '#880000', textColor: '#FFFFFF', options: [{ portion: '120gr', price: 500 }, { portion: '170gr', price: 600 }, { portion: '220gr', price: 700 }] },
          { name: 'Et Pilav Üstü', color: '#880000', textColor: '#FFFFFF', options: [{ portion: '170gr', price: 550 }, { portion: '170gr', price: 650 }, { portion: '220gr', price: 750 }] },
          { name: 'Beyti', color: '#880000', textColor: '#FFFFFF', options: [{ portion: '100gr', price: 650 }, { portion: '150gr', price: 750 }, { portion: '200gr', price: 850 }] },
          { name: 'İskender', color: '#880000', textColor: '#FFFFFF', options: [{ portion: '100gr', price: 650 }, { portion: '150gr', price: 750 }, { portion: '200gr', price: 850 }] },
          { name: 'Et Kampy', color: '#388E3C', textColor: '#FFFFFF', options: [{ portion: 'Standart', price: 220 }] },
          { name: '500gr Et', color: '#388E3C', textColor: '#FFFFFF', options: [{ portion: 'Standart', price: 1400 }] }
        ]
      },
      {
        name: 'TAVUK DÖNER',
        items: [
          { name: 'Tavuk Dürüm', color: '#F57C00', textColor: '#FFFFFF', options: [{ portion: 'Standart', price: 220 }] },
          { name: 'Tavuk Tombik', color: '#E65100', textColor: '#FFFFFF', options: [{ portion: 'Standart', price: 220 }] },
          { name: 'Tavuk XL Dürüm', color: '#FF9800', textColor: '#FFFFFF', options: [{ portion: 'Standart', price: 270 }] },
          { name: 'Zurna Tavuk Dürüm', color: '#F57C00', textColor: '#FFFFFF', options: [{ portion: 'Standart', price: 250 }] },
          { name: 'Tavuk Porsiyon', color: '#B71C1C', textColor: '#FFFFFF', options: [{ portion: 'Standart', price: 260 }] },
          { name: 'Tavuk Pilav Üstü', color: '#B71C1C', textColor: '#FFFFFF', options: [{ portion: 'Standart', price: 290 }] }
        ]
      },
      {
        name: 'İÇECEK',
        id: 'drinks',
        items: [
          { name: 'Kutu Kola', options: [{ portion: 'Standart', price: 60 }] },
          { name: 'Ayran', options: [{ portion: 'Standart', price: 30 }] },
          { name: 'Açık Ayran', options: [{ portion: 'Standart', price: 35 }] },
          { name: 'Şişe Kola', options: [{ portion: 'Standart', price: 65 }] },
          { name: 'Su', options: [{ portion: 'Standart', price: 20 }] },
          { name: 'Sprite', options: [{ portion: 'Standart', price: 60 }] },
          { name: 'Fanta', options: [{ portion: 'Standart', price: 60 }] },
          { name: 'Cola Zero', options: [{ portion: 'Standart', price: 60 }] },
          { name: 'Şalgam', options: [{ portion: 'Standart', price: 40 }] },
          { name: 'Soda', options: [{ portion: 'Standart', price: 30 }] },
          { name: '1L Kola', options: [{ portion: 'Standart', price: 90 }] },
          { name: '1L Ayran', options: [{ portion: 'Standart', price: 70 }] }
        ]
      }
    ]
  })
})

menuApiRouter.get('/export_menu', requireAuth, (req: any, res: any) => {
  res.json({
    customMenu: getShop().customMenu,
    priceMemory: getShop().priceMemory
  })
})

menuApiRouter.post('/import_menu', requireAuth, (req: any, res: any) => {
  const { customMenu, priceMemory } = req.body
  const shop = getShop()
  if (customMenu) shop.customMenu = customMenu
  if (priceMemory) shop.priceMemory = priceMemory
  shop.saveToDB('customMenu', shop.customMenu)
  shop.saveToDB('priceMemory', shop.priceMemory)
  
  res.json({ success: true })
  notifyUI('request_update')
})
