import { parseIsbn } from './isbn.js';
import { fetchGoogleBooksByIsbn } from './providers/googleBooks.js';
import { fetchOpenLibraryByIsbn, openLibraryCoverUrl } from './providers/openLibrary.js';
import { mergeProviders } from './merge.js';
import { putItem, getItem, getAllItems, deleteItem, clearAll, exportJson, importJson } from './db.js';
import { initPwa, promptInstall } from './pwa.js';
import { startScanner } from './scanner.js';

const $ = (id)=>document.getElementById(id);

const state = {
  current: null,
  googleKey: '',
  scanner: null,
  activeShelf: 'ALL',
  filter: {
    language: '', publisher: '', format: '', yearMin: '', yearMax: '', priceMin: '', priceMax: '', cover:'any', tag:''
  },
  sort: { key:'title', dir:'asc' },
  _rtTimer: null
};

initPwa();
init();

async function init(){
  state.googleKey = localStorage.getItem('googleApiKey') || '';
  $('googleApiKey').value = state.googleKey;
  $('googleApiKey').addEventListener('change', ()=>{
    state.googleKey = $('googleApiKey').value.trim();
    localStorage.setItem('googleApiKey', state.googleKey);
  });

  $('btnInstall').addEventListener('click', async ()=>{
    const ok = await promptInstall();
    toast(ok ? 'Yükleme başlatıldı' : 'Yükleme iptal', ok ? 'ok' : '');
  });

  // scan
  $('btnScan').addEventListener('click', openScan);
  $('btnCloseScan').addEventListener('click', closeScan);
  $('scanModal').addEventListener('click', (e)=>{ if(e.target === $('scanModal')) closeScan(); });
  window.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && !$('scanModal').hidden) closeScan(); });

  $('btnFetch').addEventListener('click', onFetch);
  $('btnSaveQuick').addEventListener('click', ()=> onSave({ closeAdd:false }));
  $('btnOpenAdd').addEventListener('click', openAddSheet);
  $('navAdd').addEventListener('click', openAddSheet);
  $('btnCloseAdd').addEventListener('click', closeAddSheet);
  $('addSheet').addEventListener('click', (e)=>{ if(e.target === $('addSheet')) closeAddSheet(); });
  $('btnSave').addEventListener('click', ()=> onSave({ closeAdd:true }));

  // filter
  $('btnOpenFilter').addEventListener('click', openFilterSheet);
  $('navFilter').addEventListener('click', openFilterSheet);
  $('btnCloseFilter').addEventListener('click', closeFilterSheet);
  $('filterSheet').addEventListener('click', (e)=>{ if(e.target === $('filterSheet')) closeFilterSheet(); });
  $('btnResetFilter').addEventListener('click', ()=>{ resetFilter(); renderFilterUi(); scheduleRender(); });

  // realtime filter hooks
  const rtIds = ['f_language','f_publisher','f_format','f_yearMin','f_yearMax','f_priceMin','f_priceMax','f_tag','f_cover','s_key','s_dir','searchInput'];
  for(const id of rtIds){
    const el=$(id);
    if(!el) continue;
    const evt = (el.tagName==='SELECT') ? 'change' : 'input';
    el.addEventListener(evt, ()=>{ readFilterUi(); scheduleRender(); });
  }

  // export/import
  $('btnExport').addEventListener('click', async ()=>{
    const text = await exportJson();
    downloadText('kitap_kutuphane_export.json', text);
  });
  $('fileImport').addEventListener('change', async (e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const txt = await file.text();
    await importJson(JSON.parse(txt));
    toast('İçe aktarma tamam', 'ok');
    e.target.value='';
    await renderShelves();
  });

  $('btnClear').addEventListener('click', async ()=>{
    if(!confirm('Tüm kayıtları silmek istiyor musun?')) return;
    await clearAll();
    toast('Tüm kayıtlar silindi', 'ok');
    await renderShelves();
  });

  // cover upload
  $('coverUpload').addEventListener('change', onCoverUpload);
  $('btnRemoveCover').addEventListener('click', ()=>{
    if(!state.current) return;
    state.current.edition.coverLocalDataUrl='';
    updateCoverView();
    toast('Kapak kaldırıldı', 'ok');
  });

  // bottom nav pages
  $('navHome').addEventListener('click', ()=> setPage('Home'));
  $('navShelves').addEventListener('click', ()=> setPage('Shelves'));
  $('navSettings').addEventListener('click', ()=> setPage('Settings'));

  // keep shelf quick & detail in sync
  $('uc_shelf').addEventListener('input', ()=>{ $('uc_shelf_detail').value = $('uc_shelf').value; });
  $('uc_shelf_detail').addEventListener('input', ()=>{ $('uc_shelf').value = $('uc_shelf_detail').value; });

  setPage('Home');
  renderFilterUi();
  await renderShelves();
  setStatus('Hazır. Barkod okut veya ISBN gir.', '');
}

function setPage(name){
  const pages = { Home:'pageHome', Shelves:'pageShelves', Settings:'pageSettings' };
  for(const k of Object.values(pages)) $(k).classList.remove('active');
  $(pages[name]).classList.add('active');

  for(const id of ['navHome','navShelves','navSettings']) $(id).classList.remove('active');
  $('navHome').classList.toggle('active', name==='Home');
  $('navShelves').classList.toggle('active', name==='Shelves');
  $('navSettings').classList.toggle('active', name==='Settings');

  if(name==='Shelves') scheduleRender();
}

function scheduleRender(){
  clearTimeout(state._rtTimer);
  state._rtTimer = setTimeout(()=> renderShelves(), 120);
}

async function openScan(){
  $('scanModal').hidden = false;
  $('scanResult').textContent='';
  $('scanHint').textContent='Kamerayı barkoda yaklaştır.';

  const video=$('scanVideo');
  const torchBtn=$('btnTorch');

  if(state.scanner){
    try{ state.scanner.stop(); }catch{}
    state.scanner=null;
  }

  try{
    state.scanner = await startScanner({
      videoEl: video,
      resultEl: $('scanResult'),
      hintEl: $('scanHint'),
      torchBtn,
      onDetected: async (code)=>{
        $('isbnInput').value = code;
        closeScan();
        toast('Barkod okundu. Bilgiler getiriliyor…', 'ok');
        await onFetch();
      }
    });
  }catch(err){
    $('scanHint').textContent = err.message;
    $('scanResult').textContent = 'İpucu: HTTPS/Chrome kullan. Manuel ISBN girebilirsin.';
    torchBtn.hidden = true;
  }
}

function closeScan(){
  if(state.scanner){
    try{ state.scanner.stop(); }catch{}
    state.scanner=null;
  }
  $('scanModal').hidden = true;
}

function openAddSheet(){
  $('addSheet').hidden = false;
  if(state.current) fillDetailFields(state.current);
}
function closeAddSheet(){ $('addSheet').hidden = true; }

function openFilterSheet(){ renderFilterUi(); $('filterSheet').hidden = false; }
function closeFilterSheet(){ $('filterSheet').hidden = true; }

async function onFetch(){
  const parsed = parseIsbn($('isbnInput').value);
  if(!parsed.valid || !parsed.isbn13){
    setStatus('Geçersiz ISBN. 10 ya da 13 haneli doğru ISBN gir.', 'err');
    return;
  }

  const isbn13 = parsed.isbn13;
  const refresh = $('refreshMode').value === 'refresh';
  if(!refresh){
    const cached = await getItem(isbn13);
    if(cached){
      // backward compatibility: ensure shelf
      cached.userCopy = cached.userCopy || {};
      cached.userCopy.shelf = normalizeShelf(cached.userCopy.shelf);

      state.current = cached;
      fillQuickFields(cached);
      fillDetailFields(cached);
      updateCoverView();
      setStatus('Cache’den yüklendi ✅', 'ok');
      return;
    }
  }

  setStatus('Kaynaklardan çekiliyor…', '');

  const [google, ol] = await Promise.allSettled([
    fetchGoogleBooksByIsbn(isbn13, state.googleKey),
    fetchOpenLibraryByIsbn(isbn13)
  ]);

  const g = google.status==='fulfilled' ? google.value : { matched:false };
  const o = ol.status==='fulfilled' ? ol.value : { matched:false };

  if(!g.matched && !o.matched){
    setStatus('Hiçbir kaynak eşleştirme bulamadı. ISBN’i kontrol et.', 'err');
    return;
  }

  const merged = mergeProviders(isbn13, g, o);

  const item = {
    edition: merged.edition,
    userCopy: merged.userCopy,
    snapshots: { google: g.raw || null, openlibrary: o.raw || null }
  };

  const existing = await getItem(isbn13);
  if(existing){
    item.userCopy = { ...item.userCopy, ...existing.userCopy };
    item.edition.coverLocalDataUrl = existing.edition.coverLocalDataUrl || item.edition.coverLocalDataUrl;
    item.edition.createdAt = existing.edition.createdAt || item.edition.createdAt;
  }
  item.userCopy.shelf = normalizeShelf(item.userCopy.shelf);

  state.current = item;
  fillQuickFields(item);
  fillDetailFields(item);
  updateCoverView();

  setStatus('Çekildi ve birleştirildi ✅', 'ok');
}

async function onSave({ closeAdd }={ closeAdd:false }){
  if(!state.current?.edition?.isbn13){
    setStatus('Önce ISBN ile bilgileri getir.', 'err');
    return;
  }

  state.current.edition.title = $('ed_title').value.trim();
  state.current.edition.authors = splitCsv($('ed_authors').value);
  state.current.edition.publisher = $('ed_publisher').value.trim();
  state.current.edition.publishedDate = $('ed_publishedDate').value.trim();
  state.current.edition.language = $('ed_language').value.trim();
  state.current.edition.translators = splitCsv($('ed_translators').value);

  state.current.userCopy.price = toFloatOrNull($('uc_price').value);
  state.current.userCopy.currency = $('uc_currency').value;

  const shelf = normalizeShelf($('uc_shelf').value || $('uc_shelf_detail').value);
  state.current.userCopy.shelf = shelf;

  state.current.edition.subtitle = $('ed_subtitle').value.trim();
  state.current.edition.isbn13 = $('ed_isbn13').value || state.current.edition.isbn13;
  state.current.edition.isbn10 = $('ed_isbn10').value || state.current.edition.isbn10;
  state.current.edition.pageCount = toIntOrNull($('ed_pageCount').value);
  state.current.edition.editionStatement = $('ed_editionStatement').value.trim();
  state.current.edition.format = $('ed_format').value;
  state.current.edition.categories = splitCsv($('ed_categories').value);
  state.current.edition.description = $('ed_description').value.trim();
  state.current.edition.updatedAt = new Date().toISOString();

  state.current.userCopy.purchaseDate = $('uc_purchaseDate').value;
  state.current.userCopy.purchasePlace = $('uc_purchasePlace').value.trim();
  state.current.userCopy.tags = splitCsv($('uc_tags').value);
  state.current.userCopy.notes = $('uc_notes').value.trim();
  if(!state.current.userCopy.addedAt) state.current.userCopy.addedAt = new Date().toISOString();

  await putItem(state.current);
  toast('Kaydedildi ✅', 'ok');
  await renderShelves();

  if(closeAdd) closeAddSheet();
}

function fillQuickFields(item){
  const ed=item.edition;
  const uc=item.userCopy;
  $('ed_title').value = ed.title || '';
  $('ed_authors').value = (ed.authors||[]).join(', ');
  $('ed_publisher').value = ed.publisher || '';
  $('ed_publishedDate').value = ed.publishedDate || '';
  $('ed_language').value = ed.language || '';
  $('ed_translators').value = (ed.translators||[]).join(', ');
  $('uc_price').value = (uc.price ?? '');
  $('uc_currency').value = uc.currency || 'TRY';

  $('uc_shelf').value = normalizeShelf(uc.shelf);
  $('uc_shelf_detail').value = normalizeShelf(uc.shelf);

  $('ed_confidence').textContent = String(ed.confidence ?? '-');
  $('ed_sources').textContent = sourceText(ed.sources);
}

function fillDetailFields(item){
  const ed=item.edition;
  const uc=item.userCopy;
  $('ed_isbn13').value = ed.isbn13 || '';
  $('ed_isbn10').value = ed.isbn10 || '';
  $('ed_subtitle').value = ed.subtitle || '';
  $('ed_pageCount').value = ed.pageCount ?? '';
  $('ed_editionStatement').value = ed.editionStatement || '';
  $('ed_format').value = ed.format || '';
  $('ed_categories').value = (ed.categories||[]).join(', ');
  $('ed_description').value = ed.description || '';

  $('uc_shelf_detail').value = normalizeShelf(uc.shelf);
  $('uc_purchaseDate').value = uc.purchaseDate || '';
  $('uc_purchasePlace').value = uc.purchasePlace || '';
  $('uc_tags').value = (uc.tags||[]).join(', ');
  $('uc_notes').value = uc.notes || '';
}

function updateCoverView(){
  const img=$('coverImg');
  const info=$('coverInfo');
  if(!state.current){ img.src=''; info.textContent=''; return; }
  const ed=state.current.edition;
  const url = ed.coverLocalDataUrl || ed.coverRemoteUrl || '';
  img.src = url;
  info.textContent = ed.coverLocalDataUrl ? 'Kapak: manuel' : (ed.coverSource ? `Kapak: ${ed.coverSource}` : '');
  img.onerror = ()=>{
    if(ed.coverSource==='openlibrary'){
      img.src = openLibraryCoverUrl(ed.isbn13, 'M');
      info.textContent = 'Kapak: openlibrary (M fallback)';
    }else{
      img.src='';
      info.textContent='Kapak yüklenemedi.';
    }
  };
}

async function onCoverUpload(e){
  const file=e.target.files?.[0];
  if(!file) return;
  if(!state.current){
    toast('Önce ISBN ile bilgileri getir.', 'err');
    e.target.value='';
    return;
  }
  const dataUrl = await readFileAsDataUrl(file);
  state.current.edition.coverLocalDataUrl = dataUrl;
  updateCoverView();
  toast('Kapak yüklendi', 'ok');
  e.target.value='';
}

async function renderShelves(){
  const items = await getAllItems();
  // normalize shelves for older entries
  for(const it of items){
    it.userCopy = it.userCopy || {};
    it.userCopy.shelf = normalizeShelf(it.userCopy.shelf);
  }
  renderShelfTabs(items);
  populateShelfDatalist(items);
  const filtered = applyAllFilters(items);
  renderLibraryList(filtered);
}

function uniqueShelves(items){
  const set=new Set();
  for(const it of items){
    set.add(normalizeShelf(it.userCopy?.shelf));
  }
  return Array.from(set).sort((a,b)=>a.localeCompare(b,'tr',{sensitivity:'base'}));
}

function renderShelfTabs(items){
  const shelves = uniqueShelves(items);
  const counts = { ALL: items.length };
  for(const s of shelves){ counts[s] = items.filter(x=>normalizeShelf(x.userCopy?.shelf)===s).length; }

  const box=$('shelfTabs');
  box.innerHTML='';

  // Hepsi
  box.appendChild(makeTab('ALL','Hepsi', counts.ALL));

  for(const s of shelves){
    box.appendChild(makeTab(s, s, counts[s] || 0));
  }

  function makeTab(key,label,count){
    const b=document.createElement('button');
    b.className='tab'+(state.activeShelf===key?' active':'');
    b.type='button';
    b.innerHTML = `<span>${label}</span> <span class="badge">${count}</span>`;
    b.onclick=()=>{ state.activeShelf=key; scheduleRender(); };
    return b;
  }
}

function populateShelfDatalist(items){
  const dl=$('shelfList');
  if(!dl) return;
  const shelves=uniqueShelves(items);
  dl.innerHTML='';
  for(const s of shelves){
    const opt=document.createElement('option');
    opt.value=s;
    dl.appendChild(opt);
  }
}

function applyAllFilters(items){
  let out=[...items];

  if(state.activeShelf !== 'ALL'){
    out = out.filter(x=> normalizeShelf(x.userCopy?.shelf) === state.activeShelf);
  }

  const q = ($('searchInput')?.value || '').trim().toLowerCase();
  if(q){
    out = out.filter(x=>{
      const ed=x.edition||{};
      const hay = [ed.title, (ed.authors||[]).join(' '), ed.publisher, ed.isbn13, ed.publishedDate].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  const f=state.filter;
  if(f.language) out = out.filter(x=> (x.edition?.language||'').toLowerCase().includes(f.language.toLowerCase()));
  if(f.publisher) out = out.filter(x=> (x.edition?.publisher||'').toLowerCase().includes(f.publisher.toLowerCase()));
  if(f.format) out = out.filter(x=> (x.edition?.format||'').toLowerCase().includes(f.format.toLowerCase()));

  const yMin = toIntOrNull(f.yearMin);
  const yMax = toIntOrNull(f.yearMax);
  if(yMin || yMax){
    out = out.filter(x=>{
      const y = extractYear(x.edition?.publishedDate||'');
      if(!y) return false;
      if(yMin && y < yMin) return false;
      if(yMax && y > yMax) return false;
      return true;
    });
  }

  const pMin = toFloatOrNull(f.priceMin);
  const pMax = toFloatOrNull(f.priceMax);
  if(pMin!=null || pMax!=null){
    out = out.filter(x=>{
      const p = x.userCopy?.price;
      if(p==null || !Number.isFinite(p)) return false;
      if(pMin!=null && p < pMin) return false;
      if(pMax!=null && p > pMax) return false;
      return true;
    });
  }

  if(f.cover==='has') out = out.filter(x=> !!(x.edition?.coverLocalDataUrl || x.edition?.coverRemoteUrl));
  if(f.cover==='none') out = out.filter(x=> !(x.edition?.coverLocalDataUrl || x.edition?.coverRemoteUrl));

  if(f.tag){
    const t = f.tag.toLowerCase();
    out = out.filter(x=> (x.userCopy?.tags||[]).some(z=>String(z).toLowerCase().includes(t)));
  }

  out.sort((a,b)=> compareItems(a,b, state.sort));
  return out;
}

function compareItems(a,b, sort){
  const dir = sort.dir==='desc' ? -1 : 1;
  const edA=a.edition||{}; const edB=b.edition||{};
  const ucA=a.userCopy||{}; const ucB=b.userCopy||{};
  switch(sort.key){
    case 'title':
      return dir * (edA.title||'').localeCompare((edB.title||''), 'tr', { sensitivity:'base' });
    case 'publisher':
      return dir * (edA.publisher||'').localeCompare((edB.publisher||''), 'tr', { sensitivity:'base' });
    case 'author':
      return dir * ((edA.authors||[])[0]||'').localeCompare(((edB.authors||[])[0]||''), 'tr', { sensitivity:'base' });
    case 'publishedDate':
      return dir * (extractYear(edA.publishedDate||'') - extractYear(edB.publishedDate||''));
    case 'price':
      return dir * ((ucA.price ?? -1) - (ucB.price ?? -1));
    default:
      return 0;
  }
}

function renderLibraryList(list){
  const box=$('library');
  box.innerHTML='';
  if(!list.length){
    box.innerHTML = '<div class="small">Bu raf/filtre için kayıt yok.</div>';
    return;
  }

  for(const item of list){
    const ed=item.edition;
    const uc=item.userCopy;
    const div=document.createElement('div');
    div.className='item';

    const img=document.createElement('img');
    img.alt='Kapak';
    img.src = ed.coverLocalDataUrl || ed.coverRemoteUrl || '';
    img.onerror = ()=>{ img.src=''; img.style.display='none'; };

    const meta=document.createElement('div');
    meta.className='meta';

    const name=document.createElement('div');
    name.className='name';
    name.textContent = ed.title || '(Başlık yok)';

    const pubYear = ed.publishedDate ? `• ${ed.publishedDate}` : '';
    const author = (ed.authors||[]).slice(0,2).join(', ');
    const sub=document.createElement('div');
    sub.className='sub';
    sub.textContent = `${author || '-'} • ${ed.publisher||'-'} ${pubYear}`;

    const chips=document.createElement('div');
    chips.className='chips';
    chips.appendChild(makeChip('📚 '+normalizeShelf(uc.shelf)));
    if(ed.language) chips.appendChild(makeChip('🌐 '+ed.language));
    if(ed.format) chips.appendChild(makeChip('📦 '+ed.format));
    if(Number.isFinite(uc.price)) chips.appendChild(makeChip('💳 '+`${uc.price} ${uc.currency||''}`));

    meta.appendChild(name);
    meta.appendChild(sub);
    meta.appendChild(chips);

    const btns=document.createElement('div');
    btns.className='btns';

    const bEdit=document.createElement('button');
    bEdit.className='btn ghost';
    bEdit.textContent='✏️ Düzenle';
    bEdit.onclick=async()=>{
      const fresh = await getItem(ed.isbn13);
      fresh.userCopy = fresh.userCopy || {};
      fresh.userCopy.shelf = normalizeShelf(fresh.userCopy.shelf);
      state.current = fresh;
      fillQuickFields(fresh);
      fillDetailFields(fresh);
      updateCoverView();
      setPage('Home');
      toast('Kayıt yüklendi (düzenleme).', 'ok');
    };

    const bDel=document.createElement('button');
    bDel.className='btn danger';
    bDel.textContent='Sil';
    bDel.onclick=async()=>{
      if(!confirm('Silmek istiyor musun?')) return;
      await deleteItem(ed.isbn13);
      await renderShelves();
      toast('Silindi', 'ok');
    };

    btns.appendChild(bEdit);
    btns.appendChild(bDel);

    div.appendChild(img);
    div.appendChild(meta);
    div.appendChild(btns);
    box.appendChild(div);
  }
}

function makeChip(text){
  const s=document.createElement('span');
  s.className='chip';
  s.textContent=text;
  return s;
}

function setStatus(msg, kind){
  const el=$('fetchStatus');
  el.textContent = msg;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function toast(msg, kind){
  setStatus(msg, kind || '');
  setTimeout(()=> setStatus('Hazır.', ''), 1800);
}

function normalizeShelf(s){
  const t = String(s||'').trim();
  return t ? t : 'Genel';
}

function splitCsv(s){
  if(!s) return [];
  return s.split(',').map(x=>x.trim()).filter(Boolean);
}

function toIntOrNull(v){
  const n = parseInt(String(v||'').trim(),10);
  return Number.isFinite(n) ? n : null;
}

function toFloatOrNull(v){
  const t = String(v||'').replace(',','.').trim();
  if(!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function extractYear(dateStr){
  const m = String(dateStr||'').match(/(19\d{2}|20\d{2})/);
  return m ? parseInt(m[1],10) : 0;
}

function downloadText(filename, text){
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sourceText(sources){
  const parts=[];
  if(sources?.google?.matched) parts.push('Google');
  if(sources?.openlibrary?.matched) parts.push('OpenLibrary');
  return parts.length ? parts.join(' + ') : '-';
}

function readFilterUi(){
  state.filter.language = $('f_language').value.trim();
  state.filter.publisher = $('f_publisher').value.trim();
  state.filter.format = $('f_format').value.trim();
  state.filter.yearMin = $('f_yearMin').value.trim();
  state.filter.yearMax = $('f_yearMax').value.trim();
  state.filter.priceMin = $('f_priceMin').value.trim();
  state.filter.priceMax = $('f_priceMax').value.trim();
  state.filter.cover = $('f_cover').value;
  state.filter.tag = $('f_tag').value.trim();
  state.sort.key = $('s_key').value;
  state.sort.dir = $('s_dir').value;
}

function renderFilterUi(){
  $('f_language').value = state.filter.language;
  $('f_publisher').value = state.filter.publisher;
  $('f_format').value = state.filter.format;
  $('f_yearMin').value = state.filter.yearMin;
  $('f_yearMax').value = state.filter.yearMax;
  $('f_priceMin').value = state.filter.priceMin;
  $('f_priceMax').value = state.filter.priceMax;
  $('f_cover').value = state.filter.cover;
  $('f_tag').value = state.filter.tag;
  $('s_key').value = state.sort.key;
  $('s_dir').value = state.sort.dir;
}

function resetFilter(){
  state.filter = { language:'', publisher:'', format:'', yearMin:'', yearMax:'', priceMin:'', priceMax:'', cover:'any', tag:'' };
  state.sort = { key:'title', dir:'asc' };
}

async function onCoverUpload(e){
  const file=e.target.files?.[0];
  if(!file) return;
  if(!state.current){
    toast('Önce ISBN ile bilgileri getir.', 'err');
    e.target.value='';
    return;
  }
  const dataUrl = await readFileAsDataUrl(file);
  state.current.edition.coverLocalDataUrl = dataUrl;
  updateCoverView();
  toast('Kapak yüklendi', 'ok');
  e.target.value='';
}

function readFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = ()=> resolve(fr.result);
    fr.onerror = ()=> reject(fr.error);
    fr.readAsDataURL(file);
  });
}
