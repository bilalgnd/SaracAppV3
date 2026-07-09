// Bu kod web sayfasının ana bağlamında çalışır ve ağ isteklerini dinler
(function() {
    // Fetch isteklerini dinle
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await origFetch.apply(this, args);
        const url = args[0] ? args[0].toString() : '';
        
        // Trendyol URL filtresi
        if (url.includes('trendyol') && url.includes('order')) {
            const clone = response.clone();
            clone.json().then(data => {
                window.postMessage({ type: 'TRENDYOL_ORDER', payload: data }, '*');
            }).catch(e => {});
        } 
        // Yemeksepeti URL filtresi
        else if (url.includes('yemeksepeti') && url.includes('order')) {
            const clone = response.clone();
            clone.json().then(data => {
                window.postMessage({ type: 'YEMEKSEPETI_ORDER', payload: data }, '*');
            }).catch(e => {});
        }
        return response;
    };
    
    // XHR (XMLHttpRequest) isteklerini dinle
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        origOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(body) {
        this.addEventListener('load', function() {
            const url = this._url ? this._url.toString() : '';
            
            if (url.includes('trendyol') && url.includes('order')) {
                try {
                    const data = JSON.parse(this.responseText);
                    window.postMessage({ type: 'TRENDYOL_ORDER', payload: data }, '*');
                } catch(e) {}
            } else if (url.includes('yemeksepeti') && url.includes('order')) {
                try {
                    const data = JSON.parse(this.responseText);
                    window.postMessage({ type: 'YEMEKSEPETI_ORDER', payload: data }, '*');
                } catch(e) {}
            }
        });
        origSend.apply(this, arguments);
    };
})();
