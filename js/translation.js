'use strict';
const Translation = (() => {
  const VERSION = '9663055d59a8cb1a35078a71db7a09ff39305828';
  const memory = new Map();
  let database;
  function parseEJDict(text) {
    const map = new Map();
    for (const line of text.split(/\r?\n/)) {
      const tab = line.indexOf('\t');
      if (tab < 1) continue;
      const meaning = line.slice(tab+1).trim();
      if (!meaning) continue;
      for (const word of line.slice(0,tab).split(/\s*,\s*/)) {
        const key = word.trim().toLowerCase();
        if (key && !map.has(key)) map.set(key,meaning);
      }
    }
    return map;
  }
  const irregular = {went:'go',gone:'go',was:'be',were:'be',been:'be',did:'do',done:'do',had:'have',made:'make',took:'take',taken:'take',bought:'buy',brought:'bring',thought:'think',caught:'catch',taught:'teach',wrote:'write',written:'write',ran:'run',spoke:'speak',spoken:'speak',saw:'see',seen:'see',gave:'give',given:'give',got:'get',gotten:'get',knew:'know',known:'know',left:'leave',kept:'keep',met:'meet',sent:'send',paid:'pay',sold:'sell',told:'tell',held:'hold',found:'find',felt:'feel',built:'build',chose:'choose',chosen:'choose',grew:'grow',grown:'grow',won:'win',lost:'lose',children:'child',men:'man',women:'woman',people:'person',feet:'foot',teeth:'tooth',mice:'mouse',better:'good',best:'good',worse:'bad',worst:'bad'};
  function englishVariants(input) {
    const x=input.trim().toLowerCase(), result=[x];
    if (!/^[a-z]+$/.test(x)) return result;
    if (Object.hasOwn(irregular,x)) result.push(irregular[x]);
    if (/[^aeiou]ies$/.test(x)) result.push(x.slice(0,-3)+'y');
    if (/ied$/.test(x)) result.push(x.slice(0,-3)+'y');
    for (const suffix of ['ing','ed']) if (x.endsWith(suffix) && x.length>suffix.length+2) {
      const stem=x.slice(0,-suffix.length);
      result.push(stem,stem+'e');
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) result.push(stem.slice(0,-1));
    }
    if (/(ches|shes|sses|xes|zes|oes)$/.test(x)) result.push(x.slice(0,-2));
    if (x.endsWith('s') && !/(ss|us|is)$/.test(x) && x.length>3) result.push(x.slice(0,-1));
    return [...new Set(result)];
  }
  async function request(url, signal, ms=6500) {
    const controller=new AbortController();
    const abort=()=>controller.abort(signal?.reason);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort',abort,{once:true});
    const timeout=setTimeout(()=>controller.abort(),ms);
    try {
      const response=await fetch(url,{signal:controller.signal});
      if (!response.ok) throw Error(response.status===429?'利用上限に達しました。時間をおいて再検索してください':`通信先がHTTP ${response.status}を返しました`);
      // Keep timeout active until the complete response body has been read.
      return await response.text();
    } catch(e) {
      if (signal?.aborted) throw new DOMException('検索を中止しました','AbortError');
      if (e.name==='AbortError') throw Error('通信が時間切れになりました');
      if (e instanceof TypeError) throw Error('通信できません。接続またはブラウザの通信制限（CORS等）を確認してください');
      throw e;
    } finally {clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
  }
  function openCache() {
    if (database) return database;
    database=new Promise(resolve=>{
      if (!('indexedDB' in globalThis)) return resolve(null);
      let finished=false;
      const finish=db=>{if(finished){db?.close();return;}finished=true;clearTimeout(timer);resolve(db);};
      const timer=setTimeout(()=>finish(null),1000);
      try {
        const req=indexedDB.open('kosen-toeic-ejdict-v2',1);
        req.onupgradeneeded=()=>req.result.createObjectStore('shards');
        req.onsuccess=()=>finish(req.result);req.onerror=()=>finish(null);req.onblocked=()=>finish(null);
      } catch(_){finish(null);}
    });
    return database;
  }
  async function cacheGet(key) {
    const db=await openCache(); if(!db)return null;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>resolve(null),750);
      const done=value=>{clearTimeout(timer);resolve(value);};
      try {const tx=db.transaction('shards');const r=tx.objectStore('shards').get(key);r.onsuccess=()=>done(r.result);r.onerror=()=>done(null);tx.onabort=()=>done(null);}catch(_){done(null);}
    });
  }
  async function shard(letter,signal) {
    const key=VERSION+':'+letter;
    if(memory.has(key))return memory.get(key);
    const cached=await cacheGet(key);
    if(signal?.aborted)throw new DOMException('中止','AbortError');
    let map=cached ? parseEJDict(cached) : null;
    if(!map?.size) {
      const text=await request(new URL(`../assets/ejdict/${letter}.txt`,document.currentScript?.src || new URL('js/translation.js',document.baseURI)),signal,8500);
      map=parseEJDict(text);if(!map.size)throw Error('同梱辞書を読み取れませんでした');
      openCache().then(db=>{try{db?.transaction('shards','readwrite').objectStore('shards').put(text,key);}catch(_){}});
    }
    memory.set(key,map);return map;
  }
  async function lookupMyMemory(en,signal) {
    if(new TextEncoder().encode(en).length>500)throw Error('外部翻訳の文字数制限を超えています');
    const params=new URLSearchParams({q:en,langpair:'en|ja'});
    const data=JSON.parse(await request('https://api.mymemory.translated.net/get?'+params,signal));
    if(data.quotaFinished || [403,429].includes(Number(data.responseStatus)))throw Error('MyMemoryの利用上限です。時間をおくか訳を手入力してください');
    if(Number(data.responseStatus)!==200)throw Error('MyMemoryが翻訳を返しませんでした');
    const jp=String(data.responseData?.translatedText || '').trim();
    if(!/[\u3040-\u30ff\u3400-\u9fff]/.test(jp) || /MYMEMORY WARNING|QUOTA|INVALID LANGUAGE/i.test(jp))throw Error('有効な日本語訳を取得できませんでした');
    if(jp.length>180)throw Error('訳が長いため自動入力しません。意味を確認して手入力してください');
    return {text:jp,source:'外部翻訳 MyMemory（要確認）'};
  }
  async function translate(en,{signal}={}) {
    const variants=englishVariants(en);
    // Exact entries take precedence over every guessed base form.
    if(Object.hasOwn(BUILTIN_VOCAB,variants[0]))return {text:BUILTIN_VOCAB[variants[0]],source:'TOEIC内蔵辞書'};
    let dictionaryError;
    try {
      for(const candidate of variants) {
        if(signal?.aborted)throw new DOMException('中止','AbortError');
        const base=candidate!==variants[0];
        if(base && Object.hasOwn(BUILTIN_VOCAB,candidate))return {text:BUILTIN_VOCAB[candidate],source:`TOEIC内蔵辞書（推定原形 ${candidate}・要確認）`};
        if(!/^[a-z]/.test(candidate))continue;
        const dictionary=await shard(candidate[0],signal), meaning=dictionary.get(candidate);
        if(meaning) return {text:meaning.replace(/[『』]/g,'').replace(/\s+/g,' ').trim().slice(0,180),source:base?`EJDict（推定原形 ${candidate}・要確認）`:'EJDict'};
      }
    } catch(e){if(signal?.aborted)throw e;dictionaryError=e.message;}
    if(signal?.aborted)throw new DOMException('中止','AbortError');
    if(!navigator.onLine)throw Error('オフラインで辞書に見つかりませんでした。訳を手入力してください');
    try{return await lookupMyMemory(en,signal);}
    catch(e){if(signal?.aborted)throw e;throw Error((dictionaryError?`辞書：${dictionaryError}。`:'辞書に該当語がありません。')+e.message);}
  }
  return {parseEJDict,englishVariants,translate,lookupMyMemory};
})();
if(typeof module!=='undefined')module.exports=Translation;
