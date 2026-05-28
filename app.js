/**
 * Vault - app.js
 * 全部业务逻辑
 *
 * 目录：
 *   1.  浏览器兼容性检查
 *   2.  常量与全局状态
 *   3.  工具函数
 *   4.  加密模块（C）
 *   5.  存储模块（S）
 *   6.  手势锁类（GL）
 *   7.  UI 工具函数
 *   8.  初始化
 *   9.  设置流程
 *   10. 免密自动解锁
 *   11. 锁屏流程
 *   12. 设置页面
 *   13. API Key 管理
 *   14. 导出功能
 *   15. 重置所有数据
 *
 * ============================================================
 * 数据模型（vault_config）：
 *   pwHash      — 主密码验证哈希（PBKDF2 + SHA-256）
 *   pwSalt      — 主密码哈希派生盐
 *   keySalt     — AES 密钥派生盐
 *   test        — AES-GCM 加密的验证值
 *   gestureEnabled — 手势是否启用
 *   gestureHash    — 手势验证哈希
 *   gestureSalt    — 手势哈希派生盐
 *   wrappedKey     — 手势密钥包裹的 AES 主密钥
 * ============================================================
 */

/* ============================================================
   1. 浏览器兼容性检查
   ============================================================ */
if(!window.crypto||!window.crypto.subtle){
document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0b14;color:#e2e8f0;font-family:sans-serif;text-align:center;padding:20px"><div><h1>⚠ 浏览器不支持</h1><p style="color:#94a3b8;margin-top:8px">请使用支持 Web Crypto API 的现代浏览器</p></div></div>';
throw new Error('No Web Crypto');
}

/* ============================================================
   2. 常量与全局状态
   ============================================================ */
const SC='vault_config';
const SD='vault_data';
const TV='VAULT_OK';

/** 当前会话状态 */
let mk=null;          // AES-256-GCM 主密钥（内存中，锁定后清空）
let keys=[];           // 解密后的 API Key 列表
let visSet=new Set();  // API Key 显示/隐藏状态

/** 手势锁实例 */
let lGL=null;          // 锁屏手势锁
let setupGL=null;      // 设置流程手势锁
let resetGL1=null;     // 重置手势-首次绘制
let resetGL2=null;     // 重置手势-确认绘制

/** 设置流程临时变量 */
let setupPw='';

/** 重置手势临时变量 */
let resetVerifiedMk=null;

/** 标记是否为主动重置，防止监测定时器误触发 reload */
let isResetting=false;

/* ============================================================
   3. 工具函数
   ============================================================ */
function b64(a){const b=new Uint8Array(a);let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s)}
function ub64(s){const d=atob(s),a=new Uint8Array(d.length);for(let i=0;i<d.length;i++)a[i]=d.charCodeAt(i);return a.buffer}
function hex(a){return Array.from(new Uint8Array(a)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function uuid(){return crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16)})}
function fmtDate(t){return new Date(t).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}
function maskKey(k){if(k.length<=8)return'•'.repeat(k.length);return k.substring(0,4)+'•'.repeat(Math.min(k.length-8,20))+k.substring(k.length-4)}

/* ============================================================
   4. 加密模块（C）
   PBKDF2 + AES-256-GCM + SHA-256
   ============================================================ */
const C={
genSalt(){return crypto.getRandomValues(new Uint8Array(16))},
genIV(){return crypto.getRandomValues(new Uint8Array(12))},

/** PBKDF2 密码/手势 → AES-256-GCM 密钥 */
async derive(input,salt){
const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(input),'PBKDF2',false,['deriveKey']);
return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},km,{name:'AES-GCM',length:256},true,['encrypt','decrypt','wrapKey','unwrapKey'])},

/** AES-256-GCM 加密 */
async enc(pt,key){const iv=this.genIV(),ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(pt));return{c:b64(ct),i:b64(iv)}},

/** AES-256-GCM 解密 */
async dec(ci,ii,key){const d=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(ub64(ii))},key,ub64(ci));return new TextDecoder().decode(d)},

/** SHA-256 哈希 */
async hash(d){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(d));return hex(h)}
};

/* ============================================================
   5. 存储模块（S）
   ============================================================ */
const S={
saveCfg(c){localStorage.setItem(SC,JSON.stringify(c))},
loadCfg(){try{return JSON.parse(localStorage.getItem(SC))}catch{return null}},
saveData(d){localStorage.setItem(SD,JSON.stringify(d))},
loadData(){try{return JSON.parse(localStorage.getItem(SD)||'[]')}catch{return[]}}
};

/* ============================================================
   6. 手势锁类（GL）
   3×3 九宫格手势识别
   ============================================================ */
class GL{
constructor(wid,cid,cb){
this.w=document.getElementById(wid);
this.cv=document.getElementById(cid);
this.ctx=this.cv.getContext('2d');
this.cb=cb;
this.dots=[];
this.sel=[];
this.drawing=false;
this._init();
}
_init(){
this.grid=document.createElement('div');this.grid.className='gesture-grid';
for(let i=0;i<9;i++){const d=document.createElement('div');d.className='g-dot';d.dataset.i=i;this.grid.appendChild(d);this.dots.push(d)}
this.w.appendChild(this.grid);
this._resize();
this._onResize=()=>this._resize();
this._onPd=this._pd.bind(this);
this._onPm=this._pm.bind(this);
this._onPu=this._pu.bind(this);
this.w.addEventListener('pointerdown',this._onPd);
this.w.addEventListener('pointermove',this._onPm);
this.w.addEventListener('pointerup',this._onPu);
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
destroy(){this.reset();window.removeEventListener('resize',this._onResize);this.w.removeEventListener('pointerdown',this._onPd);this.w.removeEventListener('pointermove',this._onPm);this.w.removeEventListener('pointerup',this._onPu);if(this.grid&&this.grid.parentNode)this.grid.remove()}
}

/* ============================================================
   7. UI 工具的函数
   ============================================================ */
function toast(msg,type='success'){const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;document.getElementById('toasts').appendChild(t);requestAnimationFrame(()=>t.classList.add('show'));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},2500)}

/** 自定义确认对话框（替代原生 confirm，避免 Electron 中 confirm 阻塞导致焦点丢失） */
function confirmDialog(msg){
return new Promise(resolve=>{
const el=document.getElementById('confirmDialog');
document.getElementById('confirmMsg').textContent=msg;
el.style.display='flex';
document.getElementById('confirmYes').onclick=()=>{el.style.display='none';resolve(true)};
document.getElementById('confirmNo').onclick=()=>{el.style.display='none';resolve(false)};
});
}
function togVis(id){
const i=document.getElementById(id);
if(i.type==='password'){i.type='text';i.parentElement.querySelector('.eye-icon').src='eye-closed.png'}
else{i.type='password';i.parentElement.querySelector('.eye-icon').src='eye-open.jpg'}
}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function openModal(id){document.getElementById(id).classList.add('show')}
function closeModalEl(id){document.getElementById(id).classList.remove('show')}

/* ============================================================
   8. 初始化
   ============================================================ */
/** 页面加载时初始化主题（在 DOM 渲染前） */
initTheme();

/** 免密访问固定的派生盐（16字节） */
const NOLOCK_SALT=new Uint8Array([86,97,117,108,116,78,111,76,111,99,107,83,97,108,116,33]);

document.addEventListener('DOMContentLoaded',async()=>{
const cfg=S.loadCfg();
if(!cfg){showScreen('setup-screen');return}
updateNoLockBtn(!!cfg.noLock);
if(cfg.noLock){
await autoUnlock(cfg);
}else{
showScreen('lock-screen');initLockScreen();
}
});

/** 监测 localStorage 被清除 → 自动刷新 */
let lastCfg=!!S.loadCfg();
let monitoringActive=true;
setInterval(()=>{
if(!monitoringActive||isResetting)return;
const c=!!S.loadCfg();
if(lastCfg&&!c){location.reload();return}
if(!c){monitoringActive=false}
lastCfg=c;
},300);

/** 文字密码回车键 */
document.getElementById('lpw')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();unlockByPw()}});

/* ============================================================
   9. 设置流程（首次使用）
   ============================================================ */

/** 步骤 1 → 步骤 2 */
function setupNext1(){
const pw=document.getElementById('spw').value;
const pw2=document.getElementById('spw2').value;
if(!pw||pw.length<4||pw.length>30){toast('密码需4-30位','error');return}
if(pw!==pw2){toast('两次密码不一致','error');return}
setupPw=pw;
document.getElementById('s1').classList.remove('active');
document.getElementById('s2').classList.add('active');
initSetupGesture();
}

/** 初始化设置流程手势锁 */
function initSetupGesture(){
if(setupGL)return;
setupGL=new GL('sgw','sgc',(p,gl)=>{
gl._markSuccess();
setTimeout(async()=>{
await finishSetup(p);
},400);
});
}

/** 跳过手势设置 */
function setupSkipGesture(){
if(setupGL){setupGL.destroy();setupGL=null}
finishSetup(null);
}

/** 完成设置，生成配置并保存 */
async function finishSetup(gesturePattern){
try{
const keySalt=C.genSalt();
const key=await C.derive(setupPw,keySalt);
const test=await C.enc(TV,key);
const pwHash=await C.hash(setupPw);

let cfg={
pwHash,
pwSalt:b64(keySalt),
keySalt:b64(keySalt),
test,
gestureEnabled:false
};

if(gesturePattern){
const gestureSalt=C.genSalt();
const gestureHash=await C.hash(gesturePattern);
const gKey=await C.derive(gesturePattern,gestureSalt);
const raw=await crypto.subtle.exportKey('raw',key);
const iv=C.genIV();
const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv},gKey,raw);
cfg.gestureEnabled=true;
cfg.gestureHash=gestureHash;
cfg.gestureSalt=b64(gestureSalt);
cfg.wrappedKey={c:b64(wrapped),i:b64(iv)};
}

S.saveCfg(cfg);
S.saveData([]);
toast('设置成功！');
showScreen('main-screen');
mk=key;keys=[];renderKeys();
setupPw='';
if(setupGL){setupGL.destroy();setupGL=null}
}catch(e){toast('设置失败: '+e.message,'error')}
}

/* ============================================================
   10. 免密自动解锁
   ============================================================ */

/** 免密模式下自动解锁 */
async function autoUnlock(cfg){
try{
const noLockKey=await C.derive('VaultNoLock',NOLOCK_SALT);
const raw=await crypto.subtle.decrypt(
{name:'AES-GCM',iv:new Uint8Array(ub64(cfg.noLockWrapped.i))},
noLockKey,
ub64(cfg.noLockWrapped.c)
);
mk=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
await loadKeys();
showScreen('main-screen');
renderKeys();
}catch(e){
showScreen('lock-screen');
initLockScreen();
}
}

/* ============================================================
   11. 锁屏流程
   ============================================================ */

/** 初始化锁屏：根据手势是否启用显示对应界面 */
function initLockScreen(){
const cfg=S.loadCfg();
if(!cfg){showScreen('setup-screen');return}
if(cfg.gestureEnabled){
showGestureLock();
}else{
showPasswordLock();
}
}

/** 显示手势锁 */
function showGestureLock(){
document.getElementById('lock-gesture').classList.remove('hidden');
document.getElementById('lock-pw').classList.add('hidden');
if(lGL)return;
lGL=new GL('lgw','lgc',async(p,gl)=>{
try{
const cfg=S.loadCfg();
const gh=await C.hash(p);
if(gh!==cfg.gestureHash){
gl._markError();
document.getElementById('lgh').textContent='手势错误';
setTimeout(()=>{gl.reset();document.getElementById('lgh').textContent=''},800);
return;
}
const gKey=await C.derive(p,ub64(cfg.gestureSalt));
const raw=await crypto.subtle.decrypt(
{name:'AES-GCM',iv:new Uint8Array(ub64(cfg.wrappedKey.i))},
gKey,
ub64(cfg.wrappedKey.c)
);
mk=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM',length:256},true,['encrypt','decrypt']);
await loadKeys();
gl._markSuccess();
setTimeout(()=>{showScreen('main-screen');renderKeys();gl.reset()},400);
}catch(e){
gl._markError();
document.getElementById('lgh').textContent='解锁失败';
setTimeout(()=>{gl.reset();document.getElementById('lgh').textContent=''},800);
}
});
}

/** 显示密码输入 */
function showPasswordLock(){
document.getElementById('lock-gesture').classList.add('hidden');
document.getElementById('lock-pw').classList.remove('hidden');
const cfg=S.loadCfg();
if(cfg&&cfg.gestureEnabled){
document.getElementById('backToGesture').classList.remove('hidden');
}else{
document.getElementById('backToGesture').classList.add('hidden');
}
}

/** 切换到密码模式 */
function switchToPw(){
if(lGL){lGL.reset()}
showPasswordLock();
document.getElementById('lpw').focus();
}

/** 切换回手势模式 */
function switchToGesture(){
document.getElementById('lpw').value='';
document.getElementById('lpwh').textContent='';
showGestureLock();
}

/** 主密码解锁 */
async function unlockByPw(){
const pw=document.getElementById('lpw').value;
if(!pw){toast('请输入密码','error');return}
try{
const cfg=S.loadCfg();
const hash=await C.hash(pw);
if(hash!==cfg.pwHash){
document.getElementById('lpwh').textContent='密码错误';
toast('密码错误','error');
return;
}
const key=await C.derive(pw,ub64(cfg.keySalt));
const ok=await C.dec(cfg.test.c,cfg.test.i,key);
if(ok!==TV)throw new Error('wrong');
mk=key;
await loadKeys();
showScreen('main-screen');
renderKeys();
document.getElementById('lpw').value='';
document.getElementById('lpwh').textContent='';
}catch(e){
document.getElementById('lpwh').textContent='密码错误';
toast('密码错误','error');
}
}

/** 锁定 Vault */
function lockVault(){
mk=null;keys=[];visSet.clear();
document.getElementById('kg').innerHTML='';
document.getElementById('search').value='';
if(lGL){lGL.reset()}
const cfg=S.loadCfg();
if(cfg&&cfg.noLock){autoUnlock(cfg);return}
showScreen('lock-screen');
initLockScreen();
}

/* ============================================================
   11. 设置页面
   ============================================================ */

/** 打开设置 */
function openSettings(){
const cfg=S.loadCfg();
if(cfg){
document.getElementById('gestureToggle').checked=cfg.gestureEnabled;
document.getElementById('resetGestureBtn').style.display=cfg.gestureEnabled?'flex':'none';
}
const currentTheme=localStorage.getItem('vault_theme')||'dark';
document.querySelectorAll('.theme-option').forEach(el=>{
el.classList.toggle('active',el.dataset.theme===currentTheme);
});
openModal('settings-modal');
}

/** 关闭设置 */
function closeSettings(){closeModalEl('settings-modal')}

/** 设置主题 */
function setTheme(name){
document.documentElement.className=name==='dark'?'':'theme-'+name;
localStorage.setItem('vault_theme',name);
document.querySelectorAll('.theme-option').forEach(el=>{
el.classList.toggle('active',el.dataset.theme===name);
});
}

/** 初始化主题 */
function initTheme(){
const t=localStorage.getItem('vault_theme')||'dark';
setTheme(t);
}

/** 切换手势开关 */
async function toggleGesture(enabled){
const cfg=S.loadCfg();
if(!cfg)return;

if(enabled){
closeSettings();
initGestureSetup();
}else{
cfg.gestureEnabled=false;
delete cfg.gestureHash;
delete cfg.gestureSalt;
delete cfg.wrappedKey;
S.saveCfg(cfg);
document.getElementById('resetGestureBtn').style.display='none';
if(lGL){lGL.destroy();lGL=null}
toast('手势已关闭');
}
}

/** 头部按钮切换免密访问 */
async function toggleNoLockBtn(){
const cfg=S.loadCfg();
if(!cfg)return;
if(cfg.noLock){
cfg.noLock=false;
delete cfg.noLockWrapped;
S.saveCfg(cfg);
updateNoLockBtn(false);
toast('免密访问已关闭');
}else{
try{
const noLockKey=await C.derive('VaultNoLock',NOLOCK_SALT);
const raw=await crypto.subtle.exportKey('raw',mk);
const iv=C.genIV();
const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv},noLockKey,raw);
cfg.noLock=true;
cfg.noLockWrapped={c:b64(wrapped),i:b64(iv)};
S.saveCfg(cfg);
updateNoLockBtn(true);
toast('免密访问已开启');
}catch(e){toast('开启失败: '+e.message,'error')}
}
}

/** 更新免密按钮视觉状态 */
function updateNoLockBtn(active){
const btn=document.getElementById('noLockBtn');
if(btn)btn.classList.toggle('active',active);
}

/** 初始化手势设置（从设置页面开启） */
function initGestureSetup(){
const gSetupModal=document.getElementById('reset-gesture-modal');
document.getElementById('rgs1').classList.add('hidden');
document.getElementById('rgs2').classList.remove('hidden');
document.getElementById('rgs3').classList.add('hidden');
document.getElementById('rgpw').value='';
openModal('reset-gesture-modal');

if(resetGL1){resetGL1.destroy();resetGL1=null}
if(resetGL2){resetGL2.destroy();resetGL2=null}

resetGL1=new GL('rggw','rggc',(p,gl)=>{
gl._markSuccess();
setTimeout(()=>{
document.getElementById('rgs2').classList.add('hidden');
document.getElementById('rgs3').classList.remove('hidden');
resetGL2=new GL('rggw2','rggc2',async(p2,gl2)=>{
if(p2===p){
gl2._markSuccess();
setTimeout(async()=>{
try{
await saveGestureConfig(p,mk);
closeResetGesture();
if(lGL){lGL.destroy();lGL=null}
toast('手势已开启');
}catch(e){toast('设置失败: '+e.message,'error')}
},400);
}else{
gl2._markError();
document.getElementById('rggh2').textContent='不一致，请重试';
setTimeout(()=>{
gl2.reset();resetGL1.reset();
document.getElementById('rgs3').classList.add('hidden');
document.getElementById('rgs2').classList.remove('hidden');
document.getElementById('rggh').textContent='';
document.getElementById('rggh2').textContent='';
},800);
}
});
},400);
});
}

/** 保存手势配置到 localStorage */
async function saveGestureConfig(pattern,key){
const gestureSalt=C.genSalt();
const gestureHash=await C.hash(pattern);
const gKey=await C.derive(pattern,gestureSalt);
const raw=await crypto.subtle.exportKey('raw',key);
const iv=C.genIV();
const wrapped=await crypto.subtle.encrypt({name:'AES-GCM',iv},gKey,raw);

const cfg=S.loadCfg();
cfg.gestureEnabled=true;
cfg.gestureHash=gestureHash;
cfg.gestureSalt=b64(gestureSalt);
cfg.wrappedKey={c:b64(wrapped),i:b64(iv)};
S.saveCfg(cfg);
}

/** 打开重置手势弹窗（需验证主密码） */
function openResetGesture(){
document.getElementById('rgs1').classList.remove('hidden');
document.getElementById('rgs2').classList.add('hidden');
document.getElementById('rgs3').classList.add('hidden');
document.getElementById('rgpw').value='';
resetVerifiedMk=null;
if(resetGL1){resetGL1.destroy();resetGL1=null}
if(resetGL2){resetGL2.destroy();resetGL2=null}
openModal('reset-gesture-modal');
}

/** 关闭重置手势弹窗 */
function closeResetGesture(){
closeModalEl('reset-gesture-modal');
if(resetGL1){resetGL1.destroy();resetGL1=null}
if(resetGL2){resetGL2.destroy();resetGL2=null}
}

/** 验证主密码后重置手势 */
async function verifyResetGesture(){
const pw=document.getElementById('rgpw').value;
if(!pw){toast('请输入密码','error');return}
try{
const cfg=S.loadCfg();
const hash=await C.hash(pw);
if(hash!==cfg.pwHash){toast('密码错误','error');return}
const key=await C.derive(pw,ub64(cfg.keySalt));
const ok=await C.dec(cfg.test.c,cfg.test.i,key);
if(ok!==TV)throw new Error('wrong');
resetVerifiedMk=key;
document.getElementById('rgs1').classList.add('hidden');
document.getElementById('rgs2').classList.remove('hidden');

resetGL1=new GL('rggw','rggc',(p,gl)=>{
gl._markSuccess();
setTimeout(()=>{
document.getElementById('rgs2').classList.add('hidden');
document.getElementById('rgs3').classList.remove('hidden');
resetGL2=new GL('rggw2','rggc2',async(p2,gl2)=>{
if(p2===p){
gl2._markSuccess();
setTimeout(async()=>{
try{
await saveGestureConfig(p,resetVerifiedMk);
resetVerifiedMk=null;
closeResetGesture();
if(lGL){lGL.destroy();lGL=null}
toast('手势已重置');
}catch(e){toast('重置失败: '+e.message,'error')}
},400);
}else{
gl2._markError();
document.getElementById('rggh2').textContent='不一致，请重试';
setTimeout(()=>{
gl2.reset();resetGL1.reset();
document.getElementById('rgs3').classList.add('hidden');
document.getElementById('rgs2').classList.remove('hidden');
document.getElementById('rggh').textContent='';
document.getElementById('rggh2').textContent='';
},800);
}
});
},400);
});
}catch(e){toast('验证失败','error')}
}

/** 打开修改主密码弹窗 */
function openChangePw(){
document.getElementById('cpwOld').value='';
document.getElementById('cpwNew').value='';
document.getElementById('cpwNew2').value='';
closeSettings();
openModal('change-pw-modal');
}

/** 关闭修改主密码弹窗 */
function closeChangePw(){closeModalEl('change-pw-modal')}

/** 保存新主密码 */
async function saveChangePw(){
const oldPw=document.getElementById('cpwOld').value;
const newPw=document.getElementById('cpwNew').value;
const newPw2=document.getElementById('cpwNew2').value;

if(!oldPw||!newPw){toast('请填写所有字段','error');return}
if(newPw.length<4||newPw.length>30){toast('新密码需4-30位','error');return}
if(newPw!==newPw2){toast('两次新密码不一致','error');return}
if(oldPw===newPw){toast('新旧密码不能相同','error');return}

try{
const cfg=S.loadCfg();

/* 验证旧密码 */
const oldHash=await C.hash(oldPw);
if(oldHash!==cfg.pwHash){toast('当前密码错误','error');return}
const oldKey=await C.derive(oldPw,ub64(cfg.keySalt));
const ok=await C.dec(cfg.test.c,cfg.test.i,oldKey);
if(ok!==TV){toast('当前密码错误','error');return}

/* 用新密钥重新加密所有 API Key */
const newKeySalt=C.genSalt();
const newKey=await C.derive(newPw,newKeySalt);
const newTest=await C.enc(TV,newKey);
const newPwHash=await C.hash(newPw);

const storedData=S.loadData();
for(let i=0;i<keys.length;i++){
storedData[i].ek=await C.enc(keys[i].apiKey,newKey);
}
S.saveData(storedData);

/* 更新配置 */
cfg.pwHash=newPwHash;
cfg.pwSalt=b64(newKeySalt);
cfg.keySalt=b64(newKeySalt);
cfg.test=newTest;

/* 手势和免密包裹的是旧密钥，无法自动迁移，需关闭 */
if(cfg.gestureEnabled||cfg.noLock){
delete cfg.gestureEnabled;
delete cfg.gestureHash;
delete cfg.gestureSalt;
delete cfg.wrappedKey;
delete cfg.noLock;
delete cfg.noLockWrapped;
if(lGL){lGL.destroy();lGL=null}
toast('主密码已修改，手势和免密已关闭，请在设置中重新开启');
}else{
toast('主密码已修改');
}

S.saveCfg(cfg);
mk=newKey;
closeChangePw();
}catch(e){toast('修改失败: '+e.message,'error')}
}

/* ============================================================
   12. API Key 管理
   ============================================================ */

/** 从 localStorage 加载并解密所有 API Key */
async function loadKeys(){
const raw=S.loadData();keys=[];
for(const e of raw){
try{
const ak=await C.dec(e.ek.c,e.ek.i,mk);
keys.push({id:e.id,name:e.name,apiKey:ak,url:e.url||'',notes:e.notes||'',createdAt:e.createdAt,updatedAt:e.updatedAt});
}catch{keys.push({id:e.id,name:e.name,apiKey:'[解密失败]',url:e.url||'',notes:e.notes||'',createdAt:e.createdAt,updatedAt:e.updatedAt})}
}
}

/** 加密并保存所有 API Key */
async function saveAll(){
const out=[];
for(const k of keys){
const ek=await C.enc(k.apiKey,mk);
out.push({id:k.id,name:k.name,ek,url:k.url,notes:k.notes,createdAt:k.createdAt,updatedAt:k.updatedAt});
}
S.saveData(out);
}

/** 渲染 API Key 卡片列表 */
function renderKeys(){
const q=(document.getElementById('search').value||'').toLowerCase();
const filtered=keys.filter(k=>k.name.toLowerCase().includes(q)||(k.url||'').toLowerCase().includes(q)||(k.notes||'').toLowerCase().includes(q));
const grid=document.getElementById('kg');
const empty=document.getElementById('empty');
if(filtered.length===0){grid.innerHTML='';empty.classList.remove('hidden');return}
empty.classList.add('hidden');
grid.innerHTML=filtered.map(k=>`
<div class="key-card" data-id="${k.id}">
${k.notes?`<div class="card-notes">${esc(k.notes)}</div>`:''}
${k.url?`<div class="card-url">${esc(k.url)}</div>`:''}
<div class="card-key-row"><span class="card-key-val" id="kv-${k.id}">${maskKey(k.apiKey)}</span><div class="card-key-btns"><button onclick="togKeyVis('${k.id}')" title="显示/隐藏" id="eye-${k.id}"><img src="eye-open.jpg" class="eye-icon" alt="显示"></button><button onclick="copyKey('${k.id}')" title="复制" class="copy-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></div></div>
<div class="card-foot"><span class="card-name">${esc(k.name)}</span><button onclick="openEdit('${k.id}')" title="编辑">✎</button><button onclick="delKey('${k.id}')" title="删除">✕</button></div>
</div>`).join('');
}

function togKeyVis(id){
const el=document.getElementById('kv-'+id);if(!el)return;
const icon=document.getElementById('eye-'+id);
if(visSet.has(id)){el.textContent=maskKey(keys.find(k=>k.id===id).apiKey);visSet.delete(id);if(icon)icon.querySelector('.eye-icon').src='eye-open.jpg'}
else{el.textContent=keys.find(k=>k.id===id).apiKey;visSet.add(id);if(icon)icon.querySelector('.eye-icon').src='eye-closed.png'}
}

function copyKey(id){
const k=keys.find(x=>x.id===id);if(!k)return;
navigator.clipboard.writeText(k.apiKey).then(()=>toast('已复制')).catch(()=>toast('复制失败','error'));
}

/** 快速选择供应商，自动填充名称和 URL */
function pickProvider(name,url){
document.getElementById('mn').value=name;
document.getElementById('mu').value=url;
}

function openAdd(){
document.getElementById('mtitle').textContent='添加 API Key';
document.getElementById('kform').reset();
document.getElementById('meid').value='';
openModal('kmodal');
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
openModal('kmodal');
}

function closeModal(){closeModalEl('kmodal')}

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
if(!await confirmDialog('确定删除此 API Key？'))return;
keys=keys.filter(k=>k.id!==id);
await saveAll();renderKeys();toast('已删除');
}

/* ============================================================
   13. 导出功能
   ============================================================ */
async function exportAllExcel(){
const XLSX=require('xlsx');
const {ipcRenderer}=require('electron');
if(!keys.length){toast('没有可导出的数据','error');return}
const data=keys.map(k=>{
return {'名称':k.name,'API Key':k.apiKey,'URL':k.url||'','备注':k.notes||'','创建时间':fmtDate(k.createdAt)};
});
const ws=XLSX.utils.json_to_sheet(data);
ws['!cols']=[{wch:20},{wch:50},{wch:30},{wch:30},{wch:20}];
const wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,ws,'API Keys');
const buf=XLSX.write(wb,{bookType:'xlsx',type:'buffer'});
const saved=await ipcRenderer.invoke('save-file-dialog',{
defaultName:'vault_export_'+Date.now()+'.xlsx',
data:buf.toString('base64')
});
if(saved)toast('导出成功');
}

/* ============================================================
   14. 重置所有数据
   ============================================================ */
async function resetAll(){
if(!await confirmDialog('确定要重置所有数据？\n\n这将清除所有 API Key 和设置，此操作不可撤销！'))return;
if(!await confirmDialog('再次确认：删除所有数据并恢复初始状态？'))return;
isResetting=true;
monitoringActive=false;
mk=null;keys=[];visSet.clear();
setupPw='';resetVerifiedMk=null;
if(lGL){lGL.destroy();lGL=null}
if(setupGL){setupGL.destroy();setupGL=null}
if(resetGL1){resetGL1.destroy();resetGL1=null}
if(resetGL2){resetGL2.destroy();resetGL2=null}
document.getElementById('kg').innerHTML='';
document.getElementById('spw').value='';
document.getElementById('spw2').value='';
document.getElementById('lpw').value='';

/* 立即移除所有 modal overlay（避免 CSS transition 拦截点击） */
document.querySelectorAll('.modal-overlay.show').forEach(m=>m.style.display='none');

localStorage.removeItem(SC);localStorage.removeItem(SD);localStorage.removeItem('vault_theme');
setTheme('dark');
updateNoLockBtn(false);
lastCfg=false;

/* 重置设置步骤状态，确保回到步骤 1 */
document.getElementById('s1').classList.add('active');
document.getElementById('s2').classList.remove('active');

showScreen('setup-screen');
setTimeout(()=>{isResetting=false;document.getElementById('spw')?.focus()},100);
toast('已重置，所有数据已清除');
}
