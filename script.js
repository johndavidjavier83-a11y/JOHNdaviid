const TEMPLATE = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
/* ====== CHANGE YOUR UPLOAD CODE HERE ====== */
const OWNER_CODE = "1234";
/* ========================================== */

const CATS = [
  {id:"quiz",   name:"Quiz",       sub:"Short checks on recent lessons."},
  {id:"long",   name:"Long Quiz",  sub:"Bigger quizzes covering several topics."},
  {id:"mid",    name:"Midterms",   sub:"Midterm exams and results."},
  {id:"final",  name:"Finals",     sub:"Final exams and results."},
  {id:"act",    name:"Activity",   sub:"Class activities and seatwork."},
  {id:"proj",   name:"Project",    sub:"Projects, reports and outputs."}
];
let current = "home", admin = false, db, items = [];
const $ = id => document.getElementById(id);

/* ---------- IndexedDB (stored in this browser, no server) ---------- */
function openDB(){
  return new Promise((res,rej)=>{
    const r = indexedDB.open("academicWorks",1);
    r.onupgradeneeded = () => r.result.createObjectStore("items",{keyPath:"id"});
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const tx = (m) => db.transaction("items",m).objectStore("items");
const getAll = () => new Promise(r=>{const q=tx("readonly").getAll();q.onsuccess=()=>r(q.result)});
const put = o => new Promise(r=>{const q=tx("readwrite").put(o);q.onsuccess=()=>r()});
const del = id => new Promise(r=>{const q=tx("readwrite").delete(id);q.onsuccess=()=>r()});

/* ---------- Rendering ---------- */
function renderTabs(){
  $("tabs").innerHTML = "";
  const hb = document.createElement("button");
  hb.className = "tab"+(current==="home"?" on":""); hb.setAttribute("role","tab"); hb.textContent = "Home";
  hb.onclick = () => {current="home"; render();}; $("tabs").appendChild(hb);
  CATS.forEach(c=>{
    const n = items.filter(i=>i.cat===c.id).length;
    const b = document.createElement("button");
    b.className = "tab"+(c.id===current?" on":"");
    b.setAttribute("role","tab");
    b.innerHTML = c.name + (n?`<small>${n}</small>`:"");
    b.onclick = () => {current=c.id; render();};
    $("tabs").appendChild(b);
  });
}
function render(){
  renderProfile();
  $("homeView").hidden = current!=="home"; $("sheet").hidden = current==="home";
  if(current==="home"){ renderTabs(); renderHome(); return; }
  const c = CATS.find(x=>x.id===current);
  $("catTitle").textContent = c.name; $("catSub").textContent = c.sub;
  renderTabs();
  const all = items.filter(i=>i.cat===current);
  const pct = i => { const m = (i.score||"").match(/(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?)|%)/); return m ? (m[2] ? m[1]/m[2]*100 : +m[1]) : null; };
  const pcts = all.map(pct).filter(v=>v!==null);
  $("stats").innerHTML = `<div class="stat"><b>${all.length}</b>items</div>`
    + `<div class="stat"><b>${all.reduce((n,i)=>n+i.files.length+i.images.length,0)}</b>uploads</div>`
    + (pcts.length ? `<div class="stat"><b>${(pcts.reduce((a,b)=>a+b,0)/pcts.length).toFixed(1)}%</b>average score</div>` : "");
  const q = $("search").value.trim().toLowerCase(), so = $("sort").value;
  const list = all.filter(i=>!q || (i.title+" "+i.note+" "+i.files.map(f=>f.name).join(" ")).toLowerCase().includes(q))
    .sort((a,b)=> so==="old" ? a.date-b.date : so==="az" ? a.title.localeCompare(b.title) : so==="score" ? (pct(b)??-1)-(pct(a)??-1) : b.date-a.date);
  const g = $("grid"); g.innerHTML = "";
  if(!list.length){
    g.innerHTML = `<div class="empty" style="grid-column:1/-1">${q?"No matches for your search.":"Nothing here yet."}${!q&&admin?" Add your first one above.":""}${!q&&!admin?" Check back soon.":""}</div>`;
    return;
  }
  list.forEach(it=>{
    const el = document.createElement("article"); el.className = "item";
    const thumb = document.createElement("div"); thumb.className = "thumb";
    if(it.images.length){
      const img = document.createElement("img");
      img.src = URL.createObjectURL(it.images[0]); img.alt = it.title;
      thumb.appendChild(img);
      thumb.title = "Click to view all images";
      thumb.onclick = () => openImages(it);
    } else { thumb.textContent = "No image"; thumb.style.cursor = "default"; thumb.style.color = "var(--muted)"; }
    const body = document.createElement("div"); body.className = "body";
    const h = document.createElement("h3"); h.textContent = it.title; body.appendChild(h);
    if(it.score){const s=document.createElement("span");s.className="score";s.textContent=it.score;body.appendChild(s);}
    if(it.note){const p=document.createElement("p");p.textContent=it.note;body.appendChild(p);}
    const m = document.createElement("div"); m.className = "meta";
    m.textContent = new Date(it.date).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})
      + (it.images.length>1 ? " • "+it.images.length+" images" : "");
    body.appendChild(m);
    const fl = document.createElement("div"); fl.className = "files";
    it.files.forEach(f=>{
      const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name;
      a.textContent = "📎 " + f.name; fl.appendChild(a);
    });
    body.appendChild(fl);
    const acts = document.createElement("div"); acts.className = "acts";
    const d = document.createElement("button"); d.className = "btn alt"; d.textContent = "Delete";
    d.onclick = async () => { if(confirm("Delete \""+it.title+"\"?")){await del(it.id); await load();} };
    const e = document.createElement("button"); e.className = "btn alt"; e.textContent = "Edit"; e.style.marginRight = "8px";
    e.onclick = () => startEdit(it);
    acts.append(e, d);
    el.append(thumb, body, acts); g.appendChild(el);
  });
}
let lbItem=null, lbI=0;
function lbShow(){ $("lbImg").src = URL.createObjectURL(lbItem.images[lbI]); $("lbCap").textContent = lbItem.title+" ("+(lbI+1)+"/"+lbItem.images.length+")";
  document.querySelectorAll(".lbnav").forEach(b=>b.style.display = lbItem.images.length>1?"block":"none"); }
function lbMove(d){ lbI=(lbI+d+lbItem.images.length)%lbItem.images.length; lbShow(); }
function openImages(it){ lbItem=it; lbI=0; lbShow(); $("lightbox").classList.add("show"); }
$("lbPrev").onclick = e => { e.stopPropagation(); lbMove(-1); };
$("lbNext").onclick = e => { e.stopPropagation(); lbMove(1); };
$("lightbox").onclick = e => { if(e.target.id==="lightbox") $("lightbox").classList.remove("show"); };
document.addEventListener("keydown", e => {
  if(!$("lightbox").classList.contains("show")) return;
  if(e.key==="Escape") $("lightbox").classList.remove("show");
  if(e.key==="ArrowRight") lbMove(1); if(e.key==="ArrowLeft") lbMove(-1);
});
$("search").oninput = render; $("sort").onchange = render;
let raw = [], about = null;
async function load(){ raw = await getAll(); if(!raw.length && SEED.length) raw = await hydrate(SEED); about = raw.find(i=>i.id==="__about__") || null; items = raw.filter(i=>i.id!=="__about__"); render(); }

/* ---------- Home ---------- */
function renderHome(){
  const box = $("overview"); box.innerHTML = "";
  const h1 = document.createElement("h2"); h1.className = "ovh"; h1.textContent = "My works"; box.appendChild(h1);
  const g = document.createElement("div"); g.className = "ovgrid";
  CATS.forEach(c=>{
    const list = items.filter(i=>i.cat===c.id).sort((a,b)=>b.date-a.date);
    const b = document.createElement("button"); b.className = "cc";
    const cv = document.createElement("div"); cv.className = "cv";
    const withImg = list.find(i=>i.images.length);
    if(withImg){ const im = document.createElement("img"); im.src = URL.createObjectURL(withImg.images[0]); im.alt = ""; cv.appendChild(im); }
    else cv.textContent = "No image yet";
    const t = document.createElement("div"); t.className = "ct";
    t.innerHTML = "<b></b><span></span>"; t.firstChild.textContent = c.name;
    t.lastChild.textContent = list.length + (list.length===1 ? " item" : " items");
    b.append(cv,t); b.onclick = () => {current=c.id; render(); window.scrollTo({top:0,behavior:"smooth"});};
    g.appendChild(b);
  });
  box.appendChild(g);
  const rec = items.slice().sort((a,b)=>b.date-a.date).slice(0,4);
  if(rec.length){
    const h2 = document.createElement("h2"); h2.className = "ovh"; h2.textContent = "Latest uploads"; box.appendChild(h2);
    const rg = document.createElement("div"); rg.className = "grid"; rg.style.marginBottom = "10px";
    rec.forEach(it=>{
      const c = CATS.find(x=>x.id===it.cat);
      const el = document.createElement("article"); el.className = "item";
      const th = document.createElement("div"); th.className = "thumb";
      if(it.images.length){ const im = document.createElement("img"); im.src = URL.createObjectURL(it.images[0]); im.alt = it.title; th.appendChild(im); th.onclick = () => openImages(it); }
      else { th.textContent = "No image"; th.style.cursor = "default"; th.style.color = "var(--muted)"; }
      const bd = document.createElement("div"); bd.className = "body";
      const h = document.createElement("h3"); h.textContent = it.title; bd.appendChild(h);
      if(it.score){ const sc = document.createElement("span"); sc.className = "score"; sc.textContent = it.score; bd.appendChild(sc); }
      const m = document.createElement("div"); m.className = "meta"; m.textContent = c.name + ", " + new Date(it.date).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
      bd.appendChild(m);
      const go = document.createElement("button"); go.className = "btn alt"; go.style.margin = "0 12px 12px"; go.textContent = "Open " + c.name;
      go.onclick = () => {current=c.id; render(); window.scrollTo({top:0,behavior:"smooth"});};
      el.append(th,bd,go); rg.appendChild(el);
    });
    box.appendChild(rg);
  } else {
    const e = document.createElement("div"); e.className = "empty"; e.textContent = admin ? "Open a category and add your first work." : "No works have been added yet. Check back soon."; box.appendChild(e);
  }
}
$("brand").onclick = () => { current = "home"; render(); };

/* ---------- About Me ---------- */
function renderProfile(){
  const a = about || {}, box = $("profile"); box.innerHTML = "";
  const av = document.createElement(a.images && a.images[0] ? "img" : "div"); av.className = "avatar";
  if(av.tagName==="IMG"){ av.src = URL.createObjectURL(a.images[0]); av.alt = a.name||"Profile photo"; }
  else av.textContent = (a.name||"?").trim().charAt(0).toUpperCase();
  const info = document.createElement("div"); info.className = "pinfo";
  const h = document.createElement("h2"); h.textContent = a.name || "Your name here"; info.appendChild(h);
  const t = [a.tagline,a.school].filter(Boolean).join(", ");
  if(t){ const e = document.createElement("div"); e.className = "tag"; e.textContent = t; info.appendChild(e); }
  const p = document.createElement("p"); p.textContent = a.bio || "Tell visitors who you are and what you study. Enter the owner code, then click Edit About Me."; info.appendChild(p);
  if(a.skills){ const c = document.createElement("div"); c.className = "chips";
    a.skills.split(",").map(x=>x.trim()).filter(Boolean).forEach(x=>{ const s = document.createElement("span"); s.className="chip"; s.textContent=x; c.appendChild(s); });
    info.appendChild(c); }
  if(a.email){ const m = document.createElement("a"); m.href = "mailto:"+a.email; m.textContent = a.email; info.appendChild(m); }
  const b = document.createElement("button"); b.className = "btn alt"; b.id = "editProfile"; b.textContent = "Edit About Me"; b.onclick = openProfile;
  info.appendChild(document.createElement("br")); info.appendChild(b);
  box.append(av, info);
}
function openProfile(){ const a = about || {};
  $("pName").value=a.name||""; $("pTag").value=a.tagline||""; $("pSchool").value=a.school||"";
  $("pBio").value=a.bio||""; $("pSkills").value=a.skills||""; $("pEmail").value=a.email||""; $("pPhoto").value="";
  $("profileModal").classList.add("show"); $("pName").focus(); }
$("pCancel").onclick = () => $("profileModal").classList.remove("show");
$("pSave").onclick = async () => {
  const ph = $("pPhoto").files[0];
  await put({id:"__about__", cat:"about", date:0, files:[], name:$("pName").value.trim(), tagline:$("pTag").value.trim(),
    school:$("pSchool").value.trim(), bio:$("pBio").value.trim(), skills:$("pSkills").value.trim(), email:$("pEmail").value.trim(),
    images: ph ? [ph] : ((about&&about.images)||[])});
  $("profileModal").classList.remove("show"); await load();
};

/* ---------- Owner code ---------- */
async function setAdmin(on){
  if(on) await adoptSeed();
  admin = on; try{sessionStorage.setItem('aw-admin', on?'1':'0')}catch{} document.body.classList.toggle("admin",on);
  $("form").classList.toggle("show",on);
  $("lockBtn").textContent = on ? "Lock (stop uploading)" : "Owner login";
  $("mode").textContent = on ? "Owner mode: you can upload and delete" : "Visitors can view everything. Only the owner can edit.";
  render();
}
$("lockBtn").onclick = () => {
  if(admin){ setAdmin(false); return; }
  $("codeInput").value = ""; $("codeErr").textContent = "";
  $("codeModal").classList.add("show"); $("codeInput").focus();
};
const tryCode = () => {
  if($("codeInput").value === OWNER_CODE){ $("codeModal").classList.remove("show"); setAdmin(true); }
  else $("codeErr").textContent = "Wrong code. Try again.";
};
$("codeOk").onclick = tryCode;
$("codeInput").onkeydown = e => { if(e.key==="Enter") tryCode(); };
$("codeCancel").onclick = () => $("codeModal").classList.remove("show");

/* ---------- Save ---------- */
let editing = null;
function resetForm(){ editing=null; ["fTitle","fScore","fNote","fImg","fFile"].forEach(i=>$(i).value="");
  $("saveBtn").textContent="Save to this category"; $("cancelEdit").hidden=true; }
function startEdit(it){ editing=it; $("fTitle").value=it.title; $("fScore").value=it.score; $("fNote").value=it.note;
  $("saveBtn").textContent="Update item (new files get added)"; $("cancelEdit").hidden=false;
  $("form").scrollIntoView({behavior:"smooth",block:"center"}); $("fTitle").focus(); }
$("cancelEdit").onclick = resetForm;
$("saveBtn").onclick = async () => {
  const title = $("fTitle").value.trim();
  const images = [...$("fImg").files], files = [...$("fFile").files];
  if(!title){ $("formMsg").textContent = "Add a title first."; return; }
  if(!editing && !images.length && !files.length && !$("fNote").value.trim()){ $("formMsg").textContent = "Add an image, a file or a note."; return; }
  const base = editing || {id:Date.now()+"-"+Math.random().toString(36).slice(2,7), cat:current, date:Date.now(), images:[], files:[]};
  await put({...base, title, score:$("fScore").value.trim(), note:$("fNote").value.trim(),
    images:[...base.images,...images], files:[...base.files,...files]});
  const was = !!editing; resetForm();
  $("formMsg").textContent = was ? "Updated ✓" : "Saved ✓"; setTimeout(()=>$("formMsg").textContent="",2000);
  await load();
};

/* ---------- Backup / Restore (so you can move it to another device) ---------- */
const toB64 = b => new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
const fromB64 = async (u,n) => { const b = await (await fetch(u)).blob(); return new File([b],n,{type:b.type}); };
const SEED = JSON.parse($("seed").textContent || "[]");
async function serialize(list){
  const out = [];
  for(const it of list) out.push({...it,
    images: await Promise.all(it.images.map(async f=>({n:f.name,d:await toB64(f)}))),
    files: await Promise.all(it.files.map(async f=>({n:f.name,d:await toB64(f)})))});
  return out;
}
async function hydrate(data){
  return Promise.all(data.map(async it=>({...it,
    images: await Promise.all(it.images.map(x=>fromB64(x.d,x.n))),
    files: await Promise.all(it.files.map(x=>fromB64(x.d,x.n)))})));
}
async function adoptSeed(){ /* owner on a new device: copy published data into this browser so it can be edited */
  if(!SEED.length || (await getAll()).length) return;
  for(const it of await hydrate(SEED)) await put(it);
  await load();
}
function download(blob,name){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
$("exportBtn").onclick = async () => download(new Blob([JSON.stringify(await serialize(raw))],{type:"application/json"}), "academic-works-backup.json");
$("publishBtn").onclick = async () => {
  const data = JSON.stringify(await serialize(raw)).replace(/</g,"\\u003c");
  const html = TEMPLATE.replace(/<script type="application\/json" id="seed">[\s\S]*?<\/script>/, () => '<script type="application/json" id="seed">'+data+'<\/script>'.replace("\\/","/"));
  download(new Blob([html],{type:"text/html"}), "index.html");
  alert("Done. Upload the downloaded index.html to a free host (Netlify Drop, GitHub Pages or Cloudflare Pages). Visitors will see all your pictures and files, and only you can edit with your code. Publish again after every change.");
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async e => {
  try{
    const data = JSON.parse(await e.target.files[0].text());
    for(const it of await hydrate(data)) await put(it);
    await load(); alert("Restored "+data.length+" items.");
  }catch{ alert("That file is not a valid backup."); }
  e.target.value = "";
};

openDB().then(d=>{db=d; load().then(()=>{ try{ if(sessionStorage.getItem('aw-admin')==='1') setAdmin(true); }catch{} });}).catch(()=>{$("grid").innerHTML='<div class="empty">Your browser blocked local storage. Try a normal (non-private) window.</div>'});
