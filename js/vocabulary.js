'use strict';
const intervals=[1,3,7,14,30];
let vocabCards=loaded.vocabulary;
let vocabScope='due', vocabFlipped=false, vocabIndex=0, vocabShuffle=false, vocabPracticeIds=[];
const dayMS=86400000;
const localNow=()=>Date.now();
function vId(){return 'v'+Date.now().toString(36)+Math.random().toString(36).slice(2,9)}
function normWord(s){return String(s||'').trim().replace(/\s+/g,' ')}
function vocabNotice(msg,error=false){$('vocabStatus').textContent=msg;$('vocabStatus').classList.toggle('error',error)}
function dueCards(){return vocabCards.filter(v=>v.due<=Date.now())}
function currentPractice(){
 const today=Date.now();let cards=vocabCards.filter(v=>vocabScope==='all'||(vocabScope==='due'?v.due<=today:v.missed>0));
 if(vocabScope==='due')cards.sort((a,b)=>a.due-b.due||a.created-b.created);
 else cards.sort((a,b)=>a.created-b.created);
 if(vocabShuffle)cards=cards.sort((a,b)=>{return (shuffleRanks.get(a.id)??0)-(shuffleRanks.get(b.id)??0)});
 return cards;
}
let shuffleRanks=new Map();
function updateVocabStats(){
 $('vocabCount').textContent=vocabCards.length+'語登録';$('vocabTotalWords').textContent=vocabCards.length+'語';
 $('reviewStats').textContent=`今日の復習 ${dueCards().length}語 ・ 復習済み ${vocabCards.filter(v=>v.box>0).length}語`;
}
function renderFlashcard(preferredId=null){
 updateVocabStats();
 const cards=currentPractice();
 if(preferredId){const pos=cards.findIndex(v=>v.id===preferredId);if(pos>=0)vocabIndex=pos}
 if(vocabIndex>=cards.length)vocabIndex=Math.max(0,cards.length-1);
 if(vocabIndex<0)vocabIndex=0;
 const cur=cards[vocabIndex];
 const shown=Boolean(cur);
 $('flashcard').disabled=!shown;
 $('vocabPrev').disabled=!shown||cards.length<2;
 $('vocabNext').disabled=!shown||cards.length<2;
 $('vocabAgain').disabled=!shown;
 $('vocabKnow').disabled=!shown;
 $('vocabSpeak').disabled=!shown||!('speechSynthesis' in window);
 $('vocabShuffle').disabled=!shown||cards.length<2;
 $('flashcard').classList.toggle('flipped',shown&&vocabFlipped);
 $('flashcardSide').textContent=shown?(vocabFlipped?'JAPANESE · タップで戻す':'ENGLISH · タップで裏返す'):'VOCABULARY';
 $('flashcardText').textContent=shown?(vocabFlipped?cur.ja:cur.en):(vocabScope==='due'&&vocabCards.length?'今日の復習は完了しました！':'ここに登録した単語カードが表示されます');
 $('flashcardHint').textContent=shown?(vocabFlipped?cur.en:'タップして日本語訳を見る'):(vocabCards.length?'「全カード」でいつでも練習できます':'英単語を上の欄から追加してください');
 $('vocabPosition').textContent=shown?`${vocabIndex+1} / ${cards.length}`:'0 / 0';
}
function renderVocabList(){
 updateVocabStats();const list=$('vocabList');list.replaceChildren();
 const query=$('vocabSearch').value.trim().toLowerCase();
 const entries=vocabCards.filter(v=>(v.en+' '+v.ja).toLowerCase().includes(query));
 if(!entries.length){const e=document.createElement('div');e.className='vocab-empty';e.textContent=vocabCards.length?'該当する単語はありません。':'まだ単語がありません。最初の1語を登録してみましょう。';list.append(e);return}
 for(const v of entries.slice().reverse()){
  const row=document.createElement('div');row.className='vocab-word';
  const main=document.createElement('div');main.className='vocab-word-main';
  const en=document.createElement('div');en.className='vocab-word-english';en.textContent=v.en;
  const ja=document.createElement('div');ja.className='vocab-word-jp';ja.textContent=v.ja;
  const meta=document.createElement('div');meta.className='vocab-word-sub';meta.textContent=v.box>0?`復習レベル ${v.box}/5 · 苦手 ${v.missed}回`:'未習得';
  main.append(en,ja,meta);
  const edit=document.createElement('button');edit.type='button';edit.textContent='編集';edit.title='意味を修正';edit.addEventListener('click',()=>{
   const newEn=prompt('英単語を編集します',v.en);if(newEn===null)return;
   const e=normWord(newEn);if(!e||e.length>120){alert('英単語を120文字以内で入力してください');return}
   if(vocabCards.some(x=>x.id!==v.id&&x.en.toLowerCase()===e.toLowerCase())){alert('その英単語は既に登録済みです');return}
   const newJp=prompt('日本語訳を編集します',v.ja);if(newJp===null)return;
   const j=normWord(newJp);if(!j||j.length>180){alert('日本語訳を180文字以内で入力してください');return}
   const next=vocabCards.map(x=>x.id===v.id?{...x,en:e,ja:j}:x);if(commitState(progressData,next)){renderVocabListAndCard(v.id);vocabNotice('編集内容を保存しました。');}
  });
  const del=document.createElement('button');del.type='button';del.textContent='削除';del.title='単語を削除';del.addEventListener('click',()=>{
   if(!confirm('「'+v.en+'」を単語帳から削除しますか？'))return;
   if(commitState(progressData,vocabCards.filter(x=>x.id!==v.id))){vocabFlipped=false;renderVocabListAndCard();}
  });
  row.append(main,edit,del);list.append(row);
 }
}
function renderVocabListAndCard(id=null){renderVocabList();renderFlashcard(id)}
function syncExternalTranslation(){
 const term=normWord($('vocabEnglish').value);
 $('externalTranslation').href='https://translate.google.com/?sl=en&tl=ja&text='+encodeURIComponent(term)+'&op=translate';
}
// Vocabulary draft is NEVER stored until the user presses the separate confirm button.
let lookupController=null;
function cancelLookup(){lookupController?.abort();}
let vocabLookupSeq=0, vocabLookupTimer=null, vocabTranslating=false, vocabMeaningSource='';
function draftValues(){return {english:normWord($('vocabEnglish').value), japanese:normWord($('vocabJapanese').value)}}
function duplicateVocab(en){return Boolean(en&&vocabCards.some(v=>v.en.toLowerCase()===en.toLowerCase()))}
function updateDraft(){
 const {english,japanese}=draftValues();
 $('vocabDraftEn').textContent=english||'英単語を入力してください';
 $('vocabDraftJa').textContent=japanese||'日本語訳を確認してから追加できます';
 $('vocabAddBtn').disabled=!(english&&japanese&&!vocabTranslating&&!duplicateVocab(english));
 $('vocabLookupBtn').disabled=!!vocabTranslating;
 $('vocabLookupBtn').textContent=vocabTranslating?'翻訳中…':'↻ 意味を検索';
}
async function lookupDraft(){
 clearTimeout(vocabLookupTimer);
 const english=normWord($('vocabEnglish').value);
 if(!english){vocabNotice('最初に英単語を入力してください。',true);return}
 if(duplicateVocab(english)){vocabNotice('「'+english+'」は登録済みです。下の一覧から編集できます。',true);updateDraft();return}
 cancelLookup();lookupController=new AbortController();
 const requestNo=++vocabLookupSeq;
 syncExternalTranslation();
 vocabTranslating=true;updateDraft();vocabNotice('「'+english+'」の日本語訳を取得しています…');
 try{
  const result=await Translation.translate(english,{signal:lookupController.signal});
  if(requestNo!==vocabLookupSeq||normWord($('vocabEnglish').value)!==english)return;
  $('vocabJapanese').value=result.text;vocabMeaningSource=result.source;
  vocabNotice('【'+result.source+'】訳を確認してください。必要なら修正し「この内容で単語帳に追加」を押してください。');
 }catch(err){
  if(requestNo!==vocabLookupSeq)return;
  vocabMeaningSource='手入力';
  vocabNotice('自動翻訳ができませんでした（'+(err.name==='AbortError'?'時間切れ':err.message)+'）。日本語訳を入力すれば登録できます。',true);
 }finally{
  if(requestNo===vocabLookupSeq){vocabTranslating=false;updateDraft()}
 }
}
$('vocabEnglish').addEventListener('input',()=>{
 cancelLookup();++vocabLookupSeq;clearTimeout(vocabLookupTimer);vocabTranslating=false;vocabMeaningSource='';
 $('vocabJapanese').value='';
 const english=normWord($('vocabEnglish').value);syncExternalTranslation();updateDraft();
 if(!english){vocabNotice('英単語を入力すると自動的に日本語訳が表示されます。');return}
 if(duplicateVocab(english)){vocabNotice('「'+english+'」は登録済みです。下の一覧から編集できます。',true);return}
 // Built-in dictionary does not require a network request or typing delay.
 if(Object.prototype.hasOwnProperty.call(BUILTIN_VOCAB,english.toLowerCase())){
  $('vocabJapanese').value=BUILTIN_VOCAB[english.toLowerCase()];vocabMeaningSource='内蔵辞書';
  updateDraft();vocabNotice('訳を確認・修正してから、追加ボタンを押してください。');
  return;
 }
 vocabNotice('入力が止まると英和辞書を検索します。初回のみ数秒かかる場合があります。');
 vocabLookupTimer=setTimeout(()=>lookupDraft(),850);
});
$('vocabJapanese').addEventListener('input',()=>{
 // A manual correction wins over an unfinished translation request.
 cancelLookup();++vocabLookupSeq;clearTimeout(vocabLookupTimer);vocabTranslating=false;vocabMeaningSource='手入力・編集';
 updateDraft();
 if(normWord($('vocabJapanese').value))vocabNotice('意味を確認したら「この内容で単語帳に追加」を押してください。');
});
$('vocabForm').addEventListener('submit',e=>{e.preventDefault();lookupDraft()});
$('vocabAddBtn').addEventListener('click',()=>{
 const {english,japanese}=draftValues();
 if(vocabTranslating||!english||!japanese||english.length>120||japanese.length>180){vocabNotice('英単語と日本語訳の両方を確認してから登録してください。',true);updateDraft();return}
 if(duplicateVocab(english)){vocabNotice('「'+english+'」は登録済みです。',true);updateDraft();return}
 const item={id:vId(),en:english,ja:japanese,box:0,due:0,missed:0,created:Date.now()};
 if(!commitState(progressData,[...vocabCards,item]))return;
 cancelLookup();++vocabLookupSeq;clearTimeout(vocabLookupTimer);vocabTranslating=false;
 $('vocabEnglish').value='';$('vocabJapanese').value='';vocabFlipped=false;
 renderVocabListAndCard(item.id);updateDraft();
 vocabNotice(`「${english} → ${japanese}」を単語帳に追加しました（${vocabMeaningSource||'確認済み'}）。`);
 vocabMeaningSource='';$('vocabEnglish').focus();
});
updateDraft();syncExternalTranslation();
$('vocabSearch').addEventListener('input',renderVocabList);
$('flashcard').addEventListener('click',()=>{vocabFlipped=!vocabFlipped;renderFlashcard()});
$('vocabPrev').addEventListener('click',()=>{const n=currentPractice().length;if(n){vocabIndex=(vocabIndex-1+n)%n;vocabFlipped=false;renderFlashcard()}});
$('vocabNext').addEventListener('click',()=>{const n=currentPractice().length;if(n){vocabIndex=(vocabIndex+1)%n;vocabFlipped=false;renderFlashcard()}});
function rateCurrent(known){
 const all=currentPractice(), current=all[vocabIndex];if(!current)return;
 const v={...current};
 if(known){v.box=Math.min(Number(v.box)+1,5);v.due=Date.now()+intervals[v.box-1]*dayMS;}
 else{v.missed=Number(v.missed)+1;v.box=0;v.due=Date.now()+10*60000;}
 if(!commitState(progressData,vocabCards.map(x=>x.id===v.id?v:x)))return;
 const prev=vocabIndex;vocabFlipped=false;vocabIndex=(vocabScope==='all'&&all.length>1)?(prev+1)%all.length:prev;
 renderVocabListAndCard();
 vocabNotice(known?`「${v.en}」を覚えたとして記録。次回は約${intervals[v.box-1]}日後です。`:`「${v.en}」を約10分後の復習に回しました。`);
}
$('vocabKnow').addEventListener('click',()=>rateCurrent(true));
$('vocabAgain').addEventListener('click',()=>rateCurrent(false));
document.querySelectorAll('[data-review]').forEach(btn=>btn.addEventListener('click',()=>{
 vocabScope=btn.dataset.review;vocabIndex=0;vocabFlipped=false;
 document.querySelectorAll('[data-review]').forEach(x=>x.classList.toggle('selected',x===btn));renderFlashcard();
}));
$('vocabShuffle').addEventListener('click',()=>{vocabShuffle=true;shuffleRanks=new Map(vocabCards.map(v=>[v.id,Math.random()]));vocabIndex=0;vocabFlipped=false;renderFlashcard();vocabNotice('カードの順番をシャッフルしました。')});
$('vocabSpeak').addEventListener('click',()=>{
 const v=currentPractice()[vocabIndex];if(!v||!('speechSynthesis' in window))return;
 speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(v.en);speech.lang='en-US';speech.rate=.88;speechSynthesis.speak(speech);
});
function downloadVocab(content,name,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
$('vocabCsv').addEventListener('click',()=>{
 if(!vocabCards.length){vocabNotice('保存する単語がありません。',true);return}
 const csv=vocabCards.map(v=>[v.en,v.ja].map(x=>'"'+x.replace(/"/g,'""')+'"').join(',')).join('\r\n');
 downloadVocab('\ufeff'+csv,'TOEIC単語帳_フラッシュカード.csv','text/csv;charset=utf-8');vocabNotice('単語帳をCSVで保存しました。');
});
$('vocabExport').addEventListener('click',()=>{
 if(repository.blocked){storageError(repository.blocked);return;}
 downloadVocab(JSON.stringify({format:'kosen-toeic-vocab',version:1,updated:new Date().toISOString(),vocabulary:vocabCards},null,2),'TOEIC単語帳_バックアップ.json','application/json');vocabNotice('単語帳のバックアップを保存しました。');
});
renderVocabListAndCard();
