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
 if(view==='receive')$('app').innerHTML=`<h2>Receive Books</h2><div class="panel"><label>1. Scan ISBN barcode</label><div class="row"><input id="isbn" inputmode="numeric" placeholder="ISBN-13 (978...)" maxlength="13"><button id="scanIsbn">Scan ISBN</button></div><div id="isbn-reader"></div><p class="muted" id="isbnStatus">Scan the EAN-13 barcode on the back of your book, or type its ISBN.</p><div id="catalogueLinks"></div><p class="muted">Bulgarian bookstore results open in a separate tab. Copy the correct title and author into the fields below. Automatic extraction from these shops is not yet supported.</p><label>Optional: photograph cover for OCR</label><input type="file" id="photo" accept="image/*" capture="environment"><p class="muted" id="ocrStatus">Bulgarian OCR suggests text; always review it.</p><img id="preview" class="preview hidden" alt="Book cover"><label>2. Title *</label><input id="title" placeholder="Започнете да пишете заглавие" autocomplete="off"><div id="titleSuggestions"></div><p class="muted">Import your book-title list once on this device to enable suggestions.</p><input id="catalogueFile" type="file" accept=".md,.txt,.csv,text/plain,text/markdown,text/csv"><p class="muted" id="catalogueCount"></p><label>Author</label><input id="author" placeholder="Автор"><label>Quantity *</label><input id="qty" type="number" min="1" step="1" value="1"><label>3. Scan destination bin QR *</label><div class="row"><input id="bin" placeholder="1A" autocapitalize="characters"><button id="scan">Scan QR</button></div><div id="qr-reader"></div><p class="muted">The scanned bin receives these copies, even when the title exists in another bin.</p><button class="primary" id="receive">Confirm and receive</button></div>`;
 if(view==='inventory'||view==='pick')$('app').innerHTML=`<h2>${view==='pick'?'Pick Books':'Inventory'}</h2><div class="panel"><input id="search" placeholder="Search title or author"><div id="results"></div></div>`;
 if(view==='history')$('app').innerHTML=`<h2>Stock history</h2><div class="panel">${movements.map(m=>{const b=books.find(b=>b.id===m.book_id);return `<div class="book"><b>${esc(m.movement_type)}</b> · ${esc(b?.title||'Unknown book')}<div class="muted">${esc(m.bin_code)} · ${m.quantity_delta>0?'+':''}${m.quantity_delta} · ${new Date(m.created_at).toLocaleString()}</div></div>`}).join('')||'No movements yet.'}</div>`;
 if($('newReceive'))$('newReceive').onclick=()=>go('receive');if($('newPick'))$('newPick').onclick=()=>go('pick');if($('photo'))$('photo').onchange=ocr;if($('catalogueFile'))$('catalogueFile').onchange=importTitleCatalogue;if($('title'))$('title').oninput=showTitleSuggestions;if($('catalogueCount'))$('catalogueCount').textContent=titleCatalogue.length+' catalogue entries available on this device.';if($('isbn'))$('isbn').oninput=isbnChanged;if($('scanIsbn'))$('scanIsbn').onclick=()=>scanIsbn();if($('scan'))$('scan').onclick=()=>scan(v=>$('bin').value=v);if($('receive'))$('receive').onclick=receive;
 if($('search')){$('search').oninput=results;results()}
}
function normalizeTitle(s){return String(s||'').toLocaleLowerCase('bg').normalize('NFKC').replace(/\\s+/g,' ').trim()}
function parseCatalogueLine(line){
 let s=line.trim();
 if(!s.startsWith('|')||/^\\|\\s*[-: ]+\\|?$/.test(s))return '';
 s=s.replace(/^\\|/,'').replace(/\\|\\s*$/,'').replace(/\\s+/g,' ').trim();
 return s.length>2?s:'';
}
async function importTitleCatalogue(e){
 const file=e.target.files?.[0];if(!file)return;
 try{
  const raw=await file.text();
  const lines=raw.split(/\\r?\\n/);
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
function isbnValid(value){const s=String(value).replace(/[\s-]/g,'');if(!/^97[89]\d{10}$/.test(s))return false;let sum=0;for(let i=0;i<13;i++)sum+=Number(s[i])*(i%2?3:1);return sum%10===0}
function isbnChanged(){const input=$('isbn');if(!input)return;const isbn=input.value.replace(/[\s-]/g,'');const status=$('isbnStatus'),links=$('catalogueLinks');if(!isbn){links.innerHTML='';status.textContent='Scan the EAN-13 barcode on the back of your book, or type its ISBN.';return}if(!isbnValid(isbn)){links.innerHTML='';status.textContent='Enter a valid 13-digit ISBN (including check digit).';return}input.value=isbn;const existing=books.find(b=>b.isbn===isbn);if(existing){$('title').value=existing.title;$('author').value=existing.author;status.textContent='Found in your BookStock inventory. Confirm the details and scan the destination bin.'}else {status.textContent='Searching book databases automatically…';lookupIsbn(isbn)};const q=encodeURIComponent('"'+isbn+'"');links.innerHTML='<p><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q='+q+'+site%3Aozone.bg">Search Ozone.bg</a> · <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q='+q+'+site%3Abookshop.bg">Search Bookshop.bg</a> · <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q='+q+'+site%3Aorangecenter.bg">Search OrangeCenter.bg</a></p>'}
async function lookupIsbn(isbn){
 const status=$('isbnStatus');const title=$('title'),author=$('author');
 const get=async(url)=>{const response=await fetch(url);if(!response.ok)throw Error('Lookup failed');return response.json()};
 let match=null;
 try{const g=await get('https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent('isbn:'+isbn)+'&maxResults=5');const item=(g.items||[]).find(x=>(x.volumeInfo?.industryIdentifiers||[]).some(i=>i.identifier===isbn));if(item?.volumeInfo?.title)match={title:item.volumeInfo.title,author:(item.volumeInfo.authors||[]).join(', '),source:'Google Books'}}catch{}
 if(!match)try{const o=await get('https://openlibrary.org/api/books?bibkeys=ISBN:'+isbn+'&jscmd=data&format=json');const item=o['ISBN:'+isbn];if(item?.title)match={title:item.title,author:(item.authors||[]).map(a=>a.name).join(', '),source:'Open Library'}}catch{}
 if(!$('isbn')||$('isbn').value!==isbn)return;
 if(match){if(!title.value.trim())title.value=match.title;if(!author.value.trim())author.value=match.author;status.textContent='Found in '+match.source+'. Verify Bulgarian title and edition before receiving.'}
 else status.textContent='No automatic database match. Use Bulgarian bookstore links below and confirm details manually.';
}
async function scanIsbn(){await stopScan();const target=$('isbn-reader');try{scanner=new Html5Qrcode('isbn-reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:280,height:160}},txt=>{const code=txt.trim().replace(/[\s-]/g,'');if(!isbnValid(code))return;$('isbn').value=code;isbnChanged();stopScan()})}catch(e){if(target)target.textContent='Camera unavailable. Enter the ISBN manually.'}}
async function ocr(e){
 const file=e.target.files?.[0];if(!file)return;
 const preview=$('preview'),status=$('ocrStatus');
 const url=URL.createObjectURL(file);preview.src=url;preview.classList.remove('hidden');
 status.textContent='Reading Bulgarian cover…';
 try{
  // Bulgarian only: English recognition often introduces stray Latin letters.
  const result=await Tesseract.recognize(file,'bul');
  const lines=(result.data.lines||[]).map(l=>({
   text:(l.text||'').trim().replace(/\s+/g,' '),confidence:l.confidence??0,
   box:l.bbox
  })).filter(l=>l.text.length>=3);
  const cyrillic=s=>(s.match(/[А-Яа-яЁёІіЇїЄєЪъЬь]/g)||[]).length;
  const candidates=lines.filter(l=>cyrillic(l.text)>=3 && cyrillic(l.text)/Math.max(1,(l.text.match(/[A-Za-zА-Яа-яЁёІіЇїЄєЪъЬь]/g)||[]).length)>=0.65 && l.confidence>=38);
  const ranked=candidates.map(l=>({...l,score:l.confidence+Math.min(l.text.length,35)*0.45})).sort((a,b)=>b.score-a.score);
  if(!ranked.length){status.textContent='Could not confidently read Bulgarian text. Try a closer, well-lit photo or type the title manually.';return}
  const title=$('title'),author=$('author');
  // Never overwrite details already entered by the user.
  if(!title.value.trim())title.value=ranked[0].text;
  const other=ranked.find(l=>l.text!==ranked[0].text && l.confidence>=50);
  if(other && !author.value.trim())author.value=other.text;
  status.textContent='Possible text detected (not verified). Check title and author carefully before receiving.';
 }catch(err){status.textContent='OCR could not read this cover. Enter details manually. '+err.message}
 finally{URL.revokeObjectURL(url)}
}
async function scan(onRead){await stopScan();try{scanner=new Html5Qrcode('qr-reader');await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},txt=>{onRead(txt.trim().toUpperCase());stopScan()})}catch(e){notice('Camera unavailable. Enter the bin code manually.',true)}}
async function stopScan(){if(scanner){const s=scanner;scanner=null;try{await s.stop()}catch{}try{s.clear()}catch{}}}
async function receive(){const title=$('title').value.trim(),author=$('author').value.trim(),isbn=$('isbn').value.replace(/[\s-]/g,''),bin=$('bin').value.trim().toUpperCase(),qty=Number($('qty').value);if(isbn&&!isbnValid(isbn)){notice('Invalid ISBN-13.',true);return}if(!title||!bin||!Number.isSafeInteger(qty)||qty<1){notice('Enter a title, bin and positive whole-number quantity.',true);return}
 $('receive').disabled=true;try{let book=books.find(b=>(isbn&&b.isbn===isbn)||(b.title.trim().toLocaleLowerCase()===title.toLocaleLowerCase()&&b.author.trim().toLocaleLowerCase()===author.toLocaleLowerCase()));if(book&&isbn&&book.isbn&&book.isbn!==isbn)throw Error('This title is registered under another ISBN. Review the edition before receiving.');if(!book){const {data,error}=await supa.from('books').insert({title,author,isbn:isbn||null}).select().single();if(error)throw error;book=data}else if(isbn&&!book.isbn){const {error}=await supa.from('books').update({isbn}).eq('id',book.id);if(error)throw error}
 const {error}=await supa.rpc('change_stock',{p_book_id:book.id,p_bin_code:bin,p_delta:qty});if(error)throw error;await refresh();notice(`Received ${qty} copies into bin ${bin}.`)}catch(e){notice('Could not receive stock: '+e.message,true)}finally{const btn=$('receive');if(btn)btn.disabled=false}}
function results(){const q=$('search').value.trim().toLocaleLowerCase();const matches=books.filter(b=>(b.title+' '+b.author+' '+(b.isbn||'')).toLocaleLowerCase().includes(q));$('results').innerHTML=matches.map(b=>`<div class="book"><b>${esc(b.title)}</b><div class="muted">${esc(b.author)}</div><p>${total(b)} copies · ${locations(b.id).map(s=>`${esc(s.bin_code)}: ${s.quantity}`).join(' · ')||'Out of stock'}</p><button data-book="${b.id}">${view==='pick'?'Pick copies':'View / move stock'}</button></div>`).join('')||'<p class="muted">No matching books.</p>';document.querySelectorAll('[data-book]').forEach(btn=>btn.onclick=()=>detail(btn.dataset.book))}
function detail(id){const b=books.find(b=>b.id===id),loc=locations(id);if(!b)return;const isPick=view==='pick';$('results').innerHTML=`<h3>${esc(b.title)}</h3><p>${loc.map(s=>`${esc(s.bin_code)}: ${s.quantity}`).join(' · ')||'No available copies'}</p><label>${isPick?'Pick from bin':'Move from bin'}</label><select id="from">${loc.map(s=>`<option value="${esc(s.bin_code)}">${esc(s.bin_code)} (${s.quantity})</option>`).join('')}</select>${isPick?'':`<label>Move to bin</label><div class="row"><input id="to" placeholder="2B"><button id="scanTo">Scan QR</button></div><div id="qr-reader"></div>`}<label>Quantity</label><input id="amount" type="number" min="1" step="1" value="1"><p><button class="primary" id="confirm">${isPick?'Confirm picked':'Move stock'}</button> <button id="cancel">Back</button></p>`;
 $('cancel').onclick=results;if($('scanTo'))$('scanTo').onclick=()=>scan(v=>$('to').value=v);$('confirm').onclick=async()=>{const from=$('from').value,n=Number($('amount').value),available=loc.find(s=>s.bin_code===from)?.quantity||0,to=isPick?null:$('to').value.trim().toUpperCase();if(!Number.isSafeInteger(n)||n<1||n>available||(!isPick&&(!to||to===from))){notice('Check quantity and bin location.',true);return} $('confirm').disabled=true;try{const fn=isPick?'change_stock':'transfer_stock';const args=isPick?{p_book_id:id,p_bin_code:from,p_delta:-n}:{p_book_id:id,p_from_bin:from,p_to_bin:to,p_quantity:n};const {error}=await supa.rpc(fn,args);if(error)throw error;await refresh();notice(isPick?'Pick recorded.':'Stock transferred.')}catch(e){notice(e.message,true);const btn=$('confirm');if(btn)btn.disabled=false}}}
init();
