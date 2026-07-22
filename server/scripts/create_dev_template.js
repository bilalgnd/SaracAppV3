const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../public/templates/apiorders.html');
const devTemplatePath = path.join(__dirname, '../public/templates/apiorders_dev.html');

let html = fs.readFileSync(templatePath, 'utf8');

// Replace title
html = html.replace('<title>Entegrasyon Kontrol Merkezi</title>', '<title>🧪 DEV TEST - Entegrasyon Kontrol Merkezi</title>');

// Add DEV Banner inside <main>
const devBanner = `
    <!-- DEV ENVIRONMENT BANNER -->
    <div class="bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 border border-purple-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between mb-4 shadow-xl shrink-0">
      <div class="flex items-center gap-2.5 text-purple-300 font-extrabold text-xs">
        <span class="relative flex h-2.5 w-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
        </span>
        <i class="fa-solid fa-flask text-purple-400 text-sm"></i>
        <span class="tracking-wide">DEV TEST ORTAMI (/apiorders-dev)</span>
        <span class="bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full text-[10px] border border-purple-500/40 font-mono">Mock Veri Aktif</span>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <button @click="addMockOrder()" class="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg font-extrabold transition-all flex items-center gap-1.5 shadow cursor-pointer">
          <i class="fa-solid fa-plus text-xs"></i> 🧪 Mock Sipariş Ekle
        </button>
        <button @click="clearMockOrders()" class="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-3 py-1.5 rounded-lg font-extrabold transition-all flex items-center gap-1.5 shadow cursor-pointer">
          <i class="fa-solid fa-trash-can text-xs"></i> 🗑️ Tümünü Temizle
        </button>
        <a href="/apiorders" class="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1">
          <i class="fa-solid fa-arrow-right-from-bracket text-xs"></i> Canlı Ortama Geç
        </a>
      </div>
    </div>
`;

html = html.replace(/(<main[^>]*>)/, '$1\n' + devBanner);

// Replace /api/tgo/orders with /api/tgo/dev/orders
html = html.replace('/api/tgo/orders?status=all', '/api/tgo/dev/orders');

// Add addMockOrder and clearMockOrders methods before downloadJson
const devMethods = `
        async addMockOrder() {
          try {
            const res = await fetch('/api/tgo/dev/mock-order', {
              method: 'POST',
              headers: { 'Authorization': "Bearer " + this.adminToken }
            });
            if (res.ok) {
              const data = await res.json();
              Swal.fire({title:'Mock Sipariş Eklendi', text:'Test siparişi oluşturuldu.', icon:'success', toast:true, position:'top-end', timer:2000, showConfirmButton:false});
              
              this.activeView = 'orders_all';
              await this.fetchOrders();

              if (data.order) {
                const found = this.orders.find(o => String(o.id) === String(data.order.id));
                if (found) {
                  this.selectedOrder = found;
                } else if (this.orders.length > 0) {
                  this.selectedOrder = this.orders[0];
                }
              }
            } else {
              const err = await res.json().catch(() => ({}));
              Swal.fire({title:'Hata', text: err.error || 'Mock sipariş eklenemedi.', icon:'error', toast:true, position:'top-end', timer:3000, showConfirmButton:false});
            }
          } catch(e) {
             console.error('Add mock order error:', e);
             Swal.fire({title:'Hata', text:'İstek başarısız.', icon:'error', toast:true, position:'top-end', timer:2000, showConfirmButton:false});
          }
        },

        async clearMockOrders() {
          try {
            const res = await fetch('/api/tgo/dev/mock-orders', {
              method: 'DELETE',
              headers: { 'Authorization': "Bearer " + this.adminToken }
            });
            if(res.ok) {
              Swal.fire({title:'Temizlendi', text:'Mock siparişler temizlendi.', icon:'info', toast:true, position:'top-end', timer:2000, showConfirmButton:false});
              await this.fetchOrders();
              this.selectedOrder = null;
            }
          } catch(e) {}
        },
`;

html = html.replace('downloadJson() {', devMethods.trim() + '\n\n        downloadJson() {');

fs.writeFileSync(devTemplatePath, html, 'utf8');
console.log('Re-generated apiorders_dev.html successfully');
