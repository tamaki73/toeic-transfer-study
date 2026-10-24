'use strict';
const storageKey='kosen-transfer-study-2028-v1';
const ids=new Set([...DATA,...WEEKS].map(x=>x.id));
let complete={};let scores={};let filter='weeks';let priorityOnly=false;let search='';let collapsed=new Set();
const $=id=>document.getElementById(id);
const repository=StudyStorage.create({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)});
const loaded=repository.load();
let progressData=loaded.progress;
function storageError(message) {
 const warning=$('storageWarning'); warning.textContent=message;warning.classList.remove('hidden');
 $('savedAt').textContent='保存されていません';
}
if(loaded.error) storageError(loaded.error);
function commitState(nextProgress,nextVocabulary,importing=false) {
 try {
  const p={...nextProgress,updated:new Date().toISOString()};
  repository.write(p,nextVocabulary,importing);
  progressData=p;complete=p.checks;scores=p.scores;vocabCards=nextVocabulary;
  $('savedAt').textContent='最終保存：'+new Date().toLocaleString('ja-JP');
  $('storageWarning').classList.add('hidden'); return true;
 }catch(e){storageError(e.message);return false;}
}
function restore(){complete=progressData.checks;scores=progressData.scores;if(progressData.updated)$('savedAt').textContent='最終保存：'+new Date(progressData.updated).toLocaleString('ja-JP');}
window.addEventListener('storage',e=>{if([StudyStorage.STUDY,StudyStorage.VOCAB,null].includes(e.key))storageError('別の画面で保存領域が変更されました。再読み込みして最新の記録を読み込んでください。');});
function showScores(syncInputs=false){for(let n=1;n<=3;n++){let total=0,ok=true;for(const x of ['L','R']){const id=`s${n}${x}`;const e=$(id);if(syncInputs)e.value=scores[id]??'';const v=Number(e.value);if(e.value===''||!Number.isFinite(v)||v<5||v>495)ok=false;else total+=v;}const t=$(`sum${n}`);t.textContent=ok?`計：${total}点${total>=850?'（目標到達）':''}`:'計：—';}}
function progress(){const count=(a)=>a.reduce((sum,x)=>sum+(complete[x.id]?1:0),0);$('totalStat').textContent=`${count(DATA)} / ${DATA.length}`;$('totalBar').style.width=`${count(DATA)/DATA.length*100}%`;for(const [name,el] of [['数学','mstat'],['物理','pstat'],['電気回路','estat'],['TOEIC','tstat']]){let arr=DATA.filter(x=>x.subject===name);$(el).textContent=`${count(arr)} / ${arr.length}`}}
function textEl(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=txt;return e}
function render(){progress();const container=$('sections');container.replaceChildren();const inWeeks=filter==='weeks';let list=inWeeks?WEEKS:DATA.filter(x=>(filter==='all'||x.subject===filter)&&(!priorityOnly||x.priority==='最優先'));
if(search)list=list.filter(x=>(x.label+' '+x.group+' '+(x.subject||'')).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
const groups=new Map();for(const x of list){const key=(x.subject||'4週間')+'|'+x.group;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x)}
if(!groups.size){container.append(textEl('p','empty','該当する単元がありません。'));return}
for(const [key,entries] of groups){const group=entries[0];const card=textEl('section','section','');const btn=document.createElement('button');btn.setAttribute('type','button');btn.setAttribute('aria-expanded',String(!collapsed.has(key)));const left=textEl('div','meta','');left.append(textEl('span','section-title',(group.subject?group.subject+' · ':'')+group.group));if(group.priority)left.append(textEl('span','pill',group.priority));const right=textEl('div','meta','');const done=entries.filter(x=>complete[x.id]).length;right.append(textEl('span','count',`${done} / ${entries.length}`));const mini=textEl('div','minibar','');const fill=document.createElement('div');fill.style.width=`${done/entries.length*100}%`;mini.append(fill);right.append(mini);right.append(textEl('span','count',collapsed.has(key)?'＋':'－'));btn.append(left,right);btn.addEventListener('click',()=>{collapsed.has(key)?collapsed.delete(key):collapsed.add(key);render()});card.append(btn);
const inner=textEl('div','items','');if(collapsed.has(key))inner.classList.add('hidden');for(const x of entries){const label=textEl('label','item','');const input=document.createElement('input');input.type='checkbox';input.checked=!!complete[x.id];input.setAttribute('aria-label',x.label);if(input.checked)label.classList.add('done');input.addEventListener('change',()=>{const checks={...complete};if(input.checked)checks[x.id]=true;else delete checks[x.id];commitState({...progressData,checks},vocabCards);render()});label.append(input,textEl('span','',x.label));inner.append(label)}card.append(inner);container.append(card)}}
function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(window.toastHandle);window.toastHandle=setTimeout(()=>$('toast').style.display='none',2500)}
$('priorityBtn').disabled=true;
$('tabBtns').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;filter=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));if(filter==='weeks'){$('priorityBtn').disabled=true}else{$('priorityBtn').disabled=false}render()});
$('search').addEventListener('input',e=>{search=e.target.value.trim();render()});
$('priorityBtn').addEventListener('click',()=>{priorityOnly=!priorityOnly;$('priorityBtn').classList.toggle('active',priorityOnly);render()});
let openAll=false;$('openBtn').addEventListener('click',()=>{openAll=!openAll;collapsed=new Set();if(!openAll){for(const x of [...DATA,...WEEKS])collapsed.add((x.subject||'4週間')+'|'+x.group)}$('openBtn').textContent=openAll?'すべて閉じる':'すべて開く';render()});
$('resetBtn').addEventListener('click',()=>{
 if(!confirm('チェックだけを初期化します。模試スコアと単語帳は維持します。初期化前のJSONをダウンロードしてから実行しますか？'))return;
 if(repository.blocked){storageError(repository.blocked);return;}
 exportAll();
 const checks={...complete};for(const id of ids)delete checks[id];
 if(commitState({...progressData,checks},vocabCards)){render();toast('チェックだけを初期化しました。模試スコアは維持しています。');}
});
for(let n=1;n<=3;n++)for(const x of ['L','R']){$(`s${n}${x}`).addEventListener('input',e=>{
 const raw=e.target.value;const next={...scores};
 if(raw==='')delete next[e.target.id];
 else if(Number(raw)>=5&&Number(raw)<=495&&Number(raw)%5===0)next[e.target.id]=Number(raw);
 else {e.target.setCustomValidity('5〜495点を5点刻みで入力してください');showScores();return;}
 e.target.setCustomValidity('');
 if(!commitState({...progressData,scores:next},vocabCards))showScores(true);else showScores();
});}
restore();render();showScores(true);
