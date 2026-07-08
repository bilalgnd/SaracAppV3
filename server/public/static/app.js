const colors=["#F44336","#9C27B0","#2196F3","#4CAF50","#FFC107","#FF9800","#795548","#FFFFFF"];
const ingredients_list=["Soğan","Domates","Patates","Ketçap","Mayonez","Turşu"];
const free_extras_list=["SadeEt","Soslu","Gemi","Kayık"];
const payment_list=["POS","NAKİT","Paket","Dükkaniçi"];

let currentColor=localStorage.getItem('waiterColor')||"";
let menuData={categories:[],ekstralar:{}};
let activeTables=[];
let draft_items=[];
let active_table_name=null;
let active_order_note="";
let is_order_screen_open=false;
let ws=null;

//Elements
const topAppBar=document.getElementById('topAppBar');
const appTitle=document.getElementById('appTitle');
const kasaStatus=document.getElementById('kasaStatus');
const backBtn=document.getElementById('backBtn');
const tabRow=document.getElementById('tabRow');
const menuArea=document.getElementById('menuArea');
const masalarArea=document.getElementById('masalarArea');
const masalarList=document.getElementById('masalarList');
const fabMasalar=document.getElementById('fabMasalar');
const bottomAppBar=document.getElementById('bottomAppBar');
const babTitle=document.getElementById('babTitle');
const babSubtitle=document.getElementById('babSubtitle');
const productSheet=document.getElementById('productSheet');
const sheetOverlay=document.getElementById('sheetOverlay');

let currentProduct=null;
let currentQty=1;
let currentOption=null;
let currentDrinks={};

//Stateforchips
let selected_notes={};
let selected_additions={};
let selected_paid_extras={};
let selected_free_extras={};
let selected_payments={};

function enableDragScroll(slider){
if(!slider)return;
let isDown=false;
let startY;
let scrollTop;

slider.addEventListener('mousedown',(e)=>{
isDown=true;
startY=e.pageY-slider.offsetTop;
scrollTop=slider.scrollTop;
});
slider.addEventListener('mouseleave',()=>{isDown=false;});
slider.addEventListener('mouseup',()=>{isDown=false;});
slider.addEventListener('mousemove',(e)=>{
if(!isDown)return;
e.preventDefault();
const y=e.pageY-slider.offsetTop;
const walk=(y-startY)*1.5;
slider.scrollTop=scrollTop-walk;
});
}

function init(){
initColorSettings();
if (localStorage.getItem('API_TOKEN') && localStorage.getItem('API_TOKEN') !== '123456') {
  fetchMenu();
  connectWebSocket();
}

enableDragScroll(menuArea);
enableDragScroll(masalarList);
enableDragScroll(productSheet);

fabMasalar.onclick=()=>open_tables_screen();
backBtn.onclick=()=>close_tables_screen();
document.getElementById('babCancel').onclick=cancelActiveOrder;
document.getElementById('babSend').onclick=sendOrder;

document.getElementById('qtyMinus').onclick=()=>{if(currentQty>1){currentQty--;updateSheetPrice();}};
document.getElementById('qtyPlus').onclick=()=>{currentQty++;updateSheetPrice();};
sheetOverlay.onclick=closeProductSheet;
document.getElementById('addToCartBtn').onclick=addProductToDraft;
}

function initColorSettings(){
const grid=document.getElementById('colorGrid');
colors.forEach(c=>{
const circle=document.createElement('div');
circle.className='color-circle'+(c===currentColor?'selected':'');
circle.style.background=c;
circle.onclick=()=>{
document.querySelectorAll('.color-circle').forEach(el=>el.classList.remove('selected'));
circle.classList.add('selected');
currentColor=c;
localStorage.setItem('waiterColor',c);
};
grid.appendChild(circle);
});

document.getElementById('settingsBtn').onclick=()=>{
document.getElementById('settingsModal').classList.add('open');
document.getElementById('settingsOverlay').classList.add('open');
};

function fallbackCopyTextToClipboard(text) {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand('copy');
    if (successful) {
      alert("TV Linki Kopyalandı:\n" + text);
    } else {
      alert("Otomatik kopyalama desteklenmiyor, lütfen manuel kopyalayın:\n" + text);
    }
  } catch (err) {
    alert("Kopyalama başarısız oldu:\n" + text);
  }

  document.body.removeChild(textArea);
}

const copyTvLinkBtn = document.getElementById('copyTvLinkBtn');
if (copyTvLinkBtn) {
  copyTvLinkBtn.onclick = async () => {
    try {
      const res = await fetch(`/tv_link`, {
        headers: {
          'Authorization': `Bearer ${window.API_TOKEN || ''}`
        }
      });
      const data = await res.json();
      if (data.tvLink) {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(data.tvLink);
          alert("TV Linki Kopyalandı:\n" + data.tvLink);
        } else {
          fallbackCopyTextToClipboard(data.tvLink);
        }
      } else {
        alert("TV Linki henüz hazır değil veya sunucuda bir sorun var.");
      }
    } catch (e) {
      alert("TV Linki alınamadı! Hata: " + e.message);
    }
  };
}

document.getElementById('closeSettingsBtn').onclick=()=>{
document.getElementById('settingsModal').classList.remove('open');
document.getElementById('settingsOverlay').classList.remove('open');
};
}

async function fetchMenu(){
try{
const res=await fetch('/menu', { headers: { 'Authorization': 'Bearer ' + (window.API_TOKEN || '') } });
const data=await res.json();

    menuData={
      categories:data.categories||[],
      ekstralar:data.extras||{}
    };
    renderTabs();
    if (menuData.categories.length > 0) {
      renderMenu(menuData.categories[0].id || menuData.categories[0].name);
    }
}catch(e){
console.error("Menufetcherror",e);
}
}

let pingInterval;
let pongTimeout;
let isOffline = false;

function showOfflineOverlay() {
    if (isOffline) return;
    isOffline = true;
    let overlay = document.getElementById('offlineOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'offlineOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;text-align:center;font-weight:bold;flex-direction:column;';
        overlay.innerHTML = '<div>Bağlantı Koptu</div><div style="font-size:16px;margin-top:10px;">Yeniden bağlanılıyor...</div><div style="font-size:12px;margin-top:5px;opacity:0.7;">Lütfen bekleyin, işlem yapılamaz.</div>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

function hideOfflineOverlay() {
    if (!isOffline) return;
    isOffline = false;
    let overlay = document.getElementById('offlineOverlay');
    if (overlay) overlay.style.display = 'none';
}

function connectWebSocket(){
ws=new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?token=' + (window.API_TOKEN || ''));
ws.onopen=()=>{
kasaStatus.innerText="🟢KasaBağlı";
kasaStatus.classList.add('online');

fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + (window.API_TOKEN || '') }
}).then(res => res.json()).then(data => {
    if (data.token) window.API_TOKEN = data.token;
    fetchMenu();
    hideOfflineOverlay();
}).catch(() => { hideOfflineOverlay(); });

clearInterval(pingInterval);
pingInterval = setInterval(()=>{
    if(ws.readyState===WebSocket.OPEN) {
        ws.send("ping");
        clearTimeout(pongTimeout);
        pongTimeout = setTimeout(() => {
            ws.close();
        }, 6000);
    }
}, 3000);
};
ws.onmessage=(e)=>{
if (e.data === 'pong') {
    clearTimeout(pongTimeout);
    return;
}
activeTables=JSON.parse(e.data);
fabMasalar.innerText=`Masalar(${activeTables.length})`;
if(is_order_screen_open)render_tables_list();
};
ws.onclose=()=>{
kasaStatus.innerText="🔴KasaÇevrimdışı";
kasaStatus.classList.remove('online');
showOfflineOverlay();
clearTimeout(pongTimeout);
clearInterval(pingInterval);
setTimeout(connectWebSocket,3000);
};
ws.onerror=()=>ws.close();
}

function getCardColorClass(name, tab){
  if(tab === 'kampanya') return "card-purple";
  if(tab === 'icecekler' || tab === 'drinks' || (typeof tab === 'string' && tab.toUpperCase().includes('ECEK'))) {
    const drinkClass = getDrinkColorClass(name);
    return drinkClass || "";
  }

  name = name.toLocaleLowerCase('tr-TR');
  
  if(name.includes('tombik')) return "card-green";
  if(name.includes('usul')) return "card-red";
  if(name.includes('xl dürüm') || name.includes('xl durum')) return "card-dark-yellow";
  if(name.includes('dürüm') || name.includes('durum') || name.includes('döneri')) return "card-yellow";
  if(["porsiyon", "beyti", "iskender", "pilav üstü", "pilav ustu"].some(x => name.includes(x))) return "card-dark-red";
  
  return "";
}

function getDrinkColorClass(name){
  name=name.toLowerCase().replace(/\s+/g,'');
  if(name.includes("zero"))return"cola-zero";
  if(name.includes("cocacola")||name.includes("şişekola")||name.includes("sisekola")||name.includes("kutukola")||name.includes("kola"))return"cola-red";
  if(name.includes("sprite"))return"sprite-green";
  if(name.includes("fanta"))return"fanta-yellow";
  if(name.includes("ayran"))return"ayran-white";
  if(name.includes("su")&&!name.includes("salgam")&&!name.includes("şalgam"))return"water-blue";
  if(name.includes("soda"))return"soda-green";
  if(name.includes("salgam")||name.includes("şalgam"))return"salgam-purple";
  return"";
}

function renderTabs() {
  tabRow.innerHTML = '';
  menuData.categories.forEach((cat, index) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (index === 0 ? ' active' : '');
    const tabId = cat.id || cat.name;
    btn.dataset.tab = tabId;
    
    let icon = '🍔';
    const n = cat.name.toLowerCase();
    if(n.includes('tavuk')) icon = '🍗';
    else if(n.includes('kampanya')) icon = '🏷️';
    else if(n.includes('içecek') || n.includes('icecek') || cat.id === 'drinks') icon = '🥤';
    
    btn.innerHTML = `<span class="tab-icon">${icon}</span><span class="tab-text">${cat.name.toUpperCase()}</span>`;
    btn.onclick = (e) => {
      document.querySelectorAll('.tab-btn.active').forEach(el => el.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderMenu(tabId);
    };
    tabRow.appendChild(btn);
  });
}

function renderMenu(tab){
menuArea.innerHTML='';
const category = menuData.categories.find(c => c.id === tab || c.name === tab);
const items = category ? category.items : [];
items.forEach(item=>{
const card=document.createElement('div');
card.className='card '+getCardColorClass(item.name, tab);
card.innerHTML=`
<div class="card-title">${item.name}</div>
<div class="card-price">${item.options[0].price}₺</div>
`;
card.onclick=()=>openProductSheet(item,tab==='icecekler');
menuArea.appendChild(card);
});
}

function renderChipGroup(containerId,items,stateObj,isNegative,colorClass,onUpdate){
const container=document.getElementById(containerId);
container.innerHTML='';
items.forEach(item=>{
let label=typeof item==='string'?item:item.label;
let key=typeof item==='string'?item:item.key;
if(isNegative){
let n=label;
label=n+"sız";
if(n==="Soğan")label="Soğansız";
if(n==="Domates")label="Domatessiz";
if(n==="Patates")label="Patatessiz";
if(n==="Ketçap")label="Ketçapsız";
if(n==="Mayonez")label="Mayonezsiz";
if(n==="Turşu")label="Turşusuz";
}else if(containerId==='icerikEkleContainer'){
let n=label;
label=n+"lı";
if(n==="Soğan")label="Soğanlı";
if(n==="Domates")label="Domatesli";
if(n==="Patates")label="Patatesli";
if(n==="Ketçap")label="Ketçaplı";
if(n==="Mayonez")label="Mayonezli";
if(n==="Turşu")label="Turşulu";
}

const chip=document.createElement('div');
  chip.className='chip '+colorClass;
chip.innerText=label;
chip.onclick=()=>{
stateObj[key]=!stateObj[key];
if(stateObj[key])chip.classList.add('selected');
else chip.classList.remove('selected');

//MutuallyexclusivelogicforicerikCikarandicerikEkle
  if(containerId==='icerikCikarContainer'&&stateObj[key]){
  if(selected_additions[key]){
  selected_additions[key]=false;
  renderChipGroup('icerikEkleContainer',ingredients_list,selected_additions,false,'chip-pink');
  }
  }else if(containerId==='icerikEkleContainer'&&stateObj[key]){
  if(selected_notes[key]){
  selected_notes[key]=false;
  renderChipGroup('icerikCikarContainer',ingredients_list,selected_notes,true,'chip-purple');
  }
  }

if(onUpdate)onUpdate();
};
container.appendChild(chip);
});
}

function openProductSheet(item,isDrink){
currentProduct=item;
currentQty=1;
currentOption=item.options[0];
currentDrinks={};
selected_notes={};
selected_paid_extras={};
selected_free_extras={};
selected_payments={};

document.getElementById('sheetProductName').innerText=item.name;
document.getElementById('qtyText').innerText=currentQty;

const optsContainer=document.getElementById('optionsContainer');
optsContainer.innerHTML='';
item.options.forEach(sec=>{
const chip=document.createElement('div');
  chip.className='chip '+(sec===currentOption?'selected':'');
let gramajAdi=sec.portion||sec.portion;
  chip.innerText=gramajAdi==='Standart'?`${sec.price} ₺`:`${gramajAdi} (${sec.price} ₺)`;
chip.onclick=()=>{
currentOption=sec;
Array.from(optsContainer.children).forEach(c=>c.classList.remove('selected'));
chip.classList.add('selected');
updateSheetPrice();
};
optsContainer.appendChild(chip);
});

const icerikCikarSec=document.getElementById('icerikCikarSection');
const drinksSec=document.getElementById('drinksSection');

  if(!isDrink){
  icerikCikarSec.classList.remove('hidden');
  renderChipGroup('icerikCikarContainer',ingredients_list,selected_notes,true,'chip-purple');
  selected_additions={};
  renderChipGroup('icerikEkleContainer',ingredients_list,selected_additions,false,'chip-pink');
  
  const ucretliArr=Object.keys(menuData.ekstralar||{}).map(k=>({key:k,label:`${k} (+${menuData.ekstralar[k]} ₺)`}));
  renderChipGroup('ucretliEkstralarContainer',ucretliArr,selected_paid_extras,false,'chip-orange',updateSheetPrice);
  
  renderChipGroup('ucretsizEkstralarContainer',free_extras_list,selected_free_extras,false,'chip-teal');
  renderChipGroup('odemeContainer',payment_list,selected_payments,false,'chip-teal');

  const drinksCat = menuData.categories.find(c => c.id === 'drinks' || c.name.toUpperCase().includes('ECEK'));
  const drinksMenu = drinksCat ? drinksCat.items : [];
  
if(drinksMenu.length>0){
drinksSec.classList.remove('hidden');
const dCont=document.getElementById('drinksContainer');
dCont.innerHTML='';
drinksMenu.forEach(ic=>{
const dBtn=document.createElement('button');
  dBtn.className='drink-btn '+getDrinkColorClass(ic.name);
dBtn.innerText=ic.name;
dBtn.onclick=()=>{
currentDrinks[ic.name]=(currentDrinks[ic.name]||0)+1;
renderDrinksList(dCont);
updateSheetPrice();
};
dCont.appendChild(dBtn);
});
}else{
drinksSec.classList.add('hidden');
}
}else{
icerikCikarSec.classList.add('hidden');
drinksSec.classList.add('hidden');
}

document.getElementById('noteInput').value='';

const masaSec=document.getElementById('masaAdiSection');
if(active_table_name){
masaSec.classList.add('hidden');
}else{
masaSec.classList.remove('hidden');
document.getElementById('masaInput').value='';
}

updateSheetPrice();
productSheet.classList.add('open');
sheetOverlay.classList.add('open');
}

function renderDrinksList(container){
Array.from(container.children).forEach(btn=>{
const name=btn.innerText.replace(/[0-9]/g,'').trim();
const count=currentDrinks[name]||0;
if(count>0){
btn.classList.add('selected');
btn.innerHTML=`${name}<div class="drink-badge">${count}</div>`;
}else{
btn.classList.remove('selected');
btn.innerText=name;
}
});
}

function updateSheetPrice(){
let ucretliFiyat=0;
Object.keys(selected_paid_extras).forEach(k=>{
if(selected_paid_extras[k])ucretliFiyat+=(menuData.ekstralar[k]||0);
});

let basePrice=(currentOption.price+ucretliFiyat)*currentQty;
let drinkPrice=0;

const drinksCat = menuData.categories.find(c => c.id === 'drinks' || c.name.toUpperCase().includes('ECEK'));
const drinksMenu = drinksCat ? drinksCat.items : [];

if(drinksMenu.length>0){
drinksMenu.forEach(ic=>{
if(currentDrinks[ic.name]){
drinkPrice+=(currentDrinks[ic.name]*ic.options[0].price);
}
});
}

const total=basePrice+drinkPrice;
document.getElementById('addToCartBtn').innerText=`SiparişeEkle(${total}₺)`;
}

function closeProductSheet(){
  productSheet.classList.remove('open');
  sheetOverlay.classList.remove('open');
  setTimeout(() => { productSheet.style.transform = ''; }, 300);
}

function addProductToDraft(){
const siparisNotu=document.getElementById('noteInput').value.trim();
let tableInput=document.getElementById('masaInput').value.trim();
let globalNote=document.getElementById('orderNoteInputGlobal') ? document.getElementById('orderNoteInputGlobal').value.trim() : "";

if(!active_table_name){
if(!tableInput)tableInput="YeniSipariş";
active_table_name=tableInput;
active_order_note=globalNote;
enterActiveTableMode();
}

const tumNotlar=[];
Object.keys(selected_notes).forEach(k=>{
if(selected_notes[k]){
let label=k+"sız";
if(k==="Soğan")label="Soğansız";
if(k==="Domates")label="Domatessiz";
if(k==="Patates")label="Patatessiz";
if(k==="Ketçap")label="Ketçapsız";
if(k==="Mayonez")label="Mayonezsiz";
if(k==="Turşu")label="Turşusuz";
tumNotlar.push(label);
}
});
Object.keys(selected_additions).forEach(k=>{
if(selected_additions[k]){
let label=k+"lı";
if(k==="Soğan")label="Soğanlı";
if(k==="Domates")label="Domatesli";
if(k==="Patates")label="Patatesli";
if(k==="Ketçap")label="Ketçaplı";
if(k==="Mayonez")label="Mayonezli";
if(k==="Turşu")label="Turşulu";
tumNotlar.push(label);
}
});
Object.keys(selected_free_extras).forEach(k=>{if(selected_free_extras[k])tumNotlar.push(k);});
Object.keys(selected_paid_extras).forEach(k=>{if(selected_paid_extras[k])tumNotlar.push(k);});
Object.keys(selected_payments).forEach(k=>{if(selected_payments[k])tumNotlar.push(k);});
if(siparisNotu)tumNotlar.push(siparisNotu);

const birlesikNot=tumNotlar.join(",");

let ucretliFiyat=0;
Object.keys(selected_paid_extras).forEach(k=>{
if(selected_paid_extras[k])ucretliFiyat+=(menuData.ekstralar[k]||0);
});

let anlikBirimFiyat=currentOption.price+ucretliFiyat;
let gramajAdi=currentOption.portion||currentOption.portion;

for(let i=0;i<currentQty;i++){
draft_items.push({
name:currentProduct.name,
portion:gramajAdi,
price:anlikBirimFiyat,
notes:birlesikNot
});
}

const drinksCat = menuData.categories.find(c => c.id === 'drinks' || c.name.toUpperCase().includes('ECEK'));
const drinksMenu = drinksCat ? drinksCat.items : [];

if(drinksMenu.length>0){
drinksMenu.forEach(ic=>{
if(currentDrinks[ic.name]){
let icGramaj=ic.options[0].portion||ic.options[0].portion;
for(let i=0;i<currentDrinks[ic.name];i++){
draft_items.push({
name:ic.name,
portion:icGramaj,
price:ic.options[0].price,
notes:""
});
}
}
});
}

updateBottomAppBar();
closeProductSheet();
}

function enterActiveTableMode(){
topAppBar.classList.add('active-mode');
appTitle.innerText=`${active_table_name}İlave`;
fabMasalar.classList.add('hidden');
bottomAppBar.classList.remove('hidden');
}

function cancelActiveOrder(){
active_table_name=null;
active_order_note="";
draft_items=[];
topAppBar.classList.remove('active-mode');
appTitle.innerText="SARAÇOĞLUDÖNER";
fabMasalar.classList.remove('hidden');
bottomAppBar.classList.add('hidden');
}

function updateBottomAppBar(){
babTitle.innerText=`Masa:${active_table_name}`;
const total=draft_items.reduce((sum,i)=>sum+i.price,0);
babSubtitle.innerText=`${draft_items.length}Ürün-${total}₺`;
}

function open_tables_screen(){
is_order_screen_open=true;
appTitle.innerText="AçıkMasalar";
kasaStatus.classList.add('hidden');
document.getElementById('settingsBtn').classList.add('hidden');
if(document.getElementById('copyTvLinkBtn')) document.getElementById('copyTvLinkBtn').classList.add('hidden');
backBtn.classList.remove('hidden');
tabRow.classList.add('hidden');
menuArea.classList.add('hidden');
fabMasalar.classList.add('hidden');
masalarArea.classList.remove('hidden');
render_tables_list();
}

function close_tables_screen(){
is_order_screen_open=false;
appTitle.innerText="SARAÇOĞLUDÖNER";
kasaStatus.classList.remove('hidden');
document.getElementById('settingsBtn').classList.remove('hidden');
if(document.getElementById('copyTvLinkBtn')) document.getElementById('copyTvLinkBtn').classList.remove('hidden');
backBtn.classList.add('hidden');
tabRow.classList.remove('hidden');
menuArea.classList.remove('hidden');
if(!active_table_name)fabMasalar.classList.remove('hidden');
masalarArea.classList.add('hidden');
}

window.deleteItem=function(customer_name,index){
if(!confirm('Buürünüsilmekistediğinizeeminmisiniz?'))return;
const table=activeTables.find(t=>t.customer_name===customer_name);
if(!table)return;
table.items.splice(index,1);

if(table.items.length===0){
fetch('/close_bill',{method:'POST',headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + (window.API_TOKEN || '')},body:JSON.stringify({customer_name:customer_name})});
}else{
const total=table.items.reduce((sum,i)=>sum+i.price,0);

const data={customer_name:customer_name,items:table.items,total_amount:total,color:table.color};
fetch('/siparis',{method:'POST',headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + (window.API_TOKEN || '')},body:JSON.stringify(data)});
}
};

window.editNote=function(customer_name,index){
const table=activeTables.find(t=>t.customer_name===customer_name);
if(!table)return;
const currentNote=table.items[index].notes||"";
const newNote=prompt("Yeninotugirin:",currentNote);
if(new Note!==null){
table.items[index].notes=new Note.trim();
const total=table.items.reduce((sum,i)=>sum+i.price,0);

const data={customer_name:customer_name,items:table.items,total_amount:total,color:table.color};
fetch('/siparis',{method:'POST',headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + (window.API_TOKEN || '')},body:JSON.stringify(data)});
}
};

window.togglePrepared=function(customer_name,current_status){
const new_status=current_status==='prepared'?'waiting':'prepared';
fetch('/update_status',{
method:'POST',
headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + (window.API_TOKEN || '')},
body:JSON.stringify({customer_name:customer_name,status:new _status})
});
};

function render_tables_list(){
masalarList.innerHTML='';
activeTables.forEach(t=>{
const card=document.createElement('div');
card.className='adisyon-card';
let itemsHtml=(t.items||[]).map((k,index)=>`
<div style="border-bottom:1px solid #444;padding: 10px 0;">
<div class="a-item"style="display:flex;justify-content:space-between;align-items:center;">
<div class="a-item-name"style="flex:1;">1x${k.name}${k.portion!=='Standart'?`(${k.portion})`:''}</div>
<div style="display:flex;align-items:center;gap:8px;">
<div class="a-item-price"style="margin-right:8px;">${k.price}₺</div>
<button class="btn-icon-small"onclick="editNote('${t.customer_name}',${index})">✏️</button>
<button class="btn-icon-small"onclick="deleteItem('${t.customer_name}',${index})"style="color:var(--danger);">🗑️</button>
</div>
</div>
${k.notes?`<div style="font-size:12px;color:#aaa;margin-top:4px;">*${k.notes}</div>`:''}
</div>
`).join('');

let colorIndicator=t.color?`<div style="width:16px;height:16px;border-radius:50%;background-color:${t.color};margin-right:8px;display:inline-block;vertical-align:middle;"></div>`:'';
let titlePrefix=t.status==='prepared'?'<span style="color:#4CAF50;font-weight:bold;margin-right:8px;">✔</span>':'';

card.innerHTML=`
<div class="adisyon-header"style="display:flex;align-items:center;justify-content:space-between;">
<div class="adisyon-title"style="display:flex;align-items:center;">
${colorIndicator}
${titlePrefix}${t.customer_name}${t.is_updated?'<span style="font-size:0.6em;color:#FF9800;margin-left:5px;">(Eklendi)</span>':''}
</div>
<div class="adisyon-time">${t.time||''}</div>
</div>
${t.order_note ? `<div style="color:#F44336; font-size:14px; margin-bottom:5px; white-space: pre-wrap;">📝 ${t.order_note}</div>` : ''}
<div class="adisyon-items">${itemsHtml}</div>
<div class="adisyon-footer"style="flex-direction:column;gap:12px;margin-top:8px;">
<div style="display:flex;justify-content:space-between;width:100%;">
<div class="adisyon-total"style="font-size:24px;">TOPLAM:${t.total_amount}₺</div>
</div>
<div style="display:grid;grid-template-columns:1fr1fr;gap:8px;width:100%;">
<button class="btn-ilave"style="background:#2196F3;">➕İlave</button>
<button class="btn-yazdir"style="background:#424242;">🖨️FişYazdır</button>
<button class="btn-tamam"style="background:#4CAF50;grid-column:span2;">💳Ödendi/Kapat</button>
</div>
</div>
`;

let pressTimer;
let isPressed=false;
let pStartY=0;

const startPress=(e)=>{
if(e.target.closest('button'))return;
isPressed=true;
pStartY=e.pageY||(e.touches&&e.touches[0].pageY)||0;
pressTimer=setTimeout(()=>{
if(isPressed){
isPressed=false;
if(navigator.vibrate)navigator.vibrate(50);
window.togglePrepared(t.customer_name,t.status);
}
},500);
};

const cancelPress=()=>{
isPressed=false;
clearTimeout(pressTimer);
};

const movePress=(e)=>{
if(!isPressed)return;
let currentY=e.pageY||(e.touches&&e.touches[0].pageY)||0;
if(Math.abs(currentY-pStartY)>10){
cancelPress();
}
};

card.addEventListener('mousedown',startPress);
card.addEventListener('touchstart',startPress,{passive:true});
card.addEventListener('mousemove',movePress);
card.addEventListener('touchmove',movePress,{passive:true});
card.addEventListener('mouseup',cancelPress);
card.addEventListener('mouseleave',cancelPress);
card.addEventListener('touchend',cancelPress);
card.addEventListener('touchcancel',cancelPress);

card.querySelector('.btn-ilave').onclick=()=>{
active_table_name=t.customer_name;
//MapbacktoTurkishkeysfordraft_itemssothe"SipariseEkle"screenworks
draft_items=[...(t.items||[])];
close_tables_screen();
enterActiveTableMode();
updateBottomAppBar();
};
card.querySelector('.btn-tamam').onclick=()=>{
fetch('/close_bill',{method:'POST',headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + (window.API_TOKEN || '')},body:JSON.stringify({customer_name:t.customer_name})});
};
card.querySelector('.btn-yazdir').onclick=()=>{
fetch('/yazdir',{method:'POST',headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + (window.API_TOKEN || '')},body:JSON.stringify({customer_name:t.customer_name})});
};
masalarList.appendChild(card);
});
}

async function sendOrder(){
if(draft_items.length===0)return;
const total=draft_items.reduce((sum,i)=>sum+i.price,0);
const m_adi=active_table_name;

//Maptoenglishkeysforserver


const data={
customer_name:m_adi==="YeniSipariş"?"":m_adi,
order_note:active_order_note,
items:draft_items,
total_amount:total,
color:currentColor
};
try{
const req=await fetch('/siparis',{
method:'POST',
headers:{'Content-Type':'application/json', 'Authorization':'Bearer ' + (window.API_TOKEN || '')},
body:JSON.stringify(data)
});
if(req.ok)cancelActiveOrder();
else alert("Gönderilemedi!Kasauygulamasındahataolabilir.");
}catch(e){
alert("Kasabağlantıhatası!");
}
}

init();

// --- DRAG TO CLOSE LOGIC ---
let isDraggingSheet = false;
let sheetStartY = 0;
let currentSheetY = 0;

const handleDragStart = (y, target) => {
    if (!productSheet.classList.contains('open')) return;
    if (productSheet.scrollTop > 0) return;
    if (['INPUT', 'BUTTON'].includes(target.tagName) || target.closest('button') || target.closest('.chips-container') || target.closest('.drinks-grid')) return;
    
    isDraggingSheet = true;
    sheetStartY = y;
    productSheet.style.transition = 'none';
};

const handleDragMove = (y, e) => {
    if (!isDraggingSheet) return;
    const deltaY = y - sheetStartY;
    if (deltaY > 0) {
        currentSheetY = deltaY;
        productSheet.style.transform = `translateY(${deltaY}px)`;
        if (e.cancelable) e.preventDefault();
    }
};

const handleDragEnd = () => {
    if (!isDraggingSheet) return;
    isDraggingSheet = false;
    productSheet.style.transition = 'transform 0.3s ease';
    if (currentSheetY > 80) {
        closeProductSheet();
    } else {
        productSheet.style.transform = 'translateY(0)';
    }
    currentSheetY = 0;
};

// Touch events
productSheet.addEventListener('touchstart', (e) => handleDragStart(e.touches[0].clientY, e.target), {passive: true});
productSheet.addEventListener('touchmove', (e) => handleDragMove(e.touches[0].clientY, e), {passive: false});
productSheet.addEventListener('touchend', handleDragEnd);

// Mouse events (for testing on desktop)
productSheet.addEventListener('mousedown', (e) => handleDragStart(e.clientY, e.target));
document.addEventListener('mousemove', (e) => handleDragMove(e.clientY, e));
document.addEventListener('mouseup', handleDragEnd);
