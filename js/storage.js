'use strict';
// The adapter is independent of the UI. Existing storage keys and object fields stay intact.
const StudyStorage = (() => {
  const STUDY = 'kosen-transfer-study-2028-v1';
  const VOCAB = 'kosen-toeic-vocabulary-2028-v1';
  const JOURNAL = 'kosen-study-pending-write-v1';
  const ORIGINAL = 'kosen-study-before-upgrade-v1';
  const IMPORT_COPY = 'kosen-study-before-import-v1';
  const keys = [STUDY, VOCAB];
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const clone = x => JSON.parse(JSON.stringify(x));
  function study(raw) {
    if (!object(raw) || !object(raw.checks) || (raw.scores !== undefined && !object(raw.scores))) throw Error('学習記録の形式が不正です');
    if (Object.values(raw.checks).some(x => typeof x !== 'boolean')) throw Error('チェック記録の形式が不正です');
    for (const [key, value] of Object.entries(raw.scores || {})) {
      if (/^s[1-3][LR]$/.test(key) && (!Number.isFinite(Number(value)) || Number(value) < 5 || Number(value) > 495)) throw Error('模試スコアの形式が不正です');
    }
    return {...clone(raw), scores: clone(raw.scores || {})};
  }
  function cards(raw) {
    if (!Array.isArray(raw)) throw Error('単語帳が配列ではありません');
    const used = new Set();
    return raw.map((v, index) => {
      if (!object(v) || typeof v.en !== 'string' || !v.en.trim() || typeof v.ja !== 'string' || !v.ja.trim()) throw Error(`${index + 1}番目の単語の形式が不正です`);
      for (const field of ['box', 'due', 'missed', 'created']) {
        if (v[field] !== undefined && (!Number.isFinite(Number(v[field])) || Number(v[field]) < 0)) throw Error(`${index + 1}番目の復習情報が不正です`);
      }
      if (v.box !== undefined && (!Number.isInteger(Number(v.box)) || Number(v.box) > 5)) throw Error('復習レベルが不正です');
      const id = v.id === undefined ? `legacy-${index}` : v.id;
      if (typeof id !== 'string' || !id || used.has(id)) throw Error('単語IDが不正または重複しています。元データは変更しません');
      used.add(id);
      // No word count limit, truncation, deduplication, or dropping unknown fields.
      return {box:0, due:0, missed:0, created:0, ...clone(v), id};
    });
  }
  function create(store) {
    let blocked = '', baseline = {};
    function raw() { return Object.fromEntries(keys.map(k => [k, store.getItem(k)])); }
    function put(k, value) { if (value === null) store.removeItem(k); else store.setItem(k, value); }
    function recover() {
      const text = store.getItem(JOURNAL);
      if (!text) return;
      const j = JSON.parse(text);
      if (!object(j.before) || !object(j.after) || !keys.every(k => [j.before[k], j.after[k]].every(v => v === null || typeof v === 'string'))) throw Error('復旧記録を確認できません');
      const current = raw();
      if (!keys.every(k => current[k] === j.before[k] || current[k] === j.after[k])) throw Error('別の画面の更新と復旧記録が競合しています');
      if (!keys.every(k => current[k] === j.after[k])) for (const k of keys) put(k, j.before[k]);
      store.removeItem(JOURNAL);
    }
    function load() {
      try {
        recover(); baseline = raw();
        const progress = baseline[STUDY] === null ? {checks:{}, scores:{}} : study(JSON.parse(baseline[STUDY]));
        const vocabulary = baseline[VOCAB] === null ? [] : cards(JSON.parse(baseline[VOCAB]));
        return {progress, vocabulary, error:''};
      } catch (e) {
        blocked = `読み込み・復旧に失敗しました：${e.message}。元データを守るため保存を停止しました。「保存領域をそのまま救出」で書き出し、元データを保管してください。`;
        return {progress:{checks:{}, scores:{}}, vocabulary:[], error:blocked};
      }
    }
    function write(progress, vocabulary, importing = false) {
      if (blocked) throw Error(blocked);
      const next = {[STUDY]:JSON.stringify(study(progress)), [VOCAB]:JSON.stringify(cards(vocabulary))};
      const before = raw();
      if (keys.some(k => before[k] !== baseline[k])) { blocked = '別の画面で保存内容が更新されました。再読み込みしてから操作してください'; throw Error(blocked); }
      if (keys.every(k => before[k] === next[k])) return;
      let journaled = false;
      try {
        // A mandatory, byte-for-byte safety copy precedes the first write.
        if (!store.getItem(ORIGINAL)) store.setItem(ORIGINAL, JSON.stringify({format:'kosen-raw-storage',version:1,raw:before,updated:new Date().toISOString()}));
        if (importing) store.setItem(IMPORT_COPY, JSON.stringify({format:'kosen-raw-storage',version:1,raw:before,updated:new Date().toISOString()}));
        store.setItem(JOURNAL, JSON.stringify({before, after:next})); journaled = true;
        for (const k of keys) if (before[k] !== next[k]) put(k, next[k]);
        if (keys.some(k => store.getItem(k) !== next[k])) throw Error('保存内容を照合できません');
        store.removeItem(JOURNAL); baseline = next;
      } catch (e) {
        if (journaled) {
          try { for (const k of keys) put(k, before[k]); store.removeItem(JOURNAL); }
          catch (_) { blocked = '保存途中で停止しました。復旧記録を保持しています。保存領域を救出してから再読み込みしてください'; }
        }
        throw Error(blocked || `保存できませんでした。変更は反映していません。空き容量・ブラウザ設定を確認してください（${e.name}）`);
      }
    }
    function rescue() {
      const result = {format:'kosen-raw-storage',version:1,updated:new Date().toISOString(),raw:raw()};
      for (const key of [ORIGINAL, IMPORT_COPY, JOURNAL]) result[key] = store.getItem(key);
      return result;
    }
    return {load, write, rescue, get blocked(){return blocked;}};
  }
  function parseBackup(data) {
    if (!object(data)) throw Error('JSONの形式が不正です');
    if (data.format === 'kosen-raw-storage' && object(data.raw)) {
      return {progress:data.raw[STUDY] == null ? null : study(JSON.parse(data.raw[STUDY])), vocabulary:data.raw[VOCAB] == null ? null : cards(JSON.parse(data.raw[VOCAB]))};
    }
    if (data.format === 'kosen-2028-checklist' && [1,2,3].includes(data.version ?? 1)) {
      return {progress:study(data), vocabulary:data.vocabulary === undefined ? null : cards(data.vocabulary)};
    }
    if (data.format === 'kosen-toeic-vocab' && (data.version ?? 1) === 1) return {progress:null, vocabulary:cards(data.vocabulary || data.cards)};
    // Legacy vocabulary exports without a format tag.
    if (data.format === undefined && (Array.isArray(data.vocabulary) || Array.isArray(data.cards))) return {progress:null, vocabulary:cards(data.vocabulary || data.cards)};
    throw Error('未対応のバックアップ形式・バージョンです');
  }
  function merge(progress, vocabulary, incoming) {
    let addedChecks=0, addedScores=0, addedWords=0, conflicts=0;
    const p = clone(progress), list = clone(vocabulary);
    if (incoming.progress) {
      for (const [k,v] of Object.entries(incoming.progress)) {
        if (['checks','scores','format','version','vocabulary','updated'].includes(k)) continue;
        if (!Object.hasOwn(p,k)) Object.defineProperty(p,k,{value:clone(v),enumerable:true,writable:true,configurable:true});
        else if (JSON.stringify(p[k]) !== JSON.stringify(v)) conflicts++;
      }
      for (const [k,v] of Object.entries(incoming.progress.checks)) {
        if (v && (!Object.hasOwn(p.checks,k) || p.checks[k]!==true)) { Object.defineProperty(p.checks,k,{value:true,enumerable:true,writable:true,configurable:true}); addedChecks++; }
      }
      for (const [k,v] of Object.entries(incoming.progress.scores)) {
        if (!Object.hasOwn(p.scores,k)) { Object.defineProperty(p.scores,k,{value:v,enumerable:true,writable:true,configurable:true}); addedScores++; }
        else if (p.scores[k] !== v) conflicts++;
      }
    }
    const words = new Map(list.map(v => [v.en.trim().toLowerCase(), v]));
    const used = new Set(list.map(v=>v.id));
    for (const v of incoming.vocabulary || []) {
      const key=v.en.trim().toLowerCase(), old=words.get(key);
      if (old) {
        if (JSON.stringify(old) !== JSON.stringify(v)) conflicts++;
        continue; // Keep current meaning AND entire review state together; never guess which is newer.
      }
      const item=clone(v);
      while (used.has(item.id)) item.id = 'import-'+Math.random().toString(36).slice(2)+Date.now().toString(36);
      used.add(item.id); list.push(item); words.set(key,item); addedWords++;
    }
    return {progress:p,vocabulary:list,summary:`チェック追加 ${addedChecks}件／スコア追加 ${addedScores}件／単語追加 ${addedWords}語\n競合 ${conflicts}件：現在の内容・復習情報を維持します。\nチェックは完了済みを優先します。取り込み元のJSONも保管してください。`};
  }
  return {STUDY,VOCAB,JOURNAL,ORIGINAL,IMPORT_COPY,study,cards,create,parseBackup,merge};
})();
if (typeof module !== 'undefined') module.exports = StudyStorage;
