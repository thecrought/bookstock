import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
const supa = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let books=[],stock=[],movements=[],user=null,view='dashboard',scanner=null;
let titleCatalogue=JSON.parse(localStorage.getItem('bookstock_title_catalogue')||'[]');
const total=id=>stock.filter(s=>s.book_id===id).reduce((n,s)=>n+s.quantity,0);
const locations=id=>stock.filter(s=>s.book_id===id&&s.quantity>0);
const tabs=[['dashboard','Dashboard'],['receive','Receive'],['inventory','Inventory'],['pick','Pick'],['history','History']];
function notice(msg,bad=false){$('notice').innerHTML=`<p class="${bad?'alert':'success'}">${esc(msg)}</p>`;}
function busy(msg){$('app').innerHTML=`<div class="panel">${esc(msg)}</div>`;}
async function refresh(){
 const [b,s,m]=await Promise.all([supa.from('books').select('*').order('title'),supa.from('stock').select('*'),supa.from('stock_movements').select('*').order('created_at',{ascending:false}).limit(300)]);
 for(const r of [b,s,m])if(r.error)throw r.error;
 books=b.data;stock=s.data;movements=m.data;render();
}
function login(){ $('nav').innerHTML='';$('app').innerHTML=`<div class="panel"><h2>Sign in to BookStock</h2><p class="muted">Use the email and password you created under Supabase Authentication → Users.</p><label>Email</label><input id="email" type="email" autocomplete="username"><label>Password</label><input id="password" type="password" autocomplete="current-password"><p><button class="primary" id="login">Sign in</button></p><div id="loginStatus"></div></div>`;
 $('login').onclick=async()=>{ $('login').disabled=true;const {error}=await supa.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('login').disabled=false;if(error){$('loginStatus').textContent=error.message;return}await init()}; }
async function init(){ const {data:{user:u}}=await supa.auth.getUser();user=u;if(!user){login();return}busy('Loading cloud inventory…');try{await refresh()}catch(e){busy('Unable to load inventory: '+e.message)}}
function go(v){stopScan();view=v;render()}
function render(){ $('notice').innerHTML='';$('nav').innerHTML=tabs.map(([id,label])=>`<button data-tab="${id}" class="${view===id?'active':''}">${label}</button>`).join('')+'<button id="signout">Sign out</button>';
 document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>go(x.dataset.tab));$('signout').onclick=async()=>{await supa.auth.signOut();user=null;login()};
 if(view==='dashboard')$('app').innerHTML=`<h2>Dashboard</h2><div class="stats"><div class="panel">Titles<div class="stat">${books.length}</div></div><div class="panel">Copies<div class="stat">${stock.reduce((n,s)=>n+s.quantity,0)}</div></div><div class="panel">Bins in use<div class="stat">${new Set(stock.filter(s=>s.quantity>0).map(s=>s.bin_code)).size}</div></div></div><div class="panel"><button class="primary" id="newReceive">Receive a book</button> <button id="newPick">Pick a book</button></div>`;
 if(view==='receive')$('app').innerHTML=`<h2>Receive Books</h2><div class="panel"><label>2. Title *</label><input id="title" placeholder="Започнете да пишете заглавие" autocomplete="off"><div id="titleSuggestions"></div><p class="muted">Import your book-title list once on this device to enable suggestions.</p><input id="catalogueFile" type="file" accept=".md,.txt,.csv,text/plain,text/markdown,text/csv"><p class="muted" id="catalogueCount"></p><label>Author</label><input id="author" placeholder="Автор"><label>Quantity *</label><input id="qty" type="number" min="1" step="1" value="1"><label>3. Scan destination bin QR *</label><div class="row"><input id="bin" placeholder="1A" autocapitalize="characters"><button id="scan">Scan QR</button></div><div id="qr-reader"></div><p class="muted">The scanned bin receives these copies, even when the title exists in another bin.</p><button class="primary" id="receive">Confirm and receive</button></div>`;
 if(view==='inventory'||view==='pick')$('app').innerHTML=`<h2>${view==='pick'?'Pick Books':'Inventory'}</h2><div class="panel"><input id="search" placeholder="Search title or author"><div id="results"></div></div>`;
 if(view==='history')$('app').innerHTML=`<h2>Stock history</h2><div class="panel">${movements.map(m=>{const b=books.find(b=>b.id===m.book_id);return `<div class="book"><b>${esc(m.movement_type)}</b> · ${esc(b?.title||'Unknown book')}<div class="muted">${esc(m.bin_code)} · ${m.quantity_delta>0?'+':''}${m.quantity_delta} · ${new Date(m.created_at).toLocaleString()}</div></div>`}).join('')||'No movements yet.'}</div>`;
 if($('newReceive'))$('newReceive').onclick=()=>go('receive');if($('newPick'))$('newPick').onclick=()=>go('pick');if($('catalogueFile'))$('catalogueFile').onchange=importTitleCatalogue;if($('title'))$('title').oninput=showTitleSuggestions;if($('catalogueCount'))$('catalogueCount').textContent=titleCatalogue.length+' catalogue entries available on this device.';if($('scan'))$('scan').onclick=()=>scan(v=>$('bin').value=v);if($('receive'))$('receive').onclick=receive;
 if($('search')){$('search').oninput=results;results()}
}
function normalizeTitle(s){return String(s||'').toLocaleLowerCase('bg').normalize('NFKC').replace(/\s+/g,' ').trim()}
function parseCatalogueLine(line){
 let s=line.trim();
 if(!s.startsWith('|')||/^\|\s*[-: ]+\|?$/.test(s))return '';
 s=s.replace(/^\|/,'').replace(/\|\s*$/,'').replace(/\s+/g,' ').trim();
 return s.length>2?s:'';
}
async function importTitleCatalogue(e){
 const file=e.target.files?.[0];if(!file)return;
 try{
  const raw=await file.text();
  const lines=raw.split(/\r?\n/);
  const parsed=lines.map(parseCatalogueLine).filter(Boolean);
  if(!parsed.length){notice('No book titles detected. Please upload the original Markdown table.',true);return}
  titleCatalogue=[...new Map(parsed.map(s=>[normalizeTitle(s),s])).values()];
  localStorage.setItem('bookstock_title_catalogue',JSON.stringify(titleCatalogue));
  $('catalogueCount').textContent=titleCatalogue.length+' catalogue entries available on this device.';
  showTitleSuggestions();
  notice('Imported '+titleCatalogue.length+' catalogue entries. Start typing a title.');
 }catch(err){notice('Could not import list: '+err.message,true)}
}
function showTitleSuggestions(){
 const q=normalizeTitle($('title')?.value),target=$('titleSuggestions');
 if(!target)return;
 if(q.length<2){target.innerHTML='';return}
 const matches=titleCatalogue.filter(s=>normalizeTitle(s).includes(q)).slice(0,12);
 target.innerHTML=matches.map((s,i)=>'<button type="button" class="suggestion" data-suggest="'+i+'" style="display:block;width:100%;text-align:left;margin:4px 0;white-space:normal">'+esc(s)+'</button>').join('');
 target.querySelectorAll('[data-suggest]').forEach(btn=>btn.onclick=()=>{
  const entry=matches[Number(btn.dataset.suggest)];
  // The source combines titles and authors in one cell, often with multiple periods.
  // Keep the full source entry editable rather than guessing a wrong title/author split.
  $('title').value=entry;
  target.innerHTML='';
 });
}
async function scan(onRead){await stopScan();try{scanner=new Html5Qrcode('qr-reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},txt=>{onRead(txt.trim().toUpperCase());stopScan()})}catch(e){notice('Camera unavailable. Enter the bin code manually.',true)}}
async function stopScan(){if(scanner){const s=scanner;scanner=null;try{await s.stop()}catch{}try{s.clear()}catch{}}}
async function receive(){const title=$('title').value.trim(),author=$('author').value.trim(),bin=$('bin').value.trim().toUpperCase(),qty=Number($('qty').value);if(!title||!bin||!Number.isSafeInteger(qty)||qty<1){notice('Enter a title, bin and positive whole-number quantity.',true);return}
 $('receive').disabled=true;try{let book=books.find(b=>b.title.trim().toLocaleLowerCase()===title.toLocaleLowerCase()&&b.author.trim().toLocaleLowerCase()===author.toLocaleLowerCase());if(!book){const {data,error}=await supa.from('books').insert({title,author}).select().single();if(error)throw error;book=data}
 const {error}=await supa.rpc('change_stock',{p_book_id:book.id,p_bin_code:bin,p_delta:qty});if(error)throw error;await refresh();notice(`Received ${qty} copies into bin ${bin}.`)}catch(e){notice('Could not receive stock: '+e.message,true)}finally{const btn=$('receive');if(btn)btn.disabled=false}}
function results(){const q=$('search').value.trim().toLocaleLowerCase();const matches=books.filter(b=>(b.title+' '+b.author+' '+(b.isbn||'')).toLocaleLowerCase().includes(q));$('results').innerHTML=matches.map(b=>`<div class="book"><b>${esc(b.title)}</b><div class="muted">${esc(b.author)}</div><p>${total(b)} copies · ${locations(b.id).map(s=>`${esc(s.bin_code)}: ${s.quantity}`).join(' · ')||'Out of stock'}</p><button data-book="${b.id}">${view==='pick'?'Pick copies':'View / move stock'}</button></div>`).join('')||'<p class="muted">No matching books.</p>';document.querySelectorAll('[data-book]').forEach(btn=>btn.onclick=()=>detail(btn.dataset.book))}
function detail(id){const b=books.find(b=>b.id===id),loc=locations(id);if(!b)return;const isPick=view==='pick';$('results').innerHTML=`<h3>${esc(b.title)}</h3><p>${loc.map(s=>`${esc(s.bin_code)}: ${s.quantity}`).join(' · ')||'No available copies'}</p><label>${isPick?'Pick from bin':'Move from bin'}</label><select id="from">${loc.map(s=>`<option value="${esc(s.bin_code)}">${esc(s.bin_code)} (${s.quantity})</option>`).join('')}</select>${isPick?'':`<label>Move to bin</label><div class="row"><input id="to" placeholder="2B"><button id="scanTo">Scan QR</button></div><div id="qr-reader"></div>`}<label>Quantity</label><input id="amount" type="number" min="1" step="1" value="1"><p><button class="primary" id="confirm">${isPick?'Confirm picked':'Move stock'}</button> <button id="cancel">Back</button></p>`;
 $('cancel').onclick=results;if($('scanTo'))$('scanTo').onclick=()=>scan(v=>$('to').value=v);$('confirm').onclick=async()=>{const from=$('from').value,n=Number($('amount').value),available=loc.find(s=>s.bin_code===from)?.quantity||0,to=isPick?null:$('to').value.trim().toUpperCase();if(!Number.isSafeInteger(n)||n<1||n>available||(!isPick&&(!to||to===from))){notice('Check quantity and bin location.',true);return} $('confirm').disabled=true;try{const fn=isPick?'change_stock':'transfer_stock';const args=isPick?{p_book_id:id,p_bin_code:from,p_delta:-n}:{p_book_id:id,p_from_bin:from,p_to_bin:to,p_quantity:n};const {error}=await supa.rpc(fn,args);if(error)throw error;await refresh();notice(isPick?'Pick recorded.':'Stock transferred.')}catch(e){notice(e.message,true);const btn=$('confirm');if(btn)btn.disabled=false}}}
init();
