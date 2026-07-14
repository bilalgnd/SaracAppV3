import os
import sys
import json
import time
import base64
import urllib.request
import urllib.error
import datetime
import ctypes

def hide_console():
    try:
        whnd = ctypes.windll.kernel32.GetConsoleWindow()
        if whnd != 0:
            ctypes.windll.user32.ShowWindow(whnd, 0)
    except:
        pass

CONFIG_FILE = "ayarlar.json"
LOG_FILE = "trendyol_siparis_loglari.txt"
DATA_FILE = "trendyol_ham_veri.jsonl"

def log_message(msg):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"[{ts}] {msg}\n")

def test_credentials(supplier_id, api_key, api_secret):
    auth_str = f"{api_key}:{api_secret}"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    url = f"https://api.trendyol.com/sapigw/suppliers/{supplier_id}/orders?size=1"
    
    try:
        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Basic {auth_b64}")
        req.add_header("User-Agent", f"{supplier_id} - SaracAppLogger")
        response = urllib.request.urlopen(req, timeout=10)
        return True, "Basarili"
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return False, "HATA (401): Yetkisiz Erisim. Keyler YANLIS veya Siparis Okuma yetkisi YOK!"
        elif e.code == 429:
            return False, "HATA (429): Cok fazla hatali deneme yapildigi icin gecici olarak engellendi. Lutfen biraz bekleyip tekrar deneyin."
        else:
            return False, f"HATA ({e.code}): Trendyol API hatasi verdi."
    except Exception as e:
        return False, f"Baglanti Hatasi: 인터넷 veya Guvenlik Duvari sorunu olabilir -> {str(e)}"

def get_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    else:
        print("=========================================")
        print("    TRENDYOL SIPARIS DINLEYICI V2")
        print("=========================================")
        print("Bu program gun boyu siparis logu toplayacaktir.")
        
        while True:
            supplier_id = input("\nSatici (Supplier) ID: ").strip()
            api_key = input("API Key: ").strip()
            api_secret = input("API Secret: ").strip()
            
            print("\nBilgileriniz Trendyol ile dogrulaniyor, lutfen bekleyin...")
            success, msg = test_credentials(supplier_id, api_key, api_secret)
            
            if success:
                print("==================================================")
                print(">>> TEBRIKLER! Bilgiler dogru. Trendyol'a baglanildi. <<<")
                print("==================================================")
                cfg = {
                    "supplierId": supplier_id,
                    "apiKey": api_key,
                    "apiSecret": api_secret
                }
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(cfg, f, indent=4)
                
                print("\nProgram 5 saniye icinde kendini tamamen gizleyecek")
                print("ve arka planda siparis toplamaya baslayacaktir...")
                time.sleep(5)
                return cfg
            else:
                print("==================================================")
                print(msg)
                print("==================================================")
                print("Girdiginiz bilgiler HATALI. Lutfen dogru bilgileri girin.")

def main():
    cfg = get_config()
    
    hide_console() 
    
    log_message("Trendol Dinleyici arka planda baslatildi.")
    
    supplier_id = cfg["supplierId"]
    api_key = cfg["apiKey"]
    api_secret = cfg["apiSecret"]
    
    auth_str = f"{api_key}:{api_secret}"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    
    url = f"https://api.trendyol.com/sapigw/suppliers/{supplier_id}/orders?size=50"
    
    while True:
        try:
            req = urllib.request.Request(url)
            req.add_header("Authorization", f"Basic {auth_b64}")
            req.add_header("User-Agent", f"{supplier_id} - SaracAppLogger")
            
            response = urllib.request.urlopen(req, timeout=15)
            data = response.read().decode("utf-8")
            parsed = json.loads(data)
            
            if parsed.get("content") and len(parsed["content"]) > 0:
                with open(DATA_FILE, "a", encoding="utf-8") as rf:
                    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    rf.write(f"{ts} || {json.dumps(parsed)}\n")
                log_message(f"Siparis sorgulandi: {len(parsed['content'])} adet siparis bulundu ve veritabanina yazildi.")
            else:
                log_message("Siparis sorgulandi: Liste bos dondu.")
                
        except urllib.error.HTTPError as e:
            try:
                err_data = e.read().decode("utf-8")
                log_message(f"API Hatasi ({e.code}): {err_data}")
            except:
                log_message(f"API Hatasi ({e.code}): {e.reason}")
        except Exception as e:
            log_message(f"Baglanti Hatasi: {str(e)}")
            
        time.sleep(60)

if __name__ == "__main__":
    main()
