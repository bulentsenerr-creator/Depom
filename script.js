// v2026-01-13 FULL: Google+OpenLibrary + Edit + Manuel Kapak + Lightbox + Çeviren + Çoklu Seçim (ANY) + Sıralama + Barkod (QuaggaJS) + Kamera Seçimi + Torch + PWA + Çoklu İçe Aktarma
const STORAGE_KEY = 'myLibrary';
const GOOGLE_BOOKS_API_KEY = '';

let myLibrary = migrateLibrary(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
let editingBookId = null;
function $(id){ return document.getElementById(id); }

// ---- Filtre Durumu ----
const filters = { q: '', format: '', lang: '', minPrice: null, maxPrice: null, cats: [], tags: [], sortBy: 'added-desc' };
function getSelectValues(sel){ if(!sel) return []; return [...sel.options].filter(o=>o.selected && o.value.trim()!=='').map(o=>o.value); }
function debounce(fn, ms = 200){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; }
function downloadBlob(filename, blob){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

function migrateLibrary(arr){ return (Array.isArray(arr)?arr:[]).map(b=>{ const book={...b}; if(book.place===undefined && book.purchasePlace!==undefined) book.place=book.purchasePlace; if(book.img===undefined && book.coverImg!==undefined) book.img=book.coverImg; if(!book.id) book.id=Date.now()+Math.floor(Math.random()*10000); if(!book.addedDate) book.addedDate=new Date().toISOString(); if(!Array.isArray(book.categories)) book.categories=book.categories?String(book.categories).split(',').map(s=>s.trim()).filter(Boolean):[]; if(!Array.isArray(book.tags)) book.tags=book.tags?String(book.tags).split(',').map(s=>s.trim()).filter(Boolean):[]; book.language=book.language||''; book.description=book.description||''; book.publisher=book.publisher||''; book.translator=book.translator||''; book.edition=book.edition||''; book.publishedDate=book.publishedDate||''; book.pageCount=Number(book.pageCount||0)||0; book.format=book.format||''; book.purchaseDate=book.purchaseDate||''; book.title=book.title||''; book.author=book.author||''; book.isbn=book.isbn||''; book.place=book.place||''; book.price=Number(book.price||0)||0; book.img=book.img||'https://via.placeholder.com/150x220?text=Kapak+Yok'; return book; }); }
function normalizeCommaList(text){ if(!text) return []; return text.split(',').map(s=>s.trim()).filter(Boolean); }
function normalizeIsbn(raw){ return String(raw||'').toUpperCase().replace(/[^0-9X]/g,''); }
function toLocalDateString(iso){ if(!iso) return ''; try{ const d=new Date(iso); if(Number.isNaN(d.getTime())) return String(iso); return d.toLocaleDateString('tr-TR'); } catch{ return String(iso); } }
function escapeHtml(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function escapeAttr(str){ return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#039;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function setCoverPreview(url,title,msg){ const wrap=$('coverPreviewWrap'); const img=$('coverPreview'); const t=$('coverPreviewTitle'); const m=$('coverPreviewMsg'); if(!wrap||!img||!t||!m) return; if(!url){ wrap.style.display='none'; return; } img.src=url; t.textContent=title||''; m.textContent=msg||''; wrap.style.display='flex'; }
function setEditMode(isEditing){ $('saveBtn')&&($('saveBtn').textContent=isEditing?'Güncelle':'Kütüphaneye Ekle'); $('cancelBtn')&&($('cancelBtn').style.display=isEditing?'block':'none'); }
function clearCover(){ $('coverImg')&&($('coverImg').value=''); $('coverUrl')&&($('coverUrl').value=''); $('coverFile')&&($('coverFile').value=''); setCoverPreview('','',''); }
function clearForm(){ document.querySelectorAll('#bookForm input, #bookForm select, #bookForm textarea').forEach(el=>{ if(el.type==='hidden') el.value=''; else if(el.type==='file') el.value=''; else if(el.tagName==='SELECT') el.selectedIndex=0; else el.value=''; }); setCoverPreview('','',''); }
function cancelEdit(){ editingBookId=null; setEditMode(false); clearForm(); saveAndRender(); }
function startEdit(id){ const book=myLibrary.find(b=>b.id===id); if(!book) return; editingBookId=id; setEditMode(true); $('title')&&($('title').value=book.title||''); $('author')&&($('author').value=book.author||''); $('translator')&&($('translator').value=book.translator||''); $('isbn')&&($('isbn').value=book.isbn||''); $('publisher')&&($('publisher').value=book.publisher||''); $('language')&&($('language').value=book.language||''); $('edition')&&($('edition').value=book.edition||''); $('publishedDate')&&($('publishedDate').value=book.publishedDate||''); $('pageCount')&&($('pageCount').value=book.pageCount||''); $('format')&&($('format').value=book.format||''); $('purchaseDate')&&($('purchaseDate').value=book.purchaseDate||''); $('purchasePlace')&&($('purchasePlace').value=book.place||''); $('price')&&($('price').value=(book.price??'')); $('categories')&&($('categories').value=Array.isArray(book.categories)?book.categories.join(', '):(book.categories||'')); $('tags')&&($('tags').value=Array.isArray(book.tags)?book.tags.join(', '):(book.tags||'')); $('description')&&($('description').value=book.description||''); $('coverImg')&&($('coverImg').value=book.img||''); $('coverUrl')&&($('coverUrl').value=(book.img && !String(book.img).startsWith('data:'))?book.img:''); $('coverFile')&&($('coverFile').value=''); if(book.img) setCoverPreview(book.img, book.title||'', 'Düzenleme modu: mevcut kapak yüklendi.'); saveAndRender(); window.scrollTo({top:0,behavior:'smooth'}); }

// Lightbox
function openLightbox(src, title){ const lb=$('lightbox'); const img=$('lightboxImg'); const cap=$('lightboxCaption'); if(!lb||!img) return; img.src=src; cap&&(cap.textContent=title||''); lb.style.display='block'; document.body.style.overflow='hidden'; }
function closeLightbox(){ const lb=$('lightbox'); const img=$('lightboxImg'); if(!lb||!img) return; lb.style.display='none'; img.src=''; document.body.style.overflow=''; }

function initUI(){ $('coverUrl')&&$('coverUrl').addEventListener('change',()=>{ const url=String($('coverUrl').value||'').trim(); if(url){ $('coverImg').value=url; $('coverFile')&&($('coverFile').value=''); setCoverPreview(url, $('title')?$('title').value:'', 'Kapak URL manuel girildi.'); } }); $('coverFile')&&$('coverFile').addEventListener('change',()=>{ const file=$('coverFile').files&&$('coverFile').files[0]; if(!file) return; if(file.size>700*1024) alert('Seçtiğiniz görsel büyük (700KB+). LocalStorage limitine takılabilir.'); const r=new FileReader(); r.onload=()=>{ const dataUrl=String(r.result||''); $('coverImg')&&($('coverImg').value=dataUrl); $('coverUrl')&&($('coverUrl').value=''); setCoverPreview(dataUrl, $('title')?$('title').value:'', 'Kapak dosyadan eklendi.'); }; r.readAsDataURL(file); }); $('libraryGrid')&&$('libraryGrid').addEventListener('click',(e)=>{ const t=e.target; if(t&&t.classList&&t.classList.contains('cover-click')){ const src=t.getAttribute('data-src')||t.getAttribute('src'); const title=t.getAttribute('data-title')||''; if(src) openLightbox(src,title); } }); document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeLightbox(); }); $('barcodeBtn')&&$('barcodeBtn').addEventListener('click', startBarcodeScan); 
  // PWA: SW register
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('SW kayıt hatası', e));
    });
  }
}

// ---- Google + OpenLibrary birleşik çekme ----
function pickBestGoogleItem(items,isbnNorm){ let best=null,bestScore=-1; for(const it of (items||[])){ const info=it?.volumeInfo||{}; const links=info.imageLinks||{}; const hasCover=!!(links.extraLarge||links.large||links.medium||links.small||links.thumbnail||links.smallThumbnail); const hasDesc=!!info.description; const hasPublisher=!!info.publisher; const hasCats=Array.isArray(info.categories)&&info.categories.length; const hasPages=!!info.pageCount; const hasLang=!!info.language; const hasDate=!!info.publishedDate; const ids=(info.industryIdentifiers||[]).map(x=>String(x.identifier||'').replace(/[^0-9X]/gi,'').toUpperCase()); const isbnMatch=isbnNorm?ids.includes(isbnNorm):false; let score=0; score+=isbnMatch?10:0; score+=hasCover?6:0; score+=hasDesc?4:0; score+=hasPublisher?3:0; score+=hasCats?2:0; score+=hasPages?2:0; score+=hasLang?1:0; score+=hasDate?1:0; if(score>bestScore){ bestScore=score; best=it; } } return best || (items&&items[0]) || null; }
function googleBestCoverUrl(volumeInfo){ const links=volumeInfo?.imageLinks||{}; const best=links.extraLarge||links.large||links.medium||links.small||links.thumbnail||links.smallThumbnail; return best?String(best).replace(/^http:/,'https:'):''; }
async function fetchGoogleByIsbn(isbnNorm){ const keyPart=GOOGLE_BOOKS_API_KEY?`&key=${encodeURIComponent(GOOGLE_BOOKS_API_KEY)}`:''; const url=`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbnNorm)}&projection=full&maxResults=10${keyPart}`; const res=await fetch(url); const data=await res.json(); if(!data||!Array.isArray(data.items)||!data.items.length) return null; const picked=pickBestGoogleItem(data.items,isbnNorm); return picked?.volumeInfo||null; }
async function fetchOpenLibraryByIsbn(isbnNorm){ const url=`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbnNorm)}&format=json&jscmd=data`; const res=await fetch(url); const data=await res.json(); return data?.[`ISBN:${isbnNorm}`]||null; }
function parseOpenLibraryDescription(desc){ if(!desc) return ''; if(typeof desc==='string') return desc; if(typeof desc==='object'&&typeof desc.value==='string') return desc.value; return ''; }
function openLibraryCoverUrl(isbnNorm){ return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbnNorm)}-L.jpg?default=false`; }
function probeImage(url){ return new Promise(resolve=>{ const img=new Image(); img.onload=()=>resolve(true); img.onerror=()=>resolve(false); img.src=url; }); }
function mergeIntoForm(primary,fallback){ if(primary?.title) $('title').value=primary.title; if(Array.isArray(primary?.authors)&&primary.authors.length) $('author').value=primary.authors.join(', '); if(primary?.publisher) $('publisher').value=primary.publisher; if(primary?.language) $('language').value=primary.language; if(primary?.publishedDate) $('publishedDate').value=primary.publishedDate; if(primary?.pageCount) $('pageCount').value=primary.pageCount; if(Array.isArray(primary?.categories)&&primary.categories.length) $('categories').value=primary.categories.join(', '); if(primary?.description) $('description').value=primary.description; if(fallback){ if(!$('author').value.trim()&&Array.isArray(fallback.authors)&&fallback.authors.length){ $('author').value=fallback.authors.map(a=>a.name).filter(Boolean).join(', '); } if(!$('publisher').value.trim()&&Array.isArray(fallback.publishers)&&fallback.publishers.length){ $('publisher').value=fallback.publishers.map(p=>p.name).filter(Boolean).join(', '); } if(!$('publishedDate').value.trim()&&fallback.publish_date){ $('publishedDate').value=String(fallback.publish_date); } if((!$('pageCount').value||Number($('pageCount').value)===0)&&fallback.number_of_pages){ $('pageCount').value=fallback.number_of_pages; } if(!$('categories').value.trim()&&Array.isArray(fallback.subjects)&&fallback.subjects.length){ $('categories').value=fallback.subjects.map(s=>s.name).filter(Boolean).slice(0,12).join(', '); } if(!$('description').value.trim()){ const desc=parseOpenLibraryDescription(fallback.description)||parseOpenLibraryDescription(fallback.excerpt); if(desc) $('description').value=desc; } } }
async function searchBook(){ const isbnNorm=normalizeIsbn($('isbnSearch').value); if(!isbnNorm) return alert('Lütfen bir ISBN girin.'); $('isbn').value=isbnNorm; try{ const googleInfo=await fetchGoogleByIsbn(isbnNorm); let olInfo=null; try{ olInfo=await fetchOpenLibraryByIsbn(isbnNorm); }catch(e){ console.warn('OpenLibrary alınamadı',e); } if(!googleInfo&&!olInfo){ alert('Kitap bulunamadı.'); return; } mergeIntoForm(googleInfo,olInfo); const olCover=openLibraryCoverUrl(isbnNorm); const hasOlCover=await probeImage(olCover); const coverUrl=hasOlCover?olCover:googleBestCoverUrl(googleInfo); $('coverImg').value=coverUrl; $('coverUrl').value=(coverUrl&&!String(coverUrl).startsWith('data:'))?coverUrl:''; $('coverFile').value=''; if(coverUrl){ setCoverPreview(coverUrl, $('title').value, hasOlCover?'Kapak Open Library’den alındı.':'Kapak Google Books’tan alındı.'); } const missing=[]; if(!$('publisher').value.trim()) missing.push('Yayıncı'); if(!Number($('pageCount').value)) missing.push('Sayfa'); if(!$('categories').value.trim()) missing.push('Kategoriler'); if(!$('description').value.trim()) missing.push('Açıklama'); if(!$('coverImg').value.trim()) missing.push('Kapak'); if(missing.length) alert('Bilgiler getirildi; eksik kalanlar: '+missing.join(', ')); else alert('Tüm bulunabilen bilgiler ve kapak getirildi!'); }catch(err){ console.error(err); alert('Veri çekme sırasında hata oluştu.'); } }

// ---- Kaydet / Güncelle ----
function saveBook(){ const title=$('title').value.trim(); if(!title) return alert('Kitap adı zorunludur!'); const nowIso=new Date().toISOString(); const payload={ title, author:$('author').value.trim(), translator:$('translator').value.trim(), isbn:$('isbn').value.trim(), publisher:$('publisher').value.trim(), language:$('language').value.trim(), edition:$('edition').value.trim(), publishedDate:$('publishedDate').value.trim(), pageCount:parseInt($('pageCount').value,10)||0, format:$('format').value, purchaseDate:$('purchaseDate').value, tags:normalizeCommaList($('tags').value), categories:normalizeCommaList($('categories').value), description:$('description').value.trim(), place:$('purchasePlace').value.trim(), price:parseFloat($('price').value)||0, img:$('coverImg').value || $('coverUrl').value.trim() || 'https://via.placeholder.com/150x220?text=Kapak+Yok' }; if(editingBookId){ const idx=myLibrary.findIndex(b=>b.id===editingBookId); if(idx===-1) myLibrary.push({id:Date.now(),addedDate:nowIso,...payload}); else{ const existing=myLibrary[idx]; myLibrary[idx]={...existing,...payload,id:existing.id,addedDate:existing.addedDate||nowIso}; } editingBookId=null; setEditMode(false); }else{ myLibrary.push({id:Date.now(),addedDate:nowIso,...payload}); } saveAndRender(); clearForm(); }
function deleteBook(id){ myLibrary=myLibrary.filter(b=>b.id!==id); saveAndRender(); }

// ---- Metin araması / fiyat aralığı ----
function matchesQuery(book,q){ if(!q) return true; const needle=q.toLowerCase(); const hay=[book.title,book.author,book.translator,book.isbn,book.publisher,book.language,book.edition,book.publishedDate,book.place,...(Array.isArray(book.categories)?book.categories:[]),...(Array.isArray(book.tags)?book.tags:[]),book.description].filter(Boolean).join(' ').toLowerCase(); return hay.includes(needle); }
function inPriceRange(book,minP,maxP){ const price=Number(book.price??0); if(minP!=null&&price<minP) return false; if(maxP!=null&&price>maxP) return false; return true; }
function hasAny(haystack, needles){ if(!needles||needles.length===0) return true; const set=new Set((haystack||[]).map(String)); return needles.some(n=>set.has(String(n))); }
function applyFilters(book){ const okQ=matchesQuery(book,filters.q); const okF=!filters.format||String(book.format||'')===filters.format; const okL=!filters.lang||String(book.language||'')===filters.lang; const okP=inPriceRange(book,filters.minPrice,filters.maxPrice); const okCats=hasAny(book.categories,filters.cats); const okTags=hasAny(book.tags,filters.tags); return okQ&&okF&&okL&&okP&&okCats&&okTags; }

// ---- Sıralama ----
function cmpStr(a,b){ return String(a||'').localeCompare(String(b||''), 'tr', { sensitivity:'base' }); }
function cmpDateAsc(a,b){ const ta=Date.parse(a||0); const tb=Date.parse(b||0); return (isNaN(ta)?0:ta) - (isNaN(tb)?0:tb); }
function cmpNumAsc(a,b){ return (Number(a)||0) - (Number(b)||0); }
function sortBooks(arr,key){ const list=arr.slice(); switch(key){ case 'title-asc': list.sort((a,b)=>cmpStr(a.title,b.title)); break; case 'title-desc': list.sort((a,b)=>-cmpStr(a.title,b.title)); break; case 'added-asc': list.sort((a,b)=>cmpDateAsc(a.addedDate,b.addedDate)); break; case 'added-desc': list.sort((a,b)=>-cmpDateAsc(a.addedDate,b.addedDate)); break; case 'purchase-asc': list.sort((a,b)=>cmpDateAsc(a.purchaseDate,b.purchaseDate)); break; case 'purchase-desc': list.sort((a,b)=>-cmpDateAsc(a.purchaseDate,b.purchaseDate)); break; case 'price-asc': list.sort((a,b)=>cmpNumAsc(a.price,b.price)); break; case 'price-desc': list.sort((a,b)=>-cmpNumAsc(a.price,b.price)); break; case 'pages-asc': list.sort((a,b)=>cmpNumAsc(a.pageCount,b.pageCount)); break; case 'pages-desc': list.sort((a,b)=>-cmpNumAsc(a.pageCount,b.pageCount)); break; default: list.sort((a,b)=>-cmpDateAsc(a.addedDate,b.addedDate)); break; } return list; }

// ---- JSON & Excel DIŞA/İÇE AKTAR (Çoklu dosya) ----
function summarizeMergeResult(title, info){
  alert(`${title}\n\nEklendi: ${info.added}\nGüncellendi: ${info.updated}\nHatalı: ${info.errors}`);
}
function mergeIncoming(incoming){
  const byId = new Map(myLibrary.map(b => [b.id, b]));
  let added=0, updated=0, errors=0;
  for (const nb of incoming) {
    try {
      if (!nb) { errors++; continue; }
      if (nb.id && byId.has(nb.id)) {
        const ex = byId.get(nb.id);
        const merged = { ...ex, ...nb, id: ex.id, addedDate: ex.addedDate || nb.addedDate || new Date().toISOString() };
        const idx = myLibrary.findIndex(x => x.id === ex.id);
        if (idx >= 0) myLibrary[idx] = merged;
        updated++;
      } else {
        myLibrary.push({
          ...nb,
          id: nb.id || (Date.now() + Math.floor(Math.random()*10000)),
          addedDate: nb.addedDate || new Date().toISOString()
        });
        added++;
      }
    } catch (e) { console.warn('Merge hatası', e); errors++; }
  }
  return {added, updated, errors};
}
function exportJson(){ const data=JSON.stringify(myLibrary,null,2); const blob=new Blob([data],{type:'application/json;charset=utf-8'}); const ts=new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); downloadBlob(`kitaplik-${ts}.json`,blob); }
function importJsonFromFiles(files){
  if (!files || files.length===0) return;
  let total = {added:0,updated:0,errors:0};
  let remaining = files.length;
  [...files].forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(String(reader.result || '[]'));
        if (!Array.isArray(arr)) { total.errors++; }
        else {
          const incoming = migrateLibrary(arr);
          const res = mergeIncoming(incoming);
          total.added += res.added; total.updated += res.updated; total.errors += res.errors;
        }
      } catch (e) { console.error(e); total.errors++; }
      finally {
        remaining--; if (remaining===0) { saveAndRender(); summarizeMergeResult('JSON içe aktarma tamamlandı (çoklu dosya).', total); }
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}
function exportExcel(){ if(typeof XLSX==='undefined'||!XLSX||!XLSX.utils||!XLSX.writeFile){ alert('Excel kütüphanesi (XLSX) yüklenemedi. Lütfen xlsx.full.min.js scriptinin sayfada olduğundan emin olun.'); return; } const rows=myLibrary.map(b=>({ id:b.id, addedDate:b.addedDate, title:b.title, author:b.author, translator:b.translator, isbn:b.isbn, publisher:b.publisher, language:b.language, edition:b.edition, publishedDate:b.publishedDate, pageCount:b.pageCount, format:b.format, purchaseDate:b.purchaseDate, place:b.place, price:b.price, categories:Array.isArray(b.categories)?b.categories.join(', '):(b.categories||''), tags:Array.isArray(b.tags)?b.tags.join(', '):(b.tags||''), description:b.description, img:b.img })); const ws=XLSX.utils.json_to_sheet(rows,{skipHeader:false}); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Kitaplik'); const ts=new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); XLSX.writeFile(wb,`kitaplik-${ts}.xlsx`); }
function importExcelFromFiles(files){ if(typeof XLSX==='undefined'||!XLSX||!XLSX.read||!XLSX.utils){ alert('XLSX kütüphanesi bulunamadı.'); return; } if(!files||files.length===0) return; let total = {added:0,updated:0,errors:0}; let index=0; const next = () => {
  if (index>=files.length) { saveAndRender(); summarizeMergeResult('Excel içe aktarma tamamlandı (çoklu dosya).', total); return; }
  const file = files[index++]; const reader = new FileReader(); reader.onload = (e) => { try { const data = new Uint8Array(e.target.result); const wb = XLSX.read(data, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; const arr = XLSX.utils.sheet_to_json(ws, { defval: '' }); const incomingRaw = arr.map(r => ({ id: r.id || undefined, addedDate: r.addedDate || undefined, title: r.title || '', author: r.author || '', translator: r.translator || '', isbn: r.isbn || '', publisher: r.publisher || '', language: r.language || '', edition: r.edition || '', publishedDate: r.publishedDate || '', pageCount: Number(r.pageCount || 0), format: r.format || '', purchaseDate: r.purchaseDate || '', place: r.place || '', price: Number(r.price || 0), categories: r.categories ? String(r.categories).split(',').map(s => s.trim()).filter(Boolean) : [], tags: r.tags ? String(r.tags).split(',').map(s => s.trim()).filter(Boolean) : [], description: r.description || '', img: r.img || '' })); const incoming = migrateLibrary(incomingRaw); const res = mergeIncoming(incoming); total.added += res.added; total.updated += res.updated; total.errors += res.errors; } catch (err) { console.error(err); total.errors++; } finally { next(); } }; reader.readAsArrayBuffer(file); };
  next(); }

// ---- Filtre olayları ----
function initFiltersEvents(){ const onChange=debounce(()=>{ filters.q=$('fQuery')?.value.trim()||''; filters.format=$('fFormat')?.value||''; filters.lang=$('fLang')?.value||''; const minP=$('fMinPrice')?.value||''; const maxP=$('fMaxPrice')?.value||''; filters.minPrice=(minP==='')?null:Number(minP); filters.maxPrice=(maxP==='')?null:Number(maxP); filters.cats=getSelectValues($('fCats')); filters.tags=getSelectValues($('fTags')); filters.sortBy=$('sortBy')?.value||'added-desc'; saveAndRender(); },160); ['fQuery','fFormat','fLang','fMinPrice','fMaxPrice','fCats','fTags','sortBy'].forEach(id=>{ const el=$(id); if(!el) return; el.addEventListener('input',onChange); el.addEventListener('change',onChange); }); $('fClearBtn')&&$('fClearBtn').addEventListener('click',()=>{ ['fQuery','fFormat','fLang','fMinPrice','fMaxPrice'].forEach(id=>{ const el=$(id); if(el) el.value=''; }); ['fCats','fTags'].forEach(id=>{ const el=$(id); if(el) [...el.options].forEach(o=>o.selected=false); }); $('sortBy')&&($('sortBy').value='added-desc'); filters.q=''; filters.format=''; filters.lang=''; filters.minPrice=null; filters.maxPrice=null; filters.cats=[]; filters.tags=[]; filters.sortBy='added-desc'; saveAndRender(); }); }

// ---- Seçenekleri doldurma ----
function uniqueNonEmpty(arr){ return Array.from(new Set(arr.filter(x=>!!x&&String(x).trim()!=='').map(String))).sort((a,b)=>a.localeCompare(b,'tr')); }
function populateFilterOptions(){ const fLang=$('fLang'); const fFormat=$('fFormat'); const fCats=$('fCats'); const fTags=$('fTags'); if(!fLang||!fFormat) return; const langs=uniqueNonEmpty(myLibrary.map(b=>b.language||'')); const formats=uniqueNonEmpty(myLibrary.map(b=>b.format||'')); const allCats=uniqueNonEmpty(myLibrary.flatMap(b=>Array.isArray(b.categories)?b.categories:[])); const allTags=uniqueNonEmpty(myLibrary.flatMap(b=>Array.isArray(b.tags)?b.tags:[])); const prevLang=fLang.value; const prevFmt=fFormat.value; const prevCats=fCats?getSelectValues(fCats):[]; const prevTags=fTags?getSelectValues(fTags):[]; fLang.innerHTML=`<option value="">Dil (tümü)</option>`+langs.map(l=>`<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join(''); fFormat.innerHTML=`<option value="">Format (tümü)</option>`+formats.map(f=>`<option value="${escapeAttr(f)}">${escapeHtml(f)}</option>`).join(''); if(fCats){ fCats.innerHTML=allCats.map(c=>`<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join(''); [...fCats.options].forEach(o=>{ o.selected=prevCats.includes(o.value); }); } if(fTags){ fTags.innerHTML=allTags.map(t=>`<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join(''); [...fTags.options].forEach(o=>{ o.selected=prevTags.includes(o.value); }); } if([...fLang.options].some(o=>o.value===prevLang)) fLang.value=prevLang; if([...fFormat.options].some(o=>o.value===prevFmt)) fFormat.value=prevFmt; }

// ---- Kamera listesi ----
async function populateCameras(){ if(!navigator.mediaDevices?.enumerateDevices) return; try{ const devices=await navigator.mediaDevices.enumerateDevices(); const cams=devices.filter(d=>d.kind==='videoinput'); const sel=$('cameraSelect'); if(!sel) return; const prev=sel.value; sel.innerHTML='<option value="">Otomatik (varsayılan)</option>' + cams.map(c=>`<option value="${c.deviceId}">${c.label||'Kamera'}</option>`).join(''); if([...sel.options].some(o=>o.value===prev)) sel.value=prev; }catch(e){ console.warn('Kamera listesi alınamadı', e); } }

// ---- Barkod Tarama (QuaggaJS) + Torch ----
let isScanning=false; let lastDetectTs=0; let torchOn=false; let torchCapable=false;
function getActiveVideoTrack(){ try{ const video=document.querySelector('#barcodeViewport video'); const track=video && video.srcObject && video.srcObject.getVideoTracks && video.srcObject.getVideoTracks()[0]; return track || null; }catch(e){ return null; } }
async function setTorch(desired){ const track=getActiveVideoTrack(); const btn=$('torchBtn'); if(!track){ btn && (btn.disabled=true); return; }
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  if (!caps || !caps.torch){ torchCapable=false; btn && (btn.disabled=true); return; }
  try{
    await track.applyConstraints({ advanced: [{ torch: desired }] });
    torchOn = desired; torchCapable=true;
    if(btn){ btn.disabled=false; btn.textContent = 'Flaş: ' + (torchOn?'Açık':'Kapalı'); }
  }catch(e){ console.warn('Torch uygulanamadı', e); btn && (btn.disabled=true); }
}
async function toggleTorch(){ await setTorch(!torchOn); }
async function startBarcodeScan(){ try{ if(typeof Quagga==='undefined'){ alert('Barkod kütüphanesi (QuaggaJS) yüklenemedi. İnternet ve script etiketini kontrol edin.'); return; } if(isScanning) return; 
    let deviceId = $('cameraSelect')?.value || '';
    if(!deviceId && navigator.mediaDevices?.enumerateDevices){ try{ const devices=await navigator.mediaDevices.enumerateDevices(); const cams=devices.filter(d=>d.kind==='videoinput'); if(cams.length>0) deviceId=cams[0].deviceId; }catch{} }
    isScanning=true; $('barcodeModal').style.display='block'; document.body.style.overflow='hidden'; const constraints = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' };
    Quagga.init({ inputStream:{ type:'LiveStream', target: document.querySelector('#barcodeViewport'), constraints:{ ...constraints, width:{ideal:1280}, height:{ideal:720} } }, locator:{ patchSize:'medium', halfSample:true }, numOfWorkers: navigator.hardwareConcurrency ? Math.max(1, Math.min(4, navigator.hardwareConcurrency - 1)) : 2, frequency:10, decoder:{ readers:['ean_reader','ean_8_reader','upc_reader','upc_e_reader'] }, locate:true }, err=>{ if(err){ console.error(err); alert('Kamera başlatılamadı. İzinleri ve HTTPS bağlantısını kontrol edin.'); stopBarcodeScan(); return; } Quagga.start(); const video=document.querySelector('#barcodeViewport video'); if(video){ video.onloadeddata=async ()=>{ // Torch hazır mı?
            $('torchBtn') && ($('torchBtn').disabled = true);
            await setTorch(false); // keşif + kapalı başlat
          }; }
      });
    Quagga.offDetected();
    Quagga.onDetected(onBarcodeDetected);
    // Torch button click
    if ($('torchBtn')) {
      $('torchBtn').onclick = toggleTorch;
    }
  }catch(e){ console.error(e); alert('Barkod tarama başlatılamadı.'); stopBarcodeScan(); } }
function stopBarcodeScan(){ try{ if(typeof Quagga!=='undefined'){ Quagga.offDetected(); Quagga.stop(); } }catch(e){ console.warn('Quagga stop uyarısı', e); } finally { isScanning=false; $('barcodeModal')&&($('barcodeModal').style.display='none'); document.body.style.overflow=''; torchOn=false; if($('torchBtn')){ $('torchBtn').textContent='Flaş: Kapalı'; $('torchBtn').disabled=true; } } }
function onBarcodeDetected(data){ const now=Date.now(); if(now - lastDetectTs < 1500) return; lastDetectTs = now; try{ const code = (data && data.codeResult && data.codeResult.code) ? String(data.codeResult.code).trim() : ''; if(!code) return; const digits = code.replace(/[^0-9]/g,''); if(digits.length===13 && (digits.startsWith('978') || digits.startsWith('979'))){ $('isbnSearch').value = digits; stopBarcodeScan(); searchBook(); } else { $('barcodeHint') && ($('barcodeHint').textContent = 'Barkod okundu: '+code+' (ISBN beklenen 13 hane, 978/979 ile başlamalı)'); } }catch(e){ console.error('onDetected hata', e); } }

// ---- Render (filtre + sıralama) ----
function saveAndRender(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(myLibrary)); populateFilterOptions(); const filtered=myLibrary.filter(applyFilters); const sorted=sortBooks(filtered, filters.sortBy); const grid=$('libraryGrid'); if(!grid) return; grid.innerHTML=''; sorted.forEach(book=>{ const badges=[]; if(book.format) badges.push(book.format); if(book.language) badges.push(book.language); (book.categories||[]).slice(0,4).forEach(c=>badges.push('Kategori: '+c)); (book.tags||[]).slice(0,4).forEach(t=>badges.push('#'+t)); const meta=[ book.publisher?`Yayıncı: ${escapeHtml(book.publisher)}`:'', book.edition?`Baskı: ${escapeHtml(book.edition)}`:'', book.pageCount?`Sayfa: ${escapeHtml(book.pageCount)}`:'', book.isbn?`ISBN: ${escapeHtml(book.isbn)}`:'', book.publishedDate?`Yayın: ${escapeHtml(book.publishedDate)}`:'', book.purchaseDate?`Satın alma: ${escapeHtml(toLocalDateString(book.purchaseDate))}`:'', book.place?`Yer: ${escapeHtml(book.place)}`:'', (book.price??0)?`Fiyat: ${escapeHtml(Number(book.price).toFixed(2))} TL`:'', `Eklenme: ${escapeHtml(toLocalDateString(book.addedDate))}` ].filter(Boolean); const desc=(book.description||'').trim(); const short=desc.length>180?desc.slice(0,180)+'…':desc; const authorLine=book.author?escapeHtml(book.author):''; const trLine=book.translator?` · Çeviren: ${escapeHtml(book.translator)}`:''; const imgSrc=escapeAttr(book.img||''); const imgTitle=escapeAttr(book.title||''); const card=document.createElement('div'); card.className='book-card'+(editingBookId===book.id?' is-editing':''); card.innerHTML=`
      <div class="card-header">
        <div class="card-title-wrap">
          <h3 class="book-title">${escapeHtml(book.title)}</h3>
          ${(authorLine||trLine)?`<div class="author-line">${authorLine}${trLine}</div>`:''}
          ${editingBookId===book.id?`<span class="editing-badge"><span class="editing-dot"></span>🟡 Düzenleniyor</span>`:''}
        </div>
        <div class="card-actions">
          <button class="edit-btn" type="button" onclick="startEdit(${book.id})">Düzenle</button>
          <button class="delete-btn" type="button" onclick="deleteBook(${book.id})">Sil</button>
        </div>
      </div>
      <div class="book-top">
        <img class="cover-click" src="${imgSrc}" alt="Kapak" data-src="${imgSrc}" data-title="${imgTitle}" />
        <div>
          <p class="book-meta">${meta.join('<br>')}</p>
        </div>
      </div>
      ${badges.length?`<div class="badges">${badges.map(b=>`<span class="badge">${escapeHtml(b)}</span>`).join('')}</div>`:''}
      ${short?`<p class="book-meta">${escapeHtml(short)}</p>`:''}
    `; grid.appendChild(card); }); $('totalBooks')&&($('totalBooks').innerText=myLibrary.length); $('filteredCount')&&($('filteredCount').innerText=sorted.length); $('totalSpend')&&($('totalSpend').innerText=sorted.reduce((acc,b)=>acc+(Number(b.price)||0),0).toFixed(2)); }

// --- Uygulama başlangıcı ---
saveAndRender();
initUI();
initFiltersEvents();
populateCameras();
