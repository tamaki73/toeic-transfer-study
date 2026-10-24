"""Isolated Chromium tests. All seeded records are synthetic; no user browser is accessed."""
import json, tempfile, os
from urllib.parse import urlsplit
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
URL=os.environ.get('STUDY_TEST_URL','http://127.0.0.1:8000/toeic-transfer-study/')
STUDY='kosen-transfer-study-2028-v1'; VOCAB='kosen-toeic-vocabulary-2028-v1'
passed=[]
def ok(name): passed.append(name);print('PASS',name,flush=True)
def data(page):return page.evaluate('({progress:JSON.parse(localStorage.getItem(StudyStorage.STUDY)),cards:JSON.parse(localStorage.getItem(StudyStorage.VOCAB))})')
with sync_playwright() as p:
 launch={'executable_path':'/usr/bin/chromium','headless':True,'args':['--no-sandbox']}
 if urlsplit(URL).hostname not in ['localhost','127.0.0.1'] and os.environ.get('HTTPS_PROXY'):
  launch['proxy']={'server':os.environ['HTTPS_PROXY']}
 browser=p.chromium.launch(**launch)
 context=browser.new_context(accept_downloads=True,viewport={'width':1366,'height':900})
 page=context.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);expect(page.locator('#vocabAddBtn')).to_be_disabled();assert not errors,errors
 ok('subdirectory assets and initial desktop rendering')
 # Reload a copy of exact old-key data. Unknown fields/IDs and review details must survive.
 progress={'checks':{'m1-1':True,'w850-1':True,'future-id':True},'scores':{'s1L':390,'s1R':345},'future':{'value':'preserved'}}
 cards=[{'id':'legacy-1','en':'legacy','ja':'以前の単語','box':3,'due':0,'missed':2,'created':123,'history':[10,20]}]
 page.evaluate('([k,v,s,c])=>{localStorage.setItem(k,JSON.stringify(s));localStorage.setItem(v,JSON.stringify(c))}',[STUDY,VOCAB,progress,cards])
 page.reload();expect(page.locator('#sum1')).to_contain_text('735');expect(page.locator('#vocabCount')).to_have_text('1語登録');assert data(page)['cards']==cards
 ok('legacy keys, scores, words and review data load unchanged')
 page.locator('#vocabEnglish').fill('allocate');expect(page.locator('#vocabJapanese')).to_have_value('割り当てる');assert len(data(page)['cards'])==1
 page.locator('#vocabEnglish').press('Enter');expect(page.locator('#vocabJapanese')).to_have_value('割り当てる');assert len(data(page)['cards'])==1
 page.locator('#vocabJapanese').fill('配分する（確認済み）');page.locator('#vocabAddBtn').click();assert data(page)['cards'][-1]['ja']=='配分する（確認済み）'
 ok('built-in lookup, manual correction, Enter never saves, explicit Add saves')
 page.locator('#vocabEnglish').fill('aardvark');expect(page.locator('#vocabJapanese')).not_to_have_value('',timeout=15000);expect(page.locator('#vocabStatus')).to_contain_text('EJDict');assert len(data(page)['cards'])==2
 page.locator('#vocabEnglish').fill('running');expect(page.locator('#vocabJapanese')).not_to_have_value('',timeout=15000);expect(page.locator('#vocabStatus')).to_contain_text('EJDict')
 ok('real bundled EJDict requests and inflected word lookup')
 # External service success, race, manual correction, quota, bad results and timeout via deterministic mock.
 def response(route):
  from urllib.parse import urlparse,parse_qs
  term=parse_qs(urlparse(route.request.url).query)['q'][0]
  if term=='quota test phrase':body={'responseStatus':403,'quotaFinished':True}
  elif term=='invalid test phrase':body={'responseStatus':200,'responseData':{'translatedText':'untranslated text'}}
  else:body={'responseStatus':200,'responseData':{'translatedText':'試験用の訳'}}
  route.fulfill(status=200,content_type='application/json',body=json.dumps(body))
 page.route('https://api.mymemory.translated.net/get?*',response)
 page.locator('#vocabEnglish').fill('remote test phrase');expect(page.locator('#vocabJapanese')).to_have_value('試験用の訳',timeout=15000);expect(page.locator('#vocabStatus')).to_contain_text('MyMemory')
 page.locator('#vocabEnglish').fill('quota test phrase');expect(page.locator('#vocabStatus')).to_contain_text('利用上限',timeout=15000);expect(page.locator('#vocabAddBtn')).to_be_disabled()
 page.locator('#vocabEnglish').fill('invalid test phrase');expect(page.locator('#vocabStatus')).to_contain_text('有効な日本語訳',timeout=15000)
 ok('MyMemory success/quota/invalid output handling (mocked service)')
 # Hold a late translation; type a manual correction and release it afterwards.
 held=[]
 page.unroute('https://api.mymemory.translated.net/get?*')
 page.route('https://api.mymemory.translated.net/get?*',lambda route:held.append(route))
 page.locator('#vocabEnglish').fill('late test phrase');page.wait_for_timeout(1200);assert held
 page.locator('#vocabJapanese').fill('手動の訳');held.pop().fulfill(status=200,content_type='application/json',body=json.dumps({'responseStatus':200,'responseData':{'translatedText':'遅い翻訳'}}))
 page.wait_for_timeout(300);expect(page.locator('#vocabJapanese')).to_have_value('手動の訳')
 page.locator('#vocabEnglish').fill('old test phrase');page.wait_for_timeout(1200);assert held
 page.locator('#vocabEnglish').fill('budget');held.pop().fulfill(status=200,content_type='application/json',body=json.dumps({'responseStatus':200,'responseData':{'translatedText':'古い翻訳'}}))
 page.wait_for_timeout(300);expect(page.locator('#vocabJapanese')).to_have_value('予算')
 ok('manual edits and newer word input beat stale responses')
 page.locator('#vocabEnglish').fill('timeout test phrase');page.wait_for_timeout(1200);assert held
 expect(page.locator('#vocabStatus')).to_contain_text('時間切れ',timeout=10000)
 held.pop().abort()
 page.unroute('https://api.mymemory.translated.net/get?*')
 page.route('https://api.mymemory.translated.net/get?*',lambda r:r.abort('failed'))
 page.locator('#vocabEnglish').fill('network failure test');expect(page.locator('#vocabStatus')).to_contain_text('通信できません',timeout=15000)
 page.locator('#vocabJapanese').fill('手入力で復旧');expect(page.locator('#vocabAddBtn')).to_be_enabled()
 ok('timeout and network/CORS-style failure allow manual recovery')
 # Edit and delete specific rows through existing prompts.
 row=page.locator('.vocab-word').filter(has_text='allocate');answers=iter(['allocation','割り当て'])
 def edit_dialog(dialog):dialog.accept(next(answers))
 page.on('dialog',edit_dialog);row.get_by_role('button',name='編集').click();page.remove_listener('dialog',edit_dialog)
 assert data(page)['cards'][-1]['en']=='allocation'
 page.once('dialog',lambda d:d.accept());page.locator('.vocab-word').filter(has_text='allocation').get_by_role('button',name='削除').click();assert len(data(page)['cards'])==1
 page.locator('#flashcard').click();expect(page.locator('#flashcardText')).to_have_text('以前の単語')
 page.locator('#vocabKnow').click();c=data(page)['cards'][0];assert c['box']==4 and c['due']>0 and c['history']==[10,20]
 page.locator('[data-review="all"]').click();page.locator('#vocabAgain').click();assert data(page)['cards'][0]['missed']==3
 page.locator('[data-review="missed"]').click();expect(page.locator('#vocabPosition')).to_have_text('1 / 1')
 page.evaluate("()=>{window.spoken=[];speechSynthesis.speak=(s)=>window.spoken.push({text:s.text,lang:s.lang,rate:s.rate});}")
 page.locator('#vocabSpeak').click();spoken=page.evaluate('window.spoken')[0];assert spoken['text']=='legacy' and spoken['lang']=='en-US' and abs(spoken['rate']-0.88)<0.00001
 ok('word edit/delete, flashcard flip, review intervals and weak-word filter')
 page.locator('[data-tab="数学"]').click();first=page.locator('#sections input[type=checkbox]').first;expect(first).to_be_checked();first.uncheck()
 page.locator('#s2L').fill('450');page.locator('#s2R').fill('400');expect(page.locator('#sum2')).to_contain_text('850')
 page.reload();expect(page.locator('#sum2')).to_contain_text('850');page.locator('[data-tab="数学"]').click();expect(page.locator('#sections input[type=checkbox]').first).not_to_be_checked();assert data(page)['progress']['checks']['future-id'];assert data(page)['progress']['future']=={'value':'preserved'}
 ok('checklist and scores survive reload without dropping unknown data')
 with page.expect_download() as d:page.locator('#exportBtn').click()
 with tempfile.TemporaryDirectory() as tmp:
  path=Path(tmp)/'backup.json';d.value.save_as(path);backup=json.loads(path.read_text());assert backup['vocabulary'][0]['history']==[10,20]
  # Cancel import, then merge conflicting and new records.
  incoming={'format':'kosen-2028-checklist','version':3,'checks':{'m1-1':True},'scores':{'s1L':495,'s3L':460},'vocabulary':[dict(cards[0],id='incoming-legacy',ja='競合訳',box=0),{'id':'legacy-1','en':'newword','ja':'新語','box':0,'due':0,'missed':0,'created':1}]}
  path.write_text(json.dumps(incoming));before=data(page)
  page.once('dialog',lambda d:d.dismiss());page.locator('#importFile').set_input_files(path);page.wait_for_timeout(100);assert data(page)==before
  page.once('dialog',lambda d:d.accept())
  with page.expect_download():page.locator('#importFile').set_input_files(path)
  expect(page.locator('#vocabCount')).to_have_text('2語登録');result=data(page);assert result['cards'][0]['ja']=='以前の単語';assert result['cards'][0]['box']==0;assert result['cards'][0]['missed']==3;assert result['progress']['scores']['s1L']==390;assert result['progress']['scores']['s3L']==460
  # Invalid import rejects before confirmation or writes.
  path.write_text(json.dumps(dict(incoming,vocabulary=[None])));before=data(page);page.once('dialog',lambda d:d.accept());page.locator('#importFile').set_input_files(path);page.wait_for_timeout(100);assert data(page)==before
 ok('download JSON, cancel import, merge conflicts safely, reject invalid backup')
 # Simulate storage quota for edits: UI and original primary data must stay intact.
 before=data(page)
 page.evaluate("()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')};}")
 page.locator('#s1L').fill('400');expect(page.locator('#storageWarning')).to_be_visible();assert data(page)==before;expect(page.locator('#s1L')).to_have_value('390')
 page.evaluate('()=>{Storage.prototype.setItem=window.originalSet;}');page.reload()
 ok('quota failure keeps persisted records and UI in sync')
 # Preserve malformed raw data and refuse writes, including a raw rescue export.
 page.evaluate('(k)=>localStorage.setItem(k,"{broken")',VOCAB);page.reload();expect(page.locator('#storageWarning')).to_contain_text('保存を停止')
 page.locator('#vocabEnglish').fill('budget');page.locator('#vocabAddBtn').click();assert page.evaluate('(k)=>localStorage.getItem(k)',VOCAB)=='{broken'
 with page.expect_download() as d:page.locator('#rawExportBtn').click()
 with tempfile.TemporaryDirectory() as tmp:
  path=Path(tmp)/'raw.json';d.value.save_as(path);assert json.loads(path.read_text())['raw'][VOCAB]=='{broken'
 ok('corrupt original is never overwritten and raw rescue is downloadable')
 # Independent mobile device context, synthetic records only.
 mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
 mobile.add_init_script("Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('disabled','SecurityError')}})")
 mp=mobile.new_page();mp.goto(URL);mp.locator('#vocabEnglish').fill('aardvark');expect(mp.locator('#vocabJapanese')).not_to_have_value('',timeout=15000);mp.locator('#vocabEnglish').fill('annual');expect(mp.locator('#vocabJapanese')).to_have_value('年1回の、年間の');mp.locator('#vocabAddBtn').click();mp.locator('#flashcard').click();expect(mp.locator('#flashcardText')).to_have_text('年1回の、年間の')
 assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile overflow'
 mp.screenshot(path='/tmp/toeic-mobile.png',full_page=True)
 ok('mobile 390px: dictionary works with IndexedDB disabled, add, flip and no overflow')
 mp.set_viewport_size({'width':320,'height':700});assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth')
 ok('narrow 320px viewport has no horizontal overflow')
 assert not errors,errors
 browser.close()
print(f'{len(passed)} browser groups passed')
