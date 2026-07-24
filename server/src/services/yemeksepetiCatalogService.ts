import axios from 'axios';
import { addSystemLog } from '../server';

export interface YemeksepetiCatalogItemUpdate {
  productId: string;
  sku?: string;
  price?: number;
  available?: boolean;
  stockQuantity?: number;
}

export class YemeksepetiCatalogService {
  private static baseUrl = process.env.YEMEKSEPETI_CATALOG_BASE_URL || 'https://api.deliveryhero.com/catalog';
  private static authUrl = process.env.YEMEKSEPETI_AUTH_URL || 'https://api.deliveryhero.com/oauth/token';
  private static cachedToken: string | null = null;
  private static tokenExpiresAt: number = 0;

  /**
   * Retrieves OAuth2 client_credentials token for Yemeksepeti / Delivery Hero API
   */
  private static async getAuthToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    const clientId = process.env.YEMEKSEPETI_CLIENT_ID || '';
    const clientSecret = process.env.YEMEKSEPETI_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
      // Mock / Fallback token for dev testing if credentials not yet configured
      addSystemLog('YemeksepetiCatalog', 'warning', 'YEMEKSEPETI_CLIENT_ID veya CLIENT_SECRET eksik. Dev mock token kullanılıyor.');
      return 'mock_yemeksepeti_catalog_token_dev';
    }

    try {
      const response = await axios.post(
        this.authUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        }
      );

      if (response.data && response.data.access_token) {
        this.cachedToken = response.data.access_token;
        const expiresIn = response.data.expires_in || 3600;
        this.tokenExpiresAt = now + expiresIn * 1000;
        addSystemLog('YemeksepetiCatalog', 'info', 'Yemeksepeti OAuth2 token başarıyla yenilendi.');
        return this.cachedToken;
      }
      throw new Error('OAuth2 yanıtında access_token bulunamadı.');
    } catch (error: any) {
      addSystemLog('YemeksepetiCatalog', 'error', `OAuth2 token alınamadı: ${error.message}`);
      throw error;
    }
  }

  /**
   * GET /chain/{chainId}/store/{storeId}/categories
   * Retrieves categories for the given store
   */
  public static async getCategories(chainId: string, storeId: string) {
    try {
      const token = await this.getAuthToken();
      if (token === 'mock_yemeksepeti_catalog_token_dev') {
        return {
          success: true,
          isMock: true,
          categories: [
            { id: 'cat_1', name: 'Dönerler', count: 4 },
            { id: 'cat_2', name: 'İçecekler', count: 3 },
            { id: 'cat_3', name: 'Tatlılar & Yan Ürünler', count: 2 },
          ],
        };
      }

      const response = await axios.get(`${this.baseUrl}/chain/${chainId}/store/${storeId}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      return { success: true, categories: response.data };
    } catch (error: any) {
      addSystemLog('YemeksepetiCatalog', 'error', `Kategoriler çekilemedi (${storeId}): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * GET /chain/{chainId}/store/{storeId}/products
   * Retrieves listed products for the store
   */
  public static async getProducts(chainId: string, storeId: string) {
    try {
      const token = await this.getAuthToken();
      if (token === 'mock_yemeksepeti_catalog_token_dev') {
        return {
          success: true,
          isMock: true,
          products: [
            { id: 'ys_prod_101', name: 'Eski Usul Ekmek Arası Et Döner', price: 450.0, available: true, sku: 'SKU-ED-01' },
            { id: 'ys_prod_102', name: 'Kaşarlı Et Döner Dürüm', price: 550.0, available: true, sku: 'SKU-ED-02' },
            { id: 'ys_prod_103', name: 'Saracoğlu Et Döner Dürüm (XL)', price: 550.0, available: true, sku: 'SKU-ED-03' },
            { id: 'ys_prod_104', name: 'Coca-Cola (1 L)', price: 130.0, available: true, sku: 'SKU-IC-01' },
          ],
        };
      }

      const response = await axios.get(`${this.baseUrl}/chain/${chainId}/store/${storeId}/products`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      return { success: true, products: response.data };
    } catch (error: any) {
      addSystemLog('YemeksepetiCatalog', 'error', `Ürünler çekilemedi (${storeId}): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * PUT /chain/{chainId}/store/{storeId}/products
   * Updates status (AVAILABLE/UNAVAILABLE), price, and stock for items
   */
  public static async updateProductStatusAndPrice(
    chainId: string,
    storeId: string,
    updates: YemeksepetiCatalogItemUpdate[]
  ) {
    try {
      const token = await this.getAuthToken();
      addSystemLog(
        'YemeksepetiCatalog',
        'info',
        `Yemeksepeti Katalog Güncelleme İsteği (${storeId}): ${updates.length} ürün güncelleniyor.`
      );

      if (token === 'mock_yemeksepeti_catalog_token_dev') {
        return {
          success: true,
          isMock: true,
          message: `${updates.length} ürün Yemeksepeti kataloğunda güncellendi (Dev Mock).`,
          updatedItems: updates,
        };
      }

      const payload = {
        products: updates.map(u => ({
          id: u.productId,
          sku: u.sku,
          price: u.price !== undefined ? { amount: u.price, currency: 'TRY' } : undefined,
          status: u.available !== undefined ? (u.available ? 'AVAILABLE' : 'UNAVAILABLE') : undefined,
          quantity: u.stockQuantity,
        })),
      };

      const response = await axios.put(`${this.baseUrl}/chain/${chainId}/store/${storeId}/products`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      });

      addSystemLog('YemeksepetiCatalog', 'success', `Yemeksepeti Ürün Güncelleme Başarılı (${storeId}).`);
      return { success: true, data: response.data };
    } catch (error: any) {
      addSystemLog('YemeksepetiCatalog', 'error', `Ürün güncelleme hatası (${storeId}): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * POST /chain/{chainId}/store/{storeId}/assortment/export
   * Initiates full menu export job for vendor
   */
  public static async exportAssortment(chainId: string, storeId: string) {
    try {
      const token = await this.getAuthToken();
      if (token === 'mock_yemeksepeti_catalog_token_dev') {
        return {
          success: true,
          isMock: true,
          jobId: `job_ys_export_${Date.now()}`,
          message: 'Tüm Yemeksepeti menüsü dışa aktarma talebi oluşturuldu (Dev Mock).',
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/chain/${chainId}/store/${storeId}/assortment/export`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );

      return { success: true, data: response.data };
    } catch (error: any) {
      addSystemLog('YemeksepetiCatalog', 'error', `Menü dışa aktarma başlatılamadı (${storeId}): ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles incoming catalog update webhooks from Yemeksepeti
   */
  public static handleCatalogWebhook(payload: any) {
    addSystemLog('YemeksepetiCatalog', 'info', `Yemeksepeti Katalog Webhook Alındı: ${JSON.stringify(payload).slice(0, 200)}`);
    return { received: true, timestamp: new Date().toISOString() };
  }
}
