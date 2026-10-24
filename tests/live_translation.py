"""Opt-in real MyMemory/CORS check against published Pages; synthetic input only."""
import os
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('STUDY_TEST_URL', 'https://tamaki73.github.io/toeic-transfer-study/')
with sync_playwright() as p:
    launch = {'executable_path': '/usr/bin/chromium', 'headless': True, 'args': ['--no-sandbox']}
    if urlsplit(URL).hostname not in ['localhost', '127.0.0.1'] and os.environ.get('HTTPS_PROXY'):
        launch['proxy'] = {'server': os.environ['HTTPS_PROXY']}
    browser = p.chromium.launch(**launch)
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    errors = []
    responses = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: responses.append(response.status)
            if 'api.mymemory.translated.net/get?' in response.url else None)
    response = page.goto(URL)
    assert response.status == 200
    page.locator('#vocabEnglish').fill('learning progress')
    expect(page.locator('#vocabJapanese')).not_to_have_value('', timeout=20000)
    expect(page.locator('#vocabStatus')).to_contain_text('MyMemory')
    assert responses == [200], responses
    assert page.evaluate('localStorage.length') == 0, 'Translation must not save a card'
    assert not errors, errors
    print('PASS live Pages → MyMemory → Japanese result, CORS, and no automatic registration')
    print('Synthetic input: learning progress; result:', page.locator('#vocabJapanese').input_value())
    page.locator('#vocabPanel').screenshot(path='/tmp/toeic-live-translation.png')
    browser.close()
