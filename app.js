if(!window.crypto||!window.crypto.subtle){document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0b14;color:#e2e8f0;font-family:sans-serif;text-align:center;padding:20px"><div><h1>⚠ 浏览器不支持</h1><p style="color:#94a3b8;margin-top:8px">请使用支持 Web Crypto API 的现代浏览器（HTTPS）</p></div></div>';throw new Error('No Web Crypto')}

const SC='vault_config',SD='vault_data',TV='VAULT_OK';
let mk=null,keys=[];

function b64(a){const b=new Uint8Array(a);let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s)}
function ub64(s){const d=atob(s),a=new Uint8Array(d.length);for(let i=0;i<d.length;i++)a[i]=d.charCodeAt(i);return a.buffer}
function hex(a){return Array.from(new Uint8Array(a)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)})}
function fmtDate(t){return new Date(t).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function maskKey(k){if(k.length<=8)return'•'.repeat(k.length);return k.substring(0,4)+'•'.repeat(Math.min(k.length-8,20))+k.substring(k.length-4)}

const C={
genSalt(){return crypto.getRandomValues(new Uint8Array(16))},
genIV(){return crypto.getRandomValues(new Uint8Array(12))},
async derive(pw,salt){
const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},true,['encrypt','decrypt'])},
async enc(pt,key){const iv=this.genIV(),ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(pt));return{c:b64(ct),i:b64(iv)}},
async dec(ci,ii,key){const d=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(ub64(ii))},key,ub64(ci));return new TextDecoder().decode(d)},
async hash(d){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(d));return hex(h)}
};

const S={
saveCfg(c){localStorage.setItem(SC,JSON.stringify(c))},
loadCfg(){try{return JSON.parse(localStorage.getItem(SC))}catch{return null}},
saveData(d){localStorage.setItem(SD,JSON.stringify(d))},
loadData(){try{return JSON.parse(localStorage.getItem(SD)||'[]')}catch{return[]}}
};

class GL{
constructor(wid,cid,cb){this.w=document.getElementById(wid);this.cv=document.getElementById(cid);this.ctx=this.cv.getContext('2d');this.cb=cb;this.dots=[];this.sel=[];this.drawing=false;this._init()}
_init(){
this.grid=document.createElement('div');this.grid.className='gesture-grid';
for(let i=0;i<9;i++){const d=document.createElement('div');d.className='g-dot';d.dataset.i=i;this.grid.appendChild(d);this.dots.push(d)}
this.w.appendChild(this.grid);
this._resize();
this._onResize=()=>this._resize();
this.w.addEventListener('pointerdown',this._pd.bind(this));
this.w.addEventListener('pointermove',this._pm.bind(this));
this.w.addEventListener('pointerup',this._pu.bind(this));
window.addEventListener('resize',this._onResize)}
_resize(){const r=this.w.getBoundingClientRect();this.cv.width=r.width;this.cv.height=r.height}
_center(i){const wr=this.w.getBoundingClientRect(),dr=this.dots[i].getBoundingClientRect();return{x:dr.left-wr.left+dr.width/2,y:dr.top-wr.top+dr.height/2}}
_hit(x,y){for(let i=0;i<9;i++){const c=this._center(i);if(Math.hypot(x-c.x,y-c.y)<28)return i}return-1}
_sel(i){this.sel.push(i);this.dots[i].classList.add('active');this._draw()}
_draw(){this.ctx.clearRect(0,0,this.cv.width,this.cv.height);if(this.sel.length<2)return;this.ctx.beginPath();this.ctx.strokeStyle='#6366f1';this.ctx.lineWidth=3;this.ctx.lineCap='round';this.ctx.lineJoin='round';const f=this._center(this.sel[0]);this.ctx.moveTo(f.x,f.y);for(let j=1;j<this.sel.length;j++){const p=this._center(this.sel[j]);this.ctx.lineTo(p.x,p.y)}this.ctx.stroke()}
_drawTo(x,y){this._draw();if(this.sel.length>0){const l=this._center(this.sel[this.sel.length-1]);this.ctx.beginPath();this.ctx.strokeStyle='rgba(99,102,241,.5)';this.ctx.lineWidth=2;this.ctx.lineCap='round';this.ctx.moveTo(l.x,l.y);this.ctx.lineTo(x,y);this.ctx.stroke()}}
_pd(e){e.preventDefault();this.w.setPointerCapture(e.pointerId);this.drawing=true;this.sel=[];this.dots.forEach(d=>{d.classList.remove('active','error','success')});this._resize();const r=this.w.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,h=this._hit(x,y);if(h>=0)this._sel(h)}
_pm(e){if(!this.drawing)return;const r=this.w.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,h=this._hit(x,y);if(h>=0&&!this.sel.includes(h))this._sel(h);this._drawTo(x,y)}
_pu(e){this.drawing=false;this.ctx.clearRect(0,0,this.cv.width,this.cv.height);this._draw();if(this.sel.length>=4){this.cb(this.sel.join(''),this)}else if(this.sel.length>0){this._markError();setTimeout(()=>this.reset(),600)}}
_markError(){this.dots.forEach(d=>{if(d.classList.contains('active')){d.classList.remove('active');d.classList.add('error')}})}
_markSuccess(){this.dots.forEach(d=>{if(d.classList.contains('active')){d.classList.remove('active');d.classList.add('success')}})}
reset(){this.sel=[];this.dots.forEach(d=>d.classList.remove('active','error','success'));this.ctx.clearRect(0,0,this.cv.width,this.cv.height)}
destroy(){this.reset();window.removeEventListener('resize',this._onResize);if(this.grid&&this.grid.parentNode)this.grid.remove()}
}

function toast(msg,type='success'){const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;document.getElementById('toasts').appendChild(t);requestAnimationFrame(()=>t.classList.add('show'));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},2500)}
function togVis(id){const i=document.getElementById(id);i.type=i.type==='password'?'text':'password'}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

let sGL1=null,sGL2=null,lGL=null,resetGL1=null,resetGL2=null;
let setupPw='',setupG='',resetVerifiedKey=null,resetG='';

function setupNext1(){
const pw=document.getElementById('spw').value,pw2=document.getElementById('spw2').value;
if(!pw||pw.length<4){toast('密码至少4位','error');return}
if(pw!==pw2){toast('两次密码不一致','error');return}
setupPw=pw;
document.getElementById('s1').classList.remove('active');
document.getElementById('s2').classList.add('active');
}

async function chooseMethod(type){
if(type==='gesture'){
document.getElementById('s2').classList.remove('active');
document.getElementById('s3').classList.add('active');
sGL1=new GL('sgw','sgc',(p,gl)=>{
setupG=p;gl._markSuccess();
setTimeout(()=>{
document.getElementById('s3').classList.remove('active');
document.getElementById('s4').classList.add('active');
sGL2=new GL('sgw2','sgc2',async(p2,gl2)=>{
if(p2===setupG){gl2._markSuccess();setTimeout(()=>doSetup('gesture'),400)}
else{gl2._markError();document.getElementById('sgh2').textContent='手势不一致，请重试';setTimeout(()=>{gl2.reset();sGL1.reset();document.getElementById('s4').classList.remove('active');document.getElementById('s3').classList.add('active');document.getElementById('sgh').textContent='';document.getElementById('sgh2').textContent=''},800)}
});
},400);
});
}else{
await doSetup('password');
}
}

async function doSetup(lockType){
try{
const salt=C.genSalt();
const key=await C.derive(setupPw,salt);
const test=await C.enc(TV,key);
let cfg={lockType,salt:b64(salt),test};
if(lockType==='gesture'){
const gSalt=C.genSalt(),iv=C.genIV();
const gHash=await C.hash(setupG);
const gKey=await C.derive(setupG,gSalt);
const raw=await crypto.subtle.exportKey('raw',key);
const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv},gKey,raw);
cfg.gSalt=b64(gSalt);cfg.gHash=gHash;cfg.wI=b64(iv);cfg.wC=b64(wrapped);
}
S.saveCfg(cfg);S.saveData([]);
toast('设置成功！');
showScreen('main-screen');
mk=key;keys=[];renderKeys();
setupPw='';setupG='';
if(sGL1){sGL1.destroy();sGL1=null}
if(sGL2){sGL2.destroy();sGL2=null}
}catch(e){toast('设置失败: '+e.message,'error')}
}

function initLockScreen(){
const cfg=S.loadCfg();
if(!cfg){showScreen('setup-screen');return}
if(cfg.lockType==='gesture'){
document.getElementById('lock-gesture').classList.remove('hidden');
document.getElementById('lock-pw').classList.add('hidden');
initLockGesture();
}else{
document.getElementById('lock-gesture').classList.add('hidden');
document.getElementById('lock-pw').classList.remove('hidden');
}
}

function initLockGesture(){
if(lGL)return;
lGL=new GL('lgw','lgc',async(p,gl)=>{
try{
const cfg=S.loadCfg();
const gh=await C.hash(p);
if(gh!==cfg.gHash){gl._markError();document.getElementById('lgh').textContent='手势错误';setTimeout(()=>{gl.reset();document.getElementById('lgh').textContent=''},800);return}
const gKey=await C.derive(p,ub64(cfg.gSalt));
const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(ub64(cfg.wI))},gKey,ub64(cfg.wC));
mk=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
await loadKeys();
gl._markSuccess();
setTimeout(()=>{showScreen('main-screen');renderKeys();gl.reset()},400);
}catch(e){gl._markError();document.getElementById('lgh').textContent='解锁失败';setTimeout(()=>{gl.reset();document.getElementById('lgh').textContent=''},800)}
});
}

async function unlockByPw(){
const pw=document.getElementById('lpw').value;
if(!pw){toast('请输入密码','error');return}
try{
const cfg=S.loadCfg();
const key=await C.derive(pw,ub64(cfg.salt));
const ok=await C.dec(cfg.test.c,cfg.test.i,key);
if(ok!==TV)throw new Error('wrong');
mk=key;await loadKeys();
showScreen('main-screen');renderKeys();
document.getElementById('lpw').value='';document.getElementById('lpwh').textContent='';
}catch(e){document.getElementById('lpwh').textContent='密码错误';toast('密码错误','error')}
}

async function loadKeys(){
const raw=S.loadData();keys=[];
for(const e of raw){
try{
const ak=await C.dec(e.ek.c,e.ek.i,mk);
keys.push({id:e.id,name:e.name,apiKey:ak,url:e.url||'',notes:e.notes||'',createdAt:e.createdAt,updatedAt:e.updatedAt});
}catch{keys.push({id:e.id,name:e.name,apiKey:'[解密失败]',url:e.url||'',notes:e.notes||'',createdAt:e.createdAt,updatedAt:e.updatedAt})}
}
}

async function saveAll(){
const out=[];
for(const k of keys){
const ek=await C.enc(k.apiKey,mk);
out.push({id:k.id,name:k.name,ek,url:k.url,notes:k.notes,createdAt:k.createdAt,updatedAt:k.updatedAt});
}
S.saveData(out);
}

function renderKeys(){
const q=(document.getElementById('search').value||'').toLowerCase();
const filtered=keys.filter(k=>k.name.toLowerCase().includes(q)||(k.url||'').toLowerCase().includes(q)||(k.notes||'').toLowerCase().includes(q));
const grid=document.getElementById('kg');
const empty=document.getElementById('empty');
if(filtered.length===0){grid.innerHTML='';empty.classList.remove('hidden');return}
empty.classList.add('hidden');
grid.innerHTML=filtered.map((k,i)=>`
<div class="key-card" data-id="${k.id}">
<div class="card-top"><span class="card-name">${esc(k.name)}</span></div>
${k.url?`<div class="card-url">${esc(k.url)}</div>`:''}
<div class="card-key-row"><span class="card-key-val" id="kv-${k.id}">${maskKey(k.apiKey)}</span><div class="card-key-btns"><button onclick="togKeyVis('${k.id}')" title="显示/隐藏">👁</button><button onclick="copyKey('${k.id}')" title="复制">📋</button></div></div>
${k.notes?`<div class="card-notes">${esc(k.notes)}</div>`:''}
<div class="card-foot"><button onclick="openEdit('${k.id}')" title="编辑">✎</button><button onclick="delKey('${k.id}')" title="删除">✕</button></div>
</div>`).join('');
}

let visSet=new Set();
function togKeyVis(id){
const el=document.getElementById('kv-'+id);if(!el)return;
if(visSet.has(id)){el.textContent=maskKey(keys.find(k=>k.id===id).apiKey);visSet.delete(id)}
else{el.textContent=keys.find(k=>k.id===id).apiKey;visSet.add(id)}
}
function copyKey(id){
const k=keys.find(x=>x.id===id);if(!k)return;
navigator.clipboard.writeText(k.apiKey).then(()=>toast('已复制')).catch(()=>toast('复制失败','error'));
}

function openAdd(){
document.getElementById('mtitle').textContent='添加 API Key';
document.getElementById('kform').reset();
document.getElementById('meid').value='';
document.getElementById('kmodal').classList.add('show');
}
function openEdit(id){
const k=keys.find(x=>x.id===id);if(!k)return;
document.getElementById('mtitle').textContent='编辑 API Key';
document.getElementById('mn').value=k.name;
document.getElementById('mk').value=k.apiKey;
document.getElementById('mk').type='password';
document.getElementById('mu').value=k.url;
document.getElementById('mno').value=k.notes;
document.getElementById('meid').value=id;
document.getElementById('kmodal').classList.add('show');
}
function closeModal(){document.getElementById('kmodal').classList.remove('show')}

async function saveKey(e){
e.preventDefault();
const btn=e.target.querySelector('[type="submit"]');
if(btn.disabled)return;btn.disabled=true;
const name=document.getElementById('mn').value.trim();
const ak=document.getElementById('mk').value;
const url=document.getElementById('mu').value.trim();
const notes=document.getElementById('mno').value.trim();
const eid=document.getElementById('meid').value;
if(!name||!ak){toast('名称和 Key 不能为空','error');btn.disabled=false;return}
const now=Date.now();
if(eid){
const k=keys.find(x=>x.id===eid);
if(k){k.name=name;k.apiKey=ak;k.url=url;k.notes=notes;k.updatedAt=now}
}else{keys.push({id:uuid(),name,apiKey:ak,url,notes,createdAt:now,updatedAt:now})}
await saveAll();renderKeys();closeModal();toast(eid?'已更新':'已添加');btn.disabled=false;
}

async function delKey(id){
if(!confirm('确定删除此 API Key？'))return;
keys=keys.filter(k=>k.id!==id);
await saveAll();renderKeys();toast('已删除');
}

function lockVault(){
mk=null;keys=[];visSet.clear();
document.getElementById('kg').innerHTML='';
document.getElementById('search').value='';
if(lGL)lGL.reset();
showScreen('lock-screen');
initLockScreen();
}

function exportAllExcel(){
if(typeof XLSX==='undefined'){toast('XLSX 库未加载，请检查网络','error');return}
if(!keys.length){toast('没有可导出的数据','error');return}
const data=keys.map(k=>({'名称':k.name,'API Key':k.apiKey,'URL':k.url||'','备注':k.notes||'','创建时间':fmtDate(k.createdAt)}));
const ws=XLSX.utils.json_to_sheet(data);
ws['!cols']=[{wch:20},{wch:50},{wch:30},{wch:30},{wch:20}];
const wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,ws,'API Keys');
XLSX.writeFile(wb,'vault_export_'+Date.now()+'.xlsx');
toast('导出成功');
}

function openReset(){
document.getElementById('rs1').classList.remove('hidden');
document.getElementById('rs2').classList.add('hidden');
document.getElementById('rs3').classList.add('hidden');
document.getElementById('rpw').value='';
resetVerifiedKey=null;resetG='';
if(resetGL1){resetGL1.destroy();resetGL1=null}
if(resetGL2){resetGL2.destroy();resetGL2=null}
document.getElementById('rmodal').classList.add('show');
}
function closeReset(){document.getElementById('rmodal').classList.remove('show');if(resetGL1){resetGL1.destroy();resetGL1=null}if(resetGL2){resetGL2.destroy();resetGL2=null}}

async function verifyResetPw(){
const pw=document.getElementById('rpw').value;
if(!pw){toast('请输入密码','error');return}
try{
const cfg=S.loadCfg();
const key=await C.derive(pw,ub64(cfg.salt));
const ok=await C.dec(cfg.test.c,cfg.test.i,key);
if(ok!==TV){toast('密码错误','error');return}
resetVerifiedKey=key;
document.getElementById('rs1').classList.add('hidden');
document.getElementById('rs2').classList.remove('hidden');
resetGL1=new GL('rgw','rgc',(p,gl)=>{
resetG=p;gl._markSuccess();
setTimeout(()=>{
document.getElementById('rs2').classList.add('hidden');
document.getElementById('rs3').classList.remove('hidden');
resetGL2=new GL('rgw2','rgc2',async(p2,gl2)=>{
if(p2===resetG){gl2._markSuccess();setTimeout(async()=>{
try{
const cfg=S.loadCfg();
const gSalt=C.genSalt(),iv=C.genIV();
const gHash=await C.hash(resetG);
const gKey=await C.derive(resetG,gSalt);
const raw=await crypto.subtle.exportKey('raw',resetVerifiedKey);
const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv},gKey,raw);
cfg.gSalt=b64(gSalt);cfg.gHash=gHash;cfg.wI=b64(iv);cfg.wC=b64(wrapped);cfg.lockType='gesture';
S.saveCfg(cfg);mk=resetVerifiedKey;
resetVerifiedKey=null;resetG='';
await loadKeys();closeReset();
showScreen('main-screen');renderKeys();
if(lGL){lGL.destroy();lGL=null}
toast('手势已重置');
}catch(e){toast('重置失败: '+e.message,'error')}
},400)}else{gl2._markError();document.getElementById('rgh2').textContent='不一致，请重试';setTimeout(()=>{gl2.reset();resetGL1.reset();document.getElementById('rs3').classList.add('hidden');document.getElementById('rs2').classList.remove('hidden');document.getElementById('rgh').textContent='';document.getElementById('rgh2').textContent=''},800)}
});
},400);
});
}catch(e){toast('验证失败','error')}
}

function resetAll(){
if(!confirm('确定要重置所有数据？\n\n这将清除所有 API Key 和设置，此操作不可撤销！'))return;
if(!confirm('再次确认：删除所有数据并恢复初始状态？'))return;
localStorage.removeItem(SC);localStorage.removeItem(SD);
mk=null;keys=[];visSet.clear();
setupPw='';setupG='';resetVerifiedKey=null;resetG='';
if(lGL){lGL.destroy();lGL=null}
if(sGL1){sGL1.destroy();sGL1=null}
if(sGL2){sGL2.destroy();sGL2=null}
if(resetGL1){resetGL1.destroy();resetGL1=null}
if(resetGL2){resetGL2.destroy();resetGL2=null}
document.getElementById('kg').innerHTML='';
document.getElementById('spw').value='';
document.getElementById('spw2').value='';
document.getElementById('lpw').value='';
showScreen('setup-screen');
toast('已重置，所有数据已清除');
}

document.addEventListener('DOMContentLoaded',()=>{
const cfg=S.loadCfg();
if(!cfg){showScreen('setup-screen')}
else{showScreen('lock-screen');initLockScreen()}
});

let lastCfg=!!S.loadCfg();
setInterval(()=>{const c=!!S.loadCfg();if(lastCfg&&!c)location.reload();lastCfg=c},300);

document.getElementById('lpw')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();unlockByPw()}});
