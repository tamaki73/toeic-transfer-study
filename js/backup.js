'use strict';
function exportAll() {
 if(repository.blocked){storageError(repository.blocked);return false;}
 const data={...progressData,format:'kosen-2028-checklist',version:3,updated:new Date().toISOString(),checks:complete,scores,vocabulary:vocabCards};
 downloadVocab(JSON.stringify(data,null,2),'編入学習_全体バックアップ_'+Date.now()+'.json','application/json');
 return true;
}
$('exportBtn').addEventListener('click',()=>{if(exportAll())toast('バックアップのダウンロードを開始しました。ファイルの保存を確認してください。');});
$('rawExportBtn').addEventListener('click',()=>{
 try{downloadVocab(JSON.stringify(repository.rescue(),null,2),'編入学習_保存領域救出_'+Date.now()+'.json','application/json');}
 catch(e){storageError('保存領域を読み出せません：'+e.message);}
});
async function importBackup(event, vocabularyOnly=false) {
 const file=event.target.files?.[0];if(!file)return;
 try {
  if(repository.blocked)throw Error(repository.blocked);
  const incoming=StudyStorage.parseBackup(JSON.parse(await file.text()));
  if(vocabularyOnly)incoming.progress=null;
  const next=StudyStorage.merge(progressData,vocabCards,incoming);
  if(!confirm(next.summary+'\n\n変更前の全体JSONをダウンロードし、統合して保存しますか？'))return;
  if(!exportAll())return;
  if(!commitState(next.progress,next.vocabulary,true))return;
  render();showScores(true);renderVocabListAndCard();updateDraft();
  toast('統合して保存しました。競合する内容は現在の記録を維持しています。');
 } catch(e){alert('読み込みを中止しました。現在の保存内容は変更していません。\n'+e.message);}
 finally{event.target.value='';}
}
$('importBtn').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',e=>importBackup(e));
$('vocabImportBtn').addEventListener('click',()=>$('vocabImportFile').click());
$('vocabImportFile').addEventListener('change',e=>importBackup(e,true));
