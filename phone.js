/* =========================================================================
   핸드폰 (밤편지용, 핸드폰 v139 기반)
   내 폰 / 캐릭터 폰 / 모브 대화 — 세 갈래로 나뉜 메신저 엿보기 도구
   ========================================================================= */
(() => {
  'use strict';

  const NS = '__ZETATALK_V1__';
  const APP_ID = 'zetatalk-v1-app';
  const STYLE_ID = 'zetatalk-v1-style';
  const K_SET = 'zetatalk.v8.settings';
  function scope() {
    return (window.BamPhone && window.BamPhone.scope()) || 'default';
  }
  const K_ROOM = 'zetatalk.v8.rooms.' + scope();
  const K_CAV = 'zetatalk.v8.charav.' + scope();
  const K_LORE = 'zetatalk.v8.lore.' + scope();
  const K_APPS = 'zetatalk.v8.apps.' + scope();
  const K_QNA = 'zetatalk.v8.qna.' + scope();

  try { window[NS] && window[NS].destroy && window[NS].destroy(); } catch (e) {}

  /* ── 저장소 ────────────────────────────────────────────────────────── */
  const DEFAULTS = {
    provider: 'gemini', apiUrl: '', apiKey: '', model: '',
    maxTokens: 2000, turns: 16, persona: '', selector: '',
    theme: 'kakao', fontPx: 15.5, dark: false, sendImage: false, myAvatar: '',
    lang: '', appLang: '', trans: false, nShop: 6, nPay: 6, nMusic: 6, nSearch: 5, nRoom: 6
  };
  const PRESET = {
    openai:     { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    openrouter: { url: 'https://openrouter.ai/api/v1', model: '' },
    gemini:     { url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
    claude:     { url: 'https://api.anthropic.com', model: 'claude-sonnet-5' },
    custom:     { url: '', model: '' }
  };

  const load = (k, d) => {
    try { const r = window.BamKV.getItem(k); return r ? JSON.parse(r) : d; } catch (e) { return d; }
  };
  let S = Object.assign({}, DEFAULTS, load(K_SET, {}));
  if (window.BamPhone && !S.apiKey) { try { Object.assign(S, window.BamPhone.api() || {}); } catch (e) {} }
  if (S.theme === 'galaxy' || S.theme === 'insta') S.theme = 'kakao';
  let rooms = load(K_ROOM, []);
  let charAv = load(K_CAV, '');
  const saveCA = () => {
    try {
      if (charAv) window.BamKV.setItem(K_CAV, JSON.stringify(charAv));
      else window.BamKV.removeItem(K_CAV);
    } catch (e) { toast('사진이 너무 큽니다'); }
  };
  let apps = Object.assign({ shop: [], music: [], search: [], pay: [] }, load(K_APPS, {}));
  const K_CAL = 'zetatalk.v8.cal.' + scope();
  let cal = load(K_CAL, []);
  const saveC = () => { try { window.BamKV.setItem(K_CAL, JSON.stringify(cal)); } catch (e) {} };
  let calAt = new Date(), calPick = '', calBusy = false;
  // 하루문답 — 오늘 질문 하나와 지난 기록
  let qna = Object.assign({ today: null, past: [] }, load(K_QNA, {}));
  const saveQ = () => {
    try { window.BamKV.setItem(K_QNA, JSON.stringify(qna)); }
    catch (e) { toast('저장 공간이 가득 찼습니다'); }
  };
  const saveA = () => {
    try { window.BamKV.setItem(K_APPS, JSON.stringify(apps)); }
    catch (e) { toast('저장 공간이 가득 찼습니다'); }
  };
  let lore = Object.assign({ char: '', user: '' }, load(K_LORE, {}));
  const saveL = () => { try { window.BamKV.setItem(K_LORE, JSON.stringify(lore)); } catch (e) {} };
  const saveS = () => { try { window.BamKV.setItem(K_SET, JSON.stringify(S)); } catch (e) {} };
  const saveR = () => {
    try { window.BamKV.setItem(K_ROOM, JSON.stringify(rooms)); }
    catch (e) { toast('저장 공간이 가득 찼습니다. 오래된 방을 지워 주세요'); }
  };
  const me = () => S.persona || detectUser() || '나';

  // 원본 대화에서 유저 쪽 이름 찾기
  const BAD_NAME = /^(user|유저|나|저|me|you|사용자|guest|assistant|캐릭터|char)$/i;

  let _userName = '';
  function detectUser() {
    if (_userName) return _userName;
    const tally = {};
    for (const t of extract()) {
      if (t.who !== 'user' || !t.name) continue;
      tally[t.name] = (tally[t.name] || 0) + 1;
    }
    // 이 방의 로그에서 읽힌 이름만 쓴다.
    // 저장소에는 다른 방 프로필까지 섞여 있어 엉뚱한 이름이 걸린다
    const got = Object.keys(tally)
      .sort((a, b) => tally[b] - tally[a])
      .find(n => !BAD_NAME.test(n)) || '';
    // 빈 값은 캐시하지 않는다. 대화가 아직 안 읽혔을 수 있다
    if (got) _userName = got;
    return got;
  }

  /* ── 대화 추출 ─────────────────────────────────────────────────────── */
  const CHAT_DOM_URL = 'https://zetakit.pages.dev/tools/zeta-chat-dom.js';
  function loadChatDOM() {
    if (window.BamPhone) return;
    if (window.ZetaChatDOM && window.ZetaChatDOM.extractLoadedRecords) return;
    if (document.querySelector('script[data-zp-chatdom]')) return;
    const s = document.createElement('script');
    s.dataset.zpChatdom = '1';
    s.src = CHAT_DOM_URL + '?cb=' + Date.now();
    s.onload = () => {
      _userName = ''; _mainC = ''; _picMap = null;
      if (view === 'home') renderHome();
    };
    document.head.appendChild(s);
  }

  function fromChatDOM() {
    const fn = window.ZetaChatDOM && window.ZetaChatDOM.extractLoadedRecords;
    if (typeof fn !== 'function') return null;
    let recs;
    try { recs = fn({ root: document, exclude: [], includeStatus: false }); }
    catch (e) { return null; }
    if (!Array.isArray(recs) || !recs.length) return null;
    const turns = recs.map(r => {
      const role = String(r.role || r.type || '').toLowerCase();
      if (role === 'image') return null;
      const text = String(r.text || '').trim();
      if (text.length < 2) return null;
      return { who: role === 'user' ? 'user' : 'char', name: String(r.name || '').trim(), text };
    }).filter(Boolean);
    return turns.length ? turns : null;
  }

  const sigOf = el => {
    const c = (typeof el.className === 'string' ? el.className : '')
      .trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    return el.tagName + (c ? '.' + c : '');
  };

  function autoDetect() {
    const groups = new Map();
    for (const el of document.querySelectorAll('div,li,article,section,p')) {
      if (el.closest('#' + APP_ID)) continue;
      const t = (el.innerText || '').trim();
      if (t.length < 2 || t.length > 4000 || el.children.length > 8) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 12) continue;
      const s = sigOf(el);
      if (!groups.has(s)) groups.set(s, []);
      groups.get(s).push(el);
    }
    let best = null, top = 0;
    for (const [sig, els] of groups) {
      if (els.length < 3) continue;
      const sc = els.reduce((n, e) => n + (e.innerText || '').trim().length, 0) * Math.min(els.length, 40);
      if (sc > top) { top = sc; best = els; }
    }
    return best;
  }

  function extract() {
    if (window.BamPhone) return window.BamPhone.turns();
    const viaModule = fromChatDOM();
    if (viaModule) return viaModule;
    let els = [];
    if (S.selector) {
      try { els = [...document.querySelectorAll(S.selector)].filter(e => !e.closest('#' + APP_ID)); }
      catch (e) { els = []; }
    }
    if (!els.length) els = autoDetect() || [];
    els = els.filter(el => !els.some(o => o !== el && el.contains(o)));
    if (!els.length) return [];
    els.sort((a, b) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    const cx = els.map(e => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; });
    const mid = [...cx].sort((a, b) => a - b)[Math.floor(cx.length / 2)];
    return els.map((e, i) => ({
      who: cx[i] > mid + 12 ? 'user' : 'char', name: '',
      text: (e.innerText || '').replace(/\s+\n/g, '\n').trim()
    })).filter(t => t.text.length >= 2);
  }

  // 이 방의 주인 캐릭터
  let _mainC = '';
  function mainChar() {
    if (window.BamPhone) return window.BamPhone.charName();
    if (_mainC) return _mainC;
    const tally = {};
    for (const t of extract()) {
      if (t.who !== 'char' || !t.name) continue;
      tally[t.name] = (tally[t.name] || 0) + 1;
    }
    const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    if (top) { _mainC = top; return top; }
    const h = document.querySelector('h1,h2,header');
    return h ? (h.innerText || '').trim().split('\n')[0].slice(0, 20) : '캐릭터';
  }

  // 캐릭터 프로필 사진
  function charAvatar() {
    if (window.BamPhone) return window.BamPhone.charAvatar();
    const imgs = [...document.querySelectorAll('img')]
      .filter(i => !i.closest('#' + APP_ID))
      .map(i => ({ i, r: i.getBoundingClientRect() }))
      .filter(o => o.r.width >= 24 && o.r.width <= 90 &&
        Math.abs(o.r.width - o.r.height) < 8 && o.i.currentSrc);
    if (!imgs.length) return '';
    imgs.sort((a, b) => a.r.top - b.r.top);
    return imgs[0].i.currentSrc || '';
  }

  // 화면에 있는 프사와 이름을 짝지어 둔다
  // 단역과 기본 아이콘은 걸러서, 진짜 프사가 있는 인물만 담는다
  const EXTRA_NAME = /^(.*?)(하객|손님|행인|시민|남자|여자|점원|직원|팀원|학생|사람|기자|경비|주민|관객|무리|일동|사원|병사|부하|모브|npc|npc\d*)\s*\d*$/i;
  const DEFAULT_PIC = /(default|placeholder|anonymous|avatar[-_]?(?:default|none|empty)|no[-_]?image|blank|person|user[-_]?icon|profile[-_]?default)/i;

  function isDefaultPic(img) {
    const src = String(img.currentSrc || img.src || '');
    if (!src) return true;
    if (DEFAULT_PIC.test(src)) return true;
    if (src.startsWith('data:image/svg')) return true;
    // 실제로 그려 보고 색이 거의 없으면 기본 아이콘으로 본다
    try {
      const cv = document.createElement('canvas');
      cv.width = 12; cv.height = 12;
      const g = cv.getContext('2d');
      g.drawImage(img, 0, 0, 12, 12);
      const d = g.getImageData(0, 0, 12, 12).data;
      let sat = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        if (mx) sat += (mx - mn) / mx;
        n++;
      }
      return n ? (sat / n) < 0.08 : false;
    } catch (e) { return false; }   // 다른 도메인 사진이면 읽지 못한다. 그건 진짜 사진이다
  }

  let _picMap = null;
  function charPicMap() {
    if (window.BamPhone) { const m = {}, n = window.BamPhone.charName(), a = window.BamPhone.charAvatar(); if (n && a) m[n] = a; _picMap = m; return m; }
    if (_picMap) return _picMap;
    const map = {};
    // 발언이 잦은 인물만 후보로 삼는다. 단역은 뺀다
    const tally = {};
    for (const t of extract()) {
      if (t.who !== 'char' || !t.name) continue;
      tally[t.name] = (tally[t.name] || 0) + 1;
    }
    const names = Object.keys(tally)
      .filter(n => tally[n] >= 2 && !EXTRA_NAME.test(n) && n.length >= 2);
    if (!names.length) { _picMap = map; return map; }

    const imgs = [...document.querySelectorAll('img')]
      .filter(i => !i.closest('#' + APP_ID))
      .map(i => ({ i, r: i.getBoundingClientRect() }))
      .filter(o => o.r.width >= 20 && o.r.width <= 100 &&
        Math.abs(o.r.width - o.r.height) < 12 && o.i.currentSrc);
    for (const o of imgs) {
      if (isDefaultPic(o.i)) continue;
      let el = o.i, hit = '';
      for (let d = 0; d < 6 && el.parentElement && !hit; d++) {
        el = el.parentElement;
        const txt = (el.innerText || '').trim();
        if (!txt || txt.length > 300) continue;
        hit = names.find(n => txt.includes(n)) || '';
      }
      if (hit && !map[hit]) map[hit] = o.i.currentSrc;
    }
    _picMap = map;
    return map;
  }
  const picByName = n => charPicMap()[String(n || '').trim()] || '';

  let _charPic = null;
  const charPic = () => {
    if (_charPic === null) { try { _charPic = charAvatar(); } catch (e) { _charPic = ''; } }
    return _charPic;
  };

  // 유저 쪽 말풍선에 붙은 프로필 사진 (없으면 빈 문자열)
  function userAvatar() {
    if (S.myAvatar) return S.myAvatar;
    const all = [...document.querySelectorAll('img')]
      .filter(i => !i.closest('#' + APP_ID))
      .map(i => ({ i, r: i.getBoundingClientRect() }))
      .filter(o => o.r.width >= 24 && o.r.width <= 90 &&
        Math.abs(o.r.width - o.r.height) < 8 && o.i.currentSrc);
    if (all.length < 2) return '';
    const mid = window.innerWidth / 2;
    const right = all.filter(o => o.r.left + o.r.width / 2 > mid + 20);
    return right.length ? (right[0].i.currentSrc || '') : '';
  }

  let learnStop = null;
  function startLearn() {
    go('home');
    toast('대화 말풍선을 하나 탭하세요');
    const h = ev => {
      if (ev.target.closest('#' + APP_ID)) return;
      ev.preventDefault(); ev.stopPropagation();
      let el = ev.target;
      for (let i = 0; i < 6 && el.parentElement; i++) {
        try { if (document.querySelectorAll(sigOf(el)).length >= 3) break; } catch (e) {}
        el = el.parentElement;
      }
      S.selector = sigOf(el); saveS();
      stop(); go('settings');
      toast('인식 완료 · ' + S.selector);
    };
    const stop = () => { document.removeEventListener('click', h, true); learnStop = null; };
    learnStop = stop;
    document.addEventListener('click', h, true);
  }

  /* ── API ───────────────────────────────────────────────────────────── */
  const clean = v => String(v == null ? '' : v)
    .replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').trim();
  const baseUrl = () =>
    clean(S.provider === 'custom' ? S.apiUrl : PRESET[S.provider].url).replace(/\/+$/, '');

  let lastMode = '';
  let tokenBoost = 0;
  async function callLLM(system, user, images) {
    const key = clean(S.apiKey);
    if (!key) throw new Error('설정에서 API Key를 입력하세요');
    const base = baseUrl();
    if (!base) throw new Error('설정에서 API URL을 입력하세요');
    const model = clean(S.model) || PRESET[S.provider].model;
    if (!model) throw new Error('설정에서 모델 이름을 입력하세요');

    const pics = (S.sendImage && images && images.length) ? images : [];
    let res;

    if (S.provider === 'claude') {
      const content = [{ type: 'text', text: user }];
      for (const d of pics) {
        const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(d);
        if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
      }
      res = await fetch(base + '/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model, max_tokens: Math.max(Number(S.maxTokens) || 2000, tokenBoost), system,
          messages: [{ role: 'user', content }]
        })
      });
      if (!res.ok) throw new Error(res.status + ' · ' + (await res.text()).slice(0, 220));
      const d = await res.json();
      lastMode = '표준';
      return (d.content || []).map(b => b.text || '').join('\n').trim();
    }

    const userContent = pics.length
      ? [{ type: 'text', text: user }].concat(pics.map(u => ({ type: 'image_url', image_url: { url: u } })))
      : user;
    const body = JSON.stringify({
      model, max_tokens: Math.max(Number(S.maxTokens) || 2000, tokenBoost),
      messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }]
    });
    const url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
        body
      });
      lastMode = '표준';
    } catch (e1) {
      try {
        res = await fetch(url + '?key=' + encodeURIComponent(key), {
          method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body
        });
        lastMode = '우회';
      } catch (e2) {
        throw new Error('서버에 닿지 못했습니다. 두 가지 방식 모두 막혔습니다.\n' +
          '이 서버가 zeta-ai.io 에서 오는 스크립트 요청을 허용하지 않는 것 같습니다.');
      }
    }
    if (!res.ok) throw new Error(res.status + ' · ' + (await res.text()).slice(0, 220));
    const d = await res.json();
    return (d.choices?.[0]?.message?.content || '').trim();
  }

  function parseJSON(raw, what) {
    const s = String(raw || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const pick = v => {
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object') {
        for (const k of Object.keys(v)) if (Array.isArray(v[k])) return v[k];
      }
      return null;
    };
    try {
      const got = pick(JSON.parse(s));
      if (got) return got;
    } catch (e) {}
    const m = s.match(/\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    // 응답이 중간에 잘렸을 때 — 온전한 덩어리만 골라낸다
    const chunks = s.match(/\{[^{}]*\}/g);
    if (chunks) {
      const out = [];
      for (const c of chunks) { try { out.push(JSON.parse(c)); } catch (e) {} }
      if (out.length) return out;
    }
    throw new Error((what || '응답') + '을 읽지 못했습니다 · ' +
      (s ? s.slice(0, 200) : '빈 응답이 왔습니다'));
  }

  const logText = () => extract().slice(-S.turns)
    .map(t => (t.who === 'user' ? (t.name || me()) : (t.name || '상대')) + ': ' + t.text)
    .join('\n');

  /* ── 언어 ──────────────────────────────────────────────────────────── */
  const LANGS = [['ko', '한국어'], ['ja', '일본어'], ['en', '영어'], ['zh', '중국어']];
  const langLabel = v => (LANGS.find(x => x[0] === (v || 'ko')) || LANGS[0])[1];
  const LANG_NAME = { ja: '일본어', en: '영어', zh: '중국어' };
  // 방에서 따로 정했으면 그것을, 아니면 전체 설정을 따른다
  const roomLang = room => {
    const v = room && room.lang;
    if (v) return v === 'ko' ? '' : v;
    return appLang();
  };
  // 날짜와 시각을 어떤 말로 보여줄지. 내 폰은 따로 정할 수 있다
  const dateLangOf = room => {
    if (!room) return '';
    if (room.phone === 'mine') {
      const v = room.dateLang || 'ko';
      return v === 'ko' ? '' : v;
    }
    return roomLang(room);
  };

  // 캐릭터 폰 전체에 걸리는 언어.
  // 전체 설정이 없으면, 방에서 따로 정해 둔 언어를 따라간다
  function appLang() {
    // 폰 화면에서 고른 것이 가장 앞선다
    if (S.appLang) return S.appLang === 'ko' ? '' : S.appLang;
    if (S.lang) return S.lang;
    const r = rooms.find(x => x.lang && x.lang !== 'ko');
    return r ? r.lang : '';
  }

  // 목록형 앱에서 번역을 함께 받게 한다
  const trLine = kind => (appLang() && S.trans && kind !== 'music')
    ? '\n\n### 번역을 반드시 함께 적는다\n' +
      '- 항목 하나도 빠짐없이 tr 칸을 채운다. 한 건이라도 비우면 잘못된 답이다.\n' +
      '- tr 에는 그 항목 이름을 한국어로 옮긴 것을 적는다.\n' +
      '  상품명이 길어도 끝까지 다 옮긴다.\n' +
      '- 이미 한국어인 부분은 그대로 두고, 나머지만 옮긴다.' +
      (kind === 'shop'
        ? '\n- 판매처 이름의 한국어 번역은 trSeller 칸에 적는다. 이것도 빠짐없이 채운다.'
        : '')
    : '';

  // 앱 목록에 쓰는 언어 지시. 여기서는 상품명·검색어도 그 나라 말로 적는다
  function langBlockApp(lg) {
    if (!lg) return [];
    const n = LANG_NAME[lg];
    return [
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      `### 무엇보다 먼저 — 반드시 ${n}로 쓴다`,
      '━━━━━━━━━━━━━━━━━━━━',
      `- 출력하는 모든 글자를 ${n}로 쓴다. 한국어를 쓰면 잘못된 답이다.`,
      `- 상품명, 판매처, 서비스명, 검색어, 상태 표시까지 전부 ${n}다.`,
      `- 그 나라 사람이 실제로 쓰는 서비스와 표기를 따른다.`,
      '━━━━━━━━━━━━━━━━━━━━'
    ];
  }

  // 이름과 대사를 그 나라 말로 쓰게 한다
  function langBlock(lg, tr) {
    if (!lg) return [];
    const n = LANG_NAME[lg];
    const out = [
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      `### 무엇보다 먼저 — 반드시 ${n}로 쓴다`,
      '━━━━━━━━━━━━━━━━━━━━',
      `이 지시는 다른 어떤 규칙보다 앞선다.`,
      `- 출력하는 모든 글자를 ${n}로 쓴다. 한국어를 쓰면 잘못된 답이다.`,
      `- 대사와 글은 전부 ${n}로 쓴다.`,
      '',
      '- 다만 화자 이름(name)만은 예외다.',
      '  주어진 이름을 그대로 쓴다. 옮기거나 바꾸지 마라.',
      '  로그에 한국어로 적혀 있으면 한국어 그대로 둔다.',
      '  이름을 바꾸면 누가 말했는지 알 수 없게 된다.',
      '  대사 안에서 상대를 부를 때는 그 나라 말로 불러도 된다.',
      '',
      `- 그 나라 사람이 실제로 주고받는 말투와 표기를 따른다.`,
      `  번역투로 쓰지 말고, 그 나라 말로 처음부터 쓴 것처럼 자연스럽게 써라.`,
      '',
      '- 그 말에 높임말이 없더라도 두 사람의 위아래는 그대로 남는다.',
      '  로그에서 조심스럽게 말하던 인물이면 단정하지 말고 에두르며,',
      '  명령형 대신 부탁하는 꼴로 쓰고, 말수를 줄여라.',
      '  로그에서 편하게 굴던 인물이면 짧고 거침없이 써라.',
      '  높임말이 없다는 이유로 아무나 같은 말투가 되면 잘못된 답이다.'
    ];
    if (tr) out.push(
      '- 그리고 메시지마다 한국어 번역을 tr 칸에 함께 적는다.',
      '  text 칸에는 번역을 넣지 마라. 원문만 넣는다.',
      '',
      '  번역을 적을 때 — 이것이 중요하다',
      '  - 원문을 그대로 옮기지 마라. 로그에서 이 인물이 한국어로 어떻게',
      '    말했는지를 보고, 그 말투로 다시 쓴다.',
      '  - 로그에서 존댓말을 쓰던 인물이면 번역도 존댓말이어야 한다.',
      '    반말을 쓰던 인물이면 반말이어야 한다.',
      '  - 상대를 부르던 말도 로그에 있는 그대로 쓴다.',
      '  - 원문 언어에 높임말이 없다고 해서 번역까지 평평해지면 안 된다.');
    out.push('━━━━━━━━━━━━━━━━━━━━');
    return out;
  }

  /* ── 프롬프트 ──────────────────────────────────────────────────────── */
  function callRule(room) {
    if (room && room.userCall) {
      return [
        `- 유저를 부를 때는 "${room.userCall}" 라고 부른다.`,
        '  이 호칭을 대화 내내 유지한다. 다른 호칭으로 바꾸지 마라.',
        '  문장에 녹여 쓰되, 매 문장마다 억지로 넣지는 마라.',
        '- 지문은 둘의 관계와 거리를 읽는 데 함께 참고한다.'
      ];
    }
    return [
      '- 유저를 부르는 호칭은 이 순서로 정한다.',
      '  1) 인물이 직접 하는 말 안에서 찾는다. 본명이든 애칭이든 거기 있으면 그대로 쓴다.',
      '  2) 대사에 없으면 별표(*) 안의 지문에서 단서를 찾아 유추한다.',
      '  3) 그래도 애매하면 둘의 관계를 보고 어울리는 호칭을 정한다.',
      '  본명을 기본값으로 삼지 마라. 관계가 읽히면 그에 맞는 호칭이 낫다.',
      '- 지문은 둘의 관계와 거리를 읽는 데 함께 참고한다.'
    ];
  }

  const LEN_RULE = {
    auto: '- 한 통에 담을 길이는 대화 흐름을 보고 네가 정한다.\n' +
          '  가볍게 받아넘길 대목이면 한 줄로 짧게,\n' +
          '  할 말이 있는 대목이면 두세 문장으로 쓴다.\n' +
          '  세 문장을 넘기면 잘못된 답이다.\n' +
          '  매번 같은 길이로 쓰지 마라. 턴마다 길이가 달라야 한다.\n' +
          '- 길이가 달라져도 말투는 그대로다.\n' +
          '  짧게 쓴다고 무뚝뚝해지거나, 길게 쓴다고 다정해지지 마라.\n' +
          '  호칭, 어미, 말버릇은 로그에 있는 그대로 유지한다.',
    short: '- 한 통은 한 호흡이다. 짧은 문장 한둘이면 족하다.\n' +
           '  두 줄로 넘어가면 이미 길다. 한 줄 안에서 끝내라.\n' +
           '  설명하거나 이유를 덧붙이지 마라.',
    mid: '- 메신저답게 짧게 끊어 여러 번 보낸다. 한 통은 한두 문장이다.\n' +
         '  세 문장을 넘기면 잘못된 답이다.\n' +
         '  대신 한 통에 알맹이 하나는 넣어라. 방금 한 일, 본 것, 떠오른 생각.\n' +
         '  상대가 물고 늘어질 거리가 없으면 안 보낸 것과 같다.\n' +
         '  설명이나 이유를 덧붙여 늘리지 마라.',
    long: '- 한 통을 길게 쓴다. 짧게 끊지 말고 한 통에 몰아 쓴다.\n' +
          '- 길게 쓰는 만큼 담기는 것도 많아야 한다.\n' +
          '  한 통에 서로 다른 이야기가 둘은 들어가야 한다.\n' +
          '  방금 있었던 일, 그때 든 생각, 상대에게 하고 싶은 말 중에서 고른다.\n' +
          '- 한 가지를 여러 문장으로 늘려 쓰는 것을 금지한다.\n' +
          '  부연, 이유 설명, 걱정하는 잔소리로 길이를 채우지 마라.'
  };
  // 방마다 따로 정한다. 정해 두지 않은 방은 자동이다
  const lenOf = room => (room && room.replyLen) || 'auto';
  const rules = (len, lg, tr) => [
    '규칙',
    '- 로그에서 드러난 말투, 관계, 감정선을 그대로 유지한다.',
    LEN_RULE[len] || LEN_RULE.auto,
    '',
    '### 나눌지 붙일지',
    '- 나눌지 붙일지는 말 사이의 관계로 정한다.',
    '- 뒤엣말이 앞엣말 없이는 뜻이 안 통하면 반드시 한 통에 붙인다.',
    '  ("피자 먹었는데 맛있더라" + "다음에 같이 가자" → 한 통)',
    '- 서로 딴 얘기거나, 내 말에서 상대에게 넘어가는 자리면 나눠도 된다.',
    '  ("누워 있었어" + "애기는 왜 안 자?" → 나눠도 붙여도 된다)',
    '- 개수를 채우려고 억지로 나누지 마라. 붙여 보낼 말이면 통을 줄여라.',
    '',
    '### 공을 넘기는 법',
    '- 매번 질문으로 끝내지 마라. 질문으로 끝내는 것은 세 턴에 한 번이면 족하다.',
    '  한 턴에 물음표를 두 개 이상 쓰지 마라.',
    '- 되묻는 대신 이렇게 넘겨도 된다.',
    '  1) 궁금할 거리를 흘려두고 설명하지 않는다. ("오늘 이상한 거 봤는데.")',
    '  2) 다 말하지 않고 하나를 덜 알려준다. ("엄마는 괴물이랬는데.")',
    '     말줄임표로 흐리라는 뜻이 아니다. 문장은 맺되 내용을 덜 주는 것이다.',
    '  3) 아무것도 하지 않고 그냥 끝낸다. 이런 턴도 있어야 한다.',
    '',
    '- 다만 말투 자체는 바꾸지 않는다.',
    '- 말투, 어휘, 이모지 사용 여부는 로그에 있는 그대로 따른다.',
    '  로그에 없는 말버릇이나 어투를 새로 만들지 마라.',
    '- 말줄임표, 물음표나 느낌표를 겹쳐 쓰는 것, 감탄사도 마찬가지다.',
    '  로그에 나온 만큼만 쓴다. 로그에 없으면 새로 만들지 마라.',
    '- 말줄임표는 이번에 만드는 메시지 전체에서 많아야 한 번이다.',
    '  두 번 넘게 나오면 잘못된 답이다. 대부분의 메시지에는 아예 없어야 한다.',
    '  문장 첫머리에는 절대 붙이지 마라.',
    '  말끝을 흐려서 감정을 대신하지 마라. 할 말은 문장으로 끝내라.',
    '  번역(tr)에도 같은 규칙을 적용한다. 원문에 없는 말줄임표를 번역에 넣지 마라.',
    '- 지문이나 서술 없이 채팅 메시지만 쓴다.',
    '',
    '### 여기가 어떤 자리인지',
    '- 두 사람은 지금 떨어져 있다. 그래서 메신저로 말하는 것이다.',
    '  같은 자리에 있으면 톡을 할 이유가 없다.',
    '- 각자 자기 자리에서 자기 하루를 보내는 중에 폰을 들여다보고 있다.',
    '  만나러 가는 길도 아니고, 문 앞에 서 있는 것도 아니다.',
    '- 원본 로그는 말투와 관계를 읽는 데 쓴다.',
    '  그 장면은 이미 지나갔다. 지금은 그 뒤 어느 날이다.',
    '  그 장면에서 하던 요구나 부탁을 이 방에서 그대로 되풀이하지 마라.',
    '- "얼른 와", "언제 와", "어디야" 같은 말은 한 번이면 족하다.',
    '  이미 물었으면 다시 묻지 마라. 답을 못 들었어도 그렇다.',
    '  같은 것을 조르는 대신 다른 이야기로 넘어가라.',
    '- 이 방에서 앞서 한 말을 다시 하지 마라.',
    '  같은 요구, 같은 물음, 같은 첫머리를 반복하는 것을 금지한다.',
    '  이미 한 말이면 상대가 답했다고 치고 그 다음으로 넘어가라.',
    '- 대화를 앞으로 밀어라.',
    '  새 화제, 새 물음, 오늘 있었던 일 중 하나는 꺼내서',
    '  상대가 답할 거리를 남겨라. 한 자리에 머물지 마라.',
    lg ? `- 다시 한 번. 모든 글자를 ${LANG_NAME[lg]}로 쓴다.` : '',
    '',
    '출력은 이 JSON 배열 하나만. 설명이나 코드펜스 금지.',
    (lg && tr)
      ? '[{"name":"화자","text":"메시지","tr":"한국어 번역"}]'
      : '[{"name":"화자","text":"메시지"}]'
  ];

  // 답장 개수를 매번 다르게 정한다. 짧게 한 통만 오는 쪽에 무게를 둔다
  const pickN = w => {
    const r = Math.random();
    let a = 0;
    for (const [n, p] of w) { a += p; if (r < a) return n; }
    return w[w.length - 1][0];
  };
  // 유저와 캐릭터가 주고받는 개인톡만 세 개까지. 네 개부터는 정신이 사납다
  const replyN = room => { const L = lenOf(room);
    return L === 'long' ? pickN([[1, .58], [2, .32], [3, .10]])
      : L === 'short' ? pickN([[1, .30], [2, .45], [3, .25]])
      : L === 'mid' ? pickN([[1, .36], [2, .38], [3, .26]])
      : pickN([[1, .32], [2, .40], [3, .28]]); };
  // 여러 명이 오가는 방은 손대지 않는다
  const watchN = room => { const L = lenOf(room);
    return L === 'long' ? pickN([[3, .35], [4, .40], [5, .25]])
      : L === 'short' ? pickN([[5, .20], [6, .28], [7, .28], [8, .24]])
      : pickN([[4, .22], [5, .26], [6, .26], [7, .16], [8, .10]]); };

  // 내 폰에서는 유저 대사를 절대 만들지 않는다
  const noUserRule = () => [
    '',
    `절대 규칙 — "${me()}"의 메시지는 쓰지 마라.`,
    `- "${me()}"를 화자(name)로 삼는 것을 금지한다.`,
    '- 유저가 할 법한 말을 대신 지어내지 마라. 상대방이 보내는 메시지만 만든다.',
    '- 유저의 대답을 기다리는 상태로 끝내라.'
  ];

  // 캐릭터 폰에 쌓인 기록 — 그 인물이 관련된 방에서만 쓴다
  function appBlock(room) {
    const isChar = room.phone === 'char' || (room.phone === 'mine' && room.isOwner);
    if (!isChar) return '';
    const main = room.owner || mainChar();
    const out = [];
    if (apps.shop.length) out.push('- 주문한 것: ' +
      apps.shop.slice(0, 8).map(x => x.name).join(', '));
    if (apps.music.length) out.push('- 요즘 듣는 곡: ' +
      apps.music.slice(0, 8).map(x => x.title + ' / ' + x.artist).join(', '));
    if (apps.search.length) out.push('- 검색한 것: ' +
      apps.search.slice(0, 8).map(x => x.q).join(', '));
    if (apps.pay.length) out.push('- 결제하고 있는 것: ' +
      apps.pay.slice(0, 8).map(x => x.name + (x.cycle ? ' (' + x.cycle + ')' : '')).join(', '));
    const tk = todayKey();
    const near = calSorted().filter(x => x.d >= tk).slice(0, 6);
    if (near.length) out.push('- 달력에 적힌 일: ' + near.map(x =>
      `${x.d} ${x.t} (${me()}의 일)` +
      (x.d === tk ? ' — 바로 오늘이다' : '')).join(', '));
    if (!out.length) return '';
    return `### ${main}의 휴대폰에 남아 있는 기록\n` + out.join('\n') + '\n' +
      `이것은 ${main} 본인의 기록이다. 대화에 자연스럽게 묻어나도 좋다.\n` +
      '상대가 이 기록을 두고 물어보거나 놀리면 그 인물답게 반응한다.\n' +
      '먼저 굳이 늘어놓지는 마라.\n';
  }

  function loreBlock() {
    const out = [];
    if (lore.char.trim()) out.push('### 캐릭터 설정', lore.char.trim());
    if (lore.user.trim()) out.push('### 유저 설정', lore.user.trim());
    return out.length ? out.join('\n') + '\n' : '';
  }

  // 참여자와 유저의 관계 · 캐릭터 저장명
  const relLine = room => room.rel
    ? `- 참여자와 유저의 관계는 이렇다: ${room.rel}\n` +
      '  참여자를 적은 순서와 짝지어 읽어라. 이 관계에 맞는 말투와 호칭을 쓴다.'
    : '';
  const charLine = room => (room.withChar && room.charLabel)
    ? `- "${mainChar()}"의 화자 이름은 반드시 "${room.charLabel}" 로 쓴다. 다른 이름을 쓰지 마라.\n` +
      `  "${room.charLabel}" 은 유저가 저장해 둔 이름일 뿐이다. 성격과 말투는 로그 그대로 유지한다.`
    : '';

  function systemPrompt(room) {
    const main = room.owner || mainChar();
    const lg = roomLang(room), tr = !!(lg && S.trans);
    const LG = langBlock(lg, tr).join('\n');
    const nameHint = room.type === 'group' && room.name && !/^새 (대화|단톡방)$/.test(room.name)
      ? `방 이름은 "${room.name}" 이다. 이 이름이 곧 이 방의 성격과 용도다. 이름에 맞는 대화만 오간다.`
      : '';
    if (room.phone === 'mine' && room.isOwner) {
      const label = room.ownerLabel || room.name;
      return [
        LG,
        `너는 아래 로그에 등장하는 "${room.owner}"를 연기해 메신저 대화를 쓴다.`,
        `이 방은 ${room.owner}와 유저가 주고받는 개인 채팅방이다.`,
        `유저는 "${me()}"라는 이름으로 이 방에 들어와 있다.`,
        '',
        `화자 이름은 반드시 이렇게 쓴다.`,
        `- ${room.owner}의 화자 이름은 "${label}" 로 쓴다. 다른 이름을 쓰지 마라.`,
        `  "${label}" 은 유저가 저장해 둔 이름일 뿐이다. 인물의 성격과 말투는 로그 그대로 유지한다.`,
        '',
        nameHint,
        `- 이번에는 메시지를 최대 ${replyN(room)}개까지 만든다. 그보다 많이 쓰지 마라.\n` +
        '  한 개면 한 개로 끝낸다. 억지로 늘리지 마라.',
        ...noUserRule(),
        '', ...rules(lenOf(room), lg, tr), ...callRule(room)
      ].filter(Boolean).join('\n');
    }

    if (room.phone === 'mine') {
      const others = Math.max(1, (Number(room.size) || 3) - 1);
      const mobN = Math.max(1, others - (room.withChar ? 1 : 0));
      const auto = room.type === 'group' ? [
        `무대는 유저가 들어가 있는 단체 채팅방이다. 유저 말고 ${others}명이 더 있다.`,
        room.withChar
          ? `- 그 ${others}명 중 한 명은 "${main}"다. ${main}는 반드시 이 방에 참여한다.\n` +
            `  나머지 ${mobN}명은 로그를 읽고 네가 직접 정한다.`
          : `- 참여자 ${others}명은 로그를 읽고 네가 직접 정한다. 한 번 정하면 계속 유지한다.\n` +
            `  "${main}"는 이 방에 없다. ${main}를 화자로 쓰지 마라.`,
        '- 어떤 성격의 방인지도 네가 정한다. 친구들 모임, 가족 단톡, 일 얘기, 동아리, 동네 이웃 등',
        '  로그에서 유저의 처지와 관계가 읽히는 대로 고르면 된다. 예시에 매이지 마라.',
        '- 이 방이 어떤 모임인지 먼저 스스로 정하고, 첫 메시지부터 그 성격에 맞게 써라.'
      ].join('\n') : [
        '무대는 유저와 다른 한 사람이 주고받는 개인 채팅방이다.',
        '- 상대는 로그를 읽고 네가 직접 정한다. 한 번 정하면 계속 유지한다.',
        `- 상대로 "${main}"를 고르지 마라. ${main}와의 방은 따로 있다.`,
        `  ${main} 말고, 로그에서 읽히는 유저 주변 인물 중에서 골라라.`,
        '  친구, 가족, 동료, 선후배 등 유저의 삶에 실제로 있을 법한 사람이면 된다.'
      ].join('\n');
      const stage = room.type === 'group'
        ? (room.cast.length
          ? `무대는 "${room.name}" 단체 채팅방이다. 참여자는 ${room.cast.join(', ')}.`
          : auto)
        : (room.cast.length
          ? `무대는 ${room.cast[0]}과의 개인 채팅방이다.`
          : auto);
      return [
        LG,
        '너는 아래 로그에 등장하는 인물들의 메신저 대화를 이어 쓰는 작가다.',
        stage, nameHint, relLine(room), charLine(room),
        `유저는 "${me()}"라는 이름으로 이 방에 들어와 있다.`,
        room.type === 'group' ? '- 참여자 중 여러 명이 번갈아 말하게 한다.' : '',
        room.type === 'group'
          ? `- 이번에는 메시지를 최대 ${watchN(room)}개까지 만든다.`
          : `- 이번에는 메시지를 최대 ${replyN(room)}개까지 만든다. 그보다 많이 쓰지 마라.\n` +
            '  한 개면 한 개로 끝낸다. 억지로 늘리지 마라.',
        ...noUserRule(),
        '', ...rules(lenOf(room), lg, tr), ...callRule(room)
      ].filter(Boolean).join('\n');
    }

    if (room.phone === 'char') {
      const others = Math.max(1, (Number(room.size) || 3) - 1);
      const n2 = Math.max(1, others - (room.withUser ? 1 : 0));
      const who = room.cast.length ? room.cast.join(', ')
        : (room.type !== 'group' && room.withUser ? me()
          : (room.withUser ? `${me()}와 ${main}의 주변 인물 ${n2}명 (네가 정한다)`
            : `${main}의 주변 인물 ${n2}명 (네가 정한다)`));
      return [
        LG,
        `너는 "${main}"의 휴대폰에 들어 있는 메신저 대화를 지어내는 작가다.`,
        `지금 열려 있는 방은 "${room.name}" 이고, 참여자는 ${main}, ${who} 이다.`,
        `${main}는 반드시 이 방에 참여한다.`,
        `- "${main}"의 화자 이름(name)은 반드시 "${main}" 로 적는다.`,
        '  다른 표기로 바꾸거나 다른 나라 말로 옮기지 마라.',
        '  대사 안에서 서로를 부르는 말은 그 나라 말이어도 된다.',
        nameHint, relLine(room),
        room.cast.length ? '' : [
          `- 참여자 ${n2}명은 로그를 보고 네가 직접 정한다. 한 번 정하면 계속 유지한다.`,
          `  ${main}의 처지, 직업, 건강 상태, 숨기는 것, 돈 문제, 가족 관계까지 폭넓게 읽어라.`,
          '  부하나 동료만 떠올리지 말고, 그 인물의 삶에 실제로 필요한 사람을 골라라.',
          '  주치의, 상담사, 변호사, 뒷일 처리하는 사람, 채권자, 옛 연인, 가족,',
          '  약을 대주는 사람, 뒷조사를 맡긴 흥신소 등 무엇이든 좋다.',
          '  로그에서 그 인물의 문제가 읽힌다면, 그 문제를 아는 사람이 방에 있어야 자연스럽다.'
        ].join('\n'),
        room.withUser
          ? `이 방에는 유저도 참여한다. 유저의 메시지도 함께 쓴다.\n` +
            `유저의 화자 이름은 반드시 "${room.userLabel || me()}" 로 쓴다.\n` +
            `"나", "저", "유저", "user", "사용자" 를 화자 이름(name)으로 쓰는 것을 절대 금지한다.\n` +
            `유저가 말할 차례라면 name 칸에 "${room.userLabel || me()}" 만 적어라.`
          : `"${me()}"는 이 방에 없다. ${me()}를 화자로 쓰지 마라. 다만 화제에 오르는 것은 자연스럽다.`,
        `${main}가 ${me()} 앞에서는 안 보이던 면이 드러나도 좋다.`,
        `- 이번에는 메시지를 최대 ${watchN(room)}개까지 만든다.`, '', ...rules(lenOf(room), lg, tr), ...callRule(room)
      ].filter(Boolean).join('\n');
    }

    // 모브 대화
    const n = Math.max(2, Number(room.size) || 3);
    return [
      LG,
      '너는 주변 인물들끼리 주고받은 메신저 대화를 지어내는 작가다.',
      nameHint, relLine(room),
      `이 방에는 "${main}"도 "${me()}"도 참여하지 않는다. 둘 다 화자로 쓰지 마라.`,
      room.cast.length
        ? `참여자는 ${room.cast.join(', ')} 이다. 이들만 화자로 쓴다.` +
          (room.type === 'dm' && room.cast.length >= 2
            ? ` 두 사람이 번갈아 주고받는 대화다. 한쪽만 말하게 두지 마라.`
            : '')
        : `부하, 동료, 주치의, 가족 같은 인물 ${n}명이 자기들끼리 이야기한다.`,
      `${main}와 ${me()}가 화제에 오르는 것은 자연스럽다.`,
      '- 한 번 정한 참여자는 이후에도 유지한다.',
      `- 이번에는 메시지를 최대 ${watchN(room)}개까지 만든다.`, '', ...rules(lenOf(room), lg, tr), ...callRule(room)
    ].filter(Boolean).join('\n');
  }

  // 얼마나 벌어졌는지 사람이 읽는 말로 적는다. 100일보다 "약 3개월"이 낫다
  function gapLabel(from, to) {
    const days = Math.round((dayStart(to) - dayStart(from)) / 86400e3);
    if (days >= 365) return '약 ' + Math.floor(days / 365) + '년';
    if (days >= 27) return '약 ' + Math.max(1, Math.round(days / 30)) + '개월';
    if (days >= 7) return '약 ' + Math.round(days / 7) + '주';
    if (days >= 2) return days + '일';
    if (days === 1) return '하루';
    return Math.max(1, Math.round((to - from) / 3600e3)) + '시간';
  }

  async function generate(room, mine, images) {
    const ctx = logText();
    if (!ctx) throw new Error('원본 대화를 읽지 못했습니다. 설정에서 말풍선을 지정해 보세요');
    const p = [];
    const lb = loreBlock();
    if (lb) p.push(lb);
    const ab = appBlock(room);
    if (ab) p.push(ab);
    p.push('### 원본 대화 로그', ctx);
    p.push('', '### 지금 시각', fmtStamp(nextTime(room, true)),
      '이 시각에 맞는 인사와 행동을 해라. 새벽이면 새벽답게, 낮이면 낮답게.');
    if (room.feed.length) {
      // 화면에는 손대지 않는다. 보내는 기록에만 날이 바뀐 자리를 표시한다
      const fd = room.feed.slice(-30);
      const lines = [];
      fd.forEach((m, i) => {
        const prev = fd[i - 1];
        if (prev && fmtDay(prev.ts) !== fmtDay(m.ts)) {
          lines.push(`── 여기서 ${gapLabel(prev.ts, m.ts)}이 지났다 ──`);
        }
        lines.push(m.name + ': ' + (m.text || '(사진)'));
      });
      p.push('', '### 이 방에서 지금까지 오간 대화', lines.join('\n'));
    }
    // 마지막 메시지 이후로 시간이 얼마나 벌어졌는지 스스로 살핀다
    let gapNote = null;
    if (room.feed.length) {
      const last = room.feed[room.feed.length - 1];
      const at = nextTime(room, true);
      const h = Math.round((at - last.ts) / 3600e3);
      const days = Math.round((dayStart(at) - dayStart(last.ts)) / 86400e3);
      if (h >= 2 || days >= 1) {
        gapNote = ['', `### 마지막 대화 이후로 ${gapLabel(last.ts, at)}이 지났다`,
          '그동안 서로 연락이 없었다.',
          '- 오랜만에 말을 거는 사람처럼 굴어라.',
          '  방금까지 얘기하던 것처럼 이어 말하지 마라.',
          '- 그때 있던 자리에 그대로 있지 않다.',
          '  문 앞에 서 있었다면 이미 들어갔거나 돌아갔고,',
          '  기다리고 있었다면 그 기다림은 끝났다.',
          '  가고 있었다면 도착했다. 하던 일은 끝났다.',
          '- 그 사이에 무슨 일이 있었는지는 네가 정해서 자연스럽게 흘려라.',
          '- 그때 하던 일이 아직 그대로일 거라고 넘겨짚지 마라.',
          '  출장이든 외출이든 그 사이에 끝났다고 보는 것이 자연스럽다.',
          `- 지금은 ${fmtStamp(at)} 이다. 시간대와 계절에 맞게 말해라.`];
      }
    }
    if (mine) p.push('', `### 방금 ${me()}가 보낸 메시지`, mine);
    // 경과 안내는 유저 메시지 뒤에 둔다. 마지막에 읽은 지시가 더 세게 걸린다
    if (gapNote) p.push(...gapNote);
    if (images && images.length) {
      p.push('', `### ${me()}가 사진을 ${images.length}장 보냈다`,
        S.sendImage ? '첨부된 이미지를 보고 반응해라.' : '사진 내용은 알 수 없으니 자연스럽게 반응해라.');
    }
    if (room.phone === 'mine') {
      p.push('', `${me()}의 메시지는 만들지 마라. 상대방의 답만 써라.`);
    }
    p.push('', room.feed.length ? '이어서 생성해줘.' : '이 방의 대화를 처음부터 생성해줘.');

    const arr = parseJSON(await callLLM(systemPrompt(room), p.join('\n'), images));
    let out = arr.filter(x => x && x.text)
      .map(x => {
        const o = { name: String(x.name || room.name), text: String(x.text) };
        const t = x.tr || x.trans || x.ko;
        if (t) o.tr = String(t).trim();
        return o;
      });
    // 개인톡에서 네 통 넘게 오면 뒤엣것을 앞에 이어 붙인다. 말이 잘리지 않게
    if (room.phone === 'mine' && room.type !== 'group' && out.length > 3) {
      const head = out.slice(0, 3);
      const tail = out.slice(3);
      tail.forEach(m => {
        const at = head.map(h => h.name).lastIndexOf(m.name);
        const to = at >= 0 ? head[at] : head[head.length - 1];
        to.text = to.text.trim() + ' ' + m.text.trim();
        if (m.tr) to.tr = ((to.tr || '') + ' ' + m.tr).trim();
      });
      out = head;
    }
    // 내 폰에서는 AI가 만든 유저 대사를 걸러낸다
    if (room.phone === 'mine') {
      const u = me();
      out = out.filter(m => m.name && m.name !== u && m.name !== '나' &&
        (!S.persona || m.name !== S.persona));
    }
    return out;
  }

  // 단톡방 이름을 대화 내용에 맞게 짓는다
  // 개인톡 저장명 — 상대를 그 나라 말로 뭐라고 저장해 둘지 정한다
  async function nameDm(room, who2) {
    const lg = roomLang(room);
    if (!lg) return '';
    const sys = [
      `아래는 어떤 사람과 나눈 개인 메신저 대화다.`,
      `이 사람을 휴대폰 연락처에 뭐라고 저장해 둘지 이름 하나만 지어라.`,
      '',
      `- 지금 임시로 "${who2}"라고 적혀 있다. 같은 사람을 가리키되,`,
      `  ${LANG_NAME[lg]}를 쓰는 사람이 실제로 저장해 둘 법한 표기로 바꾼다.`,
      '- 대화에서 서로를 부르는 말을 보고 정해라.',
      '  성만 부르면 성으로, 이름으로 부르면 이름으로, 직함이 붙으면 직함까지.',
      '- 사람 이름이 아니라 별명이나 관계로 저장할 수도 있다.',
      '- 12자 이내. 따옴표, 설명, 코드펜스 없이 이름 한 줄만 출력한다.',
      `- 반드시 ${LANG_NAME[lg]}로 적는다. 한국어로 적으면 잘못된 답이다.`
    ].join('\n');
    const body = '### 대화\n' +
      room.feed.slice(0, 20).map(m => m.name + ': ' + (m.text || '(사진)')).join('\n');
    const raw = await callLLM(sys, body);
    const line = String(raw || '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
    return line.replace(/^["'`\s]+|["'`\s]+$/g, '').slice(0, 16);
  }

  async function nameRoom(room) {
    const names = [...new Set(room.feed.map(m => m.name))].filter(Boolean);
    if (!names.length) return '';
    const sys = [
      '아래는 어떤 메신저 단체 채팅방에서 오간 대화다.',
      '이 방에 붙어 있을 법한 방 이름을 하나만 지어라.',
      '',
      '- 실제 사람들이 자기 단톡방에 붙이는 이름처럼 지어야 한다.',
      '- 참여자 이름을 그냥 쉼표로 나열하는 것은 금지한다.',
      '- 모임의 목적, 사건, 날짜, 소속, 장소가 드러나면 좋다.',
      '  예를 들어 일정 조율 방이면 날짜와 일 이름이 들어가고,',
      '  가족 방이면 가족을 가리키는 말이 들어가는 식이다.',
      '- 12자 이내로 짧게 쓴다.',
      '- 따옴표, 설명, 코드펜스 없이 이름 한 줄만 출력한다.',
      ...langBlock(roomLang(room), false),
      ...(roomLang(room) ? [
        '',
        '- 방 이름은 위에 적힌 그 나라 말로 짓는다.',
        '  화자 이름을 그대로 두라는 예외는 방 이름에는 적용되지 않는다.',
        '  한국어로 방 이름을 지으면 잘못된 답이다.'
      ] : [])
    ].join('\n');
    const body = '### 참여자\n' + names.join(', ') + '\n\n### 대화\n' +
      room.feed.slice(0, 24).map(m => m.name + ': ' + (m.text || '(사진)')).join('\n');
    const raw = await callLLM(sys, body);
    const line = String(raw || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
    return line.replace(/^["'`\s]+|["'`\s]+$/g, '').replace(/^방\s*이름\s*[:：]\s*/, '').slice(0, 24);
  }

  const str = (o, keys) => {
    if (typeof o === 'string') return o;
    for (const k of keys) {
      if (o && o[k] != null && String(o[k]).trim()) return String(o[k]).trim();
    }
    return '';
  };

  // 결제 이름을 다듬는다. 가운뎃점을 빼고, 앞말이 겹치면 앞을 지운다
  function tidyPay(v) {
    let t = String(v || '')
      .replace(/\s*[·∙‧・•|/]\s*/g, ' ')
      .replace(/\s+/g, ' ').trim();
    const m = t.match(/^(\S+)\s+(.+)$/);
    // "유튜브 유튜브 프리미엄" → "유튜브 프리미엄"
    if (m && m[2].indexOf(m[1]) >= 0) t = m[2];
    return t;
  }

  const LOCAL_RULE = who => [
    '',
    `- 먼저 ${who}가 어느 나라, 어느 문화권에 사는 사람인지 로그에서 판단해라.`,
    '  그 다음 그곳 사람이 실제로 쓰는 서비스와 물건만 등장시킨다.',
    '- 한국을 기본값으로 삼지 마라.',
    `  ${who}가 한국에 살거나 한국과 연이 있을 때만 한국 것을 쓴다.`,
    '  그렇지 않다면 한국 쇼핑몰, 한국 가수, 한국 서비스를 넣지 마라.',
    '- 글은 한국어로 적되, 내용은 그 인물의 생활권에 맞춘다.',
    '- 돈은 그 나라에서 실제로 쓰는 화폐로 적는다.',
    '  한국이면 원, 몽골이면 투그릭, 일본이면 엔 하는 식이다.'
  ];

  const APP_SPEC = {
    shop: {
      title: '주문내역', get n() { return Number(S.nShop) || 6; },
      sys: who => [
        `너는 "${who}"의 쇼핑앱 주문 내역을 짓는다.`,
        '',
        `- 주문 ${S.nShop || 6}건을 만든다. 최근 것이 먼저 오게 한다.`,
        `- 로그에서 읽히는 ${who}의 처지, 직업, 사는 곳, 취향, 몸 상태,`,
        '  돈 사정, 숨기는 것을 그대로 반영한다.',
        '- 로그에 근거가 없는 성향을 지어내지 마라.',
        '  로그에서 읽히는 생활 그대로면 된다.',
        '  그 인물의 삶에 실제로 필요한 물건이면 무엇이든 좋다.',
        '- 상품명은 실제 쇼핑앱처럼 판매자가 붙인 이름으로 쓰되 30자를 넘기지 마라.',
        '  물건 이름만 담백하게 적고 설명이나 묘사를 붙이지 마라.',
        '- 날짜는 "8월 27일" 같은 형식으로 쓴다.',
        '  다른 언어로 쓸 때는 그 나라 방식으로 적는다.',
        '- 배송 상태는 배송완료, 배송중, 결제완료 중에서 고른다.',
        '  취소나 반품은 넣지 마라.',
        '- ord 칸에는 "주문"에 해당하는 그 나라 말을 한 단어로 적는다.',
        '  한국어면 "주문", 일본어면 "注文", 영어면 "Ordered", 중국어면 "下单".',
        ...LOCAL_RULE(who),
        '',
        '출력은 이 JSON 배열 하나만. 설명이나 코드펜스 금지.',
        (appLang() && S.trans)
          ? '[{"name":"상품명","tr":"상품명 한국어","seller":"판매처","trSeller":"판매처 한국어",' +
            '"price":"12,900원","date":"8월 27일","status":"배송완료","ord":"주문"}]'
          : '[{"name":"상품명","seller":"판매처","price":"12,900원","date":"8월 27일","status":"배송완료","ord":"주문"}]'
      ].join('\n'),
      map: x => ({
        tr: str(x, ['tr', 'trans', 'ko']),
        trSeller: str(x, ['trSeller', 'sellerTr', '판매처번역']),
        ord: str(x, ['ord', 'orderWord', '주문말']) || '주문',
        name: str(x, ['name', 'title', 'product', 'item', 'productName', '상품명']),
        seller: str(x, ['seller', 'store', 'shop', 'brand', 'mall', '판매처']),
        price: str(x, ['price', 'amount', 'cost', '가격']),
        date: str(x, ['date', 'when', 'orderedAt', 'orderDate', '주문일']),
        status: str(x, ['status', 'state', 'delivery', '상태'])
      })
    },
    music: {
      title: '음악', get n() { return Number(S.nMusic) || 6; },
      sys: who => [
        `너는 "${who}"가 최근에 들은 곡 목록을 짓는다.`,
        '',
        `- ${S.nMusic || 6}곡을 만든다. 최근에 들은 것이 먼저 오게 한다.`,
        `- 로그에서 읽히는 ${who}의 나이, 처지, 감정 상태, 사는 곳에 맞는 곡을 고른다.`,
        '- 실제로 있는 곡으로 채운다. 없는 곡을 지어내지 마라.',
        '- 한 사람의 재생목록답게 결이 이어지되, 한두 곡은 뜬금없어도 좋다.',
        '- 들은 때는 "어제 밤", "오늘 새벽", "3일 전" 같이 쓴다.',
        ...LOCAL_RULE(who),
        '',
        '출력은 이 JSON 배열 하나만. 설명이나 코드펜스 금지.',
        '[{"title":"곡 제목","artist":"가수","when":"어제 밤"}]'
      ].join('\n'),
      map: x => ({
        title: str(x, ['title', 'name', 'song', 'track', '제목']),
        artist: str(x, ['artist', 'singer', 'by', 'band', '가수']),
        when: str(x, ['when', 'time', 'playedAt', 'date', '시각'])
      })
    },
    pay: {
      title: '결제내역', get n() { return Number(S.nPay) || 6; },
      sys: who => [
        `너는 "${who}"의 결제 내역을 짓는다.`,
        '정기구독, 멤버십, 단건 결제가 뒤섞인 목록이다.',
        '',
        `- ${S.nPay || 6}건을 만든다. 가장 최근에 결제한 것이 맨 위로 오게 한다.`,
        '  아래로 갈수록 오래된 결제다.',
        '',
        '### 무엇을 넣을까',
        `- ${who}의 성격, 직업, 생활 습관, 돈 쓰는 방식, 혼자 있을 때의 모습을 로그에서 읽어라.`,
        '  그 사람이 실제로 자기 카드로 결제해 뒀을 것만 넣는다.',
        '- 실제로 있는 서비스 이름을 쓴다. 없는 서비스를 지어내지 마라.',
        '- 한 종류로 몰리면 안 된다. 아래가 골고루 섞여야 한다.',
        '',
        '  1) 영상·음악 구독 — 넷플릭스, 디즈니플러스, 티빙, 웨이브, 왓챠,',
        '     유튜브 프리미엄, 스포티파이, 애플뮤직, 멜론, 지니 같은 것',
        '  2) 읽는 것 — 리디, 밀리의서재, 카카오페이지, 네이버시리즈, 레진 같은 것',
        '  3) 생활 멤버십 — 쿠팡 와우, 네이버플러스, 배민클럽, 컬리멤버스 같은 것',
        '  4) 일이나 공부에 드는 것 — 클라우드, 편집 프로그램, 학원, 강의, 헬스장',
        '  5) 남에게 말 안 할 것 — 데이팅앱, 게임 결제, 운세앱, 익명 서비스 등',
        '     로그에서 근거가 읽힐 때만 넣는다',
        '  6) 단건 결제 — 병원비, 택시, 배달, 주유, 옷, 선물, 약값, 큰 물건 하나',
        '',
        '### 무엇을 샀는지까지 적는다',
        '- 콘텐츠 서비스는 서비스 이름만 적지 말고, 그 안에서 무엇을 샀는지 함께 적어라.',
        '  가운뎃점이나 구분 기호 없이 한 줄로 자연스럽게 이어 쓴다.',
        '  예를 들어 리디에서 소설을 샀다면 그 소설 제목을,',
        '  웹툰에 돈을 썼다면 그 웹툰 제목을 적는 식이다.',
        `  제목은 ${who}가 볼 법한 것으로 네가 지어라. 실제 작품이 아니어도 된다.`,
        '- 구독이나 멤버십은 등급까지 적으면 좋다. "넷플릭스 프리미엄" 하는 식이다.',
        '- 같은 말을 두 번 쓰지 마라.',
        '  "유튜브 유튜브 프리미엄"이 아니라 "유튜브 프리미엄" 이라고 적는다.',
        '  "네이버 네이버플러스 멤버십"이 아니라 "네이버플러스 멤버십" 이라고 적는다.',
        '  서비스 이름이 이미 상품 이름 안에 들어 있으면 앞에 또 붙이지 마라.',
        '- 단건 결제는 무엇을 샀는지가 드러나게 적는다.',
        '- 다만 설명이나 묘사를 붙이지는 마라. 이름만 담백하게.',
        '',
        '### 그 사람이 드러나야 한다',
        '- 게을러서 해지 못 한 것, 남에게 말 안 하는 것, 남 좋으라고 낸 것,',
        '  일 때문에 어쩔 수 없는 것, 옛날에 걸어두고 잊은 것이 섞여야 사람 같다.',
        '- 큰돈이 한 번 나간 것과 사소한 것이 함께 있어야 한다.',
        '- 로그에 근거가 없는 성향은 넣지 마라. 근거가 있으면 무엇이든 넣어도 된다.',
        '',
        '- 주기는 매월, 매년, 매주, 단건 중에서 고른다. 단건도 반드시 섞어라.',
        '- 날짜는 결제한 날을 "9월 3일" 형식으로 적는다.',
        '  정기결제라면 마지막으로 결제된 날을 적는다.',
        '  다른 언어로 쓸 때는 그 나라 방식으로 적는다.',
        '- ord 칸에는 "결제"에 해당하는 그 나라 말을 한 단어로 적는다.',
        '  한국어면 "결제", 일본어면 "決済", 영어면 "Paid", 중국어면 "支付".',
        '- 금액은 그 서비스의 실제 가격대에 맞춘다.',
        ...LOCAL_RULE(who),
        '',
        '출력은 이 JSON 배열 하나만. 설명이나 코드펜스 금지.',
        (appLang() && S.trans)
          ? '[{"name":"결제한 것","tr":"한국어 번역","price":"9,900원","cycle":"매월","next":"9월 3일","ord":"결제"}]'
          : '[{"name":"결제한 것","price":"9,900원","cycle":"매월","next":"9월 3일","ord":"결제"}]'
      ].join('\n'),
      map: x => ({
        tr: str(x, ['tr', 'trans', 'ko']),
        ord: str(x, ['ord', 'payWord', '결제말']) || '결제',
        name: tidyPay(str(x, ['name', 'title', 'service', 'item', '서비스명'])),
        price: str(x, ['price', 'amount', 'cost', '금액']),
        cycle: str(x, ['cycle', 'period', 'interval', 'billing', '주기']),
        next: str(x, ['next', 'nextDate', 'date', 'when', '결제일'])
      })
    },
    search: {
      title: '검색 기록', get n() { return Number(S.nSearch) || 5; },
      sys: who => [
        `너는 "${who}"의 인터넷 검색 기록을 짓는다.`,
        '',
        `- 검색어 ${S.nSearch || 5}개를 만든다. 최근 것이 먼저 오게 한다.`,
        `- 로그에서 읽히는 ${who}의 고민과 처지가 드러나게 한다.`,
        '  사람은 남에게 묻지 못하는 것을 검색창에 친다.',
        '- 실제 사람이 치듯 짧고 거칠게 쓴다. 문장으로 다듬지 마라.',
        '- 로그에 근거가 없는 성향을 지어내지 마라.',
        '- 검색한 때는 "오늘 새벽", "어제", "그저께" 같이 쓴다.',
        ...LOCAL_RULE(who),
        '',
        '출력은 이 JSON 배열 하나만. 설명이나 코드펜스 금지.',
        (appLang() && S.trans)
          ? '[{"q":"검색어","tr":"한국어 번역","when":"오늘 새벽"}]'
          : '[{"q":"검색어","when":"오늘 새벽"}]'
      ].join('\n'),
      map: x => ({
        tr: str(x, ['tr', 'trans', 'ko']),
        q: str(x, ['q', 'query', 'keyword', 'term', 'text', 'search', '검색어']),
        when: str(x, ['when', 'time', 'date', 'searchedAt', '시각'])
      })
    }
  };

  // "11월 14일" 같은 표기에서 월·일을 뽑는다
  function dateKey(v) {
    const m = String(v || '').match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (!m) return null;
    return Number(m[1]) * 100 + Number(m[2]);
  }
  // 연말과 연초가 섞이면 큰 달이 오래된 것이므로, 흐름을 보고 이어 붙인다
  function sortByDate(rows, pick) {
    const keyed = rows.map((x, i) => ({ x, i, k: dateKey(pick(x)) }));
    if (keyed.some(o => o.k == null)) return rows;
    // 12월과 1월이 함께 있으면 1~6월을 다음 해로 본다
    const hasLate = keyed.some(o => o.k >= 1000);
    const hasEarly = keyed.some(o => o.k < 700);
    const adj = o => (hasLate && hasEarly && o.k < 700) ? o.k + 1300 : o.k;
    return keyed.sort((a, b) => adj(b) - adj(a) || a.i - b.i).map(o => o.x);
  }

  // 검색·음악은 "오늘 새벽", "어제" 같은 말이라 가까운 순으로 세운다
  const WHEN_ORDER = [
    [/방금|조금 전/, 0], [/오늘 새벽/, 1], [/오늘 아침/, 2], [/오늘 낮/, 3],
    [/오늘 저녁|오늘 밤/, 4], [/오늘/, 5],
    [/어제 새벽/, 6], [/어제 아침/, 7], [/어제 밤|어젯밤/, 8], [/어제/, 9],
    [/그저께|그제/, 10], [/3일 전/, 11], [/4일 전/, 12], [/5일 전/, 13],
    [/일주일|1주일|한 주/, 14], [/2주/, 15], [/한 달|1개월/, 16]
  ];
  function whenKey(v) {
    const t = String(v || '');
    for (const [rx, n] of WHEN_ORDER) if (rx.test(t)) return n;
    const d = t.match(/(\d+)\s*일\s*전/);
    if (d) return 10 + Number(d[1]);
    return 99;
  }
  const sortByWhen = (rows, pick) =>
    rows.map((x, i) => ({ x, i })).sort((a, b) =>
      whenKey(pick(a.x)) - whenKey(pick(b.x)) || a.i - b.i).map(o => o.x);

  async function makeApp(kind) {
    const spec = APP_SPEC[kind];
    const who = mainChar();
    const ctx = logText();
    if (!ctx) throw new Error('원본 대화를 읽지 못했습니다');
    let have = '';
    if (apps[kind].length) {
      have = '\n\n### 이미 있는 기록 (겹치지 않게 새로 만들어라)\n' +
        apps[kind].map(x => x.name || x.title || x.q).join(', ');
      const dates = apps[kind]
        .map(x => x.date || x.next || '').filter(v => dateKey(v));
      if (dates.length) {
        const newest = dates.reduce((a, b) => dateKey(a) >= dateKey(b) ? a : b);
        have += `\n\n이 목록에서 가장 최근 날짜는 ${newest} 이다.\n` +
          `새로 만드는 것은 모두 ${newest} 보다 뒤의 날짜로 적어라.`;
      }
    }
    const body = loreBlock() + '### 원본 대화 로그\n' + ctx + have;
    const sysText = langBlockApp(appLang()).join('\n') + '\n' +
      spec.sys(who) + trLine(kind);

    let made = [], err = null;
    // 번역까지 받으면 글이 두 배가 된다. 넉넉히 잡아 잘리지 않게 한다
    tokenBoost = (appLang() && S.trans) ? 6500 : 3000;
    try {
      for (let tryN = 0; tryN < 2 && !made.length; tryN++) {
        try {
          const arr = parseJSON(await callLLM(sysText, body), spec.title);
          made = arr.filter(Boolean).slice(0, spec.n).map(spec.map)
            .filter(x => x.name || x.title || x.q);
        } catch (e) { err = e; }
      }
    } finally { tokenBoost = 0; }
    // 요청한 개수에 한참 못 미치면 한 번 더 불러 채운다
    if (made.length && made.length < spec.n - 1) {
      tokenBoost = (appLang() && S.trans) ? 6500 : 3000;
      try {
        const more = parseJSON(await callLLM(sysText,
          body + '\n\n### 방금 만든 것\n' +
          made.map(x => x.name || x.title || x.q).join(', ') +
          `\n이것 말고 ${spec.n - made.length}건을 더 만들어라.`), spec.title);
        made = made.concat(more.filter(Boolean).map(spec.map)
          .filter(x => x.name || x.title || x.q)).slice(0, spec.n);
      } catch (e) {}
      tokenBoost = 0;
    }
    if (!made.length) throw err || new Error('기록을 만들지 못했습니다');
    let all = made.concat(apps[kind]).slice(0, 40);
    if (kind === 'shop') all = sortByDate(all, x => x.date);
    else if (kind === 'pay') all = sortByDate(all, x => x.next);
    else all = sortByWhen(all, x => x.when);
    apps[kind] = all;
    saveA();
    return made.length;
  }

  // 캐릭터가 유저를 부르는 말과, 연락처에 저장해 뒀을 이름
  async function suggestLabel() {
    const src = extract();
    if (!src.length) throw new Error('원본 대화를 읽지 못했습니다');
    const main = mainChar(), u = me();
    const ctx = src.slice(-S.turns)
      .map(t => (t.who === 'user' ? (t.name || '상대') : (t.name || main)) + ': ' + t.text)
      .join('\n');

    const sys = [
      `"${main}"가 상대를 어떻게 부르는지, 그리고 자기 휴대폰 연락처에`,
      '어떤 이름으로 저장해 두었을지 알아내라.',
      '',
      '아래 여섯 줄을 순서대로 써라. 반드시 이 형식이어야 한다.',
      '',
      '관계: (둘이 어떤 사이인지 한 문장)',
      '마음: (데면데면 / 편안함 / 마음 있음 / 좋아함 / 깊이 빠짐 중 하나)',
      '표현: (감정을 겉으로 드러내는 인물인가, 안으로 감추는 인물인가)',
      '이모지: (이름 뒤에 이모지나 기호를 붙일 사람인가. 붙인다면 어떤 결인지. 아니면 "안 씀")',
      '호칭: (대화에서 실제로 부르는 말. 조사가 붙은 형태 그대로)',
      '저장명: (연락처에 저장했을 이름 하나. 조사 없이)',
      '',
      '── 관계가 모든 것의 뼈대다',
      '',
      '먼저 둘이 어떤 사이인지 정해라. 거기서 호칭과 저장명이 따라 나온다.',
      '연인, 부부, 짝사랑, 소꿉친구, 주종, 상하관계, 사제, 가족, 친척,',
      '동료, 거래 상대, 앙숙, 계약 관계 등 로그에서 읽히는 그대로 잡아라.',
      '',
      '- 연인이나 부부라면 이름, 애칭, 서로만 아는 말이 나온다.',
      '- 주종이라면 도련님, 아가씨, 주인님이 나오고 반대쪽은 이름이나 직분이 나온다.',
      '- 사제라면 선생님, 교수님이 나오고 반대쪽은 학생 이름이 나온다.',
      '- 일로 엮였다면 직함이나 성을 붙인 이름이 나온다.',
      '- 가족이라면 누나, 형, 오빠, 언니, 동생 같은 말이 나온다.',
      '- 친구라면 이름이나 별명이 나온다.',
      '이건 예시일 뿐이다. 관계가 다르면 다른 말이 나와야 한다.',
      '',
      '── 마음과 표현을 판단하는 법',
      '',
      '- 부르는 말의 온도, 존댓말과 반말, 상대 말에 반응하는 정도',
      '- 챙기는지 무심한지, 가까이 두는지 거리를 두는지',
      '- 다른 사람 얘기가 나올 때의 반응',
      '- 감정을 말로 내뱉는 인물인지, 삼키는 인물인지',
      '',
      '── 호칭을 찾는 순서',
      '',
      `1단계 — ${main}가 직접 하는 말 안에서 상대를 부르는 말을 찾는다.`,
      '  별표(*) 밖 대사에서 찾는다. 거기 있으면 그대로 쓴다.',
      '2단계 — 대사에 없다면 별표(*) 안 지문에서 단서를 찾아 유추한다.',
      '3단계 — 그래도 없다면 관계를 보고 어울리는 호칭을 정한다.',
      '호칭은 조사가 붙은 형태 그대로 쓴다. "지원아", "누나", "아가씨" 처럼.',
      '',
      '── 저장명 — 호칭과 다르다',
      '',
      '저장명은 연락처에 적어 넣는 이름이다. 부를 때 쓰는 말이 아니다.',
      '- 호칭에서 조사를 뗀다. "지원아"라고 부르면 저장명은 "지원" 또는 "지원이"다.',
      '- 부름말을 그대로 저장명으로 쓰지 마라.',
      '',
      '관계와 마음이 저장명을 정한다.',
      '- 겉으로 드러내는 인물이고 마음이 깊다면 애칭이 그대로 저장명이 된다.',
      '  이때는 수식어나 이모지가 붙는 것이 오히려 자연스럽다.',
      '- 안으로 감추는 인물이라면 마음이 깊어도 담백하게 적는다.',
      '  그 담백함이 그 인물다운 것이다.',
      '- 데면데면하면 성을 붙인 본명이나 직함으로 적는다.',
      '- 로그에 별명이 있으면 그 별명을 그대로 저장명으로 쓴다.',
      '',
      '── 이모지',
      '',
      '- 위에서 "안 씀"이라고 판단했으면 절대 붙이지 마라.',
      '- 붙인다면 그 인물의 결에 맞는 것으로 하나만 붙인다.',
      '- 하트만 떠올리지 마라.',
      '  동물, 음식, 별, 달, 자물쇠, 검은 하트, 옛날식 표정 등 무엇이든',
      '  그 인물이 쓸 법하면 된다.',
      '- 무뚝뚝하거나 격식 차리는 인물에게는 아무것도 붙이지 않는다.',
      '',
      '── 폭을 보여주는 예시',
      '',
      '유지원 / 지원 / 지원이 / 지원이❤️ / 지원🐶 / 우리 지원이 /',
      '누나 / 누나😡 / 사랑하는 누나 / 선생님 / 김 선생 /',
      '아가씨 / 도련님 / 주인님 / 박 대리 / 사장님 / 뚱이 / 야옹이^^',
      '',
      '이건 결의 폭을 보여주는 것일 뿐이다. 그대로 베끼지 마라.',
      `${main}라는 인물이 자기 폰에 직접 적어 넣는다면 무엇이라고 쓸지만 생각해라.`,
      '',
      '── 금지',
      '',
      '- 남이 봐도 어색한 이름',
      '- 로그에 근거가 없는 친밀함이나 거리감',
      '- 조사가 붙은 부름말을 저장명으로 쓰는 것',
      '',
      '설명이나 코드펜스 없이 여섯 줄만 출력한다.',
      ...(appLang() ? [
        '',
        `단, 호칭과 저장명은 ${LANG_NAME[appLang()]}로 적는다.`,
        '나머지 네 줄은 한국어로 적는다.'
      ] : [])
    ].join('\n');

    const raw = await callLLM(sys, loreBlock() + '### 원본 대화 로그\n' + ctx);
    const lines = String(raw || '').split('\n').map(x => x.trim()).filter(Boolean);
    const grab = key => {
      const rx = new RegExp('^' + key + '\\s*[:：]');
      const hit = lines.slice().reverse().find(x => rx.test(x));
      return hit ? hit.replace(rx, '').trim() : '';
    };
    const tidy = v => String(v || '')
      .replace(/^["'`\s]+|["'`\s]+$/g, '').replace(/^\(|\)$/g, '').slice(0, 24);

    const label = tidy(grab('저장명')) || tidy(lines[lines.length - 1]) || u;
    const call = tidy(grab('호칭'));
    return { label: label || u, call };
  }

  /* ── 스타일 ────────────────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${APP_ID}{position:fixed;left:0;right:0;top:0;height:100%;z-index:2147483600;
 display:flex;flex-direction:column;
 background:#fff;color:#111;overflow:hidden;
 font:400 15px/1.5 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;
 -webkit-text-size-adjust:100%;overscroll-behavior:contain}
#${APP_ID} *{box-sizing:border-box;margin:0;padding:0;font-family:inherit}
#zetatalk-v1-back{position:fixed;inset:0;z-index:2147483599;background:#fff}
#${APP_ID} button{background:none;border:0;color:inherit;font-size:inherit;text-align:left}
#${APP_ID} .v{display:none;position:absolute;inset:0;flex-direction:column}
#${APP_ID} .v.on{display:flex}
#${APP_ID}{--fz:15.5px;--fzs:13px;--plate:#e5e5e5}
#${APP_ID}[data-dark="1"]{--plate:#3d3d3d}
#${APP_ID} svg{display:block;width:100%;height:100%}

#${APP_ID}[data-theme=kakao] .chat{--bg:#b2c7d9;--hd:#b2c7d9;--hdink:#16232c;--hdsub:#54697a;
 --other:#fff;--otherink:#111;--mine:#fae100;--mineink:#1a1a1a;--name:#43535f;--time:#5a6d7c;
 --day:rgba(0,0,0,.14);--dayink:#fff;--avr:16px;
 --ro:2px 16px 16px 16px;--rm:16px 2px 16px 16px;--rc:16px;
 --barbg:#fff;--barline:#e6e6e6;--send:#fae100;--sendink:#3a2f00;--empty:#4a5f70;--tail:1}
#${APP_ID}[data-theme=imessage] .chat{--bg:#fff;--hd:#fff;--hdink:#111;--hdsub:#84848b;
 --other:#e9e9eb;--otherink:#111;--mine:#0b84fe;--mineink:#fff;--name:#84848b;--time:#a2a2a8;
 --day:transparent;--dayink:#84848b;--avr:50%;--ro:19px;--rm:19px;--rc:19px;
 --barbg:#fff;--barline:#e6e6e6;--send:#0b84fe;--sendink:#fff;--empty:#84848b;--tail:0}
#${APP_ID}[data-theme=line] .chat{--bg:#8cabd8;--hd:#8cabd8;--hdink:#12202d;--hdsub:#3a596f;
 --other:#fff;--otherink:#111;--mine:#06c755;--mineink:#111;--name:#28404f;--time:#4a6274;
 --day:rgba(0,0,0,.16);--dayink:#fff;--avr:50%;
 --ro:2px 16px 16px 16px;--rm:16px 2px 16px 16px;--rc:16px;
 --barbg:#fff;--barline:#e3e3e3;--send:transparent;--sendink:#4a7ef0;--empty:#2f4c62;--tail:1}

/* 테마별 글씨 결 */
#${APP_ID}[data-theme=kakao] .bub{letter-spacing:-.01em;font-weight:400}
#${APP_ID}[data-theme=imessage] .bub{letter-spacing:-.022em;font-weight:400}
#${APP_ID}[data-theme=imessage] .who{letter-spacing:-.01em;font-weight:500}
#${APP_ID}[data-theme=line] .bub{letter-spacing:0;font-weight:400}
#${APP_ID}[data-theme=line] .who{font-weight:500}

/* 다크 */
#${APP_ID}[data-dark="1"]{background:#16161a;color:#ececf0}
#${APP_ID}[data-dark="1"] .nav{background:#1c1c21;border-bottom-color:#2a2a31}
#${APP_ID}[data-dark="1"] .nav .ic{color:#ececf0}
#${APP_ID}[data-dark="1"] .nav .tt span{color:#8b8b95}
#${APP_ID}[data-dark="1"] .pick{background:#212127}
#${APP_ID}[data-dark="1"] .pick:active{background:#2a2a31}
#${APP_ID}[data-dark="1"] .pick .emo{background-color:#2c2c34}
#${APP_ID}[data-dark="1"] .pick .tx2 span{color:#8b8b95}
#${APP_ID}[data-dark="1"] .pick .arw{color:#5c5c66}
#${APP_ID}[data-dark="1"] .turns{background:#212127}
#${APP_ID}[data-dark="1"] .turns label{color:#8b8b95}
#${APP_ID}[data-dark="1"] .item{border-bottom-color:#26262d}
#${APP_ID}[data-dark="1"] .item:active{background:#212127}
#${APP_ID}[data-dark="1"] .item .prev,#${APP_ID}[data-dark="1"] .item .top i{color:#8b8b95}
#${APP_ID}[data-dark="1"] .none{color:#7a7a85}
#${APP_ID}[data-dark="1"] .form{background:#131317}
#${APP_ID}[data-dark="1"] .grp{background:#212127}
#${APP_ID}[data-dark="1"] .f{border-bottom-color:#2b2b33}
#${APP_ID}[data-dark="1"] .f label{color:#8b8b95}
#${APP_ID}[data-dark="1"] .f input,#${APP_ID}[data-dark="1"] .f select,
#${APP_ID}[data-dark="1"] .f textarea{color:#ececf0}
#${APP_ID}[data-dark="1"] .cap{color:#7a7a85}
#${APP_ID}[data-dark="1"] .row b{color:#ececf0}
#${APP_ID}[data-dark="1"] .seg button{background:#2b2b33;color:#a5a5b0}
#${APP_ID}[data-dark="1"] .seg button.on{background:#ececf0;color:#16161a}
#${APP_ID}[data-dark="1"] .sw{background:#3a3a44}
#${APP_ID}[data-dark="1"] .av.grid{background:#2c2c34}
#${APP_ID}[data-dark="1"] .sbox{background:#212127}
#${APP_ID}[data-dark="1"] .sitem{border-bottom-color:#2b2b33}

#${APP_ID}[data-dark="1"][data-theme=kakao] .chat{--bg:#1b1b1f;--hd:#1b1b1f;--hdink:#ececf0;
 --hdsub:#8b8b95;--other:#2c2c34;--otherink:#ececf0;--mine:#fae100;--mineink:#1a1a1a;
 --name:#9a9aa5;--time:#77777f;--day:rgba(255,255,255,.1);--dayink:#c8c8d0;
 --barbg:#1c1c21;--barline:#2a2a31;--empty:#7a7a85}
#${APP_ID}[data-dark="1"][data-theme=imessage] .chat{--bg:#000;--hd:#000;--hdink:#fff;
 --hdsub:#8e8e93;--other:#26262a;--otherink:#fff;--mine:#0b84fe;--mineink:#fff;
 --name:#8e8e93;--time:#6d6d73;--day:transparent;--dayink:#8e8e93;
 --barbg:#000;--barline:#26262a;--empty:#8e8e93}
#${APP_ID}[data-dark="1"][data-theme=line] .chat{--bg:#000;--hd:#000;--hdink:#e8e8ea;
 --hdsub:#8a8a90;--other:#2b2b2e;--otherink:#e8e8ea;--mine:#7ee08a;--mineink:#0b0b0c;
 --name:#8a8a90;--time:#6e6e74;--day:#1c1c1e;--dayink:#a8a8ae;
 --barbg:#0b0b0c;--barline:#232326;--empty:#6e6e74}
#${APP_ID}[data-dark="1"] .sys i{background:rgba(255,255,255,.12);color:#e8b9b3}
#${APP_ID}[data-dark="1"] .bar textarea{color:#ececf0}
#${APP_ID}[data-dark="1"] .toast{background:rgba(240,240,245,.94);color:#16161a}

#${APP_ID} .nav{flex:0 0 auto;display:flex;align-items:center;gap:2px;
 padding:calc(env(safe-area-inset-top) + 10px) 8px 10px;border-bottom:1px solid #ececee;background:#fff}
#${APP_ID} .nav .ic{width:42px;height:38px;font-size:19px;text-align:center;color:#222}
#${APP_ID} .nav .tt{flex:1;min-width:0;padding:0 4px}
#${APP_ID} .nav .tt b{display:block;font-size:17px;font-weight:700;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .nav .tt span{font-size:11px;color:#8b8b93}
#${APP_ID} .nav .tx{padding:0 10px;font-size:15px;font-weight:600;color:#3b6fe0}

/* 홈 — 세 갈래 */
#${APP_ID} .picks{flex:1;overflow-y:auto;padding:18px 14px calc(env(safe-area-inset-bottom) + 24px)}
#${APP_ID} .pick{display:flex;align-items:center;gap:14px;width:100%;
 background:#f6f6f8;border-radius:16px;padding:18px 16px;margin-bottom:12px}
#${APP_ID} .pick:active{background:#eeeef1}
#${APP_ID} .pick .emo{flex:0 0 auto;width:46px;height:46px;border-radius:14px;background:#fff;
 display:flex;align-items:center;justify-content:center;font-size:23px;
 background-size:cover;background-position:center;overflow:hidden}
#${APP_ID} .pick .tx2{flex:1;min-width:0}
#${APP_ID} .pick .tx2 b{display:block;font-size:17px;font-weight:700;margin-bottom:3px}
#${APP_ID} .pick .tx2 span{font-size:13px;color:#84848b}
#${APP_ID} .pick .arw{flex:0 0 auto;color:#b8b8bf;font-size:19px}
#${APP_ID} .pick .fetch{flex:0 0 auto;font-size:13px;font-weight:600;color:#3b6fe0;
 padding:9px 13px;border-radius:9px;background:rgba(59,111,224,.1);margin-right:6px}
#${APP_ID}[data-dark="1"] .pick .fetch{background:rgba(120,160,255,.14);color:#8fb0ff}
#${APP_ID} .pick .fetch.busy{color:#9a9aa2;background:rgba(150,150,160,.12)}
/* 캐릭터 폰 — 아이폰 홈 화면식 격자 */
#${APP_ID} .grid{display:grid;grid-template-columns:repeat(4,1fr);
 gap:22px 8px;padding:10px 4px 26px}
#${APP_ID} .icn{display:flex;flex-direction:column;align-items:center;gap:7px;
 background:none;padding:0}
#${APP_ID} .icn .ibx{width:60px;height:60px;border-radius:15px;
 display:flex;align-items:center;justify-content:center;font-size:29px;
 box-shadow:0 1px 5px rgba(0,0,0,.16);transition:transform .12s}
#${APP_ID} .icn:active .ibx{transform:scale(.9)}
#${APP_ID} .icn em{font-style:normal;font-size:11.5px;line-height:1.3;
 text-align:center;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID}[data-dark="1"] .icn .ibx{box-shadow:0 1px 5px rgba(0,0,0,.5)}

/* 하루문답 */
#${APP_ID} .qcard{background:#fff;border-radius:16px;padding:17px 18px;margin-bottom:13px;
 text-align:center;box-shadow:0 1px 6px rgba(0,0,0,.06)}
#${APP_ID}[data-dark="1"] .qcard{background:#212127;box-shadow:none}
#${APP_ID} .qcard i{display:block;font-style:normal;font-size:11px;
 color:#c07a92;letter-spacing:.06em;margin-bottom:8px}
#${APP_ID} .qcard b{display:block;font-size:15.5px;font-weight:600;line-height:1.6;
 letter-spacing:-.02em;word-break:keep-all}

/* 좌우로 넘겨 지난 문답을 본다 */
#${APP_ID} .qnav{display:flex;align-items:center;justify-content:center;
 gap:18px;padding:4px 0 16px}
#${APP_ID} .qnav .qarw{width:34px;height:34px;border-radius:50%;background:#fff;
 color:#5a5a62;font-size:17px;line-height:34px;text-align:center;
 box-shadow:0 1px 4px rgba(0,0,0,.1);flex:0 0 auto}
#${APP_ID}[data-dark="1"] .qnav .qarw{background:#2b2b33;color:#d0d0d8;box-shadow:none}
#${APP_ID} .qnav .qarw:active{background:#eeeef1}
#${APP_ID} .qnav .qarw.off{visibility:hidden}
#${APP_ID} .qnav em{font-style:normal;font-size:12px;color:#9a9aa2;
 min-width:44px;text-align:center}

/* 캘린더 */
#${APP_ID} .cnav{display:flex;align-items:center;justify-content:space-between;
 padding:4px 6px 12px}
#${APP_ID} .cnav b{font-size:16px;font-weight:700}
#${APP_ID} .cnav .ic{width:38px;height:34px;font-size:20px;color:#8a8a90}
#${APP_ID} .cwk{display:grid;grid-template-columns:repeat(7,1fr);
 font-size:11.5px;color:#9a9aa2;text-align:center;padding-bottom:4px}
#${APP_ID} .cwk .sun{color:#e2685f}
#${APP_ID} .cwk .sat{color:#4f79d8}
#${APP_ID} .cgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
#${APP_ID} .cd2{position:relative;aspect-ratio:1/1.05;border-radius:9px;
 display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
 font-size:13.5px;color:#2a2a30}
#${APP_ID}[data-dark="1"] .cd2{color:#e0e0e6}
#${APP_ID} .cd2.out{visibility:hidden}
#${APP_ID} .cd2.now b{color:#2f7cf6;font-weight:700}
#${APP_ID} .cd2.on{background:rgba(47,124,246,.14)}
#${APP_ID} .cd2 i{width:5px;height:5px;border-radius:50%;background:#2f7cf6;display:block}
#${APP_ID} .cd2 i.ch{background:#e07aa8}
#${APP_ID} .crow{display:flex;align-items:center;gap:9px;padding:11px 2px;
 border-bottom:1px solid rgba(128,128,140,.16)}
#${APP_ID} .crow .ct{flex:1;min-width:0}
#${APP_ID} .crow .ct b{display:block;font-size:14.5px;font-weight:600}
#${APP_ID} .crow .ct em{font-style:normal;font-size:11.5px;color:#8a8a90}
#${APP_ID} .crow.ch .ct em{color:#e07aa8}
#${APP_ID} .crow .cbtn{flex:0 0 auto;font-size:12.5px;color:#2f7cf6;padding:6px 4px}
#${APP_ID} .crow .cdel{flex:0 0 auto;font-size:14px;color:#b4b4bc;padding:6px 4px}

/* 알림 배너 */
#${APP_ID} .noti{position:absolute;left:10px;right:10px;
 top:calc(env(safe-area-inset-top) + 8px);z-index:40;
 transform:translateY(-160%);opacity:0;transition:transform .34s cubic-bezier(.2,.8,.3,1),opacity .28s;
 pointer-events:none}
#${APP_ID} .noti.on{transform:translateY(0);opacity:1;pointer-events:auto}
#${APP_ID} .nbox{display:flex;align-items:center;gap:11px;
 background:rgba(238,238,242,.82);border-radius:21px;padding:12px 14px;
 -webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px);
 box-shadow:0 6px 22px rgba(0,0,0,.18)}
#${APP_ID}[data-dark="1"] .nbox{background:rgba(48,48,54,.82)}
#${APP_ID} .nbox .nav2{flex:0 0 auto;width:38px;height:38px;border-radius:50%;
 overflow:hidden;display:flex;align-items:center;justify-content:center;
 color:#fff;font-size:15px;font-weight:600;background-size:cover;background-position:center}
#${APP_ID} .nbox .ntx{flex:1;min-width:0}
#${APP_ID} .nbox .ntx b{display:block;font-size:13.5px;font-weight:700;
 margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .nbox .ntx p{font-size:13.5px;line-height:1.35;color:#2a2a30;
 display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#${APP_ID}[data-dark="1"] .nbox .ntx p{color:#e0e0e6}
#${APP_ID} .nbox i{flex:0 0 auto;font-style:normal;font-size:11.5px;
 color:#8a8a90;align-self:flex-start}
#${APP_ID} .ans{background:#fff;border-radius:14px;padding:15px 16px;margin-bottom:11px}
#${APP_ID}[data-dark="1"] .ans{background:#212127}
#${APP_ID} .ans i{display:block;font-style:normal;font-size:12px;font-weight:600;
 margin-bottom:7px;color:#8a8a90}
#${APP_ID} .ans.me i{color:#c4923f}
#${APP_ID} .ans.ch i{color:#7b8fc4}
#${APP_ID} .ans p{font-size:15px;line-height:1.62;white-space:pre-wrap;word-break:break-word}
#${APP_ID} .ans p.wait{color:#a8a8b0;font-size:13.5px}
#${APP_ID} .ans .tr{opacity:.5}
#${APP_ID} .qsec{font-size:12.5px;color:#8a8a90;padding:22px 6px 9px}
#${APP_ID} .qold{background:#fff;border-radius:13px;padding:14px 16px;margin-bottom:9px}
#${APP_ID}[data-dark="1"] .qold{background:#212127}
#${APP_ID} .qold b{display:block;font-size:14.5px;font-weight:600;margin-bottom:9px;
 line-height:1.5;word-break:keep-all}
#${APP_ID} .qold p{font-size:13.5px;line-height:1.6;color:#5a5a62;margin-top:5px;
 white-space:pre-wrap;word-break:break-word}
#${APP_ID}[data-dark="1"] .qold p{color:#a8a8b2}
#${APP_ID} .qold p em{font-style:normal;font-weight:600;color:#8a8a90;margin-right:6px}
#${APP_ID} .qold .del{float:right;color:#d1443c;font-size:12.5px;padding:2px 4px}

#${APP_ID} .turns{background:#f6f6f8;border-radius:16px;padding:15px 16px 12px;margin-top:4px}
#${APP_ID} .turns label{display:block;font-size:13px;color:#84848b;margin-bottom:4px}
#${APP_ID} .turns input{width:100%}

/* 목록 */
#${APP_ID} .list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;
 padding-bottom:calc(env(safe-area-inset-bottom) + 24px)}
#${APP_ID} .item{display:flex;align-items:center;gap:13px;padding:14px 16px;width:100%;
 border-bottom:1px solid #f2f2f4}
#${APP_ID} .item:active{background:#f6f6f8}
#${APP_ID} .item .meta{flex:1;min-width:0}
#${APP_ID} .item .top{display:flex;align-items:baseline;gap:8px}
#${APP_ID} .item .top b{flex:1;min-width:0;font-size:16px;font-weight:600;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .item .top b .cnt{margin-left:5px;font-weight:400;font-size:.86em;opacity:.45}
#${APP_ID} .item .top i{flex:0 0 auto;font-style:normal;font-size:11px;color:#a6a6ac}
#${APP_ID} .item .prev{font-size:13.5px;color:#84848b;margin-top:3px;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .item .del{flex:0 0 auto;color:#d1443c;font-size:14px;padding:6px 8px}
#${APP_ID} .none{text-align:center;color:#9a9aa2;font-size:13.5px;padding:60px 30px;line-height:1.85}
#${APP_ID} .av{flex:0 0 auto;width:52px;height:52px;border-radius:18px;overflow:hidden;
 display:flex;align-items:center;justify-content:center;color:#fff;font-size:19px;font-weight:600;
 background-size:cover;background-position:center}

/* 대화방 */
#${APP_ID} .chat{background:var(--bg)}
#${APP_ID} .chat .nav{background:var(--hd);border-bottom:0;position:relative;padding-bottom:8px}
#${APP_ID} .chat .nav .ic{color:var(--hdink)}
#${APP_ID} .chat .nav .tt b{color:var(--hdink)}
#${APP_ID} .chat .nav .tt{flex:1;min-width:0;text-align:center;
 padding:0 2px;pointer-events:none;margin-left:38px}
#${APP_ID} .chat .nav .tt b{font-size:16.5px}
#${APP_ID} .chat .nav .gap{display:none}
#${APP_ID}[data-theme=line] .chat .nav .tt{margin-left:0}
#${APP_ID} .chat .nav .tt span{color:var(--hdsub)}
#${APP_ID} .chat .nav .tt b .cnt{margin-left:7px;font-weight:500;font-size:.9em;opacity:.5}
#${APP_ID} .chat .nav .gap{flex:1}
#${APP_ID} .chat .nav .ico{width:38px;height:38px;padding:8px;color:var(--hdink)}
/* 라인 — 헤더를 투명하게, 말풍선이 뒤로 흐르게 */
/* 실제 라인처럼 헤더 뒤에 옅은 층을 깔아 글자가 묻히지 않게 한다 */
#${APP_ID}[data-theme=line] .chat .nav{position:absolute;left:0;right:0;top:0;z-index:6;
 pointer-events:none;padding-bottom:8px;
 background:linear-gradient(180deg,rgba(140,171,216,.88) 62%,rgba(140,171,216,0));
 -webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}
#${APP_ID}[data-dark="1"][data-theme=line] .chat .nav{
 background:linear-gradient(180deg,rgba(0,0,0,.86) 62%,rgba(0,0,0,0))}
#${APP_ID}[data-theme=line] .chat .nav button{pointer-events:auto}
#${APP_ID}[data-theme=line] .chat .log{padding-top:calc(env(safe-area-inset-top) + 62px)}
#${APP_ID}[data-theme=line] .chat .status{padding-top:calc(env(safe-area-inset-top) + 58px)}
#${APP_ID}[data-theme=line] .chat .find{position:absolute;z-index:7;left:0;right:0;
 top:calc(env(safe-area-inset-top) + 54px);
 background:rgba(140,171,216,.9);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
/* 아이콘과 제목 뒤에 깔던 흰 판을 쓰지 않는다. 글자와 아이콘만 남긴다 */
#${APP_ID}[data-theme=line] .chat .nav .ico{background:none;border-radius:0;
 -webkit-backdrop-filter:none;backdrop-filter:none}
#${APP_ID}[data-theme=line] .chat .nav .tt b{display:inline-block;max-width:100%;
 background:none;border-radius:0;padding:0;
 -webkit-backdrop-filter:none;backdrop-filter:none}
#${APP_ID}[data-dark="1"][data-theme=line] .chat .find{background:rgba(11,11,12,.92)}

/* 라인은 제목이 뒤로가기 바로 옆 */
#${APP_ID}[data-theme=line] .chat .nav .tt{position:static;transform:none;max-width:none;
 text-align:left;padding:0 2px;pointer-events:auto}
#${APP_ID}[data-theme=line] .chat .nav .tt b{font-size:18px;font-weight:600}
#${APP_ID}[data-theme=line] .chat .nav .gap{flex:1}

/* 검색줄 */
#${APP_ID} .find{display:none;flex:0 0 auto;align-items:center;gap:6px;
 background:var(--hd);padding:0 10px 9px}
#${APP_ID} .find.on{display:flex}
#${APP_ID} .find input{flex:1;min-width:0;border:0;outline:0;background:rgba(255,255,255,.85);
 border-radius:16px;padding:8px 13px;font-size:14px;color:#111}
#${APP_ID} .find .fb{flex:0 0 auto;width:32px;height:32px;padding:7px;color:var(--hdink)}
#${APP_ID} .find .fcnt{flex:0 0 auto;font-size:12px;color:var(--hdsub);min-width:38px;text-align:center}

#${APP_ID} .status{flex:0 0 auto;background:var(--hd);color:var(--hdsub);
 padding:0 14px 9px;font-size:11px;line-height:1.55;word-break:break-word}
#${APP_ID} .status:empty{display:none}
#${APP_ID} .status.err{background:#e3c4c0;color:#71211a;padding-top:9px}
#${APP_ID} .log{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:14px 14px 8px}
#${APP_ID} .day{text-align:center;margin:22px 0 18px;padding:0;width:100%}
#${APP_ID} .day:first-child{margin-top:4px}
#${APP_ID} .day i{background:var(--day);color:var(--dayink);font-style:normal;
 font-size:11.5px;padding:5px 13px;border-radius:12px;line-height:1.6}
#${APP_ID}[data-theme=imessage] .day i{background:transparent;padding:0;
 font-size:12px;font-weight:600}
#${APP_ID}[data-theme=imessage] .day i b{font-weight:600}
#${APP_ID}[data-theme=imessage] .day i span{font-weight:400;opacity:.85;margin-left:5px}
#${APP_ID} .sys{text-align:center;margin:12px 0}
#${APP_ID} .sys i{display:inline-block;max-width:92%;text-align:left;
 background:rgba(255,255,255,.88);color:#6b2b24;font-style:normal;font-size:11.5px;
 line-height:1.7;padding:10px 13px;border-radius:11px;white-space:pre-wrap;word-break:break-word}
#${APP_ID} .m{display:flex;gap:9px;margin-bottom:4px;align-items:flex-start}
#${APP_ID} .m.first{margin-top:13px}
#${APP_ID} .m .mav{flex:0 0 auto;width:40px;height:40px;border-radius:var(--avr);
 align-self:flex-start;overflow:hidden;
 display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:600;
 background-size:cover;background-position:center}
#${APP_ID} .m .mav.hide{visibility:hidden;height:0}
#${APP_ID} .col{min-width:0;max-width:74%}
#${APP_ID} .who{font-size:var(--fzs);color:var(--name);margin:1px 0 4px 2px;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .line{display:flex;align-items:flex-end;gap:5px}
#${APP_ID} .bub{position:relative;background:var(--other);color:var(--otherink);
 border-radius:var(--ro);padding:9px 12px;font-size:var(--fz);line-height:1.46;
 white-space:pre-wrap;word-break:normal;overflow-wrap:anywhere;
 -webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#${APP_ID} .m:not(.first) .bub{border-radius:var(--rc)}
#${APP_ID} .bub img{display:block;max-width:190px;border-radius:10px}
#${APP_ID} .bub.pic{padding:5px;background:transparent}
#${APP_ID} .bub .tr{opacity:.5;font-size:.94em}
#${APP_ID} .trs{display:block;font-size:12px;line-height:1.5;
 color:#a0a0a8;font-weight:400;margin-top:2px;word-break:keep-all}
#${APP_ID}[data-dark="1"] .trs{color:#82828c}
#${APP_ID} .bub mark{background:#ffd54a;color:#111;border-radius:2px}
#${APP_ID} .bub.cur mark{background:#ff8f2e;color:#fff}
#${APP_ID} .tm{flex:0 0 auto;font-size:10.5px;color:var(--time);padding-bottom:2px;min-width:1px}
#${APP_ID} .m.me{flex-direction:row-reverse}
#${APP_ID} .m.me .col{margin-left:auto}
#${APP_ID} .m.me .line{flex-direction:row-reverse}
#${APP_ID} .m.me .bub{background:var(--mine);color:var(--mineink);border-radius:var(--rm)}
#${APP_ID} .m.me:not(.first) .bub{border-radius:var(--rc)}
#${APP_ID} .m.me .bub.pic{background:transparent}
/* 말풍선 꼬리 — 카톡 · 라인 */
#${APP_ID}[data-theme=kakao] .m.first .bub:not(.pic)::after{
 content:'';position:absolute;top:0;left:-6px;width:9px;height:13px;
 background:var(--other);clip-path:polygon(100% 0,6% 0,100% 74%);
 border-top-left-radius:4px;border-bottom-left-radius:9px}
#${APP_ID}[data-theme=kakao] .m.me.first .bub:not(.pic)::after{
 left:auto;right:-6px;background:var(--mine);clip-path:polygon(0 0,94% 0,0 74%);
 border-top-left-radius:0;border-bottom-left-radius:0;
 border-top-right-radius:4px;border-bottom-right-radius:9px}
#${APP_ID}[data-theme=line] .m.first .bub:not(.pic)::after{
 content:'';position:absolute;top:0;left:-6px;width:9px;height:13px;
 background:var(--other);clip-path:polygon(100% 0,6% 0,100% 74%);
 border-top-left-radius:4px;border-bottom-left-radius:9px}
#${APP_ID}[data-theme=line] .m.me.first .bub:not(.pic)::after{
 left:auto;right:-6px;background:var(--mine);clip-path:polygon(0 0,94% 0,0 74%);
 border-top-left-radius:0;border-bottom-left-radius:0;
 border-top-right-radius:4px;border-bottom-right-radius:9px}
/* 프사가 꼬리에 가려지지 않게 위로 올린다 */
#${APP_ID} .m .mav{position:relative;z-index:2}
/* 아이메시지 — 묶음의 마지막 말풍선에 둥근 꼬리 */
#${APP_ID}[data-theme=imessage] .m.last .bub:not(.pic)::before{
 content:'';position:absolute;bottom:0;left:-6px;width:16px;height:16px;
 background:var(--other);border-bottom-right-radius:16px;z-index:-2}
#${APP_ID}[data-theme=imessage] .m.last .bub:not(.pic)::after{
 content:'';position:absolute;bottom:0;left:-16px;width:16px;height:16px;
 background:var(--bg);border-bottom-right-radius:12px;z-index:-1}
#${APP_ID}[data-theme=imessage] .m.me.last .bub:not(.pic)::before{
 left:auto;right:-6px;background:var(--mine);
 border-bottom-right-radius:0;border-bottom-left-radius:16px}
#${APP_ID}[data-theme=imessage] .m.me.last .bub:not(.pic)::after{
 left:auto;right:-16px;background:var(--bg);
 border-bottom-right-radius:0;border-bottom-left-radius:12px}
#${APP_ID}[data-theme=imessage] .bub{z-index:0}
#${APP_ID}[data-theme=imessage] .col{max-width:76%}
#${APP_ID}[data-theme=imessage] .m{align-items:flex-end}
/* 아이메시지는 문자라 참여자 줄을 두지 않는다 */
#${APP_ID}[data-theme=imessage] .chat .nav .tt span{display:none}
/* 아이메시지 — 1:1 방은 프사도 이름도 시간도 안 붙는다 */
#${APP_ID}[data-theme=imessage] .chat[data-dm="1"] .m .mav{display:none}
#${APP_ID}[data-theme=imessage] .chat[data-dm="1"] .who{display:none}
/* 아이메시지 단톡방 — 작은 프사가 묶음 맨 아래에, 이름은 말풍선 위에 */
#${APP_ID}[data-theme=imessage] .chat[data-dm="0"] .m .mav{
 width:28px;height:28px;font-size:12px;align-self:flex-end}
#${APP_ID}[data-theme=imessage] .chat[data-dm="0"] .who{
 font-size:11.5px;margin:0 0 4px 4px}
#${APP_ID}[data-theme=imessage] .chat[data-dm="0"] .m{gap:8px}
#${APP_ID}[data-theme=imessage] .tm{display:none}
#${APP_ID}[data-theme=imessage] .m{margin-bottom:2px}
#${APP_ID}[data-theme=imessage] .m.first{margin-top:9px}

/* 카톡 — 헤더를 투명하게, 말풍선이 뒤로 흐르게 */
#${APP_ID}[data-theme=kakao] .chat .nav{position:absolute;left:0;right:0;top:0;z-index:6;
 background:transparent;pointer-events:none;padding-bottom:8px}
#${APP_ID}[data-theme=kakao] .chat .nav button{pointer-events:auto}
#${APP_ID}[data-theme=kakao] .chat .log{padding-top:calc(env(safe-area-inset-top) + 62px)}
#${APP_ID}[data-theme=kakao] .chat .status{padding-top:calc(env(safe-area-inset-top) + 58px)}
#${APP_ID}[data-theme=kakao] .chat .find{position:absolute;z-index:7;left:0;right:0;
 top:calc(env(safe-area-inset-top) + 54px);
 background:rgba(178,199,217,.9);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
#${APP_ID}[data-theme=kakao] .chat .nav .ico{background:rgba(255,255,255,.58);
 border-radius:50%;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
/* 제목 뒤 판만 없앤다. 아이콘 동그라미는 그대로 둔다 */
#${APP_ID}[data-theme=kakao] .chat .nav .tt b{display:inline-block;max-width:100%;
 background:none;border-radius:0;padding:0;
 -webkit-backdrop-filter:none;backdrop-filter:none}
#${APP_ID}[data-dark="1"][data-theme=kakao] .chat .nav .ico{background:rgba(42,42,50,.66)}
#${APP_ID}[data-dark="1"][data-theme=kakao] .chat .find{background:rgba(27,27,31,.92)}
#${APP_ID}[data-theme=imessage] .chat .status{
 padding-top:calc(env(safe-area-inset-top) + 74px)}

#${APP_ID}[data-theme=imessage] .chat .nav{padding-bottom:8px;align-items:center;
 position:absolute;left:0;right:0;top:0;z-index:6;background:transparent;
 pointer-events:none}
#${APP_ID}[data-theme=imessage] .chat .nav button{pointer-events:auto}
#${APP_ID}[data-theme=imessage] .chat .log{
 padding-top:calc(env(safe-area-inset-top) + 100px)}
#${APP_ID}[data-theme=imessage] .day{margin:26px 0 18px}
#${APP_ID}[data-theme=imessage] .day:first-child{margin-top:6px}
/* 뒤로가기와 이름은 살짝 흐린 판 위에 올려 글자가 묻히지 않게 한다 */
#${APP_ID}[data-theme=imessage] .chat .nav .ico{
 background:rgba(248,248,250,.72);border-radius:50%;
 -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
#${APP_ID}[data-dark="1"][data-theme=imessage] .chat .nav .ico{
 background:rgba(40,40,46,.66)}
#${APP_ID}[data-theme=imessage] .chat .nav .tt b{
 background:rgba(249,249,251,.62);border-radius:11px;padding:2px 9px;
 -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
#${APP_ID}[data-dark="1"][data-theme=imessage] .chat .nav .tt b{
 background:rgba(72,72,78,.5)}
#${APP_ID}[data-theme=imessage] .chat .nav .tt{display:flex;flex-direction:column;
 align-items:center;gap:0;position:static;transform:none;
 order:2;flex:1;min-width:0;margin:0;max-width:none}
#${APP_ID}[data-theme=imessage] .chat .nav [data-a=back]{order:1}
#${APP_ID}[data-theme=imessage] .chat .nav .tt{padding-left:0;padding-right:0}
#${APP_ID}[data-theme=imessage] .chat .nav [data-a=find]{display:none}
#${APP_ID}[data-theme=imessage] .chat .nav [data-a=roomset]{order:4}
#${APP_ID}[data-theme=imessage] .chat .nav .ico{align-self:center;margin-top:0}
#${APP_ID}[data-theme=imessage] .chat .nav .tt b{font-size:12.5px;font-weight:500;
 line-height:16px;height:20px;display:flex;align-items:center;justify-content:center}
#${APP_ID} .chat .nav .tt .hav{display:none;flex:0 0 auto;
 width:52px;height:52px;min-width:52px;min-height:52px;border-radius:50%;
 background-size:cover;background-position:center;color:#fff;font-size:21px;font-weight:600;
 align-items:center;justify-content:center;overflow:hidden;position:relative}
#${APP_ID}[data-theme=imessage] .chat .nav .tt .hav{display:flex;margin-bottom:5px}
#${APP_ID} .person{background:transparent}
#${APP_ID} .person .pv{width:100%;height:100%;display:block}
#${APP_ID} .hav.bare{background:transparent;overflow:visible}
/* 단톡은 여러 명이 겹쳐 얹히므로 뒤에 회색 판을 깐다.
   잘라내면 바깥 아바타가 썰리므로, 대신 겹치기를 원 안쪽으로 줄인다 */
#${APP_ID} .chat .nav .tt .hav.grp{background:var(--plate);overflow:visible}
#${APP_ID} .hav.grp .stack.inner{position:absolute;left:0;top:0;
 width:52px;height:52px;border-radius:0;overflow:visible}
#${APP_ID} .stack{position:relative;background:transparent;overflow:visible}
#${APP_ID} .hav .stack.inner{width:100%;height:100%}
#${APP_ID} .stack .pp{position:absolute;border-radius:34%;overflow:hidden;
 display:flex;align-items:center;justify-content:center;
 font-style:normal;font-weight:600;color:#fff;line-height:1;
 background-size:cover;background-position:center;background-repeat:no-repeat;
 box-shadow:0 0 0 2px #fff}
#${APP_ID}[data-dark="1"] .stack .pp{box-shadow:0 0 0 2px #16161a}
#${APP_ID} .stack .pp.lt{background:linear-gradient(180deg,#adb6d4,#828fbe)}
#${APP_ID}[data-dark="1"] .hav .inner{color:#cfcfd8}
#${APP_ID} .stack .pp .pv{width:100%;height:100%;display:block}
#${APP_ID} .av.stack{background:transparent;border-radius:0;overflow:visible}
/* 목록 아이콘도 헤더와 같은 회색 판 위에 얹는다 */
#${APP_ID}[data-theme=imessage] .av.stack{background:var(--plate);border-radius:50%}
#${APP_ID} .chat .none{color:var(--empty)}
#${APP_ID} .dots{display:inline-flex;gap:4px;padding:3px 2px}
#${APP_ID} .dots i{width:6px;height:6px;border-radius:50%;background:#9aa7b0;animation:zpb 1.1s infinite}
#${APP_ID} .dots i:nth-child(2){animation-delay:.15s}
#${APP_ID} .dots i:nth-child(3){animation-delay:.3s}
@keyframes zpb{0%,60%,100%{opacity:.3}30%{opacity:1}}
@media (prefers-reduced-motion:reduce){#${APP_ID} .dots i{animation:none;opacity:.6}}
#${APP_ID} .bar{flex:0 0 auto;display:flex;align-items:flex-end;gap:8px;background:var(--barbg);
 padding:8px 12px calc(env(safe-area-inset-bottom) * var(--sab, 1) + 8px);
 border-top:1px solid var(--barline)}
#${APP_ID} .bar .pl{flex:0 0 auto;width:34px;height:34px;padding:5px;color:#5a5a62}
#${APP_ID}[data-dark="1"] .bar .pl{color:#b8b8c2}
#${APP_ID} .bar .pl.off{opacity:.32}
#${APP_ID} .bar .field{flex:1;min-width:0;display:flex;align-items:flex-end;
 background:var(--fieldbg,#f1f1f4);border-radius:19px;padding:2px 14px}
#${APP_ID} .bar textarea{flex:1;border:0;outline:0;resize:none;font-size:var(--fz);
 max-height:100px;padding:8px 0;background:none;color:inherit;line-height:1.45}
#${APP_ID} .bar textarea:disabled{color:#9a9aa2;-webkit-text-fill-color:#9a9aa2}
#${APP_ID} .snd{flex:0 0 auto;width:34px;height:34px;margin-bottom:1px;padding:7px;
 border-radius:50%;background:var(--send);color:var(--sendink);text-align:center}
#${APP_ID} .snd.txt{width:auto;height:auto;padding:9px 14px;border-radius:18px;
 font-size:14px;font-weight:600}
#${APP_ID}[data-theme=line] .snd{padding:5px}
#${APP_ID}[data-theme=line] .snd.txt{background:#06c755;color:#fff;padding:9px 14px}
#${APP_ID}[data-dark="1"] .bar .field{background:var(--fieldbg,#2a2a31)}
#${APP_ID}[data-dark="1"] .bar textarea{color:#ececf0}
#${APP_ID} .tray{display:flex;gap:6px;padding:0 12px 8px;background:var(--barbg);flex-wrap:wrap}
#${APP_ID} .tray:empty{display:none}
#${APP_ID} .tray .thumbx{position:relative;display:inline-block;line-height:0}
#${APP_ID} .tray img{width:52px;height:52px;object-fit:cover;border-radius:9px}
#${APP_ID} .tray .thumbx i{position:absolute;right:-5px;top:-5px;
 width:19px;height:19px;border-radius:50%;background:rgba(20,20,25,.88);
 color:#fff;font-style:normal;font-size:11px;line-height:19px;text-align:center;
 box-shadow:0 1px 3px rgba(0,0,0,.35)}

/* 액션 시트 */
#${APP_ID} .sheet{display:none;position:absolute;inset:0;z-index:20;
 background:rgba(0,0,0,.35);align-items:flex-end}
#${APP_ID} .sheet.on{display:flex}
#${APP_ID} .sbox{width:100%;background:#fff;border-radius:16px 16px 0 0;overflow:hidden;
 padding-bottom:env(safe-area-inset-bottom)}
#${APP_ID} .sitem{display:block;width:100%;text-align:center;padding:17px 0;font-size:16px;
 border-bottom:1px solid #f0f0f2}
#${APP_ID} .sitem.del{color:#d1443c;font-weight:600}
#${APP_ID} .sitem:last-child{border-bottom:0}

/* 폼 */
#${APP_ID} .form{flex:1;overflow-y:auto;background:#f4f4f6;
 padding:16px 14px calc(env(safe-area-inset-bottom) + 40px)}
#${APP_ID} .grp{background:#fff;border-radius:14px;padding:2px 14px;margin-bottom:16px}
#${APP_ID} .f{padding:13px 0;border-bottom:1px solid #f0f0f2}
#${APP_ID} .f:last-child{border-bottom:0}
#${APP_ID} .f label{display:block;font-size:11px;color:#8a8a90;margin-bottom:6px}
#${APP_ID} .f input,#${APP_ID} .f select{width:100%;border:0;outline:0;
 font-size:16px;background:none;color:#111;-webkit-appearance:none}
#${APP_ID} .f select{appearance:none}
#${APP_ID} .f input[type=range]{margin-top:6px}
#${APP_ID} .f textarea{width:100%;border:0;outline:0;resize:vertical;font-size:15px;
 line-height:1.5;background:none;color:#111;font-family:inherit;min-height:70px}
#${APP_ID} .row{display:flex;align-items:center;justify-content:space-between;gap:12px}
#${APP_ID} .row b{font-size:15px;font-weight:500}
#${APP_ID} .sw{flex:0 0 auto;width:50px;height:30px;border-radius:15px;background:#e2e2e6;position:relative}
#${APP_ID} .sw.on{background:#34c759}
#${APP_ID} .sw::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;
 border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .15s}
#${APP_ID} .sw.on::after{left:23px}
#${APP_ID} .cap{font-size:11.5px;color:#8a8a90;padding:0 6px 16px;line-height:1.75;white-space:pre-line}
#${APP_ID} .act{display:block;width:100%;padding:15px 0;font-size:16px;color:#3b6fe0}
/* 불러올 언어 · 번역 · 불러오기 — 왼쪽 기준선을 하나로 맞춘다 */
#${APP_ID} .f.bare{border-bottom:none}
#${APP_ID} .row.tight{justify-content:flex-start;gap:10px}
#${APP_ID} .act.gap{margin-top:24px}
#${APP_ID} .act.warn{color:#d1443c}
#${APP_ID} .act em{float:right;font-style:normal;color:#8a8a90;font-weight:400}
#${APP_ID} .pickone{display:flex;align-items:center;justify-content:space-between;
 width:100%;font-size:16px;color:#111;padding:2px 0}
#${APP_ID} .pickone i{font-style:normal;color:#b8b8bf;font-size:19px}
#${APP_ID}[data-dark="1"] .pickone{color:#ececf0}
#${APP_ID} .seg{display:flex;gap:6px;padding:4px 0}
#${APP_ID} .seg button{flex:1;text-align:center;padding:11px 2px;border-radius:10px;
 background:#f0f0f3;font-size:14px;color:#666}
#${APP_ID} .seg button.on{background:#111;color:#fff;font-weight:600}

/* 프로필 사진 자르기 */
#${APP_ID} .crop{display:none;position:absolute;inset:0;z-index:30;background:#15151a;
 flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px}
#${APP_ID} .crop.on{display:flex}
#${APP_ID} .cframe{position:relative;width:268px;height:268px;border-radius:50%;
 overflow:hidden;background:#000;touch-action:none}
#${APP_ID} .cframe img{position:absolute;left:0;top:0;transform-origin:0 0;
 max-width:none;-webkit-user-drag:none;user-select:none}
#${APP_ID} .ctip{color:#b8b8c2;font-size:12.5px;text-align:center;line-height:1.7}
#${APP_ID} .crop input[type=range]{width:268px}
#${APP_ID} .crop textarea{width:100%;max-width:340px;min-height:170px;
 background:#22222a;border:1px solid #34343e;border-radius:14px;
 color:#ececf0;font-size:15.5px;line-height:1.6;padding:14px 15px;
 outline:0;resize:none;font-family:inherit}
#${APP_ID} .crow{display:flex;gap:10px;width:268px}
#${APP_ID} .crow button{flex:1;text-align:center;padding:13px 0;border-radius:12px;
 background:#2b2b33;color:#ececf0;font-size:15px}
#${APP_ID} .crow button.ok{background:#3b6fe0;color:#fff;font-weight:600}

#${APP_ID} .toast{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);
 background:rgba(20,20,25,.92);color:#fff;font-size:13px;padding:11px 16px;
 border-radius:16px;z-index:2147483601;max-width:84%;line-height:1.55;
 word-break:break-word;text-align:center}

/* 앱 화면 — 앱마다 배경이 다르다 */
#${APP_ID} .ap{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;
 padding:0 0 calc(env(safe-area-inset-bottom) + 40px)}
#${APP_ID} .ap[data-k=shop],#${APP_ID} .ap[data-k=music]{background:#fff}
#${APP_ID} .ap[data-k=pay],#${APP_ID} .ap[data-k=search]{background:#f2f2f7}
#${APP_ID}[data-dark="1"] .ap[data-k=shop],
#${APP_ID}[data-dark="1"] .ap[data-k=music]{background:#000}
#${APP_ID}[data-dark="1"] .ap[data-k=pay],
#${APP_ID}[data-dark="1"] .ap[data-k=search]{background:#000}
#${APP_ID} .ap .del{position:absolute;right:12px;top:10px;color:#d1443c;
 font-size:13px;padding:4px 7px;background:rgba(255,255,255,.9);border-radius:7px;z-index:3}
#${APP_ID}[data-dark="1"] .ap .del{background:rgba(30,30,36,.9)}

/* 쇼핑 — 여러 판매처 주문이 모인 통합 내역 */
#${APP_ID} .shead{padding:18px 18px 10px}
#${APP_ID} .shead h2{font-size:25px;font-weight:700;letter-spacing:-.03em}
#${APP_ID} .shead p{font-size:13px;color:#8a8a90;margin-top:5px}
#${APP_ID} .ord{position:relative;padding:16px 18px 18px;border-top:8px solid #f4f4f6}
#${APP_ID}[data-dark="1"] .ord{border-top-color:#141418}
#${APP_ID} .ord .sel{display:flex;align-items:center;justify-content:space-between;
 gap:10px;padding-bottom:12px}
#${APP_ID} .ord .sel b{font-size:14px;font-weight:600;letter-spacing:-.01em}
#${APP_ID} .ord .sel i{font-style:normal;font-size:12px;color:#a0a0a8}
#${APP_ID} .ord .st{font-size:16px;font-weight:700;margin-bottom:12px;letter-spacing:-.02em}
#${APP_ID} .ord .st em{font-style:normal;font-size:12.5px;font-weight:400;
 color:#8a8a90;margin-left:7px}
#${APP_ID} .ord .ob{display:flex;gap:13px;align-items:flex-start}
#${APP_ID} .ord .thumb{flex:0 0 auto;width:62px;height:62px;border-radius:7px;
 display:flex;align-items:center;justify-content:center;
 font-size:20px;font-weight:600;color:#fff}
#${APP_ID} .ord .oi{flex:1;min-width:0}
#${APP_ID} .ord .oi .nm{font-size:14px;line-height:1.5;margin-bottom:7px;
 display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* 번역 줄은 이름 칸 밖에 둔다. 이름이 두 줄이어도 잘리지 않는다 */
#${APP_ID} .ord .oi .nm.tight{margin-bottom:2px}
#${APP_ID} .ord .oi .trs{margin:0 0 7px}
#${APP_ID} .ord .oi .pr{font-size:15px;font-weight:700;letter-spacing:-.02em}
#${APP_ID} .ord .obtn{display:flex;gap:7px;margin-top:14px}
#${APP_ID} .ord .obtn span{flex:1;text-align:center;padding:10px 0;border-radius:6px;
 border:1px solid #dedee2;font-size:13px;font-weight:500;color:#3a3a42}
#${APP_ID}[data-dark="1"] .ord .obtn span{border-color:#33333c;color:#c8c8d0}

/* 정기결제 — iOS 구독 관리 탭 */
#${APP_ID} .phead{padding:22px 20px 2px}
#${APP_ID} .phead h2{font-size:27px;font-weight:700;letter-spacing:-.03em}
#${APP_ID} .grp2{background:#fff;border-radius:12px;margin:14px 16px 0;overflow:hidden}
#${APP_ID}[data-dark="1"] .grp2{background:#1c1c1e}
#${APP_ID} .gcap{font-size:12.5px;color:#8a8a90;padding:16px 20px 6px;
 text-transform:none;letter-spacing:-.01em}
#${APP_ID} .sub{position:relative;display:flex;align-items:center;gap:13px;
 padding:12px 14px;border-bottom:.5px solid #e3e3e8}
#${APP_ID}[data-dark="1"] .sub{border-bottom-color:#2c2c2e}
#${APP_ID} .grp2 .sub:last-child{border-bottom:0}
#${APP_ID} .sub .ico2{flex:0 0 auto;width:40px;height:40px;border-radius:9px;
 display:flex;align-items:center;justify-content:center;
 font-size:16px;font-weight:600;color:#fff}
#${APP_ID} .sub .si{flex:1;min-width:0}
#${APP_ID} .sub .si b{display:block;font-size:15.5px;font-weight:400;margin-bottom:3px;
 line-height:1.35;word-break:keep-all;
 display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#${APP_ID} .sub .si .trs{margin:0 0 3px}
#${APP_ID} .sub .si span{font-size:12.5px;color:#8a8a90}
#${APP_ID} .sub .sp{flex:0 0 auto;display:flex;align-items:center;gap:7px}
#${APP_ID} .sub .sp b{font-size:15px;font-weight:400;color:#8a8a90}
#${APP_ID} .sub .sp em{font-style:normal;color:#c4c4c8;font-size:17px}

/* 음악 — 애플뮤직 */
#${APP_ID} .mhead{padding:20px 20px 14px}
#${APP_ID} .mhead h2{font-size:30px;font-weight:700;letter-spacing:-.035em}
#${APP_ID} .mnow{position:relative;padding:6px 20px 22px;text-align:center}
#${APP_ID} .mnow .art{width:76%;max-width:250px;aspect-ratio:1;margin:0 auto 20px;
 border-radius:9px;display:flex;align-items:center;justify-content:center;
 color:#fff;font-size:58px;font-weight:600;
 box-shadow:0 12px 30px rgba(0,0,0,.22)}
#${APP_ID} .mnow b{display:block;font-size:19px;font-weight:600;letter-spacing:-.02em;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .mnow span{display:block;font-size:19px;color:#fa2d48;margin-top:2px;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .mnow .bar2{height:4px;border-radius:2px;background:#e2e2e6;
 margin:20px 0 6px;overflow:hidden}
#${APP_ID}[data-dark="1"] .mnow .bar2{background:#2c2c2e}
#${APP_ID} .mnow .bar2 i{display:block;height:100%;background:#9a9aa0}
#${APP_ID} .mnow .tt2{display:flex;justify-content:space-between;
 font-size:11px;color:#9a9aa0;font-variant-numeric:tabular-nums}
#${APP_ID} .mnow .ctl{display:flex;align-items:center;justify-content:center;
 gap:38px;margin-top:16px;color:inherit}
#${APP_ID} .mnow .ctl svg{width:26px;height:26px}
#${APP_ID} .mnow .ctl .pp2 svg{width:34px;height:34px}
#${APP_ID} .msec{font-size:21px;font-weight:700;letter-spacing:-.03em;padding:16px 20px 4px}
#${APP_ID} .trk{position:relative;display:flex;align-items:center;gap:12px;
 padding:9px 20px 9px 0;margin-left:20px;border-bottom:.5px solid #ececee}
#${APP_ID}[data-dark="1"] .trk{border-bottom-color:#232326}
#${APP_ID} .ap .trk:last-child{border-bottom:0}
#${APP_ID} .trk .art{flex:0 0 auto;width:48px;height:48px;border-radius:5px;
 display:flex;align-items:center;justify-content:center;color:#fff;
 font-size:18px;font-weight:600}
#${APP_ID} .trk .ti{flex:1;min-width:0}
#${APP_ID} .trk .ti b{display:block;font-size:15px;font-weight:400;margin-bottom:2px;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .trk .ti span{font-size:13px;color:#8a8a90;
 display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .trk .tw{flex:0 0 auto;font-size:11.5px;color:#a6a6ac}

/* 검색 — 사파리 방문 기록 */
#${APP_ID} .hhead{padding:22px 20px 4px}
#${APP_ID} .hhead h2{font-size:27px;font-weight:700;letter-spacing:-.03em}
#${APP_ID} .sech{font-size:13px;color:#8a8a90;font-weight:400;padding:18px 20px 7px}
#${APP_ID} .card{background:#fff;border-radius:12px;margin:0 16px;overflow:hidden}
#${APP_ID}[data-dark="1"] .card{background:#1c1c1e}
#${APP_ID} .hit{position:relative;display:flex;align-items:center;gap:12px;
 padding:11px 14px;border-bottom:.5px solid #e3e3e8}
#${APP_ID}[data-dark="1"] .hit{border-bottom-color:#2c2c2e}
#${APP_ID} .card .hit:last-child{border-bottom:0}
#${APP_ID} .hit .mag{flex:0 0 auto;width:30px;height:30px;padding:7px;border-radius:50%;
 background:#e4e4ea;color:#7a7a82}
#${APP_ID}[data-dark="1"] .hit .mag{background:#2c2c2e;color:#9a9aa0}
#${APP_ID} .hit .hq{flex:1;min-width:0;font-size:15px;line-height:1.4;
 word-break:keep-all}
#${APP_ID} .hit .hu{font-size:12px;color:#8a8a90;margin-top:2px;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${APP_ID} .hit .hw{flex:0 0 auto;font-size:11.5px;color:#a6a6ac}

/* 프로필 공통 */
#${APP_ID} .imav{background:linear-gradient(180deg,#adb6d4,#828fbe);color:#fff;
 display:flex;align-items:center;justify-content:center}
#${APP_ID}[data-dark="1"] .imav{background:linear-gradient(180deg,#4b4b57,#33333d);
 color:#cfcfd8}
#${APP_ID}[data-dark="1"] .stack .pp.lt{background:linear-gradient(180deg,#4b4b57,#33333d)}
#${APP_ID}[data-theme=imessage] .av,#${APP_ID}[data-theme=imessage] .m .mav{border-radius:50%}
#${APP_ID}[data-theme=line] .av,#${APP_ID}[data-theme=line] .m .mav{border-radius:50%}
#${APP_ID} .stack .pp{border-radius:34%;box-shadow:0 0 0 2px #fff}
#${APP_ID}[data-dark="1"] .stack .pp{box-shadow:0 0 0 2px #16161a}
#${APP_ID}[data-theme=imessage] .stack .pp,
#${APP_ID}[data-dark="1"][data-theme=imessage] .stack .pp{
 border-radius:50%;box-shadow:0 0 0 2px var(--plate)}
#${APP_ID} .hav .inner{width:100%;height:100%;border-radius:50%;overflow:hidden;
 display:flex;align-items:center;justify-content:center;
 background-size:cover;background-position:center;color:#fff;font-size:21px;font-weight:600}
#${APP_ID} .hav .stack.inner{border-radius:0;overflow:visible}

/* 라인 — 실제 앱에 가깝게 */
/* 카톡 · 라인만 조금 작게. 아이메시지는 건드리지 않는다 */
#${APP_ID}[data-theme=kakao] .m,
#${APP_ID}[data-theme=line] .m{gap:8px;margin-bottom:3px}
#${APP_ID}[data-theme=kakao] .m.first,
#${APP_ID}[data-theme=line] .m.first{margin-top:12px}
#${APP_ID}[data-theme=kakao] .m .mav,
#${APP_ID}[data-theme=line] .m .mav{width:35px;height:35px;font-size:14px}
#${APP_ID}[data-theme=kakao] .col,
#${APP_ID}[data-theme=line] .col{max-width:72%}
#${APP_ID}[data-theme=kakao] .bub,
#${APP_ID}[data-theme=line] .bub{padding:8px 11px;line-height:1.45}
#${APP_ID}[data-theme=kakao] .who,
#${APP_ID}[data-theme=line] .who{margin:0 0 3px 2px}
#${APP_ID}[data-theme=line] .tm{font-size:11px;padding-bottom:3px}
#${APP_ID}[data-theme=line] .chat[data-dm="1"] .who{display:none}
`;
  document.head.appendChild(style);

  /* ── 아이콘 ────────────────────────────────────────────────────────── */
  const IC = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l-8 8 8 8"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16.2 16.2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3.5 7h17M3.5 12h17M3.5 17h17"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 12l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v13M6 12l6 6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 5.5v13a1 1 0 0 1-1.6.8L8 13.3V18a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v4.7l8.4-6a1 1 0 0 1 1.6.8z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.87l13-7.5a1 1 0 0 0 0-1.74l-13-7.5A1 1 0 0 0 7 4.5z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5.5v13a1 1 0 0 0 1.6.8L16 13.3V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.7l-8.4-6A1 1 0 0 0 6 5.5z"/></svg>',
    plane: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 11.6 21.2 3.2c.6-.3 1.2.3.9.9L13.7 22c-.3.6-1.1.5-1.3-.1l-2.1-6.6-6.6-2.1c-.6-.2-.7-1-.1-1.3z"/></svg>'
  };

  /* ── 마크업 ────────────────────────────────────────────────────────── */
  const root = document.createElement('div');
  root.id = APP_ID;
  root.setAttribute('data-theme', S.theme);
  root.setAttribute('data-dark', S.dark ? '1' : '0');
  root.innerHTML = `
<div class="v on" data-v="home">
  <div class="nav">
    <button class="ic" data-a="quit">✕</button>
    <div class="tt"><b>핸드폰</b><span id="h-sub"></span></div>
    <button class="ic" data-a="settings">⚙</button>
  </div>
  <div class="picks">
    <button class="pick" data-phone="mine">
      <div class="emo">📱</div>
      <div class="tx2"><b>내 폰</b><span id="p-mine"></span></div>
      <div class="arw">›</div>
    </button>
    <button class="pick" data-phone="char">
      <div class="emo">📱</div>
      <div class="tx2"><b id="p-char-t">캐릭터 폰</b><span id="p-char"></span></div>
      <div class="arw">›</div>
    </button>
    <button class="pick" data-phone="mob">
      <div class="emo">🔍</div>
      <div class="tx2"><b>모브 대화</b><span id="p-mob"></span></div>
      <span class="fetch" id="f-mob" data-a="fetchMob">불러오기</span>
      <div class="arw">›</div>
    </button>
    <button class="pick" data-a="pickav">
      <div class="emo" id="h-av">🙂</div>
      <div class="tx2"><b>내 프로필 사진</b><span id="h-av-t">고르기</span></div>
      <div class="arw">›</div>
    </button>
    <button class="pick" data-a="pickcav">
      <div class="emo" id="h-cav">🙂</div>
      <div class="tx2"><b id="h-cav-b">캐릭터 프로필 사진</b><span id="h-cav-t">고르기</span></div>
      <div class="arw">›</div>
    </button>
    <div class="turns">
      <label>읽어올 대화 턴 · <span id="h-tn"></span></label>
      <input type="range" id="h-turns" min="4" max="80" step="1">
    </div>
  </div>
</div>

<div class="crop" id="cropbox">
  <div class="ctip">끌어서 위치를 맞추고<br>슬라이더로 크기를 조절하세요</div>
  <div class="cframe" id="c-frame"><img id="c-cimg" alt=""></div>
  <input type="range" id="c-zoom" min="1" max="3" step="0.01" value="1">
  <div class="crow">
    <button data-a="ccancel">취소</button>
    <button class="ok" data-a="cok">사용하기</button>
  </div>
</div>

<div class="v" data-v="apps">
  <div class="nav">
    <button class="ic" data-a="appsback">‹</button>
    <div class="tt"><b id="ap-title"></b></div>
    <button class="ic" data-a="appset">⚙</button>
  </div>
  <div class="picks" id="ap-body"></div>
  <div class="sheet" id="ap-sheet">
    <div class="sbox">
      <button class="sitem" data-getk="shop">주문내역</button>
      <button class="sitem" data-getk="pay">결제내역</button>
      <button class="sitem" data-getk="music">음악 재생 기록</button>
      <button class="sitem" data-getk="search">인터넷 검색 기록</button>
      <button class="sitem" data-getk="msg">메신저 채팅방</button>
      <button class="sitem" data-a="apcancel">취소</button>
    </div>
  </div>
</div>

<div class="v" data-v="appset">
  <div class="nav">
    <button class="ic" data-a="apps">‹</button>
    <div class="tt"><b>불러올 개수</b></div>
    <button class="tx" data-a="apps">완료</button>
  </div>
  <div class="form">
    <div class="grp">
      <div class="f"><label>쇼핑 · 한 번에 불러올 건수</label>
        <input type="text" id="s-nshop" inputmode="numeric"></div>
      <div class="f"><label>결제 · 한 번에 불러올 건수</label>
        <input type="text" id="s-npay" inputmode="numeric"></div>
      <div class="f"><label>음악 · 한 번에 불러올 곡수</label>
        <input type="text" id="s-nmusic" inputmode="numeric"></div>
      <div class="f"><label>검색 기록 · 한 번에 불러올 개수</label>
        <input type="text" id="s-nsearch" inputmode="numeric"></div>
      <div class="f"><label>메신저 · 한 번에 만들 채팅방 수</label>
        <input type="text" id="s-nroom" inputmode="numeric"></div>
    </div>
  </div>
</div>

<div class="v" data-v="cal">
  <div class="nav">
    <button class="ic" data-a="apps">‹</button>
    <div class="tt"><b>캘린더</b></div>
    <button class="tx" style="visibility:hidden">·</button>
  </div>
  <div class="form" id="cal-body"></div>
</div>

<div class="v" data-v="qna">
  <div class="nav">
    <button class="ic" data-a="apps">‹</button>
    <div class="tt"><b>하루문답</b><span id="q-sub"></span></div>
    <button class="tx" data-a="qedit" id="q-edit">편집</button>
  </div>
  <div class="form" id="q-body"></div>
</div>

<div class="v" data-v="app">
  <div class="nav">
    <button class="ic" data-a="apps">‹</button>
    <div class="tt"><b id="ad-title"></b></div>
    <button class="tx" data-a="editapp" id="ad-edit">편집</button>
    <button class="tx" id="ad-more" data-a="appmore">불러오기</button>
  </div>
  <div class="ap" id="ad-list"></div>
</div>

<div class="v" data-v="list">
  <div class="nav">
    <button class="ic" data-a="listback">‹</button>
    <div class="tt"><b id="l-title"></b><span id="l-sub"></span></div>
    <button class="tx" data-a="edit">편집</button>
    <button class="ic" data-a="new">＋</button>
  </div>
  <div class="list" id="l-list"></div>
</div>

<div class="v chat" data-v="chat">
  <div class="nav">
    <button class="ico" data-a="back">${IC.back}</button>
    <div class="tt"><div class="hav" id="c-hav"></div><b id="c-title"></b><span id="c-sub"></span></div>
    <div class="gap"></div>
    <button class="ico" data-a="find">${IC.search}</button>
    <button class="ico" data-a="roomset">${IC.menu}</button>
  </div>
  <div class="find" id="c-find">
    <input type="text" id="c-q" placeholder="대화 내용 검색">
    <span class="fcnt" id="c-fcnt"></span>
    <button class="fb" data-a="fprev">${IC.up}</button>
    <button class="fb" data-a="fnext">${IC.down}</button>
    <button class="fb" data-a="fclose">${IC.close}</button>
  </div>
  <div class="status" id="c-status"></div>
  <div class="log" id="c-log"></div>
  <div class="tray" id="c-tray"></div>
  <div class="bar">
    <button class="pl" id="c-pic">${IC.plus}</button>
    <div class="field"><textarea id="c-in" rows="1" placeholder="메시지 입력"></textarea></div>
    <button class="snd" id="c-send" data-a="send">${IC.up}</button>
  </div>
  <div class="sheet" id="c-sheet">
    <div class="sbox">
      <button class="sitem" data-a="editone">수정하기</button>
      <button class="sitem" id="s-merge" data-a="mergeone">아래 말풍선과 합치기</button>
      <button class="sitem" data-a="copyone">복사하기</button>
      <button class="sitem del" data-a="delone">이 메시지 삭제</button>
      <button class="sitem" data-a="scancel">취소</button>
    </div>
  </div>
</div>

<div class="crop" id="editbox">
  <div class="ctip">말풍선 내용을 고칩니다</div>
  <textarea id="e-in" rows="6"></textarea>
  <div class="crow">
    <button data-a="ecancel">취소</button>
    <button class="ok" data-a="eok">저장</button>
  </div>
</div>

<div class="v" data-v="new">
  <div class="nav">
    <button class="ic" data-a="back">‹</button>
    <div class="tt"><b>새 채팅방</b></div>
    <button class="tx" data-a="create">만들기</button>
  </div>
  <div class="form" id="n-form"></div>
</div>

<div class="v" data-v="roomset">
  <div class="nav">
    <button class="ic" data-a="back">‹</button>
    <div class="tt"><b>방 설정</b></div>
    <button class="tx" data-a="back">완료</button>
  </div>
  <div class="form" id="rs-form"></div>
</div>

<div class="noti" id="c-noti" data-a="noti"></div>

<div class="sheet" id="lang-sheet">
  <div class="sbox">
    <button class="sitem" data-pl="ko">한국어</button>
    <button class="sitem" data-pl="ja">일본어</button>
    <button class="sitem" data-pl="en">영어</button>
    <button class="sitem" data-pl="zh">중국어</button>
    <button class="sitem" data-pl="">취소</button>
  </div>
</div>

<div class="v" data-v="settings">
  <div class="nav">
    <button class="ic" data-a="home">‹</button>
    <div class="tt"><b>설정</b></div>
    <button class="tx" data-a="home">완료</button>
  </div>
  <div class="form">
    <div class="grp">
      <div class="f"><label>테마</label>
        <div class="seg" id="s-theme">
          <button data-th="kakao">카톡</button>
          <button data-th="line">라인</button>
          <button data-th="imessage">아이메시지</button>
        </div></div>
      <div class="f"><label>화면</label>
        <div class="seg" id="s-dark">
          <button data-dk="0">라이트</button><button data-dk="1">다크</button>
        </div></div>
      <div class="f"><label>글자 크기 · <span id="s-fpx"></span></label>
        <input type="range" id="s-fs" min="11" max="24" step="0.5"></div>
    </div>



    <div class="grp">
      <div class="f"><label>API 종류</label>
        <select id="s-prov">
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
          <option value="claude">Claude</option>
          <option value="custom">직접 입력 · OpenAI 호환</option>
        </select></div>
      <div class="f" id="s-url-f"><label>API URL</label>
        <input type="text" id="s-url" placeholder="https://example.com/v1"></div>
      <div class="f"><label>API Key</label>
        <input type="password" id="s-key" placeholder="키 붙여넣기"></div>
      <div class="f"><label>모델</label><input type="text" id="s-model"></div>
      <div class="f"><label>맥스 토큰</label>
        <input type="text" id="s-max" inputmode="numeric"></div>
    </div>
    <div class="cap">추천 모델 · gemini flash</div>

    <div class="grp">
      <button class="act" data-a="scan">저장된 API 프로필 찾기</button>
      <button class="act" data-a="test">연결 테스트</button>
    </div>
    <div class="cap" id="s-test">다른 도구가 저장해 둔 설정을 찾아서 그대로 씁니다.</div>

    <div class="grp">
      <div class="f"><label>내 이름</label>
        <input type="text" id="s-persona" placeholder="비워두면 '나'로 표시됩니다"></div>
      <div class="f"><div class="row"><b id="s-img-t">사진을 보여주기</b>
        <button class="sw" id="s-img"></button></div></div>
    </div>
    <div class="cap">사진을 실제로 전송하면 답이 정확해지지만 요청이 커집니다.
꺼두면 사진을 보냈다는 사실만 전달됩니다.</div>

    <div class="grp">
      <button class="act" data-a="learn">말풍선 직접 지정하기</button>
      <button class="act warn" data-a="unlearn">인식 초기화</button>
    </div>
    <div class="cap" id="s-detect"></div>
  </div>
</div>`;
  const back = document.createElement('div');
  back.id = 'zetatalk-v1-back';
  document.body.appendChild(back);
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);

  function syncBack() {
    let c = S.dark ? '#16161a' : '#fff';
    if (view === 'chat') {
      const chat = root.querySelector('.chat');
      if (chat) {
        const bg = getComputedStyle(chat).getPropertyValue('--bg').trim();
        if (bg) c = bg;
      }
    }
    back.className = '';
    back.style.background = c;
  }

  /* ── 유틸 ──────────────────────────────────────────────────────────── */
  const esc = s => String(s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rxEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const PAL = ['#7d9bb8', '#b08a7e', '#8a9a7b', '#a08bb5', '#c19a5e', '#6f8f8f', '#9b7f8c', '#7f8aa8'];
  const hashOf = n => {
    let h = 0; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
  };
  const colorOf = n => PAL[hashOf(n) % PAL.length];
  const initial = n => (String(n).trim()[0] || '?');
  // 받침에 따라 조사를 고른다
  function josa(word, pair) {
    const w = String(word || '').trim();
    const [withT, noT] = pair.split('/');
    if (!w) return noT;
    const c = w.charCodeAt(w.length - 1);
    if (c >= 0xac00 && c <= 0xd7a3) return ((c - 0xac00) % 28) ? withT : noT;
    if (/[013678lmnrLMNR]$/.test(w)) return withT;
    return noT;
  }
  const withJosa = (w, pair) => String(w) + josa(w, pair);
  const pad = n => String(n).padStart(2, '0');
  // 방에서 정한 언어에 맞춰 날짜와 시각을 적는다
  const WD_L = {
    '': ['일', '월', '화', '수', '목', '금', '토'],
    ja: ['日', '月', '火', '水', '木', '金', '土'],
    zh: ['日', '一', '二', '三', '四', '五', '六'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  };
  const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const wdOf = (ts, lg) => (WD_L[lg] || WD_L[''])[new Date(ts).getDay()];
  // 요일을 부르는 온전한 말. 한국어 "목요일"에 해당한다
  const wdFull = (ts, lg) => {
    const w = wdOf(ts, lg);
    if (lg === 'ja') return w + '曜日';
    if (lg === 'zh') return '星期' + w;
    if (lg === 'en') return ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday'][new Date(ts).getDay()];
    return w + '요일';
  };
  // 월일만 짧게
  const mdOf = (ts, lg) => {
    const d = new Date(ts), mo = d.getMonth() + 1, da = d.getDate();
    if (lg === 'ja' || lg === 'zh') return `${mo}月${da}日`;
    if (lg === 'en') return `${MON_EN[d.getMonth()]} ${da}`;
    return `${mo}월 ${da}일`;
  };
  const fmtTime = (ts, lg) => {
    const d = new Date(ts), h = d.getHours();
    const hh = (h % 12 || 12) + ':' + pad(d.getMinutes());
    if (lg === 'en') return hh + (h < 12 ? ' AM' : ' PM');
    if (lg === 'ja') return (h < 12 ? '午前 ' : '午後 ') + hh;
    if (lg === 'zh') return (h < 12 ? '上午 ' : '下午 ') + hh;
    return (h < 12 ? '오전 ' : '오후 ') + hh;
  };
  const WD = '일월화수목금토';
  const dayStart = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
  // 날짜가 같은지 가르는 열쇠
  const fmtDay = ts => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  // 화면에 띄우는 날짜 줄. 테마마다 생김새가 다르다
  // base 는 이 방에서 가장 마지막 메시지가 있는 날. 그 날이 이 방의 "오늘"이다
  const TODAY_W = {
    '': ['오늘', '어제', '그저께'],
    ja: ['今日', '昨日', '一昨日'],
    zh: ['今天', '昨天', '前天'],
    en: ['Today', 'Yesterday', 'Two days ago']
  };
  function dayLabel(ts, base, lg) {
    const d = new Date(ts), w = wdOf(ts, lg);
    const y = d.getFullYear(), mo = d.getMonth() + 1, da = d.getDate();
    const sameYear = new Date(base).getFullYear() === y;

    if (S.theme === 'kakao') {
      if (lg === 'ja' || lg === 'zh') return `${y}年${mo}月${da}日 ${wdFull(ts, lg)}`;
      if (lg === 'en') return `${wdFull(ts, lg)}, ${MON_EN[d.getMonth()]} ${da}, ${y}`;
      return `${y}년 ${mo}월 ${da}일 ${w}요일`;
    }

    if (S.theme === 'line') {
      if (lg === 'en') return sameYear
        ? `${MON_EN[d.getMonth()]} ${da} (${w})`
        : `${MON_EN[d.getMonth()]} ${da}, ${y} (${w})`;
      return sameYear ? `${mo}. ${da}. (${w})` : `${y}. ${mo}. ${da}. (${w})`;
    }

    // 아이메시지 — 가까울수록 말로, 멀수록 날짜로. 시각까지 함께 적는다
    const diff = Math.round((dayStart(base) - dayStart(ts)) / 86400e3);
    const near = TODAY_W[lg] || TODAY_W[''];
    // 엿새 안쪽이면 말로, 그 밖이면 날짜로 적는다
    let head;
    if (diff <= 0) head = `(${near[0]})`;
    else if (diff === 1) head = `(${near[1]})`;
    else if (diff === 2) head = `(${near[2]})`;
    else if (diff <= 6) head = `(${wdFull(ts, lg)})`;
    else if (lg === 'ja' || lg === 'zh') {
      head = (sameYear ? '' : y + '年') + `${mo}月${da}日 (${w})`;
    } else if (lg === 'en') {
      head = `${MON_EN[d.getMonth()]} ${da}` + (sameYear ? '' : ', ' + y) + ` (${w})`;
    } else {
      head = (sameYear ? '' : y + '년 ') + `${mo}월 ${da}일 (${w})`;
    }
    return `<b>${head}</b><span>${fmtTime(ts, lg)}</span>`;
  }

  // 아이메시지는 같은 날이라도 한참 지나면 줄을 새로 찍는다
  const IMSG_GAP = 60 * 60 * 1000;
  const fmtShort = (ts, lg) => {
    const d = new Date(ts), n = new Date();
    if (d.toDateString() === n.toDateString()) return fmtTime(ts, lg);
    return mdOf(ts, lg);
  };
  const forInput = ts => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // 검색어를 노랗게 칠한다
  function mark(text, q) {
    const e = esc(text);
    if (!q) return e;
    try {
      return e.replace(new RegExp(rxEsc(esc(q)), 'gi'), m => '<mark>' + m + '</mark>');
    } catch (err) { return e; }
  }

  // peek 이 참이면 값을 읽어만 보고 예약은 지우지 않는다
  function nextTime(room, peek) {
    if (room.nextTs) {
      const t = room.nextTs;
      if (!peek) room.nextTs = 0;
      return t;
    }
    const last = room.feed[room.feed.length - 1];
    let base = last ? last.ts : (room.startTs || Date.now());
    if (last) base += (60 + Math.floor(Math.random() * 150)) * 1000;
    return base;
  }

  const fmtStamp = ts => {
    const d = new Date(ts);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ` +
      `${WD[d.getDay()]}요일 ${fmtTime(ts)}`;
  };

  /* ── 프로필 ────────────────────────────────────────────────────────── */
  // 모브가 사진 대신 쓰는 색
  const mix = n => {
    let h = 2166136261;
    for (const c of String(n)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
    return h >>> 0;
  };
  // 이름에서 읽히는 결에 따라 색을 고른다
  const TONE = {
    warm:  ['#e8b48a', '#e5a58f', '#dfc08c', '#d9a798'],
    soft:  ['#e3b9c6', '#d5b8dd', '#c9b6e0', '#e0b5c9'],
    cool:  ['#8fa9bf', '#7f96b8', '#93b3c9', '#8fb0b8'],
    deep:  ['#6f7f96', '#7a7386', '#6d8288', '#80798e'],
    fresh: ['#a8c4a0', '#9ac4b4', '#b3c99a', '#8fc2b0'],
    dusty: ['#c0a894', '#b99b93', '#c4ab9e', '#ad9a8e']
  };
  const TONE_HINT = [
    [/엄마|어머니|아빠|아버지|누나|언니|형$|오빠|동생|가족|할머니|할아버지|이모|삼촌|고모|조카|처남|장모|사촌/, 'warm'],
    [/의사|병원|약사|한의원|치과|클리닉|원장|간호|수의사|상담|센터|선생|교수|학원|과외|코치|트레이너|박사/, 'fresh'],
    [/변호사|검사|판사|회계|세무|은행|대표|사장|실장|팀장|부장|과장|대리|비서|기자|피디|매니저|감독|주임|점장|기사|비행|승무/, 'cool'],
    [/형님|보스|회장|두목|조직|해결사|흥신소|사채|채권|스승|사부|주인|집사|경호|영감|어르신/, 'deep'],
    [/친구|동기|선배|후배|절친|짝꿍|동아리|모임|팀$|방$|스터디|알바/, 'soft'],
    [/할멈|옛|전남|전여|고향|동네|이웃|주인집|사장님댁/, 'dusty']
  ];
  function toneOf(name) {
    const n = String(name || '');
    for (const [rx, key] of TONE_HINT) if (rx.test(n)) return key;
    const keys = Object.keys(TONE);
    return keys[mix(n + '#') % keys.length];
  }
  function paletteOf(n) {
    const set = TONE[toneOf(n)];
    return set[mix(n + '@') % set.length];
  }
  // 사람마다 실루엣형과 색배경형 중 하나로 고정된다
  const silShape = n => mix(n + '~') % 2 === 0;

  // 카톡 — 민트 배경에 꽉 찬 실루엣
  const KAKAO_SIL = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" class="pv">
    <rect width="40" height="40" fill="#a5c2dd"/>
    <circle cx="20" cy="15.4" r="6.6" fill="#cfdcea"/>
    <path d="M20 23.8c-6.3 0-11.4 4.2-11.4 9.4V40h22.8v-6.8c0-5.2-5.1-9.4-11.4-9.4z" fill="#cfdcea"/>
  </svg>`;
  // 라인 — 라벤더 배경에 흰 선으로 그린 실루엣
  const LINE_SIL = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" class="pv">
    <rect width="40" height="40" fill="#dcdcdc"/>
    <circle cx="20" cy="14.6" r="6.2" fill="#f0f0f0"/>
    <path d="M20 22.4c-6.1 0-11 4.4-11 9.9V40h22v-7.7c0-5.5-4.9-9.9-11-9.9z" fill="#f0f0f0"/>
  </svg>`;

  // 그 방의 주인 — 오른쪽 말풍선을 쓰는 사람
  function hostOf(room) {
    if (room.phone === 'mine') return me();
    if (room.phone === 'char') return room.owner || mainChar();
    return room.rightName || '';
  }
  function hostNames(room) {
    if (room.phone === 'mine') return [me(), '나', S.persona, room.userLabel].filter(Boolean);
    if (room.phone === 'char') return [room.owner || mainChar(), room.ownerLabel].filter(Boolean);
    return [room.rightName].filter(Boolean);
  }

  // 이름이 그 나라 말로 바뀌어 와도 같은 사람인지 알아본다
  // 첫 응답에서 정해진 이름을 방에 적어 두고 그 뒤로는 그것과 견준다
  function sameName(a, b) {
    const x = String(a || '').replace(/\s+/g, '').toLowerCase();
    const y = String(b || '').replace(/\s+/g, '').toLowerCase();
    if (!x || !y) return false;
    return x === y;
  }
  // 방에서 오른쪽에 설 사람을 정한다
  // 저장해 둔 이름이 실제로 오는 이름과 하나도 안 맞으면 다시 잡는다
  function fixRight(room, names) {
    if (!names.length) return;
    if (room.rightName && names.some(n => sameName(n, room.rightName))) return;
    if (room.phone === 'char') {
      // 캐릭터 폰은 오직 캐릭터만 오른쪽에 선다
      // 캐릭터로 알려진 이름과 맞춰 보고, 맞으면 그 표기를 그대로 쓴다
      const own = [room.owner, room.ownerLabel, room.charLabel, mainChar()].filter(Boolean);
      const hit = names.find(n => own.some(o => sameName(n, o)));
      // 이번에 캐릭터가 한 마디도 안 했더라도 자리를 넘기지 않는다.
      // 말수로 고르면 모브가 그 자리를 차지해 버린다
      room.rightName = hit || own[0] || room.rightName || '';
    } else if (room.phone === 'mob') {
      room.rightName = names[0] || '';
    }
  }

  // 유저·캐릭터를 뺀 나머지가 모두 모브다
  const GENERIC_USER = /^(나|저|user|유저|사용자|me|나야)$/i;
  function isUserName(room, name) {
    const n = String(name || '').trim();
    if (!n) return false;
    if (GENERIC_USER.test(n)) return true;
    if (n === me() || (S.persona && n === S.persona)) return true;
    return !!(room && room.userLabel && n === room.userLabel);
  }
  function roleOf(room, name) {
    const n = String(name || '').trim();
    if (!n) return 'mob';
    if (isUserName(room, n)) return 'user';
    if (n === mainChar() || (room.owner && n === room.owner) ||
        (room.ownerLabel && n === room.ownerLabel) ||
        (room.charLabel && n === room.charLabel)) return 'char';
    // 캐릭터와의 개인방은 방 이름이 곧 그 캐릭터다
    if (room.isOwner && room.type !== 'group' && n === room.name) return 'char';
    return 'mob';
  }
  function picOf(room, name) {
    const r = roleOf(room, name);
    // 유저 사진은 홈에서 직접 넣은 것만 쓴다. 화면에서 찾아내지 않는다
    if (r === 'user') return S.myAvatar || '';
    if (r === 'char') {
      const byName = picByName(name);
      if (byName) return byName;
      if (charAv) return charAv;
      // 캐릭터 본인의 방이면 저장명으로 바뀌어 있어도 그 사람 사진을 쓴다
      const own = room.owner || mainChar();
      if (room.isOwner || name === own || name === mainChar() ||
          (room.ownerLabel && name === room.ownerLabel) ||
          (room.charLabel && name === room.charLabel)) {
        return picByName(own) || room.avatar || charPic() || '';
      }
      return '';
    }
    // 모브라도 제타에 실제로 있는 인물이면 그 프사를 쓴다
    return picByName(name);
  }

  // 한 사람의 프로필 한 칸
  function faceHTML(room, name, cls, extra) {
    const ex = extra || '';
    const pic = picOf(room, name);
    if (pic) return `<div class="${cls}" style="${ex}background-image:url('${esc(pic)}')"></div>`;
    if (S.theme === 'imessage') return `<div class="${cls} imav" style="${ex}">${esc(initial(name))}</div>`;
    if (roleOf(room, name) !== 'char') {
      // 사진이 없는 사람은 모브와 같은 규칙을 따른다
      if (!silShape(name)) return `<div class="${cls}" style="${ex}background:${paletteOf(name)}"></div>`;
      return `<div class="${cls} person" style="${ex}">${S.theme === 'line' ? LINE_SIL : KAKAO_SIL}</div>`;
    }
    return `<div class="${cls}" style="${ex}background:${colorOf(name)}">${esc(initial(name))}</div>`;
  }

  // 이 방의 참여자 — 방 주인만 뺀다
  function membersOf(room) {
    const bad = new Set(hostNames(room));
    const out = [];
    const push = x => {
      x = String(x || '').trim();
      if (x && !bad.has(x) && out.indexOf(x) < 0) out.push(x);
    };
    if (room.owner && room.phone !== 'char') push(room.owner);
    (room.cast || []).forEach(push);
    room.feed.forEach(m => push(m.name));
    return out;
  }

  // 방 주인까지 더한 인원
  function memberCount(room) {
    let n = membersOf(room).length;
    if (room.type === 'group') n = Math.max(n, (Number(room.size) || 0) - 1);
    return n + 1;
  }
  const countHTML = room => {
    const n = room.type === 'group' ? memberCount(room) : 0;
    if (n < 2) return '';
    return S.theme === 'line' ? ` (${n})` : `<span class="cnt">${n}</span>`;
  };

  // 겹쳐 놓은 프로필
  const STACK_KAKAO = {
    2: [[0, 1, 54], [42, 41, 58]],
    3: [[26, 0, 48], [0, 50, 48], [50, 50, 48]],
    4: [[0, 0, 48], [52, 0, 48], [0, 52, 48], [52, 52, 48]]
  };
  // 아이메시지 — 뒤에 깔린 판 안에 들어가는 자리. 실제 앱 배치에 맞춰 잡았다
  const STACK_IMSG = {
    2: [[8.5, 8.5, 55], [53.7, 53.7, 33]],
    3: [[10.5, 10.5, 47], [57.6, 35.4, 36], [27.5, 60.7, 34]]
  };
  function stackHTML(room, cls) {
    const imsg = S.theme === 'imessage';
    const names = membersOf(room).slice(0, imsg ? 3 : 4);
    if (names.length < 2) return '';
    const spots = (imsg ? STACK_IMSG : STACK_KAKAO)[names.length];
    if (!spots) return '';
    return `<div class="${cls} stack">` + names.map((nm, i) => {
      const [l, t, w] = spots[i];
      const box = `position:absolute;left:${l}%;top:${t}%;width:${w}%;height:${w}%;` +
        `font-size:${w > 50 ? 15 : (w > 34 ? 12 : 10)}px;`;
      return faceHTML(room, nm, 'pp', box);
    }).join('') + `</div>`;
  }

  // 목록과 헤더에 쓰는 방 아이콘
  function avatarHTML(room, cls) {
    if (room.type === 'group') {
      if (S.theme === 'line') {
        return `<div class="${cls}" style="background:${paletteOf(room.name)}"></div>`;
      }
      const st = stackHTML(room, cls);
      if (st) return st;
    }
    if (room.type !== 'group') return faceHTML(room, room.name, cls);
    const other = membersOf(room)[0] || (room.cast || [])[0] || room.name;
    return faceHTML(room, other, cls);
  }

  const msgAvatar = (room, name) => faceHTML(room, name, 'mav');

  /* ── 상태 ──────────────────────────────────────────────────────────── */
  let view = 'home', phone = 'mine', current = null;
  let editing = false, busy = false;
  let statusText = '', statusKind = '', sysLog = [], pending = [];
  let fetchBusy = '', appKind = 'shop', appErr = '';
  let newType = 'dm', newSize = '', newInc = false;
  let labelDraft = '', labelCall = '', labelBusy = false;
  let finding = false, findQ = '', findHits = [], findAt = -1;
  let sheetIdx = -1, held = [];
  let langTarget = '', newLang = '', newDateLang = 'ko';

  const PHONE_NAME = { mine: '내 폰', char: '캐릭터 폰', mob: '모브 대화' };
  const inPhone = p => rooms.filter(r => r.phone === p);
  const readSize = () => {
    const el = $('#n-num');
    const raw = el ? el.value : newSize;
    const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    return Math.max(2, Math.min(10, n || 3));
  };

  function go(v) {
    if (v !== 'qna') { try { hideNoti(); } catch (e) {} }
    view = v;
    root.querySelectorAll('.v').forEach(el => el.classList.toggle('on', el.dataset.v === v));
    syncBack();
    if (v === 'home') renderHome();
    if (v === 'apps') renderApps();
    if (v === 'appset') renderAppSet();
    if (v === 'app') renderApp();
    if (v === 'qna') renderQna();
    if (v === 'cal') renderCal();
    if (v === 'list') renderList();
    if (v === 'chat') renderChat();
    if (v === 'new') renderNew();
    if (v === 'roomset') renderRoomSet();
    if (v === 'settings') renderSettings();
  }

  /* ── 홈 ────────────────────────────────────────────────────────────── */
  function renderHome() {
    const n = extract().length;
    const who = mainChar();
    $('#h-sub').textContent = n
      ? `${who} 방 · ${n}턴 · 내 이름 ${me()}`
      : '대화를 인식하지 못했습니다 · ⚙ 에서 지정';
    $('#p-char-t').textContent = who + ' 폰';
    const c = p => inPhone(p).length;
    $('#p-mine').textContent = '';
    $('#p-char').textContent = '';
    $('#p-mob').textContent = c('mob') ? `주변 인물들끼리 · ${c('mob')}` : '주변 인물들끼리';
    const hav = $('#h-av');
    hav.style.backgroundImage = S.myAvatar ? `url('${S.myAvatar}')` : '';
    hav.textContent = S.myAvatar ? '' : '🙂';
    $('#h-av-t').textContent = S.myAvatar ? '설정됨 · 다시 누르면 지웁니다' : '고르기';
    const cav = $('#h-cav');
    const cpic = charAv || charAvatar();
    cav.style.backgroundImage = cpic ? `url('${cpic}')` : '';
    cav.textContent = cpic ? '' : '🙂';
    $('#h-cav-b').textContent = who + ' 프로필 사진';
    $('#h-cav-t').textContent = charAv ? '바꿈 · 다시 누르면 되돌립니다' : '고르기';
    $('#h-turns').value = S.turns;
    $('#h-tn').textContent = n ? `${Math.min(S.turns, n)}턴 (원본 ${n}턴)` : S.turns + '턴';

    const fm = $('#f-mob');
    fm.style.display = 'none';
  }

  /* ── 캐릭터 폰 앱 ──────────────────────────────────────────────────── */
  const APP_ICON = { shop: '📦', pay: '💳', music: '🎧', search: '🌐',
                     msg: '💬', tarot: '🔮', qna: '💌', cal: '📅' };
  const APP_BG = { shop: '#ffe6d4', pay: '#dde3ff', music: '#ffd9de',
                   search: '#d6ecff', msg: '#fdf1b8', tarot: '#e2d8fb',
                   qna: '#ffdfe8', cal: '#d9f2e4' };
  const APP_NAME = { shop: '주문내역', pay: '결제내역', music: '음악',
                     search: '검색 기록', msg: '메신저', tarot: '타로',
                     qna: '하루문답', cal: '캘린더' };
  const CHAR_APPS = ['msg', 'shop', 'pay', 'music', 'search'];
  const MINE_APPS = ['msg', 'cal', 'tarot', 'qna'];

  function renderApps() {
    const who = mainChar();
    const mine = phone === 'mine';
    $('#ap-title').textContent = mine ? '내 폰' : who + ' 폰';
    $('[data-a="appset"]').style.display = mine ? 'none' : '';
    const cell = k => `<button class="icn" data-app="${k}">
        <span class="ibx" style="background:${APP_BG[k]}">${APP_ICON[k]}</span>
        <em>${esc(APP_NAME[k])}</em>
      </button>`;
    const list = mine ? MINE_APPS : CHAR_APPS;
    $('#ap-body').innerHTML =
      `<div class="grid">` + list.map(cell).join('') + `</div>` +
      (mine ? '' :
      langBox(fetchBusy
        ? (APP_NAME[fetchBusy] || '') + ' 불러오는 중…' : '불러오기', 'fetchpick') +
      (appErr ? `<div class="cap">불러오지 못했습니다\n${esc(appErr)}</div>` : ''));
  }

  // 불러올 언어 · 번역 · 불러오기를 한 묶음으로
  function langBox(btnText, btnAct) {
    return `<div class="grp">
      <button class="act" data-a="pickAppLang">불러올 언어</button>
      <div class="f bare"><div class="row tight"><b>번역</b>
        <button class="sw${S.trans ? ' on' : ''}" data-a="trans"></button>
      </div></div>
      ${btnText ? `<button class="act gap" data-a="${btnAct}">${esc(btnText)}</button>` : ''}
    </div>`;
  }

  const money = v => String(v || '').trim();
  // 목록에 붙는 한국어 번역. 원문 아래 줄에 연한 회색으로 붙는다
  const trTag = v => (S.trans && v) ? `<span class="trs">${esc(v)}</span>` : '';
  // 곡 길이와 재생 위치를 이름으로 정해 늘 같게 만든다
  const trackTime = t => {
    const total = 150 + hashOf(t) % 130;
    const at = Math.floor(total * (0.2 + (hashOf(t + '!') % 55) / 100));
    const f = n => Math.floor(n / 60) + ':' + pad(n % 60);
    return { pct: Math.round(at / total * 100), at: f(at), left: '-' + f(total - at) };
  };

  function renderApp() {
    const spec = APP_SPEC[appKind];
    $('#ad-title').textContent = spec.title;
    $('#ad-more').textContent = fetchBusy === appKind ? '…' : '불러오기';
    $('#ad-edit').textContent = editing ? '완료' : '편집';
    const rows = apps[appKind];
    const box = $('#ad-list');
    box.dataset.k = appKind;
    if (!rows.length) {
      box.innerHTML = appErr
        ? `<div class="none">불러오지 못했습니다.<br><br>${esc(appErr)}</div>`
        : `<div class="none">아직 기록이 없습니다.<br>
        오른쪽 위 불러오기를 눌러 주세요.</div>`;
      return;
    }
    const del = i => editing ? `<span class="del" data-arow="${i}">삭제</span>` : '';
    const wipe = editing
      ? `<div class="grp" style="margin:14px 16px 0">
          <button class="act warn" data-a="wipeapp">${esc(spec.title)} 전체 삭제</button>
        </div>` : '';

    // ── 쇼핑 — 여러 판매처 주문이 모인 통합 내역
    if (appKind === 'shop') {
      box.innerHTML = `<div class="shead"><h2>주문 내역</h2>
        <p>최근 6개월 · 총 ${rows.length}건</p></div>` +
        rows.map((x, i) => `
        <div class="ord">
          ${del(i)}
          <div class="sel"><b>${esc(x.seller || '')}${trTag(x.trSeller)}</b>
            <i>${esc(x.date)}</i></div>
          <div class="st">${esc(x.status || '')}<em>${esc(x.date)} ${esc(x.ord || '주문')}</em></div>
          <div class="ob">
            <div class="thumb" style="background:${colorOf(x.name)}">${esc(initial(x.name))}</div>
            <div class="oi">
              <div class="nm${(S.trans && x.tr) ? ' tight' : ''}">${esc(x.name)}</div>${trTag(x.tr)}
              <div class="pr">${esc(money(x.price))}</div>
            </div>
          </div>
          <div class="obtn"><span>배송조회</span><span>재구매</span><span>리뷰쓰기</span></div>
        </div>`).join('') + wipe;
      return;
    }

    // ── 정기결제 — iOS 구독 관리 탭
    if (appKind === 'pay') {
      box.innerHTML = `
        <div class="phead"><h2>결제 내역</h2></div>
        <div class="grp2">` + rows.map((x, i) => `
          <div class="sub">
            ${del(i)}
            <div class="ico2" style="background:${colorOf(x.name)}">${esc(initial(x.name))}</div>
            <div class="si">
              <b>${esc(x.name)}</b>${trTag(x.tr)}
              <span>${esc(x.next ? x.next + ' ' + (x.ord || '결제') : '')}</span>
            </div>
            <div class="sp"><b>${esc(money(x.price))}</b><em>›</em></div>
          </div>`).join('') + `</div>` + wipe;
      return;
    }

    // ── 음악 — 애플뮤직
    if (appKind === 'music') {
      const top = rows[0], rest = rows.slice(1);
      const tm = trackTime(top.title);
      box.innerHTML = `
        <div class="mhead"><h2>지금 듣는 중</h2></div>
        <div class="mnow">
          ${del(0)}
          <div class="art" style="background:${colorOf(top.title)}">${esc(initial(top.title))}</div>
          <b>${esc(top.title)}</b>
          <span>${esc(top.artist)}</span>
          <div class="bar2"><i style="width:${tm.pct}%"></i></div>
          <div class="tt2"><span>${tm.at}</span><span>${tm.left}</span></div>
          <div class="ctl">
            <span>${IC.prev}</span><span class="pp2">${IC.play}</span><span>${IC.next}</span>
          </div>
        </div>
        ${rest.length ? `<div class="msec">최근 재생</div>` + rest.map((x, i) => `
          <div class="trk">
            ${del(i + 1)}
            <div class="art" style="background:${colorOf(x.title)}">${esc(initial(x.title))}</div>
            <div class="ti"><b>${esc(x.title)}</b><span>${esc(x.artist)}</span></div>
            <div class="tw">${esc(x.when)}</div>
          </div>`).join('') : ''}` + wipe;
      return;
    }

    // ── 검색 — 사파리 방문 기록
    const group = {}, order = [];
    rows.forEach((x, i) => {
      const k = x.when || '이전';
      if (!group[k]) { group[k] = []; order.push(k); }
      group[k].push([x, i]);
    });
    box.innerHTML = `<div class="hhead"><h2>방문 기록</h2></div>` +
      order.map(k => `
      <div class="sech">${esc(k)}</div>
      <div class="card">` + group[k].map(([x, i]) => `
        <div class="hit">
          ${del(i)}
          <span class="mag">${IC.search}</span>
          <div style="flex:1;min-width:0">
            <div class="hq">${esc(x.q)}${trTag(x.tr)}</div>
            <div class="hu">google.com/search?q=${esc(encodeURIComponent(x.q).slice(0, 28))}</div>
          </div>
        </div>`).join('') + `</div>`).join('') + wipe;
  }

  /* ── 하루문답 ──────────────────────────────────────────────────────── */
  let qBusy = '', qEdit = false, qIdx = 0;

  // 0번은 오늘, 그 뒤는 지난 문답
  const qAll = () => (qna.today ? [qna.today] : []).concat(qna.past);

  const qLangRow = () => langBox('', '');

  function renderQna() {
    const who = mainChar();
    const list = qAll();
    if (qIdx >= list.length) qIdx = Math.max(0, list.length - 1);
    const t = list[qIdx];
    const isToday = !!qna.today && qIdx === 0;
    $('#q-sub').textContent = '';
    $('#q-edit').style.display = (t && !isToday) ? '' : 'none';
    $('#q-edit').textContent = '삭제';

    let html = '';
    if (!t) {
      $('#q-body').innerHTML =
        `<div class="cap" style="text-align:center;padding:34px 20px 26px;line-height:1.9">
          하루에 하나씩 질문이 옵니다.
          내가 답을 써야 ${esc(withJosa(who, '이/가'))} 쓴 답도 함께 열립니다.</div>
        <div class="grp"><button class="act" data-a="qnew">${qBusy === 'q'
          ? '질문을 고르는 중…' : '오늘의 질문 받기'}</button></div>`;
      return;
    }

    html = `<div class="qcard"><i>${isToday ? '오늘의 질문' : '지난 질문'}</i>
      <b>${esc(t.q)}</b></div>`;

    if (list.length > 1) {
      html += `<div class="qnav">
        <button class="qarw${qIdx <= 0 ? ' off' : ''}" data-a="qnewer">‹</button>
        <em>${qIdx + 1} / ${list.length}</em>
        <button class="qarw${qIdx >= list.length - 1 ? ' off' : ''}" data-a="qolder">›</button>
      </div>`;
    }

    if (isToday && !t.mine) {
      html += `<div class="grp"><div class="f"><label>내 답 · 100자까지</label>
          <textarea id="q-in" maxlength="100"></textarea>
        </div></div>
        <div class="grp"><button class="act" data-a="qsend">${qBusy === 'a'
          ? '답을 여는 중…' : '답하기'}</button></div>
        <div class="cap">한 번 보내면 고칠 수 없습니다.</div>` + qLangRow();
    } else {
      html += `<div class="ans me"><i>${esc(me())}</i><p>${esc(t.mine)}</p></div>`;
      html += `<div class="ans ch"><i>${esc(who)}</i>` + (t.char
        ? `<p>${esc(t.char)}${(S.trans && t.charTr)
            ? ` <span class="tr">(${esc(t.charTr)})</span>` : ''}</p>`
        : `<p class="wait">${qBusy === 'a' ? '답을 쓰는 중…'
            : '아직 열리지 않았습니다. 다시 눌러 주세요'}</p>`) + `</div>`;
      if (t.char) {
        html += `<div class="grp">
            <button class="act" data-a="qshare">${qBusy === 'r'
              ? '기다리는 중…' : '메시지 알림 받기'}</button>` +
          (isToday ? `<button class="act" data-a="qnext">다음 질문 받기</button>` : '') +
          `</div>`;
      } else if (isToday) {
        html += `<div class="grp"><button class="act" data-a="qopen">${qBusy === 'a'
          ? '여는 중…' : '답 열어보기'}</button></div>`;
      }
    }
    $('#q-body').innerHTML = html;
  }

  // 질문의 결 — 매번 다른 쪽에서 뽑아 온다
  const Q_KIND = [
    '취향 — 좋아하는 동물, 음식, 색, 계절, 냄새, 노래 같은 것',
    '같이 하고 싶은 것 — 가보고 싶은 곳, 해보고 싶은 일',
    '반한 순간 — 상대가 좋아진 계기나 장면',
    '습관 — 상대의 버릇 중에 눈에 밟히는 것',
    '요즘 마음 — 근래 자주 드는 생각이나 걱정',
    '서운함 — 말 못 하고 넘어간 일',
    '사소한 일상 — 아침에 처음 하는 일, 자기 전에 하는 일',
    '미래 — 일 년 뒤, 십 년 뒤에 둘이 어떨 것 같은지',
    '과거 — 만나기 전의 이야기',
    '웃긴 것 — 상대 때문에 웃었던 일, 놀리고 싶은 것',
    '질투 — 신경 쓰이는 사람이나 상황',
    '고마움 — 말로는 잘 안 하는 것',
    '만약에 — 상대가 갑자기 달라진다면',
    '비밀 — 아직 말 안 한 것 하나'
  ];

  // 오늘의 질문 하나를 고른다
  async function makeQuestion() {
    const who = mainChar();
    const ctx = logText();
    if (!ctx) throw new Error('원본 대화를 읽지 못했습니다');
    const had = qna.past.map(x => x.q).concat(qna.today ? [qna.today.q] : []);
    // 매번 다른 두 갈래를 던져 줘서 질문이 한쪽으로 쏠리지 않게 한다
    const pool = Q_KIND.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    const sys = [
      `너는 "${who}"와 유저가 하루에 하나씩 주고받는 질문을 고른다.`,
      '',
      '- 두 사람이 같은 질문을 각자 받고, 각자 답을 적는다.',
      '  그러니 둘 다 답할 수 있는 질문이어야 한다.',
      '- 로그에서 읽히는 둘의 관계와 처지에 맞게 쓴다.',
      '  연인이면 연인답게, 앙숙이면 앙숙답게 묻는다.',
      '- 이번에는 이 갈래 중 하나에서 질문을 뽑아라.',
      '  ' + pool.join('\n  '),
      '- 가벼운 질문과 깊은 질문이 번갈아 나와야 한다.',
      '  매번 무겁기만 하면 안 된다. 시시한 취향 질문도 좋은 질문이다.',
      '- 답이 예/아니오로 끝나는 질문은 만들지 마라.',
      '- 30자 이내로 짧게 쓴다.',
      had.length ? '\n### 이미 나온 질문 (겹치지 않게)\n' + had.slice(0, 20).join('\n') : '',
      '',
      '설명이나 따옴표 없이 질문 한 줄만 출력한다.'
    ].filter(Boolean).join('\n');
    const raw = await callLLM(sys, loreBlock() + '### 원본 대화 로그\n' + ctx);
    const line = String(raw || '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '';
    const q = line.replace(/^["'`\s]+|["'`\s]+$/g, '').replace(/^질문\s*[:：]\s*/, '').slice(0, 60);
    if (!q) throw new Error('질문을 만들지 못했습니다');
    return q;
  }

  // 캐릭터가 같은 질문에 쓴 답 — 내 답은 보여주지 않는다
  async function makeCharAnswer(q) {
    const who = mainChar();
    const ctx = logText();
    if (!ctx) throw new Error('원본 대화를 읽지 못했습니다');
    const sys = [
      ...langBlock(appLang(), false),
      `너는 로그에 등장하는 "${who}"가 되어 질문에 답을 적는다.`,
      '',
      `- 이것은 ${who}가 유저에게 보내려고 혼자 적는 답이다.`,
      '  상대의 답은 아직 보지 못했다. 상대 답을 짐작해 쓰지 마라.',
      '- 로그에 있는 말투, 어휘, 존댓말과 반말을 그대로 지킨다.',
      '  없던 말버릇을 새로 만들지 마라.',
      '- 100자 이내로 쓴다. 짧아도 좋다.',
      `- ${who}다운 답이어야 한다. 감추는 인물이면 감춘 채로 적는다.`,
      '  솔직하게 다 털어놓는 것이 늘 옳은 답은 아니다.',
      '- 지문이나 별표 없이 글만 쓴다.',
      '',
      (appLang() && S.trans)
        ? '답을 적은 다음 줄에 한국어 번역만 한 줄 더 적는다. 다른 말은 쓰지 마라.'
        : '설명이나 따옴표 없이 답만 출력한다.'
    ].join('\n');
    const body = loreBlock() + '### 원본 대화 로그\n' + ctx +
      '\n\n### 오늘 받은 질문\n' + q;
    const raw = await callLLM(sys, body);
    const lines = String(raw || '').split('\n').map(x => x.trim()).filter(Boolean);
    const cut = v => String(v || '')
      .replace(/^["'`]+|["'`]+$/g, '').replace(/^답\s*[:：]\s*/, '').slice(0, 200);
    const a = cut(lines[0]);
    if (!a) throw new Error('답을 만들지 못했습니다');
    return { text: a, tr: lines.length > 1 ? cut(lines[1]) : '' };
  }

  async function qRun(kind) {
    if (qBusy) return;
    qBusy = kind; renderQna();
    try {
      if (kind === 'q') {
        qna.today = { q: await makeQuestion(), mine: '', char: '', ts: Date.now() };
      } else {
        const got = await makeCharAnswer(qna.today.q);
        qna.today.char = got.text;
        qna.today.charTr = got.tr || '';
      }
      saveQ();
    } catch (e) {
      toast('불러오지 못했습니다 · ' + e.message);
      console.error('[zetatalk]', e);
    } finally { qBusy = ''; renderQna(); }
  }

  // 문답을 보고 난 캐릭터의 반응 — 질문과 답은 다시 옮기지 않는다
  async function makeReaction(t) {
    const who = mainChar();
    const ctx = logText();
    if (!ctx) throw new Error('원본 대화를 읽지 못했습니다');
    const sys = [
      ...langBlock(roomLang(ownerRoom()), false),
      `너는 로그에 등장하는 "${who}"가 되어 유저에게 메시지를 보낸다.`,
      '',
      `방금 둘이 같은 질문에 각자 답을 적었고, 서로의 답이 열렸다.`,
      `${who}가 유저의 답을 읽고 나서 먼저 말을 거는 상황이다.`,
      '',
      '- 질문이나 답을 그대로 옮겨 적지 마라. 이미 둘 다 봤다.',
      '  읽고 난 뒤에 하는 말만 쓴다.',
      '- 반응은 매번 달라야 한다. 늘 다정할 필요 없다.',
      '  좋아서 들뜨거나, 어이없어하거나, 짓궂게 놀리거나,',
      '  삐치거나, 못 들은 척하거나, 딴소리로 넘기거나,',
      '  괜히 퉁명스럽게 굴거나, 말문이 막히거나 —',
      `  그 상황에서 ${who}가 진짜 할 법한 반응 하나를 골라라.`,
      '- 문답 얘기로 시작해서 다른 얘기로 자연스럽게 새도 좋다.',
      '- 로그에 있는 말투, 어휘, 존댓말과 반말을 그대로 지킨다.',
      '  없던 말버릇을 새로 만들지 마라.',
      '- 지문이나 별표 없이 메신저 메시지만 쓴다.',
      `- 메시지는 1개에서 3개 사이로 만든다. 유저의 말은 절대 만들지 마라.`,
      '',
      ...langBlock(S.lang, false),
      '',
      '출력은 이 JSON 배열 하나만. 설명이나 코드펜스 금지.',
      (roomLang(ownerRoom()) && S.trans)
        ? '[{"text":"메시지","tr":"한국어 번역"}]'
        : '["메시지","메시지"]'
    ].join('\n');
    const body = loreBlock() + '### 원본 대화 로그\n' + ctx +
      '\n\n### 오늘의 질문\n' + t.q +
      `\n\n### ${me()}가 적은 답\n` + t.mine +
      `\n\n### ${who}가 적은 답\n` + t.char;
    const arr = parseJSON(await callLLM(sys, body), '반응');
    const out = arr.map(x => {
      if (typeof x === 'string') return { text: x.trim(), tr: '' };
      return {
        text: String((x && (x.text || x.message)) || '').trim(),
        tr: String((x && (x.tr || x.trans || x.ko)) || '').trim()
      };
    }).filter(x => x.text).slice(0, 3);
    if (!out.length) throw new Error('반응을 만들지 못했습니다');
    return out;
  }

  // 캐릭터와의 개인톡을 찾거나 새로 연다
  function ownerRoom() {
    let room = rooms.filter(r => r.phone === 'mine' && r.isOwner).pop();
    if (room) return room;
    const who = mainChar();
    room = {
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      phone: 'mine', type: 'dm', name: who, cast: [who], rel: '',
      owner: who, ownerLabel: who, isOwner: true, withChar: false, charLabel: '',
      avatar: charPic(), userAvatar: '', rightName: '', userLabel: '',
      withUser: false, memo: '', size: 2, autoName: false, userCall: '',
      startTs: Date.now(), feed: []
    };
    rooms.push(room);
    return room;
  }

  /* ── 캘린더 ────────────────────────────────────────────────────────── */
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayKey = () => ymd(new Date());
  const calOf = k => cal.filter(x => x.d === k);
  const calSorted = () => cal.slice().sort((a, b) => a.d < b.d ? -1 : (a.d > b.d ? 1 : 0));

  function renderCal() {
    const y = calAt.getFullYear(), m = calAt.getMonth();
    const first = new Date(y, m, 1), lead = first.getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const tk = todayKey();
    if (!calPick) calPick = tk;

    let cells = '';
    for (let i = 0; i < lead; i++) cells += `<div class="cd2 out"></div>`;
    for (let d = 1; d <= days; d++) {
      const k = y + '-' + pad(m + 1) + '-' + pad(d);
      const has = calOf(k);
      const dot = has.length
        ? `<i></i>` : '';
      cells += `<button class="cd2${k === tk ? ' now' : ''}${k === calPick ? ' on' : ''}"
        data-cal="${k}"><b>${d}</b>${dot}</button>`;
    }

    const list = calOf(calPick);
    const rows = list.map(x => `<div class="crow">
        <div class="ct"><b>${esc(x.t)}</b></div>
        <button class="cdel" data-caldel="${esc(x.id)}">✕</button>
      </div>`).join('');

    $('#cal-body').innerHTML = `
      <div class="grp">
        <div class="cnav">
          <button class="ic" data-a="calprev">‹</button>
          <b>${y}년 ${m + 1}월</b>
          <button class="ic" data-a="calnext">›</button>
        </div>
        <div class="cwk">${['일','월','화','수','목','금','토']
          .map((w, i) => `<span class="${i === 0 ? 'sun' : (i === 6 ? 'sat' : '')}">${w}</span>`).join('')}</div>
        <div class="cgrid">${cells}</div>
      </div>
      <div class="grp">
        <div class="f"><label>${esc(calPick)}</label></div>
        ${rows}
        <div class="f"><input type="text" id="cal-in" placeholder="일정을 적어 주세요"></div>
        <button class="act" data-a="caladd">이 날에 추가</button>
      </div>
      ${list.length ? `<div class="grp">
        <button class="act" data-a="calnoti">${calBusy
          ? '기다리는 중…' : '메시지 알림 받기'}</button>
      </div>` : ''}`;
  }

  // 고른 날의 일정을 두고 캐릭터가 개인톡으로 말을 건다
  async function calNoti() {
    const list = calOf(calPick);
    if (!list.length || calBusy) return;
    const it = { d: calPick, t: list.map(x => x.t).join(', '), who: 'me' };
    calBusy = true; renderCal();
    const room = ownerRoom();
    const label = room.ownerLabel || mainChar();
    const lg = roomLang(room), tr = !!(lg && S.trans);
    const mineDay = true;
    const sys = [
      `너는 아래 로그에 등장하는 "${mainChar()}"를 연기하는 작가다.`,
      '오늘 달력에 적힌 일을 두고 개인 메신저로 말을 건다.',
      '',
      `날짜: ${it.d}`,
      mineDay
        ? `${me()}의 일정: ${it.t}`
        : `${mainChar()} 자신의 일정: ${it.t}`,
      '',
      mineDay
        ? '- 상대의 일이다. 그 일에 맞게 말을 건다.'
        : '- 자기 일이다. 상대가 알고 있는지 모르는 채로 말을 건다.',
      '- 생일이면 축하, 시험이나 면접이면 응원, 기념일이면 그날 이야기.',
      '  일의 성격에 맞게 결을 정해라.',
      '- 달력을 봤다고 설명하지 마라. 그냥 아는 사람처럼 말한다.',
      '',
      '가장 중요한 것 — 그 인물답게 말해야 한다',
      `- 로그를 보고 ${mainChar()}가 이런 날을 어떻게 대할 인물인지 먼저 정해라.`,
      '- 축하한다는 말을 곧이곧대로 하는 인물이 있고,',
      '  쑥스러워 딴소리부터 꺼내는 인물이 있고,',
      '  선물이나 밥 얘기로 에두르는 인물이 있고,',
      '  아무렇지 않은 척하면서 챙기는 인물이 있고,',
      '  대뜸 놀리다가 끝에 한마디 붙이는 인물이 있다.',
      '- 그 인물이 하지 않을 말은 쓰지 마라.',
      '  무뚝뚝한 인물에게 다정한 축하 문구를 시키면 잘못된 답이다.',
      '- "생일 축하해" 같은 뻔한 첫마디로 시작하지 마라.',
      '',
      '호칭 규칙',
      ...callRule(room).map(x => x.startsWith('-') ? x : '- ' + x),
      '',
      '- 대사만 쓴다. 지문, 별표, 따옴표 금지.',
      '- 2~3문장. 한 통으로 보낸다.',
      '- 말줄임표는 많아야 한 번이다.',
      ...(lg ? [
        `- 대사는 반드시 ${LANG_NAME[lg]}로 쓴다.`,
        ...(tr ? ['- 두 줄만 출력한다. 1줄 원문, 2줄 [번역] 으로 시작하는 한국어 번역.'] : [])
      ] : ['- 한국어로 쓴다.'])
    ].join('\n');
    try {
      const raw = await callLLM(sys, loreBlock() + '### 원본 대화 로그\n' + logText());
      let body = String(raw || '').trim(), text = body, trText = '';
      if (tr) {
        const cut = body.split(/\n?\s*\[번역\]\s*/);
        text = (cut[0] || '').trim();
        trText = (cut[1] || '').replace(/\s*\n+\s*/g, ' ').trim();
      }
      text = text.replace(/\s*\n+\s*/g, ' ').trim();
      // 오늘이 아니라 일정이 적힌 날짜로 찍는다
      const [yy, mm, dd] = calPick.split('-').map(Number);
      const at = new Date(yy, mm - 1, dd, 10 + Math.floor(Math.random() * 8),
        Math.floor(Math.random() * 60)).getTime();
      room.feed.push({ name: label, text, tr: trText, ts: at });
      room.feed.sort((a, b) => a.ts - b.ts);
      // 방의 다음 시각도 그날 뒤로 옮겨 대화가 이어지게 한다
      room.nextTs = at + 10 * 60 * 1000;
      saveR();
      calBusy = false; renderCal();
      showNoti(room, label, text);
    } catch (e) {
      calBusy = false; renderCal();
      toast('불러오지 못했습니다 · ' + e.message);
    }
  }

  // 알림 배너
  let notiRoom = null, notiTimer = null;
  function showNoti(room, name, text) {
    notiRoom = room;
    const el = $('#c-noti');
    el.innerHTML = `<div class="nbox">
        ${faceHTML(room, name, 'nav2')}
        <div class="ntx"><b>${esc(name)}</b><p>${esc(text)}</p></div>
        <i>지금</i>
      </div>`;
    el.classList.add('on');
    clearTimeout(notiTimer);
    notiTimer = setTimeout(() => el.classList.remove('on'), 7000);
    if (navigator.vibrate) { try { navigator.vibrate(14); } catch (e) {} }
  }
  function hideNoti() {
    clearTimeout(notiTimer);
    $('#c-noti').classList.remove('on');
  }

  async function shareQna() {
    if (qBusy) return;
    const list = qAll();
    const t = list[qIdx];
    if (!t || !t.char) return;
    qBusy = 'r'; renderQna();
    try {
      const msgs = await makeReaction(t);
      const room = ownerRoom();
      const label = room.ownerLabel || mainChar();
      let ts = nextTime(room);
      msgs.forEach(m => {
        room.feed.push({ name: label, text: m.text, tr: m.tr || '', ts });
        ts += (30 + Math.floor(Math.random() * 70)) * 1000;
      });
      saveR();
      qBusy = ''; renderQna();
      showNoti(room, label, msgs[0].text);
    } catch (e) {
      qBusy = ''; renderQna();
      toast('불러오지 못했습니다 · ' + e.message);
      console.error('[zetatalk]', e);
    }
  }

  // 타로에서 온 알림을 눌렀을 때도 같은 자리로 들어간다
  function openRoomFromTarot(room) {
    hideNoti();
    if (!room) return;
    phone = 'mine'; current = room;
    statusText = ''; statusKind = ''; sysLog = []; pending = []; held = [];
    finding = false; findQ = ''; findHits = []; findAt = -1;
    $('#c-q').value = '';
    go('chat');
  }

  // 알림을 누르면 그 방으로 들어간다
  function openNoti() {
    const room = notiRoom;
    hideNoti();
    if (!room) return;
    phone = 'mine'; current = room;
    statusText = ''; statusKind = ''; sysLog = []; pending = []; held = [];
    finding = false; findQ = ''; findHits = []; findAt = -1;
    $('#c-q').value = '';
    go('chat');
  }

  function renderAppSet() {
    $('#s-nshop').value = S.nShop;
    $('#s-npay').value = S.nPay;
    $('#s-nmusic').value = S.nMusic;
    $('#s-nsearch').value = S.nSearch;
    $('#s-nroom').value = S.nRoom;
  }

  async function fetchApp(kind) {
    if (fetchBusy) return;
    fetchBusy = kind; appErr = '';
    renderApps(); if (view === 'app') renderApp();
    try {
      const n = await makeApp(kind);
      toast(`${APP_SPEC[kind].title} ${n}건을 불러왔습니다`);
    } catch (e) {
      appErr = e.message;
      toast('불러오지 못했습니다 · ' + e.message);
      console.error('[zetatalk]', e);
    } finally {
      fetchBusy = '';
      renderApps(); if (view === 'app') renderApp();
    }
  }

  /* ── 목록 ──────────────────────────────────────────────────────────── */
  function renderList() {
    const list = inPhone(phone);
    const who = mainChar();
    $('#l-title').textContent = phone === 'char' ? who + ' 폰' : PHONE_NAME[phone];
    $('#l-sub').textContent = '';
    $('[data-a="edit"]').textContent = editing ? '완료' : '편집';

    const box = $('#l-list');

    if (!list.length) {
      box.innerHTML = `<div class="none">아직 채팅방이 없습니다.<br>
        오른쪽 위 ＋ 를 눌러 만들어 보세요.</div>` +
        (phone === 'mob' ? `<div style="padding:0 14px">` +
          langBox(fetchBusy === 'mob' ? '만드는 중…' : '한꺼번에 불러오기', 'fetchMob') +
        `</div>` : '');
      return;
    }

    const ordered = list.slice().sort((a, b) =>
      (b.withUser ? 1 : 0) - (a.withUser ? 1 : 0));
    box.innerHTML = ordered.map(r => {
      const last = r.feed[r.feed.length - 1];
      const prev = last ? esc((last.name === me() ? '나' : last.name) + ': ' +
        (last.text || '사진을 보냈습니다')) : '';
      return `<button class="item" data-open="${r.id}">
        ${avatarHTML(r, 'av')}
        <div class="meta">
          <div class="top"><b>${esc(r.name)}${countHTML(r)}</b><i>${last ? fmtShort(last.ts, dateLangOf(r)) : ''}</i></div>
          ${prev ? `<div class="prev">${prev}</div>` : ''}
        </div>
        ${editing ? `<span class="del" data-del="${r.id}">삭제</span>` : ''}
      </button>`;
    }).join('');
  }

  function syncSeg(sel, attr, val) {
    const box = root.querySelector(sel);
    if (!box) return;
    box.querySelectorAll('[data-' + attr + ']').forEach(b =>
      b.classList.toggle('on', b.dataset[attr] === val));
  }

  /* ── 대화방 ────────────────────────────────────────────────────────── */
  function setStatus(msg, kind) {
    statusText = msg; statusKind = kind || '';
    const el = $('#c-status');
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function runFind() {
    findHits = [];
    const r = current;
    if (r && findQ.trim()) {
      const q = findQ.trim().toLowerCase();
      r.feed.forEach((m, i) => {
        if (m.text && m.text.toLowerCase().includes(q)) findHits.push(i);
      });
    }
    findAt = findHits.length ? findHits.length - 1 : -1;
    renderChat();
  }

  function stepFind(d) {
    if (!findHits.length) return;
    findAt = (findAt + d + findHits.length) % findHits.length;
    renderChat();
  }

  function renderChat() {
    const r = current; if (!r) return go('list');
    const watch = r.phone !== 'mine';
    $('#c-title').innerHTML = esc(r.name) + countHTML(r);
    const bareDM = r.type !== 'group';
    root.querySelector('.chat').dataset.dm = bareDM ? '1' : '0';
    const hav = $('#c-hav');
    const havHTML = avatarHTML(r, 'inner');
    // 여럿이 겹쳐 얹힐 때만 회색 판을 깐다. 얼굴 하나면 사진이 꽉 차게 둔다
    hav.className = 'hav ' + (havHTML.indexOf('stack') >= 0 ? 'grp' : 'bare');
    hav.style.background = '';
    hav.style.backgroundImage = '';
    hav.innerHTML = havHTML;
    // 헤더에는 방 이름만 둔다. 참여자 줄은 어느 테마에서도 쓰지 않는다
    $('#c-sub').textContent = '';

    const ta = $('#c-in');
    ta.disabled = watch;
    $('#c-pic').classList.toggle('off', watch);
    const snd = $('#c-send');
    if (watch) { snd.className = 'snd txt'; snd.textContent = '이어보기'; }
    else if (held.length && !$('#c-in').value.trim()) {
      snd.className = 'snd txt'; snd.textContent = '답장받기';
    } else { snd.className = 'snd'; snd.innerHTML = S.theme === 'line' ? IC.plane : IC.up; }
    ta.placeholder = watch ? '관전 중 · 이어보기를 누르세요'
      : (held.length ? '더 보내거나, 꾹 눌러 이어 보내세요' : '메시지 입력');

    $('#c-find').classList.toggle('on', finding);
    $('#c-fcnt').textContent = findQ.trim()
      ? (findHits.length ? `${findAt + 1}/${findHits.length}` : '0') : '';

    if (statusText) setStatus(statusText, statusKind);
    else setStatus('');

    $('#c-tray').innerHTML = pending.map((p, i) =>
      `<span class="thumbx" data-drop="${i}">
        <img src="${p}"><i>✕</i>
      </span>`).join('');

    const log = $('#c-log');
    if (!r.feed.length && !sysLog.length && !busy) {
      log.innerHTML = `<div class="none">${watch
        ? '아래 이어보기를 누르면<br>이 방의 대화를 엿봅니다.'
        : '아래에서 메시지를 보내<br>대화를 시작하세요.'}</div>`;
      return;
    }

    const curHit = findAt >= 0 ? findHits[findAt] : -1;
    const hitSet = new Set(findHits);

    // 개인톡에서는 저장해 둔 방 이름으로 상대를 표시한다
    const label = r.type !== 'group' ? r.name : '';
    // 이 방의 마지막 메시지가 있는 날이 곧 이 방의 "오늘"이다
    const baseTs = r.feed.length ? r.feed[r.feed.length - 1].ts : Date.now();
    // 날짜와 시각은 내 폰이면 따로 정한 값을, 아니면 방 언어를 따른다
    const lgUI = dateLangOf(r);
    let html = '', prevName = null, prevRight = null, prevDay = '', prevTs = 0;
    r.feed.forEach((m, i) => {
      const day = fmtDay(m.ts);
      const farApart = S.theme === 'imessage' && prevTs && (m.ts - prevTs) >= IMSG_GAP;
      if (day !== prevDay || farApart) {
        html += `<div class="day"><i>${dayLabel(m.ts, baseTs, lgUI)}</i></div>`;
        prevDay = day;
        prevName = null; prevRight = null;
      }
      prevTs = m.ts;
      const right = r.phone === 'mine' ? isUserName(r, m.name)
        : (!!r.rightName && sameName(m.name, r.rightName));
      const isFirst = m.name !== prevName || right !== prevRight;
      const next = r.feed[i + 1];
      const lastOfRun = !next || next.name !== m.name ||
        (r.phone === 'mine' ? isUserName(r, next.name)
          : sameName(next.name, r.rightName)) !== right ||
        fmtDay(next.ts) !== day;
      const cls = (m.img ? ' pic' : '') + (hitSet.has(i) ? ' hit' : '') + (curHit === i ? ' cur' : '');

      const avOnLast = S.theme === 'imessage';
      const showAv = avOnLast ? lastOfRun : isFirst;

      let disp = (!right && label) ? label : m.name;
      if (isUserName(r, disp)) disp = r.userLabel || me();
      html += `<div class="m${right ? ' me' : ''}${isFirst ? ' first' : ''}${lastOfRun ? ' last' : ''}">
        ${right ? '' : (showAv ? msgAvatar(r, disp) : '<div class="mav hide"></div>')}
        <div class="col">
          ${(right || !isFirst) ? '' : `<div class="who">${esc(disp)}</div>`}
          <div class="line">
            <div class="bub${cls}" data-mi="${i}">${m.img
              ? `<img src="${m.img}">`
              : mark(m.text, findQ.trim()) +
                ((S.trans && m.tr) ? ` <span class="tr">(${esc(m.tr)})</span>` : '')}</div>
            <div class="tm">${lastOfRun ? fmtTime(m.ts, lgUI) : ''}</div>
          </div>
        </div></div>`;
      prevName = m.name; prevRight = right;
    });

    for (const s of sysLog) html += `<div class="sys"><i>${esc(s)}</i></div>`;
    if (busy) html += `<div class="m first"><div class="mav" style="background:#8fa3b3">…</div>
      <div class="col"><div class="line"><div class="bub">
      <span class="dots"><i></i><i></i><i></i></span></div></div></div></div>`;
    log.innerHTML = html;

    if (curHit >= 0) {
      const el = log.querySelector('.bub.cur');
      if (el) log.scrollTop = el.offsetTop - log.clientHeight / 2;
    } else {
      log.scrollTop = log.scrollHeight;
    }
  }

  async function run(mine, images) {
    if (busy || !current) return;
    busy = true; sysLog = [];
    setStatus('');
    renderChat();
    try {
      let msgs = await generate(current, mine, images);
      // 유저 대사만 만들어 전부 걸러진 경우 한 번 더 시도한다
      if (!msgs.length) msgs = await generate(current, mine, images);
      if (!msgs.length) throw new Error('생성된 메시지가 없습니다. 다시 눌러 주세요');

      let t = nextTime(current);
      const uname = current.userLabel || me();
      msgs.forEach(m => {
        if (GENERIC_USER.test(String(m.name || '').trim())) m.name = uname;
        current.feed.push({ name: m.name, text: m.text, tr: m.tr || '', ts: t });
        t += (30 + Math.floor(Math.random() * 90)) * 1000;
      });

      const names = [...new Set(current.feed.map(m => m.name))].filter(Boolean);
      let others;
      if (current.phone === 'mine') {
        others = names.filter(x => x !== me());
      } else {
        fixRight(current, names);
        others = names.filter(x => !sameName(x, current.rightName) && x !== me());
      }
      if (!current.cast.length && others.length) current.cast = others.slice(0, 8);
      saveR();

      // 방 이름이 아직 임시라면 여기서 진짜 이름을 붙인다
      if (current.autoName) {
        if (current.type === 'group') {
          renderChat();
          try {
            const nm = await nameRoom(current);
            if (nm) { current.name = nm; current.autoName = false; }
          } catch (e) { console.error('[zetatalk] name', e); }
        } else if (others.length) {
          current.name = others[0];
          current.autoName = false;
          // 방 언어가 따로 있으면 저장명도 그 나라 말로 다시 짓는다
          if (roomLang(current)) {
            renderChat();
            try {
              const nm = await nameDm(current, others[0]);
              if (nm) current.name = nm;
            } catch (e) { console.error('[zetatalk] dmname', e); }
          }
        }
        saveR();
      }
      setStatus('');
    } catch (e) {
      const model = clean(S.model) || PRESET[S.provider].model || '(비어 있음)';
      sysLog = ['불러오지 못했습니다\n\n' + e.message +
        '\n\nAPI 종류: ' + S.provider + '\n모델: ' + model + '\n주소: ' + (baseUrl() || '(비어 있음)')];
      setStatus('오류 · ' + e.message, 'err');
      console.error('[zetatalk]', e);
    } finally {
      busy = false; renderChat();
    }
  }

  /* ── 새 방 ─────────────────────────────────────────────────────────── */
  const AUTO_CAP =
    '<div class="cap">비워두면 대화를 읽고 알아서 정합니다.</div>';
  const incName = () => phone === 'mine' ? mainChar() : (phone === 'char' ? me() : '');

  // 이미 만들어 둔 개인톡에서 저장해 둔 이름을 가져온다
  const lastOf = f => rooms.filter(f).pop();
  function savedCharLabel() {
    const r = lastOf(x => x.phone === 'mine' && x.isOwner && x.ownerLabel);
    return r ? r.ownerLabel : mainChar();
  }
  function savedUserLabel() {
    const r = lastOf(x => x.phone === 'char' && x.withUser && x.userLabel);
    return r ? r.userLabel : '';
  }
  function savedUserCall() {
    const r = lastOf(x => x.phone === 'char' && x.withUser && x.userCall);
    return r ? r.userCall : '';
  }

  const numBlock = () => {
    if (newType !== 'group') return '';
    const inc = incName();
    if (!inc) return `<div class="grp">
      <div class="f"><label>생성 인원 수 (비우면 3명)</label>
        <input type="text" id="n-num" inputmode="numeric" placeholder="숫자만 입력"
          value="${esc(newSize)}"></div>
    </div>`;
    const incLabel = phone === 'mine'
      ? savedCharLabel()
      : (labelDraft || savedUserLabel() || me());
    return `<div class="grp">
      <div class="f"><label>생성 인원 수 (비우면 3명)</label>
        <input type="text" id="n-num" inputmode="numeric" placeholder="숫자만 입력"
          value="${esc(newSize)}"></div>
      <div class="f"><div class="row"><b>${esc(inc)} 포함</b>
        <button class="sw${newInc ? ' on' : ''}" data-a="toggleinc"></button></div></div>
      ${newInc ? `<div class="f">
        <label>${phone === 'mine'
          ? '이 방에 표시할 이름'
          : esc(withJosa(mainChar(), '이/가')) + ' 저장한 내 이름'}</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="text" id="n-ulabel" value="${esc(incLabel)}" style="flex:1">
          ${phone === 'char'
            ? `<button data-a="relabel" style="flex:0 0 auto;font-size:19px;padding:2px 4px">⟳</button>`
            : ''}
        </div></div>` : ''}
    </div>`;
  };

  // 새 방을 만들 때 고르는 언어
  const newLangRow = () => `<div class="grp">
      <div class="f"><label>${newType === 'owner'
        ? esc(withJosa(mainChar(), '이/가')) + ' 쓸 언어' : '불러올 언어'}</label>
        <button class="pickone" data-a="pickNewLang">
          ${esc(langLabel(newLang || 'ko'))}<i>›</i></button></div>
      ${phone === 'mine' ? `<div class="f"><label>날짜와 시각 표시</label>
        <button class="pickone" data-a="pickNewDateLang">
          ${esc(langLabel(newDateLang || 'ko'))}<i>›</i></button></div>` : ''}
    </div>`;

  // 참여자와 관계 — 개인톡은 한 명, 단톡방은 여럿
  const castBlock = () => newType === 'group'
    ? `<div class="grp">
        <div class="f"><label>참여자 (저장명 · 쉼표로 구분)</label>
          <input type="text" id="n-cast"></div>
        <div class="f"><label>관계 표시 (쉼표로 구분)</label>
          <input type="text" id="n-rel"></div>
        <div class="f"><label>방 이름</label>
          <input type="text" id="n-name"></div>
      </div>${AUTO_CAP}`
    : `<div class="grp">
        <div class="f"><label>참여자 (저장명)</label>
          <input type="text" id="n-cast"></div>
        <div class="f"><label>참여자와 관계</label>
          <input type="text" id="n-rel"></div>
      </div>${AUTO_CAP}`;

  function renderNew() {
    const who = mainChar();
    let html = '';
    if (phone === 'mine') {
      html = `<div class="grp"><div class="seg" id="n-seg">
          <button data-t="owner">${esc(who)}</button>
          <button data-t="dm">개인톡</button>
          <button data-t="group">단톡방</button>
        </div></div>
        ${numBlock()}
        ${newType === 'owner'
          ? `<div class="grp"><div class="f"><label>이 사람을 뭐라고 저장할까요</label>
              <input type="text" id="n-name" value="${esc(who)}"></div></div>`
          : castBlock()}
        ${newLangRow()}`;
    } else if (phone === 'char') {
      html = `<div class="grp"><div class="seg" id="n-seg">
          <button data-t="user">유저</button>
          <button data-t="dm">개인톡</button>
          <button data-t="group">단톡방</button>
        </div></div>
        ${numBlock()}
        ${newType === 'user'
          ? `<div class="grp"><div class="f">
              <label>${esc(withJosa(who, '이/가'))} 저장한 이름입니다</label>
              <div style="display:flex;align-items:center;gap:10px">
                <input type="text" id="n-name"
                  value="${esc(labelDraft || savedUserLabel() || me())}" style="flex:1">
                <button data-a="relabel" style="flex:0 0 auto;font-size:19px;padding:2px 4px">⟳</button>
              </div></div></div>
            <div class="cap" id="n-sug">${labelBusy ? '이름을 정하는 중…' : ''}</div>`
          : castBlock()}
        ${newLangRow()}`;
    } else {
      html = `<div class="grp"><div class="seg" id="n-seg">
          <button data-t="dm">개인톡</button><button data-t="group">단톡방</button>
        </div></div>
        ${numBlock()}
        ${castBlock()}
        ${newLangRow()}`;
    }
    $('#n-form').innerHTML = html;
    syncSeg('#n-seg', 't', newType);
    const nn = $('#n-num');
    if (nn) nn.addEventListener('input', e => { newSize = e.target.value; });
  }

  /* ── 방 설정 ───────────────────────────────────────────────────────── */
  function renderRoomSet() {
    const r = current; if (!r) return go('list');
    $('#rs-form').innerHTML = `
      <div class="grp">
        <div class="f"><label>방 이름</label>
          <input type="text" id="rs-name" value="${esc(r.name)}"></div>
        <div class="f"><label>참여자 (저장명 · 쉼표로 구분)</label>
          <input type="text" id="rs-cast" value="${esc((r.cast || []).join(', '))}"></div>
        <div class="f"><label>관계 표시 (쉼표로 구분)</label>
          <input type="text" id="rs-rel" value="${esc(r.rel || '')}"
            placeholder="비우면 알아서 정합니다"></div>
        <div class="f"><label>답장 길이</label>
          <div class="seg" id="rs-len">
            <button data-ln="auto">자동</button>
            <button data-ln="short">짧게</button>
            <button data-ln="mid">보통</button>
            <button data-ln="long">장문</button>
          </div></div>
        <div class="f"><label>이 방의 언어</label>
          <button class="pickone" data-a="pickRoomLang">
            ${esc(langLabel(r.lang || appLang() || 'ko'))}<i>›</i></button></div>
        ${r.phone === 'mine' ? `<div class="f"><label>날짜와 시각 표시</label>
          <button class="pickone" data-a="pickRoomDateLang">
            ${esc(langLabel(r.dateLang || 'ko'))}<i>›</i></button></div>` : ''}
        <div class="f"><div class="row"><b>한국어 번역 함께 보기</b>
          <button class="sw${S.trans ? ' on' : ''}" data-a="trans"></button>
        </div></div>
        ${r.withUser || r.isOwner ? `<div class="f"><label>유저 표기 이름</label>
          <input type="text" id="rs-ulabel" value="${esc(r.userLabel || me())}"></div>
        <div class="f"><label>${esc(withJosa(r.owner || mainChar(), '이/가'))} 유저를 부르는 말</label>
          <input type="text" id="rs-ucall" value="${esc(r.userCall || '')}"
            placeholder="비우면 알아서 정합니다"></div>` : ''}
      </div>
      <div class="grp">
        <div class="f"><div class="row">
          <b>사진을 ${esc(r.owner || mainChar())}에게 보여주기</b>
          <button class="sw${S.sendImage ? ' on' : ''}" data-a="rsimg"></button>
        </div></div>
      </div>
      <div class="cap">켜면 보낸 사진을 실제로 전송해 답이 정확해집니다.
꺼두면 사진을 보냈다는 사실만 전달됩니다.</div>
      <div class="grp">
        <div class="f"><label>대화 시작 시각</label>
          <input type="datetime-local" id="rs-ts" value="${forInput(r.startTs || Date.now())}"></div>
        <button class="act" data-a="shift">저장하고 이 시각으로 옮기기</button>
      </div>
      <div class="grp">
        <div class="f"><label>다음 메시지 시각</label>
          <input type="datetime-local" id="rs-next"
            value="${forInput(r.nextTs || nextTime(r, true))}"></div>
        <button class="act" data-a="setnext">이 시각으로 정하기</button>
        ${r.nextTs ? `<button class="act warn" data-a="clearnext">되돌리기</button>` : ''}
      </div>
      ${r.type === 'group' ? `<div class="grp">
        <button class="act" data-a="rename">대화 내용으로 방 이름 다시 짓기</button>
      </div>` : ''}
      ${r.phone === 'char' ? `<div class="grp">
        <button class="act" data-a="reright">오른쪽에 설 사람 다시 잡기</button>
      </div>
` : ''}
      <div class="grp">
        <button class="act warn" data-a="clear">이 방의 대화 지우기</button>
        <button class="act warn" data-a="delroom">방 삭제</button>
      </div>`;
    syncSeg('#rs-len', 'ln', lenOf(r));
    // 고치는 즉시 저장한다. 완료를 안 눌러도 남는다
    ['#rs-name', '#rs-cast', '#rs-rel', '#rs-ulabel', '#rs-ucall'].forEach(sel => {
      const el = $(sel);
      if (el) el.addEventListener('input', saveRoomSet);
    });
  }

  // 방 설정 화면의 입력값을 그대로 저장한다
  function saveRoomSet() {
    const r = current;
    if (!r || view !== 'roomset') return;
    const gv = sel => { const el = $(sel); return el ? el.value.trim() : null; };
    const nm = gv('#rs-name');
    if (nm && nm !== r.name) { r.name = nm; r.autoName = false; }
    const cs = gv('#rs-cast');
    if (cs !== null) r.cast = cs.split(',').map(x => x.trim()).filter(Boolean);
    const rl = gv('#rs-rel');
    if (rl !== null) r.rel = rl;
    const uc = gv('#rs-ucall');
    if (uc !== null) r.userCall = uc;
    const ul = gv('#rs-ulabel');
    if (ul) {
      const old = r.userLabel;
      r.userLabel = ul;
      if (old && old !== ul) {
        r.feed.forEach(m => { if (sameName(m.name, old)) m.name = ul; });
        if (sameName(r.rightName, old)) r.rightName = ul;
      }
    }
    // 개인톡은 방 이름이 곧 상대 저장명이다. 함께 맞춘다
    if (r.type !== 'group' && nm) {
      const oldC = (r.cast && r.cast.length === 1) ? r.cast[0] : '';
      if (oldC && !sameName(oldC, nm)) {
        r.cast[0] = nm;
        if (r.isOwner) r.ownerLabel = nm;
        r.feed.forEach(m => { if (sameName(m.name, oldC)) m.name = nm; });
        if (sameName(r.rightName, oldC)) r.rightName = nm;
      }
    }
    saveR();
  }

  /* ── 설정 ──────────────────────────────────────────────────────────── */
  function renderSettings() {
    syncSeg('#s-theme', 'th', S.theme);
    $('#s-fs').value = S.fontPx;
    $('#s-fpx').textContent = S.fontPx + 'px';
    syncSeg('#s-dark', 'dk', S.dark ? '1' : '0');
    $('#s-prov').value = S.provider;
    $('#s-url').value = S.apiUrl;
    $('#s-key').value = S.apiKey;
    $('#s-model').value = S.model;
    $('#s-max').value = S.maxTokens;
    $('#s-persona').value = S.persona;
    $('#s-img').classList.toggle('on', !!S.sendImage);
    $('#s-img-t').textContent = `사진을 ${mainChar()}에게 보여주기`;
    $('#s-url-f').style.display = S.provider === 'custom' ? '' : 'none';
    $('#s-model').placeholder = PRESET[S.provider].model || '모델 이름';
    $('#s-detect').textContent = S.selector
      ? '지정한 말풍선: ' + S.selector : '자동 인식을 사용 중입니다.';
  }

  /* ── 사진 ──────────────────────────────────────────────────────────── */
  const picker = document.createElement('input');
  picker.type = 'file'; picker.accept = 'image/*'; picker.multiple = true;
  picker.style.display = 'none';
  root.appendChild(picker);

  function shrink(file, maxSize) {
    return new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = maxSize || 400, sc = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * sc);
          cv.height = Math.round(img.height * sc);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          res(cv.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = () => res('');
        img.src = fr.result;
      };
      fr.onerror = () => res('');
      fr.readAsDataURL(file);
    });
  }

  picker.addEventListener('change', async () => {
    const files = [...picker.files].slice(0, 4);
    picker.value = '';
    for (const f of files) {
      const d = await shrink(f);
      if (d) pending.push(d);
    }
    if (pending.length > 4) pending = pending.slice(0, 4);
    renderChat();
  });
  // 관전 방에서는 ＋ 가 보이기만 하고 눌리지 않는다
  $('#c-pic').onclick = () => {
    if (current && current.phone === 'mine') picker.click();
  };

  /* ── 프로필 사진 자르기 ────────────────────────────────────────────── */
  const CF = 268, COUT = 320;
  let cImg = null, cBase = 1, cZoom = 1, cX = 0, cY = 0, cTarget = 'me';

  function cApply() {
    const el = $('#c-cimg');
    const s = cBase * cZoom;
    const w = cImg.naturalWidth * s, h = cImg.naturalHeight * s;
    cX = Math.min(0, Math.max(CF - w, cX));
    cY = Math.min(0, Math.max(CF - h, cY));
    el.style.transform = `translate(${cX}px,${cY}px) scale(${s})`;
  }

  function openCrop(src) {
    const el = $('#c-cimg');
    el.onload = () => {
      cBase = Math.max(CF / cImg.naturalWidth, CF / cImg.naturalHeight);
      cZoom = 1;
      cX = (CF - cImg.naturalWidth * cBase) / 2;
      cY = (CF - cImg.naturalHeight * cBase) / 2;
      $('#c-zoom').value = 1;
      cApply();
      $('#cropbox').classList.add('on');
    };
    cImg = el;
    el.src = src;
  }

  (() => {
    const frame = $('#c-frame');
    let sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    frame.addEventListener('touchstart', e => {
      if (!cImg) return;
      on = true;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      ox = cX; oy = cY;
    }, { passive: true });
    frame.addEventListener('touchmove', e => {
      if (!on) return;
      e.preventDefault();
      cX = ox + (e.touches[0].clientX - sx);
      cY = oy + (e.touches[0].clientY - sy);
      cApply();
    }, { passive: false });
    frame.addEventListener('touchend', () => { on = false; }, { passive: true });
  })();

  $('#c-zoom').addEventListener('input', e => {
    if (!cImg) return;
    const old = cBase * cZoom;
    cZoom = Number(e.target.value);
    const now = cBase * cZoom;
    // 프레임 가운데를 기준으로 확대한다
    cX = CF / 2 - (CF / 2 - cX) * (now / old);
    cY = CF / 2 - (CF / 2 - cY) * (now / old);
    cApply();
  });

  function cropDone() {
    if (!cImg) return '';
    const s = cBase * cZoom;
    const cv = document.createElement('canvas');
    cv.width = COUT; cv.height = COUT;
    const g = cv.getContext('2d');
    g.drawImage(cImg, -cX / s, -cY / s, CF / s, CF / s, 0, 0, COUT, COUT);
    return cv.toDataURL('image/jpeg', 0.85);
  }

  const avPicker = document.createElement('input');
  avPicker.type = 'file'; avPicker.accept = 'image/*';
  avPicker.style.display = 'none';
  root.appendChild(avPicker);
  avPicker.addEventListener('change', () => {
    const f = avPicker.files[0]; avPicker.value = '';
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => openCrop(fr.result);
    fr.onerror = () => toast('사진을 읽지 못했습니다');
    fr.readAsDataURL(f);
  });

  /* ── 말풍선 꾹 눌러 삭제 ───────────────────────────────────────────── */
  let pressTimer = null;
  const logEl = $('#c-log');
  logEl.addEventListener('touchstart', ev => {
    const b = ev.target.closest('[data-mi]');
    if (!b) return;
    const i = Number(b.dataset.mi);
    pressTimer = setTimeout(() => {
      pressTimer = null;
      sheetIdx = i;
      // 바로 아래가 같은 사람의 글 말풍선일 때만 합칠 수 있다
      const cur = current && current.feed[i];
      const nx = current && current.feed[i + 1];
      const canMerge = !!(cur && nx && !cur.img && !nx.img && cur.name === nx.name);
      $('#s-merge').style.display = canMerge ? '' : 'none';
      $('#c-sheet').classList.add('on');
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    }, 480);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(t =>
    logEl.addEventListener(t, () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }, { passive: true }));

  /* ── 전송 버튼 꾹 누르기 — 답장 없이 이어 보내기 ──────────────────── */
  (() => {
    const btn = $('#c-send');
    let timer = null, longed = false;
    btn.addEventListener('touchstart', () => {
      if (!current || current.phone !== 'mine') return;
      longed = false;
      timer = setTimeout(() => { timer = null; longed = true; send(false); }, 420);
    }, { passive: true });
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
    ['touchend', 'touchmove', 'touchcancel'].forEach(t =>
      btn.addEventListener(t, stop, { passive: true }));
    btn.addEventListener('click', ev => {
      if (longed) { longed = false; ev.preventDefault(); ev.stopPropagation(); }
    }, true);
  })();

  /* ── 검색 입력 ─────────────────────────────────────────────────────── */
  $('#c-q').addEventListener('input', e => { findQ = e.target.value; runFind(); });

  /* ── 이벤트 ────────────────────────────────────────────────────────── */
  root.addEventListener('click', async ev => {
    const t = ev.target;

    const drop = t.closest('[data-drop]');
    if (drop) { pending.splice(Number(drop.dataset.drop), 1); return renderChat(); }

    const th = t.closest('[data-th]');
    if (th) { S.theme = th.dataset.th; saveS(); root.setAttribute('data-theme', S.theme); return renderSettings(); }

    const pl = t.closest('[data-pl]');
    if (pl) {
      const v = pl.dataset.pl;
      $('#lang-sheet').classList.remove('on');
      if (v) {
        if (langTarget === 'app') { S.appLang = v; saveS(); }
        else if (langTarget === 'room' && current) { current.lang = v; saveR(); }
        else if (langTarget === 'new') { newLang = v; }
        else if (langTarget === 'newdate') { newDateLang = v; }
        else if (langTarget === 'roomdate' && current) { current.dateLang = v; saveR(); }
      }
      langTarget = '';
      if (view === 'apps') return renderApps();
      if (view === 'qna') return renderQna();
      if (view === 'roomset') return renderRoomSet();
      if (view === 'new') return renderNew();
      if (view === 'list') return renderList();
      return;
    }

    const ln = t.closest('[data-ln]');
    if (ln && current) {
      current.replyLen = ln.dataset.ln; saveR(); return renderRoomSet();
    }

    const dk = t.closest('[data-dk]');
    if (dk) {
      S.dark = dk.dataset.dk === '1'; saveS();
      root.setAttribute('data-dark', S.dark ? '1' : '0');
      syncBack();
      return renderSettings();
    }
    const fx = t.closest('[data-a="fetchMob"]');
    if (fx) { ev.stopPropagation(); return fetchRooms('mob'); }


    const gk = t.closest('[data-getk]');
    if (gk) {
      ev.stopPropagation(); ev.preventDefault();
      const k = gk.dataset.getk;
      $('#ap-sheet').classList.remove('on');
      if (k === 'msg') return fetchRooms('char');
      return fetchApp(k);
    }

    const cday = t.closest('[data-cal]');
    if (cday) { calPick = cday.dataset.cal; return renderCal(); }
    const cdel = t.closest('[data-caldel]');
    if (cdel) {
      cal = cal.filter(x => x.id !== cdel.dataset.caldel);
      saveC(); return renderCal();
    }
    const ap = t.closest('[data-app]');
    if (ap) {
      const k = ap.dataset.app;
      editing = false;
      if (k === 'tarot') { hidePhone(); return openTarot(); }
      if (k === 'qna') return go('qna');
      if (k === 'cal') return go('cal');
      if (k === 'msg') return go('list');
      appKind = k; return go('app');
    }

    const arow = t.closest('[data-arow]');
    if (arow) {
      ev.stopPropagation();
      apps[appKind].splice(Number(arow.dataset.arow), 1);
      saveA(); return renderApp();
    }

    const ph = t.closest('[data-phone]');
    if (ph) {
      phone = ph.dataset.phone; editing = false;
      return go(phone === 'mob' ? 'list' : 'apps');
    }

    const nt = t.closest('[data-t]');
    if (nt) { newType = nt.dataset.t; return renderNew(); }

    const del = t.closest('[data-del]');
    if (del) {
      ev.stopPropagation();
      rooms = rooms.filter(r => r.id !== del.dataset.del);
      saveR(); return renderList();
    }

    const open = t.closest('[data-open]');
    if (open) {
      current = rooms.find(r => r.id === open.dataset.open);
      statusText = ''; statusKind = ''; sysLog = []; pending = []; held = [];
      finding = false; findQ = ''; findHits = []; findAt = -1;
      $('#c-q').value = '';
      go('chat');
      if (current && current.phone === 'mine' && !current.isOwner && !current.feed.length) run(null, null);
      return;
    }

    const a = t.closest('[data-a]')?.dataset.a;
    if (!a) return;

    if (a === 'quit') return api.destroy();
    if (a === 'home') return go('home');
    if (a === 'apps') return go('apps');
    if (a === 'appsback') return go('home');
    if (a === 'appset') return go('appset');
    if (a === 'listback') return go(phone === 'mob' ? 'home' : 'apps');
    if (a === 'appmore') return fetchApp(appKind);

    if (a === 'noti') return openNoti();
    if (a === 'qnewer') { if (qIdx > 0) qIdx--; return renderQna(); }
    if (a === 'qolder') { if (qIdx < qAll().length - 1) qIdx++; return renderQna(); }
    if (a === 'qedit') {
      // 보고 있는 지난 문답을 지운다
      const at = qIdx - (qna.today ? 1 : 0);
      if (at >= 0 && qna.past[at]) {
        qna.past.splice(at, 1); saveQ();
        if (qIdx >= qAll().length) qIdx = Math.max(0, qAll().length - 1);
        toast('지웠습니다');
      }
      return renderQna();
    }
    if (a === 'qnew') return qRun('q');
    if (a === 'qopen') return qRun('a');
    if (a === 'qshare') return shareQna();
    if (a === 'qnext') {
      const t2 = qna.today;
      if (t2 && t2.mine && t2.char) {
        qna.past.unshift(t2);
        qna.past = qna.past.slice(0, 40);
      }
      qna.today = null; qIdx = 0; saveQ();
      return qRun('q');
    }
    if (a === 'qsend') {
      const el = $('#q-in');
      const v = el ? el.value.trim() : '';
      if (!v) return toast('답을 적어 주세요');
      if (!qna.today || qIdx !== 0) return;
      qna.today.mine = v.slice(0, 100);
      saveQ(); renderQna();
      return qRun('a');
    }
    if (a === 'fetchpick') {
      if (fetchBusy) return;
      $('#ap-sheet').classList.add('on'); return;
    }
    if (a === 'apcancel') { $('#ap-sheet').classList.remove('on'); return; }
    if (a === 'wipeapp') {
      apps[appKind] = []; saveA(); appErr = '';
      toast('전체 삭제했습니다');
      return renderApp();
    }
    if (a === 'back') {
      if (view === 'roomset') { saveRoomSet(); return go('chat'); }
      return go('list');
    }
    if (a === 'editapp') { editing = !editing; return renderApp(); }
    if (a === 'settings') return go('settings');
    if (a === 'edit') { editing = !editing; return renderList(); }
    if (a === 'roomset') return go('roomset');
    if (a === 'learn') return startLearn();
    if (a === 'unlearn') { S.selector = ''; saveS(); renderSettings(); toast('인식을 초기화했습니다'); return; }
    if (a === 'clearpersona') {
      S.persona = ''; saveS(); _userName = '';
      renderSettings();
      toast('비웠습니다 · 대화에서 읽은 이름을 씁니다');
      return;
    }

    if (a === 'pickAppLang') {
      langTarget = 'app'; $('#lang-sheet').classList.add('on'); return;
    }
    if (a === 'pickRoomLang') {
      langTarget = 'room'; $('#lang-sheet').classList.add('on'); return;
    }
    if (a === 'pickNewLang') {
      langTarget = 'new'; $('#lang-sheet').classList.add('on'); return;
    }
    if (a === 'pickNewDateLang') {
      langTarget = 'newdate'; $('#lang-sheet').classList.add('on'); return;
    }
    if (a === 'pickRoomDateLang') {
      langTarget = 'roomdate'; $('#lang-sheet').classList.add('on'); return;
    }

    if (a === 'calprev') { calAt = new Date(calAt.getFullYear(), calAt.getMonth() - 1, 1); return renderCal(); }
    if (a === 'calnext') { calAt = new Date(calAt.getFullYear(), calAt.getMonth() + 1, 1); return renderCal(); }
    if (a === 'calnoti') return calNoti();
    if (a === 'caladd') {
      const el = $('#cal-in'), v = el ? el.value.trim() : '';
      if (!v) return toast('일정을 적어 주세요');
      cal.push({ id: 'u' + Date.now().toString(36), d: calPick, t: v.slice(0, 20), who: 'me' });
      saveC(); return renderCal();
    }

    if (a === 'trans') return toggleTrans();

    if (a === 'find') {
      finding = !finding;
      if (!finding) { findQ = ''; $('#c-q').value = ''; findHits = []; findAt = -1; }
      renderChat();
      if (finding) setTimeout(() => $('#c-q').focus(), 60);
      return;
    }
    if (a === 'fclose') {
      finding = false; findQ = ''; $('#c-q').value = '';
      findHits = []; findAt = -1;
      return renderChat();
    }
    if (a === 'fprev') return stepFind(-1);
    if (a === 'fnext') return stepFind(1);

    if (a === 'editone') {
      const m = current && current.feed[sheetIdx];
      $('#c-sheet').classList.remove('on');
      if (!m) { sheetIdx = -1; return; }
      if (m.img) { sheetIdx = -1; return toast('사진은 고칠 수 없습니다'); }
      $('#e-in').value = m.text || '';
      $('#editbox').classList.add('on');
      setTimeout(() => { const el = $('#e-in'); if (el) el.focus(); }, 80);
      return;
    }
    if (a === 'ecancel') {
      $('#editbox').classList.remove('on');
      sheetIdx = -1;
      return;
    }
    if (a === 'eok') {
      const m = current && current.feed[sheetIdx];
      const v = ($('#e-in').value || '').trim();
      $('#editbox').classList.remove('on');
      sheetIdx = -1;
      if (!m) return;
      if (!v) return toast('내용이 비어 있습니다');
      m.text = v; saveR();
      if (findQ.trim()) return runFind();
      return renderChat();
    }

    if (a === 'mergeone') {
      const r = current;
      $('#c-sheet').classList.remove('on');
      const i = sheetIdx; sheetIdx = -1;
      if (!r) return;
      const cur = r.feed[i], nx = r.feed[i + 1];
      if (!cur || !nx || cur.img || nx.img || cur.name !== nx.name) return;
      // 띄어쓰기 하나로 이어 붙인다
      cur.text = (cur.text || '').trim() + ' ' + (nx.text || '').trim();
      // 번역도 함께 이어 붙인다
      if (cur.tr || nx.tr) {
        cur.tr = ((cur.tr || '').trim() + ' ' + (nx.tr || '').trim()).trim();
      }
      r.feed.splice(i + 1, 1);
      saveR();
      if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} }
      if (findQ.trim()) return runFind();
      return renderChat();
    }

    if (a === 'copyone') {
      const m = current && current.feed[sheetIdx];
      $('#c-sheet').classList.remove('on');
      sheetIdx = -1;
      if (!m) return;
      const txt = m.text || '';
      if (!txt) return toast('사진은 복사할 수 없습니다');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt)
            .then(() => toast('복사했습니다'))
            .catch(() => toast('복사하지 못했습니다'));
        } else {
          const ta = document.createElement('textarea');
          ta.value = txt;
          ta.style.cssText = 'position:fixed;opacity:0';
          root.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.remove();
          toast('복사했습니다');
        }
      } catch (e) { toast('복사하지 못했습니다'); }
      return;
    }

    if (a === 'delone') {
      if (current && current.feed[sheetIdx]) {
        current.feed.splice(sheetIdx, 1);
        saveR();
      }
      sheetIdx = -1;
      $('#c-sheet').classList.remove('on');
      if (findQ.trim()) return runFind();
      return renderChat();
    }
    if (a === 'scancel') {
      sheetIdx = -1;
      $('#c-sheet').classList.remove('on');
      return;
    }

    if (a === 'new') {
      newType = phone === 'char' ? 'user' : (phone === 'mine' ? 'owner' : 'dm');
      newSize = ''; newInc = false; labelDraft = ''; labelCall = ''; newLang = 'ko'; newDateLang = 'ko';
      go('new');
      if (phone === 'char' && newType === 'user' && !savedUserLabel()) makeLabel();
      return;
    }

    if (a === 'create') {
      const gv = sel => { const el = $(sel); return el ? el.value.trim() : ''; };
      const nlg = newLang || '';
      const name = gv('#n-name');
      const cast = gv('#n-cast').split(',').map(x => x.trim()).filter(Boolean);
      const rel = gv('#n-rel');
      const ulabel = gv('#n-ulabel');
      const who = mainChar();
      const size = newType === 'group' ? Math.max(readSize(), cast.length + 1) : 2;

      if (phone === 'mine') {
        if (newType === 'owner') {
          const label = name || who;
          addRoom({
            phone: 'mine', type: 'dm', name: label, cast: [label],
            owner: who, ownerLabel: label, isOwner: true, avatar: charPic(),
            lang: nlg, dateLang: newDateLang || 'ko'
          });
        } else if (newType === 'dm') {
          addRoom({
            phone: 'mine', type: 'dm', name: cast[0] || '새 대화',
            cast, rel, avatar: '', autoName: !cast.length,
            lang: nlg, dateLang: newDateLang || 'ko'
          });
        } else {
          // 캐릭터를 넣으면 개인톡에서 저장해 둔 이름으로 참여시킨다
          const cl = newInc ? (ulabel || savedCharLabel()) : '';
          addRoom({
            phone: 'mine', type: 'group', name: name || '새 단톡방',
            cast: cl ? [cl].concat(cast.filter(c => c !== cl)) : cast,
            rel, avatar: '', size, withChar: newInc, charLabel: cl,
            autoName: !name, lang: nlg, dateLang: newDateLang || 'ko'
          });
        }
      } else if (phone === 'char') {
        if (newType === 'user') {
          const label = name || savedUserLabel() || me();
          addRoom({
            phone: 'char', type: 'dm', name: label, cast: [label],
            owner: who, avatar: charPic(), userAvatar: '',
            rightName: who, withUser: true, userLabel: label,
            userCall: labelCall || savedUserCall(), size: 2, lang: nlg
          });
        } else if (newType === 'dm') {
          addRoom({
            phone: 'char', type: 'dm', name: cast[0] || '새 대화', cast, rel,
            owner: who, avatar: charAvatar(), rightName: who, size: 2,
            autoName: !cast.length, lang: nlg
          });
        } else {
          // 유저를 넣으면 캐릭터가 저장해 둔 이름으로 표시한다
          const ul = newInc ? (ulabel || labelDraft || savedUserLabel() || me()) : '';
          addRoom({
            phone: 'char', type: 'group', name: name || '새 단톡방', cast, rel,
            owner: who, avatar: charPic(), rightName: who, size,
            withUser: newInc, userLabel: ul,
            userCall: newInc ? (labelCall || savedUserCall()) : '',
            userAvatar: '', autoName: !name, lang: nlg
          });
        }
      } else {
        addRoom({
          phone: 'mob', type: newType,
          name: name || cast[0] || '새 대화', cast, rel, size,
          autoName: !name && !cast.length, lang: nlg
        });
      }
      return;
    }

    if (a === 'send') return send(true);

    if (a === 'shift') {
      const r = current; if (!r) return;
      const val = $('#rs-ts').value;
      if (!val) return;
      const target = new Date(val).getTime();
      if (isNaN(target)) return toast('시각을 확인해 주세요');
      const first = r.feed.length ? r.feed[0].ts : (r.startTs || Date.now());
      const diff = target - first;
      r.feed.forEach(m => { m.ts += diff; });
      r.startTs = target;
      saveRoomSet();
      toast('저장했습니다'); return go('chat');
    }

    if (a === 'setnext') {
      const r = current; if (!r) return;
      const el = $('#rs-next');
      const v = el ? el.value : '';
      if (!v) return;
      const at = new Date(v).getTime();
      if (isNaN(at)) return toast('시각을 확인해 주세요');
      const last = r.feed[r.feed.length - 1];
      if (last && at <= last.ts) return toast('마지막 메시지보다 뒤여야 합니다');
      r.nextTs = at; saveR();
      toast(fmtStamp(at) + ' 로 정했습니다');
      return renderRoomSet();
    }
    if (a === 'clearnext') {
      const r = current; if (!r) return;
      r.nextTs = 0; saveR();
      toast('되돌렸습니다');
      return renderRoomSet();
    }

    if (a === 'rsimg') {
      S.sendImage = !S.sendImage; saveS();
      return renderRoomSet();
    }

    if (a === 'rename') {
      const r = current; if (!r || !r.feed.length) return toast('먼저 대화를 불러와 주세요');
      toast('이름을 짓는 중…');
      try {
        const nm = await nameRoom(r);
        if (nm) { r.name = nm; r.autoName = false; saveR(); toast('이름을 바꿨습니다 · ' + nm); }
        else toast('이름을 만들지 못했습니다');
      } catch (e) { toast('이름을 만들지 못했습니다 · ' + e.message); }
      return renderRoomSet();
    }

    // 이미 뒤집힌 채 저장된 방을 다시 판정한다
    if (a === 'reright') {
      const r = current; if (!r) return;
      if (!r.feed.length) return toast('먼저 대화를 불러와 주세요');
      r.rightName = '';
      fixRight(r, [...new Set(r.feed.map(m => m.name))].filter(Boolean));
      saveR();
      toast(r.rightName ? '오른쪽: ' + r.rightName : '다시 잡지 못했습니다');
      return renderRoomSet();
    }

    if (a === 'clear') {
      if (!current) return;
      current.feed = []; current.rightName = '';
      saveR(); toast('대화를 지웠습니다'); return go('chat');
    }

    if (a === 'delroom') {
      if (!current) return;
      rooms = rooms.filter(r => r.id !== current.id);
      current = null; saveR(); return go('list');
    }

    if (a === 'toggleinc') {
      newInc = !newInc; renderNew();
      if (phone === 'char' && newInc && !labelDraft && !savedUserLabel()) makeLabel();
      return;
    }

    if (a === 'relabel') return makeLabel();

    if (a === 'ccancel') { $('#cropbox').classList.remove('on'); return; }
    if (a === 'cok') {
      const d = cropDone();
      $('#cropbox').classList.remove('on');
      if (!d) return toast('사진을 읽지 못했습니다');
      if (cTarget === 'char') { charAv = d; saveCA(); }
      else { S.myAvatar = d; saveS(); }
      renderHome();
      toast('프로필 사진을 설정했습니다');
      return;
    }

    if (a === 'pickav') {
      if (S.myAvatar) {
        S.myAvatar = ''; saveS(); renderHome();
        return toast('프로필 사진을 지웠습니다');
      }
      cTarget = 'me'; avPicker.click(); return;
    }
    if (a === 'pickcav') {
      if (charAv) {
        charAv = ''; saveCA(); renderHome();
        return toast('원래 프로필 사진으로 되돌렸습니다');
      }
      cTarget = 'char'; avPicker.click(); return;
    }
    if (a === 'scan') return scanProfiles();
    if (a === 'test') {
      const out = $('#s-test');
      out.textContent = '요청하는 중…';
      callLLM('한 단어로만 답한다.', '준비됐으면 OK 라고만 답해줘.')
        .then(r => { out.textContent = '연결 성공 · 응답: ' + r.slice(0, 60); })
        .catch(e => { out.textContent = '연결 실패\n' + e.message; });
      return;
    }
  });

  // reply 가 false 면 말풍선만 쌓고 답장은 받지 않는다
  function send(reply) {
    if (!current || busy) return;
    if (current.phone !== 'mine') return run(null, null);
    const ta = $('#c-in'), v = ta.value.trim();
    const pics = pending.slice();
    if (!v && !pics.length) {
      // 입력창이 비어 있는데 눌렀다면, 쌓아둔 말에 대한 답장을 받는다
      if (reply && held.length) {
        const sent = held.join('\n');
        held = [];
        return run(sent, null);
      }
      return;
    }
    let t2 = nextTime(current);
    pics.forEach(p => { current.feed.push({ name: me(), img: p, text: '', ts: t2 }); t2 += 20000; });
    if (v) current.feed.push({ name: me(), text: v, ts: t2 });
    ta.value = ''; ta.style.height = 'auto'; pending = [];
    saveR();
    if (!reply) {
      if (v) held.push(v);
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
      toast('이어서 더 보낼 수 있습니다');
      return renderChat();
    }
    const all = held.concat(v ? [v] : []).join('\n');
    held = [];
    renderChat();
    run(all || v, pics);
  }

  async function makeLabel() {
    if (labelBusy) return;
    labelBusy = true;
    const box = $('#n-sug');
    if (box) box.textContent = '이름을 정하는 중…';
    try {
      const got = await suggestLabel();
      labelDraft = got.label; labelCall = got.call;
      const el = $('#n-ulabel') || $('#n-name'); if (el) el.value = labelDraft;
      if (box) box.textContent = '';
    } catch (e) {
      if (box) box.textContent = e.message;
    } finally { labelBusy = false; }
  }

  async function makeRooms(kind) {
    const who = mainChar(), av = charPic();
    const ctx = logText();
    if (!ctx) throw new Error('원본 대화를 읽지 못했습니다');

    const sys = kind === 'char'
      ? [
        `너는 "${who}"의 휴대폰에 들어 있을 법한 채팅방 목록을 짓는다.`,
        '',
        `${who}의 처지, 직업, 건강 상태, 숨기는 것, 돈 문제, 가족 관계까지 폭넓게 읽어라.`,
        '부하나 동료만 떠올리지 말고, 그 인물의 삶에 실제로 필요한 사람을 골라라.',
        '주치의, 상담사, 변호사, 뒷일 처리하는 사람, 채권자, 옛 연인, 가족,',
        '약을 대주는 사람, 뒷조사를 맡긴 흥신소 등 무엇이든 좋다.',
        '로그에서 그 인물의 문제가 읽힌다면, 그 문제를 아는 사람이 방에 있어야 자연스럽다.',
        '',
        `개인톡과 단톡방을 합쳐 ${S.nRoom || 6}개를 만든다. 단톡방은 그중 2개다.`,
        `- 유저와의 방은 절대 만들지 마라. 그 방은 따로 관리한다.`,
        '- 개인톡 이름은 실제 사람이 연락처에 저장하듯 짧게 쓴다. 직함, 성, 별명 모두 좋다.',
        '- 개인톡은 cast 에 상대 한 명을 넣는다.',
        '- 단톡방은 cast 에 참여자를 2~4명 넣는다.',
        '  단톡방 이름은 사람 이름을 나열하지 말고, 그 모임의 목적이나 사건이 드러나게 짓는다.',
        '  날짜, 일 이름, 소속, 장소가 들어가면 좋다. 12자 이내로 짧게.',
        '- 서로 다른 영역의 사람들로 흩어라. 같은 부류만 나오면 안 된다.',
        '',
        '출력은 이 JSON 배열 하나만. 설명이나 코드펜스 금지.',
        '[{"name":"방 이름","cast":["상대 이름"],"group":false}]'
      ].join('\n')
      : [
        `너는 "${who}" 주변 인물들끼리 따로 나누는 채팅방 목록을 짓는다.`,
        `${who}도 유저도 참여하지 않는 방들이다. 둘을 cast 에 넣지 마라.`,
        '',
        '부하, 동료, 주치의, 가족, 옛 연인 등 로그에서 읽히는 주변 인물들로 구성한다.',
        '개인톡 2개와 단톡방 1개, 모두 3개를 만든다.',
        '- 개인톡은 두 사람이 주고받는 방이다. cast 에 반드시 두 명을 넣어라.',
        '- 단톡방은 cast 에 3~4명을 넣는다.',
        '  단톡방 이름은 사람 이름을 나열하지 말고 그 모임을 가리키는 말로 짓는다. 12자 이내.',
        '',
        '출력은 이 JSON 배열 하나만. 설명이나 코드펜스 금지.',
        '[{"name":"방 이름","cast":["이름","이름"],"group":false}]'
      ].join('\n');

    const body = loreBlock() + '### 원본 대화 로그\n' + ctx;
    const sysL = langBlockApp(appLang()).join('\n') + '\n' + sys;
    const want = kind === 'char' ? (Number(S.nRoom) || 6) : 3;
    let made = [], err = null;
    tokenBoost = 3500;
    try {
      for (let tryN = 0; tryN < 3 && !made.length; tryN++) {
        try {
          const arr = parseJSON(await callLLM(sysL, body), '방 목록');
          made = arr.filter(x => x && x.name).slice(0, want);
        } catch (e) { err = e; }
      }
    } finally { tokenBoost = 0; }
    if (!made.length) throw err || new Error('방 목록을 만들지 못했습니다');

    let label = '', call = '';
    if (kind === 'char') {
      try {
        const got = await suggestLabel();
        label = got.label; call = got.call;
      } catch (e) { label = me(); console.error('[zetatalk] label', e); }
    }

    const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const out = [];

    if (kind === 'char') {
      out.push({
        id: uid(), phone: 'char', type: 'dm', name: label, cast: [label],
        owner: who, avatar: av, userAvatar: '', rightName: who,
        withUser: true, userLabel: label, userCall: call, memo: '', size: 2,
        autoName: false, startTs: Date.now(), feed: []
      });
    }

    made.forEach(x => {
      let cast = Array.isArray(x.cast) ? x.cast.map(String).filter(Boolean).slice(0, 6) : [];
      if (kind === 'mob' && !x.group && cast.length < 2) {
        cast = cast.concat(String(x.name).split(/[·,]/).map(v => v.trim()).filter(Boolean))
          .filter((v, i, a) => a.indexOf(v) === i).slice(0, 2);
      }
      out.push({
        id: uid(), phone: kind, type: x.group ? 'group' : 'dm',
        name: String(x.name), cast,
        owner: kind === 'char' ? who : '', avatar: kind === 'char' ? av : '',
        userAvatar: '', rightName: kind === 'char' ? who : '',
        withUser: false, memo: '', autoName: false,
        size: x.group ? Math.max(2, cast.length) : 2,
        startTs: Date.now(), feed: []
      });
    });

    rooms = rooms.concat(out);
    saveR();
    return out.length;
  }

  async function fetchRooms(kind) {
    if (fetchBusy) return;
    fetchBusy = kind === 'char' ? 'msg' : kind;
    appErr = '';
    renderHome();
    if (view === 'apps') renderApps();
    if (view === 'list') renderList();
    try {
      const n = await makeRooms(kind);
      toast(`채팅방 ${n}개를 만들었습니다`);
    } catch (e) {
      appErr = e.message;
      toast('만들지 못했습니다 · ' + e.message + ' — 다시 눌러 주세요');
      console.error('[zetatalk]', e);
    } finally {
      fetchBusy = ''; renderHome();
      if (view === 'apps') renderApps();
      if (view === 'list') renderList();
    }
  }

  function addRoom(o) {
    const room = Object.assign({
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type: 'dm', cast: [], rel: '', owner: '', ownerLabel: '', isOwner: false,
      withChar: false, charLabel: '',
      avatar: '', userAvatar: '', rightName: '', userLabel: '',
      withUser: false, memo: '', size: 2, autoName: false, userCall: '',
      nextTs: 0, lang: '',
      startTs: Date.now(), feed: []
    }, o);
    rooms.push(room); saveR();
    current = room; statusText = ''; statusKind = ''; sysLog = []; pending = []; held = [];
    finding = false; findQ = ''; findHits = []; findAt = -1;
    $('#c-q').value = '';
    go('chat');
    // 캐릭터 방을 뺀 나머지는 열자마자 대화가 차 있게 한다
    if (room.phone === 'mine' && !room.isOwner && !room.feed.length) run(null, null);
  }

  function scanProfiles() {
    const found = [];
    const looksKey = v => typeof v === 'string' && v.length > 15 && /^[\w.\-]+$/.test(v);
    const looksUrl = v => typeof v === 'string' && /^https?:\/\//.test(v);
    const walk = (o, from, depth) => {
      if (!o || typeof o !== 'object' || depth > 4) return;
      if (Array.isArray(o)) return o.forEach(x => walk(x, from, depth + 1));
      let url = '', key = '', model = '';
      for (const [k, v] of Object.entries(o)) {
        const lk = k.toLowerCase();
        if (!url && looksUrl(v) && /url|base|endpoint|host/.test(lk)) url = v;
        if (!key && looksKey(v) && /key|token|secret|auth/.test(lk)) key = v;
        if (!model && typeof v === 'string' && v && /model/.test(lk)) model = v;
      }
      if (key || (url && model)) found.push({ from, url, key, model, name: o.name || o.label || o.title || '' });
      Object.values(o).forEach(v => walk(v, from, depth + 1));
    };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('zetatalk') === 0) continue;
      try { walk(JSON.parse(localStorage.getItem(k)), k, 0); } catch (e) {}
    }
    const out = $('#s-test');
    if (!found.length) { out.textContent = '저장된 설정을 찾지 못했습니다.'; return; }
    out.innerHTML = found.slice(0, 8).map((f, i) =>
      `<button class="act" data-pick="${i}">${esc((f.name || f.from) + ' · ' +
        (f.model || '모델 미상') + (f.url ? ' · ' + f.url.slice(0, 40) : ''))}</button>`).join('');
    out.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      const f = found[Number(b.dataset.pick)];
      if (f.url) { S.provider = 'custom'; S.apiUrl = f.url; }
      if (f.key) S.apiKey = f.key;
      if (f.model) S.model = f.model;
      saveS(); renderSettings();
      $('#s-test').textContent = '가져왔습니다. 연결 테스트를 눌러 확인해 보세요.';
    });
  }

  $('#c-in').addEventListener('input', e => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
    if (!held.length || !current || current.phone !== 'mine') return;
    const snd = $('#c-send');
    if (e.target.value.trim()) {
      snd.className = 'snd'; snd.innerHTML = S.theme === 'line' ? IC.plane : IC.up;
    } else { snd.className = 'snd txt'; snd.textContent = '답장받기'; }
  });
  // 대화방 안에서도 바로 껐다 켤 수 있게 한다
  function toggleTrans() {
    S.trans = !S.trans; saveS();
    toast(S.trans ? '번역을 함께 봅니다' : '원문만 봅니다');
    if (view === 'chat') renderChat();
    else if (view === 'roomset') renderRoomSet();
    else if (view === 'settings') renderSettings();
    else if (view === 'apps') renderApps();
    else if (view === 'app') renderApp();
    else if (view === 'qna') renderQna();
  }
  // 없는 요소를 붙잡아 뒤가 통째로 죽는 일이 없게 한다
  const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
  on('#s-img', 'click', () => {
    S.sendImage = !S.sendImage; saveS(); renderSettings();
  });

  // 홈의 턴 슬라이더
  $('#h-turns').addEventListener('input', e => {
    S.turns = Number(e.target.value); saveS();
    const n = extract().length;
    $('#h-tn').textContent = n ? `${Math.min(S.turns, n)}턴 (원본 ${n}턴)` : S.turns + '턴';
  });

  const bindS = (sel, key, num) => {
    const el = $(sel);
    const apply = () => {
      S[key] = num ? Number(el.value) : el.value;
      saveS();
    };
    el.addEventListener('input', apply);
    el.addEventListener('change', () => {
      apply();
      if (key === 'provider') { S.model = ''; saveS(); renderSettings(); }
    });
  };
  bindS('#s-prov', 'provider');
  bindS('#s-url', 'apiUrl');
  bindS('#s-key', 'apiKey');
  bindS('#s-model', 'model');
  bindS('#s-max', 'maxTokens', true);
  bindS('#s-persona', 'persona');
  const bindN = (sel, key, lo, hi) => {
    const el = $(sel);
    el.addEventListener('input', () => {
      const n = parseInt(String(el.value).replace(/[^0-9]/g, ''), 10);
      if (n) { S[key] = Math.max(lo, Math.min(hi, n)); saveS(); }
    });
    el.addEventListener('blur', () => { el.value = S[key]; });
  };
  bindN('#s-nshop', 'nShop', 1, 20);
  bindN('#s-npay', 'nPay', 1, 20);
  bindN('#s-nmusic', 'nMusic', 1, 20);
  bindN('#s-nsearch', 'nSearch', 1, 20);
  bindN('#s-nroom', 'nRoom', 2, 12);
  function applyFont() {
    root.style.setProperty('--fz', S.fontPx + 'px');
    root.style.setProperty('--fzs', Math.round((S.fontPx - 2.5) * 10) / 10 + 'px');
  }
  $('#s-fs').addEventListener('input', e => {
    S.fontPx = Number(e.target.value); saveS();
    $('#s-fpx').textContent = S.fontPx + 'px';
    applyFont();
  });
  applyFont();

  /* ── 키보드 대응 ────────────────────────────────────────────────── */
  // 키보드가 올라오면 보이는 영역에 앱을 맞춘다
  function fitView() {
    const vv = window.visualViewport;
    if (!vv) return;
    root.style.height = vv.height + 'px';
    root.style.top = vv.offsetTop + 'px';
    const open = window.innerHeight - vv.height > 80;
    root.style.setProperty('--sab', open ? '0' : '1');
    if (view === 'chat' && findAt < 0) {
      const log = $('#c-log');
      if (log) log.scrollTop = log.scrollHeight;
    }
  }

  function trackKeyboard() {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fitView);
    };
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', () => setTimeout(apply, 300));
    apply();
  }
  // 키보드는 늦게 올라온다. 몇 번 나눠 다시 맞춘다
  function nudgeView() {
    [80, 220, 450].forEach(t => setTimeout(fitView, t));
  }

  $('#c-in').addEventListener('focus', nudgeView);
  $('#e-in').addEventListener('focus', nudgeView);


  /* ═══════════════════════════════════════════════════════════════════
     타로 — 캐릭터 폰 안의 앱. 설정과 화면은 원래 그대로 쓴다
     ═══════════════════════════════════════════════════════════════════ */
  // 타로가 열려 있는 동안에는 핸드폰 화면을 감춘다
  function hidePhone() {
    root.style.display = 'none';
    back.style.display = 'none';
  }
  // 타로를 닫으면 캐릭터 폰 홈으로 되돌아온다
  function backToPhone() {
    root.style.display = 'flex';
    back.style.display = 'block';
    document.body.style.overflow = 'hidden';
    go('apps');
  }

  function openTarot() {

    const NS = '__ZETATAROT_V1__';
    const APP_ID = 'zetatarot-v1-app';
    const STYLE_ID = 'zetatarot-v1-style';
    const K_SET = 'zetatalk.v8.settings';   // 핸드폰 설정을 함께 쓴다
    function scope() {
      return (window.BamPhone && window.BamPhone.scope()) || 'default';
    }
    const K_LAST = 'zetatarot.v1.last.' + scope();

    try { window[NS] && window[NS].destroy && window[NS].destroy(); } catch (e) {}

    /* ── 설정 ──────────────────────────────────────────────────────────── */
    const DEFAULTS = {
      provider: 'gemini', apiUrl: '', apiKey: '', model: '',
      maxTokens: 2000, turns: 16, persona: '', selector: '', lang: ''
    };
    const LANG_NAME = { ja: '일본어', en: '영어', zh: '중국어' };
    // 핸드폰에서 정해 둔 언어를 그대로 따른다
    const tLang = () => { try { return appLang(); } catch (e) { return ''; } };
    const PRESET = {
      openai:     { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      openrouter: { url: 'https://openrouter.ai/api/v1', model: '' },
      gemini:     { url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
      claude:     { url: 'https://api.anthropic.com', model: 'claude-sonnet-5' },
      custom:     { url: '', model: '' }
    };
    const load = (k, d) => {
      try { const r = window.BamKV.getItem(k); return r ? JSON.parse(r) : d; } catch (e) { return d; }
    };
    let S = Object.assign({}, DEFAULTS, load(K_SET, {}));
  if (window.BamPhone && !S.apiKey) { try { Object.assign(S, window.BamPhone.api() || {}); } catch (e) {} }
    const saveS = () => { try { window.BamKV.setItem(K_SET, JSON.stringify(S)); } catch (e) {} };
    const me = () => S.persona || detectUser() || '나';

    /* ── 한국어 조사 ───────────────────────────────────────────────────── */
    const hasJong = s => {
      const t = String(s || '').trim();
      if (!t) return false;
      const c = t.charCodeAt(t.length - 1);
      if (c < 0xac00 || c > 0xd7a3) return false;
      return (c - 0xac00) % 28 !== 0;
    };
    const josaGa = n => n + (hasJong(n) ? '이' : '가');
    const josaEun = n => n + (hasJong(n) ? '은' : '는');

    /* ── 대화 읽기 ─────────────────────────────────────────────────────── */
    const CHAT_DOM_URL = 'https://zetakit.pages.dev/tools/zeta-chat-dom.js';
    function loadChatDOM() {
    if (window.BamPhone) return;
      if (window.ZetaChatDOM && window.ZetaChatDOM.extractLoadedRecords) return;
      if (document.querySelector('script[data-zp-chatdom],script[data-zt-chatdom]')) return;
      const s = document.createElement('script');
      s.dataset.ztChatdom = '1';
      s.src = CHAT_DOM_URL + '?cb=' + Date.now();
      document.head.appendChild(s);
    }

    function fromChatDOM() {
      const fn = window.ZetaChatDOM && window.ZetaChatDOM.extractLoadedRecords;
      if (typeof fn !== 'function') return null;
      let recs;
      try { recs = fn({ root: document, exclude: [], includeStatus: false }); }
      catch (e) { return null; }
      if (!Array.isArray(recs) || !recs.length) return null;
      const turns = recs.map(r => {
        const role = String(r.role || r.type || '').toLowerCase();
        if (role === 'image') return null;
        const text = String(r.text || '').trim();
        if (text.length < 2) return null;
        return { who: role === 'user' ? 'user' : 'char', name: String(r.name || '').trim(), text };
      }).filter(Boolean);
      return turns.length ? turns : null;
    }

    const sigOf = el => {
      const c = (typeof el.className === 'string' ? el.className : '')
        .trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      return el.tagName + (c ? '.' + c : '');
    };

    function autoDetect() {
      const groups = new Map();
      for (const el of document.querySelectorAll('div,li,article,section,p')) {
        if (el.closest('#' + APP_ID)) continue;
        const t = (el.innerText || '').trim();
        if (t.length < 2 || t.length > 4000 || el.children.length > 8) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 12) continue;
        const s = sigOf(el);
        if (!groups.has(s)) groups.set(s, []);
        groups.get(s).push(el);
      }
      let best = null, top = 0;
      for (const [, els] of groups) {
        if (els.length < 3) continue;
        const sc = els.reduce((n, e) => n + (e.innerText || '').trim().length, 0) * Math.min(els.length, 40);
        if (sc > top) { top = sc; best = els; }
      }
      return best;
    }

    function extract() {
    if (window.BamPhone) return window.BamPhone.turns();
      const viaModule = fromChatDOM();
      if (viaModule) return viaModule;
      let els = [];
      if (S.selector) {
        try { els = [...document.querySelectorAll(S.selector)].filter(e => !e.closest('#' + APP_ID)); }
        catch (e) { els = []; }
      }
      if (!els.length) els = autoDetect() || [];
      els = els.filter(el => !els.some(o => o !== el && el.contains(o)));
      if (!els.length) return [];
      els.sort((a, b) =>
        (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
      const cx = els.map(e => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; });
      const mid = [...cx].sort((a, b) => a - b)[Math.floor(cx.length / 2)];
      return els.map((e, i) => ({
        who: cx[i] > mid + 12 ? 'user' : 'char', name: '',
        text: (e.innerText || '').replace(/\s+\n/g, '\n').trim()
      })).filter(t => t.text.length >= 2);
    }

    let _user = null;
    function detectUser() {
      if (_user !== null) return _user;
      const tally = {};
      for (const t of extract()) {
        if (t.who !== 'user' || !t.name) continue;
        tally[t.name] = (tally[t.name] || 0) + 1;
      }
      const bad = /^(user|유저|나|me|you|사용자|guest)$/i;
      _user = Object.keys(tally).sort((a, b) => tally[b] - tally[a]).find(n => !bad.test(n)) || '';
      return _user;
    }

    function mainChar() {
    if (window.BamPhone) return window.BamPhone.charName();
      const tally = {};
      for (const t of extract()) {
        if (t.who !== 'char' || !t.name) continue;
        tally[t.name] = (tally[t.name] || 0) + 1;
      }
      const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      if (top) return top;
      const h = document.querySelector('h1,h2,header');
      return h ? (h.innerText || '').trim().split('\n')[0].slice(0, 20) : '캐릭터';
    }

    function charAvatar() {
    if (window.BamPhone) return window.BamPhone.charAvatar();
      const imgs = [...document.querySelectorAll('img')]
        .filter(i => !i.closest('#' + APP_ID))
        .map(i => ({ i, r: i.getBoundingClientRect() }))
        .filter(o => o.r.width >= 24 && o.r.width <= 90 &&
          Math.abs(o.r.width - o.r.height) < 8 && o.i.currentSrc);
      if (!imgs.length) return '';
      imgs.sort((a, b) => a.r.top - b.r.top);
      return imgs[0].i.currentSrc || '';
    }

    function callRule() {
      return [
        `${josaGa(who())} 상대를 부르는 호칭은 이 순서로 정한다.`,
        '- 1) 그 인물이 직접 하는 말 안에서 찾는다. 본명이든 애칭이든 있으면 그대로 쓴다.',
        '- 2) 대사에 없으면 별표(*) 안의 지문에서 단서를 찾아 유추한다.',
        '- 3) 그래도 애매하면 둘의 관계를 보고 어울리는 호칭을 정한다.',
        '  본명을 기본값으로 삼지 마라. 관계가 읽히면 그에 맞는 호칭이 낫다.',
        '- 지문은 둘의 관계와 거리를 읽는 데 함께 참고한다.'
      ];
    }

    const logText = () => extract().slice(-S.turns)
      .map(t => (t.who === 'user' ? (t.name || me()) : (t.name || mainChar())) + ': ' + t.text)
      .join('\n');

    /* ── API ───────────────────────────────────────────────────────────── */
    const clean = v => String(v == null ? '' : v)
      .replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '').trim();
    const baseUrl = () =>
      clean(S.provider === 'custom' ? S.apiUrl : PRESET[S.provider].url).replace(/\/+$/, '');

    async function callLLM(system, user, cap) {
      const key = clean(S.apiKey);
      if (!key) throw new Error('설정에서 API Key를 입력하세요');
      const base = baseUrl();
      if (!base) throw new Error('설정에서 API URL을 입력하세요');
      const model = clean(S.model) || PRESET[S.provider].model;
      if (!model) throw new Error('설정에서 모델 이름을 입력하세요');

      let res;
      if (S.provider === 'claude') {
        res = await fetch(base + '/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json', 'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model, max_tokens: Math.max(Number(S.maxTokens) || 2000, cap || 0), system,
            messages: [{ role: 'user', content: user }]
          })
        });
        if (!res.ok) throw new Error(res.status + ' · ' + (await res.text()).slice(0, 200));
        const d = await res.json();
        return (d.content || []).map(b => b.text || '').join('\n').trim();
      }

      const body = JSON.stringify({
        model, max_tokens: Math.max(Number(S.maxTokens) || 2000, cap || 0),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      });
      const url = /\/chat\/completions$/.test(base) ? base : base + '/chat/completions';
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
          body
        });
      } catch (e1) {
        try {
          res = await fetch(url + '?key=' + encodeURIComponent(key), {
            method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body
          });
        } catch (e2) {
          throw new Error('서버에 닿지 못했습니다');
        }
      }
      if (!res.ok) throw new Error(res.status + ' · ' + (await res.text()).slice(0, 200));
      const d = await res.json();
      return (d.choices?.[0]?.message?.content || '').trim();
    }

    /* ── 카드 ──────────────────────────────────────────────────────────── */
    const MAJOR = [
      ['바보', 'The Fool', '새로운 시작, 모험, 자유', '경솔함, 준비 부족, 방향 없음'],
      ['마법사', 'The Magician', '가능성, 의지, 실행력', '속임수, 미숙함, 재능 낭비'],
      ['여사제', 'The High Priestess', '직관, 비밀, 내면', '숨긴 것, 오해, 닫힌 마음'],
      ['여황제', 'The Empress', '풍요, 애정, 돌봄', '집착, 과보호, 공허함'],
      ['황제', 'The Emperor', '권위, 질서, 책임', '고집, 억압, 지배욕'],
      ['교황', 'The Hierophant', '전통, 조언, 신념', '독선, 형식뿐인 관계, 반발'],
      ['연인', 'The Lovers', '사랑, 결합, 선택', '갈등, 유혹, 잘못된 선택'],
      ['전차', 'The Chariot', '전진, 승리, 의지', '폭주, 방향 상실, 무리한 추진'],
      ['힘', 'Strength', '용기, 인내, 부드러운 제압', '자제력 상실, 두려움, 폭발'],
      ['은둔자', 'The Hermit', '성찰, 고독, 탐색', '고립, 회피, 외로움'],
      ['운명의 수레바퀴', 'Wheel of Fortune', '전환점, 흐름, 우연', '악순환, 때를 놓침, 불운'],
      ['정의', 'Justice', '균형, 판단, 인과', '편향, 불공정, 책임 회피'],
      ['매달린 사람', 'The Hanged Man', '멈춤, 다른 시각, 희생', '헛된 기다림, 미련, 정체'],
      ['죽음', 'Death', '끝과 시작, 변화, 단절', '붙잡음, 변화 거부, 질질 끎'],
      ['절제', 'Temperance', '조화, 절충, 치유', '과잉, 불균형, 조급함'],
      ['악마', 'The Devil', '집착, 욕망, 속박', '해방, 자각, 끊어냄'],
      ['탑', 'The Tower', '붕괴, 충격, 진실', '지연된 파국, 억지로 버팀'],
      ['별', 'The Star', '희망, 회복, 이끌림', '실망, 자신감 상실, 흐려진 목표'],
      ['달', 'The Moon', '불안, 착각, 무의식', '오해가 풀림, 진실이 드러남'],
      ['태양', 'The Sun', '기쁨, 확신, 드러남', '과신, 잠깐의 흐림, 지연된 기쁨'],
      ['심판', 'Judgement', '결정, 부름, 다시 만남', '미룸, 후회, 듣지 않음'],
      ['세계', 'The World', '완성, 성취, 하나 됨', '미완, 마무리 못 함, 답보']
    ];

    const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
      'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

    const SUITS = [
      ['완드', 'Wands', '열정과 행동'],
      ['컵', 'Cups', '감정과 관계'],
      ['소드', 'Swords', '생각과 갈등'],
      ['펜타클', 'Pentacles', '현실과 안정']
    ];

    const RANKS = [
      ['에이스', '새로운 가능성', '시작이 흐려짐'],
      ['2', '균형과 선택', '망설임과 어긋남'],
      ['3', '성장과 확장', '지연과 흐트러짐'],
      ['4', '안정과 정착', '정체와 고집'],
      ['5', '갈등과 변화', '회복의 실마리'],
      ['6', '회복과 교류', '지나간 것에 매임'],
      ['7', '고민과 방어', '헛된 계산'],
      ['8', '빠른 움직임', '멈춤과 지체'],
      ['9', '경계와 인내', '불안과 소진'],
      ['10', '완성과 부담', '무거움을 내려놓음'],
      ['페이지', '호기심과 소식', '미숙함과 헛소문'],
      ['나이트', '적극적인 움직임', '조급함과 무모함'],
      ['퀸', '성숙한 이해', '감정의 과잉'],
      ['킹', '확고한 의지', '독단과 통제욕']
    ];

    function buildDeck() {
      const out = [];
      MAJOR.forEach((m, i) => out.push({
        id: 'M' + i, major: true, mi: i, n: m[0], en: m[1], k: m[2], r: m[3]
      }));
      SUITS.forEach((su, si) => RANKS.forEach((rk, ri) => out.push({
        id: su[1][0] + rk[0], major: false, si, ri,
        n: su[0] + ' ' + rk[0], en: su[1] + ' ' + rk[0],
        suit: su[0], suitKey: su[2],
        k: su[2] + '에서 ' + rk[1], r: su[2] + '에서 ' + rk[2]
      })));
      return out;
    }
    const DECK = buildDeck();

    function shuffled() {
      const a = DECK.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a.map(c => ({ ...c, up: Math.random() > 0.3 }));
    }

    const cardLabel = c => c.n + (c.up ? '' : ' (역방향)');
    const cardMean = c => c.up ? c.k : c.r;

    /* ── 스타일 ────────────────────────────────────────────────────────── */
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
  #${APP_ID}{position:fixed;left:0;right:0;top:0;height:100%;z-index:2147483610;
   display:flex;flex-direction:column;overflow:hidden;color:#efeaf8;
   background:
    radial-gradient(120% 70% at 50% -8%,#241a4a 0%,#171233 34%,#0f0b22 66%,#08060f 100%);
   font:400 15px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;
   -webkit-text-size-adjust:100%;overscroll-behavior:contain}
  #${APP_ID} *{box-sizing:border-box;margin:0;padding:0;font-family:inherit}
  #${APP_ID} button{background:none;border:0;color:inherit;font-size:inherit}
  #zetatarot-v1-back{position:fixed;inset:0;z-index:2147483609;background:#08060f}
  #${APP_ID}::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.62;
   background:
    radial-gradient(1.5px 1.5px at 12% 14%,#fff,transparent),
    radial-gradient(1.2px 1.2px at 78% 9%,#e8e0ff,transparent),
    radial-gradient(1.7px 1.7px at 34% 24%,#fff,transparent),
    radial-gradient(1.1px 1.1px at 62% 36%,#d8ccff,transparent),
    radial-gradient(1.4px 1.4px at 88% 50%,#fff,transparent),
    radial-gradient(1.2px 1.2px at 22% 59%,#e0d6ff,transparent),
    radial-gradient(1.6px 1.6px at 55% 72%,#fff,transparent),
    radial-gradient(1.1px 1.1px at 8% 82%,#d8ccff,transparent),
    radial-gradient(1.3px 1.3px at 92% 87%,#fff,transparent),
    radial-gradient(1.2px 1.2px at 44% 93%,#f0e6ff,transparent);
   background-repeat:no-repeat}
  #${APP_ID}::after{content:'';position:absolute;inset:0;pointer-events:none;
   background:radial-gradient(120% 70% at 50% 0%,transparent 40%,rgba(0,0,0,.45) 100%)}
  #${APP_ID} .body{position:relative;z-index:1}

  /* 헤더 — 좌우 폭을 같게 잡아 제목이 정중앙에 온다 */
  #${APP_ID} .nav{flex:0 0 auto;display:flex;align-items:center;
   margin:0 -14px;padding:calc(env(safe-area-inset-top) + 12px) 8px 12px}
  #${APP_ID} .nav .side{flex:0 0 92px;display:flex;align-items:center}
  #${APP_ID} .nav .side.r{justify-content:flex-end}
  #${APP_ID} .nav .ic{flex:0 0 auto;width:42px;height:38px;font-size:18px;
   text-align:center;color:#b9b0d8}
  #${APP_ID} .nav .tt{flex:1;min-width:0;text-align:center;padding:0 2px}
  #${APP_ID} .nav .tt b{display:block;font-size:16px;font-weight:600;letter-spacing:.14em;
   color:#f3ecd8}
  #${APP_ID} .nav .tt span{display:block;font-size:11px;color:#9a90bd;
   margin-top:2px;letter-spacing:.04em}

  #${APP_ID} .body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;
   padding:0 14px calc(env(safe-area-inset-bottom) + 28px)}
  #${APP_ID} .step{display:none}
  #${APP_ID} .step.on{display:block}

  #${APP_ID} .lead{text-align:center;color:#a79dc9;font-size:13.5px;
   line-height:1.85;padding:26px 10px 22px}
  #${APP_ID} .lead.pk{padding:10px 10px 6px;line-height:1.6}
  #${APP_ID} .lead.pk b{font-size:16px;margin-bottom:7px}
  #${APP_ID} .lead.pk b::after{margin:7px auto 0}
  #${APP_ID} .pickbar{display:flex;gap:9px;margin-top:14px}
  #${APP_ID} .pickbar .go{flex:1.2;margin-top:0;padding:14px 0}
  #${APP_ID} .pickbar .ghost{flex:1;margin-top:0;padding:14px 0}
  #${APP_ID} .lead b{display:block;color:#f3ecd8;font-size:18px;font-weight:600;
   margin-bottom:11px;letter-spacing:.03em}
  #${APP_ID} .lead b::after{content:'';display:block;width:46px;height:1px;margin:11px auto 0;
   background:linear-gradient(90deg,transparent,rgba(224,196,124,.75),transparent)}

  #${APP_ID} textarea,#${APP_ID} input{width:100%;border:1px solid #423a68;outline:0;
   background:rgba(255,255,255,.055);color:#efeaf8;border-radius:14px;
   padding:14px 15px;font-size:15px;line-height:1.6;resize:none;font-family:inherit}
  #${APP_ID} textarea:focus,#${APP_ID} input:focus{border-color:#7a6ab4}
  #${APP_ID} textarea::placeholder{color:#736b95}

  #${APP_ID} .fld{margin-top:16px}
  #${APP_ID} .fld label{display:block;font-size:11.5px;color:#948ab6;
   margin-bottom:7px;letter-spacing:.04em}
  #${APP_ID} select{width:100%;border:1px solid #423a68;outline:0;-webkit-appearance:none;
   appearance:none;background:rgba(255,255,255,.055);color:#efeaf8;border-radius:14px;
   padding:14px 15px;font-size:15px;font-family:inherit}
  #${APP_ID} input[type=range]{padding:0;border:0;background:none;margin-top:4px}
  #${APP_ID} .hint{font-size:12px;color:#948ab6;line-height:1.7;
   margin-top:12px;white-space:pre-wrap}
  #${APP_ID} .hint button{display:block;width:100%;text-align:left;padding:11px 0;
   color:#b49ff0;font-size:13.5px;line-height:1.5}

  #${APP_ID} .go{display:block;width:100%;margin-top:18px;padding:15px 0;
   background:linear-gradient(180deg,#8468e4,#6247bd);border-radius:14px;
   font-size:15px;font-weight:600;color:#fff;letter-spacing:.05em;text-align:center;
   box-shadow:0 8px 22px rgba(98,71,189,.35)}
  #${APP_ID} .go:disabled{background:#2c2745;color:#6f6790;box-shadow:none}
  #${APP_ID} .ghost{display:block;width:100%;margin-top:10px;padding:13px 0;
   border:1px solid #3f3765;border-radius:14px;font-size:14px;color:#a79dc9;text-align:center}

  /* 카드 */
  /* 뽑기 — 섞기와 같은 부채에서 고른다 */
  #${APP_ID} .deck{position:relative;display:flex;justify-content:center;
   align-items:flex-end;height:180px;margin:2px 0 10px}
  #${APP_ID} .deck .cd{position:absolute;bottom:8px;width:70px;height:112px;
   aspect-ratio:auto;transform-origin:50% 240%;
   transition:transform .5s cubic-bezier(.2,.85,.3,1)}
  #${APP_ID} .taken{display:flex;flex-direction:column;gap:7px;margin:2px 0 4px}
  #${APP_ID} .taken .row{display:flex;justify-content:center;gap:8px}
  #${APP_ID} .taken .sl{width:46px;height:73px;border-radius:6px;overflow:hidden;
   box-shadow:0 3px 10px rgba(0,0,0,.45)}
  #${APP_ID} .taken .sl.by{filter:hue-rotate(40deg) brightness(1.1)}
  #${APP_ID} .taken .sl.empty{border:1px dashed rgba(255,255,255,.16);
   background:rgba(255,255,255,.02);box-shadow:none}
  #${APP_ID} .taken .sl svg{width:100%;height:100%;display:block}
  #${APP_ID} #t-shuf{position:relative;display:flex;justify-content:center;
   align-items:flex-end;height:190px;margin:6px 0 2px}
  #${APP_ID} #t-shuf .cd{position:absolute;bottom:0;width:72px;height:114px;aspect-ratio:auto;
   transform-origin:50% 240%;
   transition:transform .42s cubic-bezier(.3,.85,.35,1)}
  #${APP_ID} .cd{width:100%;aspect-ratio:180/290;border-radius:7px;position:relative;
   overflow:hidden;padding:0;line-height:0;
   box-shadow:0 3px 10px rgba(0,0,0,.45);
   transition:transform .16s,box-shadow .16s,filter .16s}
  #${APP_ID} .cd .csvg{width:100%;height:100%;display:block}
  #${APP_ID} .cd.pick{transform:translateY(-9px);
   box-shadow:0 8px 22px rgba(224,196,124,.55);filter:brightness(1.22)}
  #${APP_ID} .cd.taken{opacity:.28;pointer-events:none}
  #${APP_ID} .cd.byChar{transform:translateY(-9px);opacity:1;
   box-shadow:0 8px 22px rgba(127,168,200,.5);filter:hue-rotate(40deg) brightness(1.12)}

  #${APP_ID} .qtop{margin:14px 0 4px;padding:17px 18px;border-radius:16px;text-align:center;
   background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.02));
   border:1px solid #3f3765;font-size:15px;line-height:1.7;color:#e9e2ff;
   letter-spacing:.01em}
  #${APP_ID} .qtop::before{content:'✦ ✧ ✦';display:block;color:#d8bb72;
   font-size:11px;margin-bottom:9px;letter-spacing:.35em}

  /* ── 시안 색과 구성 ─────────────────────────────────────────────── */
  #${APP_ID}{--vio:#8b5cf6;--vio2:#6d43e0;--rose:#f0709e;--ink:#efeaf8;
   --dim:#8f86b4;--line:rgba(255,255,255,.09);--pan:rgba(255,255,255,.035)}

  /* 단계 표시줄 */
  #${APP_ID} .flow{flex:0 0 auto;position:relative;
   display:flex;justify-content:center;gap:4px;padding:2px 0 14px}
  #${APP_ID} .flow span{display:flex;flex-direction:column;align-items:center;gap:5px;
   font-size:9.5px;color:#5f5885;letter-spacing:.06em;flex:0 0 62px}
  #${APP_ID} .flow span i{display:flex;align-items:center;justify-content:center;
   width:32px;height:32px;border-radius:50%;font-style:normal;font-size:13px;
   border:1px solid var(--line);color:#6b638f;background:rgba(255,255,255,.02)}
  #${APP_ID} .flow span.on{color:#cfc4f5}
  #${APP_ID} .flow span.on i{border-color:rgba(139,92,246,.75);color:#c9b6ff;
   background:rgba(139,92,246,.16);box-shadow:0 0 14px rgba(139,92,246,.3)}
  #${APP_ID} .flow span.done i{border-color:rgba(255,255,255,.16);color:#8f86b4}

  /* 알림 배너 — 하루문답과 같은 모양 */
  #${APP_ID} .noti{position:absolute;left:10px;right:10px;
   top:calc(env(safe-area-inset-top) + 8px);z-index:60;
   transform:translateY(-160%);opacity:0;
   transition:transform .34s cubic-bezier(.2,.8,.3,1),opacity .28s;
   pointer-events:none}
  #${APP_ID} .noti.on{transform:translateY(0);opacity:1;pointer-events:auto}
  #${APP_ID} .nbox{display:flex;align-items:center;gap:11px;
   background:rgba(48,48,54,.86);border-radius:21px;padding:12px 14px;
   -webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px);
   box-shadow:0 6px 22px rgba(0,0,0,.4)}
  #${APP_ID} .nbox .nav2{flex:0 0 auto;width:38px;height:38px;border-radius:50%;
   overflow:hidden;display:flex;align-items:center;justify-content:center;
   color:#fff;font-size:15px;font-weight:600;background-size:cover;
   background-position:center;background-color:#5b4f8c}
  #${APP_ID} .nbox .ntx{flex:1;min-width:0}
  #${APP_ID} .nbox .ntx b{display:block;font-size:13.5px;font-weight:700;
   margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}
  #${APP_ID} .nbox .ntx p{font-size:13.5px;line-height:1.35;color:#e0e0e6;
   display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  #${APP_ID} .nbox i{flex:0 0 auto;font-style:normal;font-size:11.5px;
   color:#a9a2c4;align-self:flex-start}

  /* 판 */
  #${APP_ID} .panel{position:relative;margin-top:14px;padding:4px;
   border:1px solid var(--line);border-radius:16px;background:var(--pan)}
  #${APP_ID} .panel textarea{border:0;background:none;border-radius:13px}
  #${APP_ID} .panel .cnt{text-align:right;font-size:11px;color:#6b638f;padding:0 12px 8px}

  /* 질문 추천 */
  #${APP_ID} .chips{display:flex;flex-wrap:wrap;gap:7px}
  #${APP_ID} .chips button{padding:8px 13px;border-radius:11px;font-size:12.5px;
   border:1px solid var(--line);color:#b3a9d6;background:rgba(255,255,255,.03)}
  #${APP_ID} .chips button.on{border-color:rgba(139,92,246,.7);color:#d5c6ff;
   background:rgba(139,92,246,.16)}

  /* 사람 이름 — 나는 보라, 상대는 분홍 */
  #${APP_ID} .lead b.mine{display:block;width:100%;text-align:center;
   color:#b79cff;font-size:20px;letter-spacing:.02em}
  #${APP_ID} .lead b.mine.you{color:#f6a8c6}
  #${APP_ID} .lead .turn{display:block;font-style:normal;font-size:12px;
   line-height:1.75;color:#7d749f;margin-top:6px}
  #${APP_ID} .lead b.mine::after{display:none}
  #${APP_ID} .lead .qsm{display:block;font-style:normal;font-size:12px;
   color:#6b638f;margin-top:12px}
  #${APP_ID} .grp h4.you{color:#f6b7cf}

  #${APP_ID} .go{background:linear-gradient(180deg,var(--vio),var(--vio2));
   box-shadow:0 10px 26px rgba(109,67,224,.34)}
  #${APP_ID} .go:disabled{background:rgba(255,255,255,.05);color:#5f5885;box-shadow:none}
  #${APP_ID} .ghost{border-color:var(--line);color:#9b92bd}
  #${APP_ID} textarea,#${APP_ID} input,#${APP_ID} select{border-color:var(--line);
   background:rgba(255,255,255,.035)}
  #${APP_ID} textarea:focus,#${APP_ID} input:focus{border-color:rgba(139,92,246,.7)}
  #${APP_ID} .qtop{border-color:var(--line);
   background:linear-gradient(180deg,rgba(139,92,246,.1),rgba(255,255,255,.015))}

  /* 결과 화면 — 질문, 카드, 풀이가 한 화면에 들어오게 줄인다 */
  #${APP_ID} .qtop{margin:8px 0 2px;padding:11px 14px;font-size:13px;line-height:1.5}
  #${APP_ID} .qtop::before{font-size:9px;margin-bottom:5px}
  #${APP_ID} .face b{font-size:9.5px}
  #${APP_ID} .face i{font-size:7.5px}
  #${APP_ID} .fslot .pos{font-size:9.5px;margin-bottom:4px}
  #${APP_ID} .pair{gap:6px}
  #${APP_ID} .read{margin-top:24px}
  #${APP_ID} .wait{display:flex;justify-content:center;padding:26px 0}
  #${APP_ID} .sent{margin-top:16px;padding:15px;border-radius:14px;text-align:center;
   font-size:13px;line-height:1.7;color:#cfc4f5;
   border:1px solid rgba(139,92,246,.4);background:rgba(139,92,246,.12)}
  #${APP_ID} .sent em{font-style:normal;font-size:11.5px;color:#8f86b4}

  /* 카드는 두 줄. 카드 그림을 낮춰 풀이까지 한 화면에 들어오게 한다 */
  #${APP_ID} .board .grp h4{margin:14px 0 9px}
  #${APP_ID} .board .pair{gap:7px}
  #${APP_ID} .board .fslot .pos{font-size:9.5px;line-height:1.35;margin-bottom:5px;
   height:2.7em;display:flex;align-items:flex-end;justify-content:center}
  #${APP_ID} .board .face .pic{aspect-ratio:180/190;margin-bottom:4px}
  #${APP_ID} .board .face b{font-size:10px}
  #${APP_ID} .board .face i{font-size:8px;line-height:1.35}

  #${APP_ID} .grp{margin:18px 0 4px}
  #${APP_ID} .grp h4{font-size:12.5px;color:#e6dcff;letter-spacing:.12em;
   margin:16px 0 12px;text-align:center;font-weight:600;
   display:flex;align-items:center;justify-content:center;gap:11px}
  #${APP_ID} .grp h4::before,#${APP_ID} .grp h4::after{content:'';height:1px;width:36px;
   background:linear-gradient(90deg,transparent,rgba(224,196,124,.5),transparent)}
  #${APP_ID} .pair{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-items:stretch}
  #${APP_ID} .fslot{min-width:0;display:flex;flex-direction:column}
  #${APP_ID} .fslot .face{flex:1;height:auto}
  #${APP_ID} .fslot .pos{display:block;font-style:normal;font-size:10.5px;
   text-align:center;margin-bottom:5px;letter-spacing:-.01em;
   color:rgba(255,255,255,.62)}
  @keyframes tflip{
   from{transform:rotateY(90deg) scale(.94);opacity:0}
   to{transform:rotateY(0) scale(1);opacity:1}}
  #${APP_ID} .face{animation:tflip .5s cubic-bezier(.2,.8,.3,1) both}
  #${APP_ID} .face{position:relative;width:100%;min-width:0;
   display:flex;flex-direction:column;height:100%;
   border-radius:9px;padding:4px 3px 7px;text-align:center;overflow:hidden;
   background:linear-gradient(168deg,#413566 0%,#2a2350 55%,#211b42 100%);
   border:1px solid #6f5fa6;
   box-shadow:0 7px 22px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.1)}
  #${APP_ID} .face::before{content:'';position:absolute;inset:3px;border-radius:7px;
   border:1px solid rgba(224,196,124,.32);pointer-events:none}
  #${APP_ID} .face::after{content:'';position:absolute;inset:-40% -60% auto;height:120%;
   background:radial-gradient(50% 40% at 50% 0%,rgba(224,196,124,.17),transparent 70%);
   pointer-events:none}
  #${APP_ID} .face .pic{position:relative;margin-bottom:5px;line-height:0;
   aspect-ratio:180/250;overflow:hidden;border-radius:5px}
  #${APP_ID} .face .pic .csvg{width:100%;height:100%;display:block}
  #${APP_ID} .face.rev .pic .csvg{transform:rotate(180deg)}
  #${APP_ID} .face .rmark{position:absolute;top:4px;right:5px;z-index:2;
   font-size:8.5px;color:#f4c2ca;background:rgba(122,42,58,.62);
   border-radius:4px;padding:1px 4px;line-height:1.4;letter-spacing:.04em}
  #${APP_ID} .face b{position:relative;display:block;font-size:10.5px;font-weight:600;
   line-height:1.3;letter-spacing:-.02em;word-break:keep-all;color:#f1eaff}
  #${APP_ID} .face i{position:relative;display:block;font-style:normal;font-size:8.5px;
   color:#a79dc9;line-height:1.4;margin-top:3px;word-break:keep-all;flex:1}
  #${APP_ID} .face.rev{border-color:#96677a}
  #${APP_ID} .face.rev::before{border-color:rgba(210,150,162,.34)}
  #${APP_ID} .face.rev b{color:#f4cad2}

  #${APP_ID} .read{position:relative;margin-top:28px;padding:21px 19px;border-radius:18px;
   background:linear-gradient(170deg,rgba(255,255,255,.065),rgba(255,255,255,.025));
   border:1px solid #423a68;
   font-size:14.5px;line-height:1.9;white-space:pre-wrap;color:#e0d9f0;
   box-shadow:0 10px 30px rgba(0,0,0,.3)}
  #${APP_ID} .read h4{font-size:11.5px;color:#d8bb72;letter-spacing:.18em;
   margin-bottom:14px;font-weight:500;display:flex;align-items:center;gap:9px}
  #${APP_ID} .read h4::after{content:'';flex:1;height:1px;
   background:linear-gradient(90deg,rgba(224,196,124,.45),transparent)}

  /* 캐릭터 반응과 대화 */
  #${APP_ID} .say{display:flex;gap:11px;margin-top:22px;align-items:flex-start}
  #${APP_ID} .say .av{flex:0 0 auto;width:42px;height:42px;border-radius:50%;
   background-size:cover;background-position:center;background-color:#4b3f82;
   display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:#fff;
   box-shadow:0 0 0 1px rgba(224,196,124,.28)}
  #${APP_ID} .say .txt{flex:1;min-width:0;padding-top:2px}
  #${APP_ID} .say .who{font-size:12px;color:#948ab6;margin-bottom:5px}
  #${APP_ID} .say .line{font-size:15px;line-height:1.8;white-space:pre-wrap;word-break:break-word}
  #${APP_ID} .mine{margin-top:20px;text-align:right}
  #${APP_ID} .mine .line{display:inline-block;max-width:86%;text-align:left;
   font-size:15px;line-height:1.8;color:#d3cbe9;white-space:pre-wrap;word-break:break-word}
  #${APP_ID} .mine .who{font-size:12px;color:#948ab6;margin-bottom:5px}

  #${APP_ID} .dots{display:inline-flex;gap:5px;padding:6px 0}
  #${APP_ID} .dots i{width:6px;height:6px;border-radius:50%;background:#9184cf;animation:ztb 1.1s infinite}
  #${APP_ID} .dots i:nth-child(2){animation-delay:.15s}
  #${APP_ID} .dots i:nth-child(3){animation-delay:.3s}
  @keyframes ztb{0%,60%,100%{opacity:.25}30%{opacity:1}}
  @media (prefers-reduced-motion:reduce){#${APP_ID} .dots i{animation:none;opacity:.6}}

  #${APP_ID} .bar{flex:0 0 auto;display:flex;align-items:flex-end;gap:9px;
   padding:10px 14px calc(env(safe-area-inset-bottom) * var(--sab,1) + 12px);
   border-top:1px solid #2e2750;background:rgba(11,9,22,.94)}
  #${APP_ID} .bar textarea{flex:1;max-height:100px;padding:11px 15px;border-radius:20px}
  #${APP_ID} .bar .snd{flex:0 0 auto;background:#8468e4;color:#fff;border-radius:20px;
   padding:11px 16px;font-size:14px;font-weight:600}
  #${APP_ID} .bar.hide{display:none}

  #${APP_ID} .err{margin-top:18px;padding:14px;border-radius:12px;
   background:rgba(200,90,80,.16);border:1px solid rgba(200,90,80,.35);
   color:#f0c4be;font-size:12.5px;line-height:1.7;white-space:pre-wrap}

  #${APP_ID} .toast{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);
   background:rgba(239,234,248,.96);color:#16132a;font-size:13px;padding:11px 17px;
   border-radius:16px;z-index:2147483611;max-width:84%;text-align:center;line-height:1.55}
  `;
    document.head.appendChild(style);

    /* ── 마크업 ────────────────────────────────────────────────────────── */
    const back = document.createElement('div');
    back.id = 'zetatarot-v1-back';
    document.body.appendChild(back);

    const root = document.createElement('div');
    root.id = APP_ID;
    root.innerHTML = `
  <div class="noti" id="k-noti" data-a="knoti"></div>

  <div class="body" id="t-body">

    <div class="nav">
      <div class="side"><button class="ic" data-a="quit">✕</button></div>
      <div class="tt"><b>타로</b><span id="t-sub"></span></div>
      <div class="side r">
        <button class="ic" data-a="toSet">⚙</button>
        <button class="ic" data-a="reset">⟳</button>
      </div>
    </div>

    <div class="flow" id="t-flow">
      <span data-f="ask"><i>✎</i>질문</span>
      <span data-f="pick"><i>❖</i>뽑기</span>
      <span data-f="read"><i>♡</i>해석</span>
    </div>

    <div class="step on" data-s="ask">
      <div class="lead"><b>무엇이 궁금한가요</b>
        두 사람이 같은 질문에<br>카드를 뽑고 답을 함께 받게 됩니다.</div>
      <div class="panel">
        <textarea id="t-q" rows="3" placeholder="예: 우리는 앞으로 어떻게 될까"></textarea>
        <div class="cnt"><span id="t-qn">0</span>/50</div>
      </div>
      <button class="go" data-a="toShuffle">다음</button>
    </div>

    <div class="step" data-s="pick">
      <div class="lead pk"><b class="mine" id="t-pkn"></b>
        <em class="turn" id="t-turn"></em>
        <span id="t-picked"></span></div>
      <div class="deck" id="t-deck"></div>
      <div class="taken" id="t-taken"></div>
      <div class="pickbar">
        <button class="ghost" data-a="reshuffle">섞기</button>
        <button class="ghost" data-a="clearPick">다시 뽑기</button>
        <button class="go" id="t-done" data-a="toRead" disabled>완료</button>
      </div>
    </div>

    <div class="step" data-s="set">
      <div class="lead"><b>설정</b>
        카드를 읽으려면 API 연결이 필요합니다.</div>
      <div class="fld"><label>API 종류</label>
        <select id="s-prov">
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
          <option value="claude">Claude</option>
          <option value="custom">직접 입력 · OpenAI 호환</option>
        </select></div>
      <div class="fld" id="s-url-f"><label>API URL</label>
        <input type="text" id="s-url" placeholder="https://example.com/v1"></div>
      <div class="fld"><label>API Key</label>
        <input type="password" id="s-key" placeholder="키 붙여넣기"></div>
      <div class="fld"><label>모델</label><input type="text" id="s-model"></div>
      <div class="fld"><label>맥스 토큰</label>
        <input type="text" id="s-max" inputmode="numeric"></div>
      <div class="hint">추천 모델 · gemini flash</div>
      <div class="fld"><label>읽어올 최근 대화 턴 · <span id="s-tn"></span></label>
        <input type="range" id="s-turns" min="4" max="80" step="1"></div>
      <div class="fld"><label>내 이름 (비우면 자동)</label>
        <input type="text" id="s-persona" placeholder="이름 입력"></div>
      <button class="go" data-a="scan">저장된 API 프로필 찾기</button>
      <div class="hint" id="s-msg"></div>
      <button class="ghost" data-a="toAsk">시작하기</button>
    </div>

    <div class="step" data-s="read">
      <div class="qtop" id="t-qtop"></div>
      <div class="board">
        <div class="grp">
          <h4 id="t-mine-h">나</h4>
          <div class="pair" id="t-mine"></div>
        </div>
        <div class="grp">
          <h4 id="t-char-h">상대</h4>
          <div class="pair" id="t-char"></div>
        </div>
      </div>
      <div id="t-out"></div>
    </div>

  </div>

`;
    document.body.appendChild(root);
    const $ = s => root.querySelector(s);

    /* ── 유틸 ──────────────────────────────────────────────────────────── */
    const esc = s => String(s).replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const fmt = s => esc(String(s).replace(/\*/g, '').replace(/\s*\n+\s*/g, ' ').trim());

    function toast(msg) {
      const t = document.createElement('div');
      t.className = 'toast'; t.textContent = msg;
      root.appendChild(t);
      setTimeout(() => t.remove(), 3200);
    }

    /* ── 카드 그림 ─────────────────────────────────────────────────────── */
    function cardBackSVG() {
      return `<svg viewBox="0 0 180 290" xmlns="http://www.w3.org/2000/svg" class="csvg">
        <defs>
          <linearGradient id="ztb1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2a1653"/>
            <stop offset="48%" stop-color="#5b3a9e"/>
            <stop offset="100%" stop-color="#1a0e33"/>
          </linearGradient>
          <radialGradient id="ztb2"><stop offset="0%" stop-color="#f6e6b4"/>
            <stop offset="100%" stop-color="#c9a55c"/></radialGradient>
        </defs>
        <rect x="3" y="3" width="174" height="284" rx="13" fill="url(#ztb1)" stroke="#dcc07d" stroke-width="2"/>
        <rect x="11" y="11" width="158" height="268" rx="9" fill="none" stroke="#dcc07d" stroke-width="1.1" opacity=".8"/>
        <g opacity=".5" fill="#f0dda6">
          <circle cx="34" cy="42" r="1.5"/><circle cx="146" cy="60" r="1.2"/>
          <circle cx="52" cy="240" r="1.3"/><circle cx="132" cy="228" r="1.5"/>
          <circle cx="90" cy="34" r="1.1"/><circle cx="90" cy="256" r="1.1"/>
        </g>
        <circle cx="90" cy="145" r="52" fill="none" stroke="#e6cd8e" stroke-width="1.5" opacity=".85"/>
        <circle cx="90" cy="145" r="40" fill="none" stroke="#e6cd8e" stroke-width=".8" opacity=".6"/>
        <circle cx="90" cy="145" r="24" fill="url(#ztb2)" opacity=".22"/>
        <path d="M90 96 L99 136 L139 145 L99 154 L90 194 L81 154 L41 145 L81 136 Z"
          fill="none" stroke="#f0dda6" stroke-width="1.4" opacity=".95"/>
        <path d="M90 112 L95 140 L123 145 L95 150 L90 178 L85 150 L57 145 L85 140 Z"
          fill="#f0dda6" opacity=".55"/>
        <circle cx="90" cy="145" r="4" fill="#fff6dc"/>
      </svg>`;
    }

    // 메이저 아르카나 22장 — 카드마다 다른 상징
    const MG = [
      // 0 바보
      `<path d="M34 66 h32 l-6 -20 z" fill="none" stroke="#f0dda6" stroke-width="2"/>
       <circle cx="50" cy="30" r="9" fill="#f0dda6"/><path d="M50 39 v18" stroke="#f0dda6" stroke-width="2"/>`,
      // 1 마법사
      `<path d="M30 46 a10 10 0 1 1 20 0 a10 10 0 1 0 20 0" fill="none" stroke="#f0dda6" stroke-width="2.4"/>
       <path d="M50 16 v-8 M50 68 v8" stroke="#f0dda6" stroke-width="2"/>`,
      // 2 여사제
      `<rect x="24" y="18" width="8" height="60" fill="#f0dda6" opacity=".85"/>
       <rect x="68" y="18" width="8" height="60" fill="#f0dda6" opacity=".85"/>
       <path d="M50 26 a17 17 0 1 0 0 34 a13 13 0 1 1 0 -34z" fill="#f0dda6"/>`,
      // 3 여황제
      `<path d="M50 76 C24 58 26 30 50 34 C74 30 76 58 50 76z" fill="#f0dda6" opacity=".9"/>
       <path d="M32 22 l8 10 10 -14 10 14 8 -10 -4 16 h-28z" fill="#f0dda6"/>`,
      // 4 황제
      `<path d="M28 30 h44 v24 c0 16 -14 24 -22 28 c-8 -4 -22 -12 -22 -28z"
        fill="none" stroke="#f0dda6" stroke-width="2.4"/>
       <path d="M30 20 l9 9 11 -13 11 13 9 -9 -3 12 h-34z" fill="#f0dda6"/>`,
      // 5 교황
      `<path d="M50 14 v66 M32 34 h36 M38 52 h24" stroke="#f0dda6" stroke-width="2.6" fill="none"/>
       <circle cx="50" cy="14" r="4" fill="#f0dda6"/>`,
      // 6 연인
      `<circle cx="38" cy="44" r="17" fill="none" stroke="#f0dda6" stroke-width="2.2"/>
       <circle cx="62" cy="44" r="17" fill="none" stroke="#f0dda6" stroke-width="2.2"/>
       <path d="M50 70 c-8 -7 -12 -12 -12 -17 a6 6 0 0 1 12 -3 a6 6 0 0 1 12 3 c0 5 -4 10 -12 17z" fill="#f0dda6"/>`,
      // 7 전차
      `<rect x="26" y="38" width="48" height="24" rx="4" fill="none" stroke="#f0dda6" stroke-width="2.2"/>
       <circle cx="36" cy="70" r="9" fill="none" stroke="#f0dda6" stroke-width="2.2"/>
       <circle cx="64" cy="70" r="9" fill="none" stroke="#f0dda6" stroke-width="2.2"/>
       <path d="M50 14 l5 14 h-10z" fill="#f0dda6"/>`,
      // 8 힘
      `<circle cx="50" cy="48" r="20" fill="none" stroke="#f0dda6" stroke-width="2.4"/>
       <path d="M40 44 l6 4 -6 4 M60 44 l-6 4 6 4 M42 60 q8 7 16 0" stroke="#f0dda6" stroke-width="2" fill="none"/>
       <path d="M30 20 a8 8 0 1 1 16 0 a8 8 0 1 0 16 0" fill="none" stroke="#f0dda6" stroke-width="2"/>`,
      // 9 은둔자
      `<path d="M46 18 h8 v10 h-8z" fill="#f0dda6"/>
       <path d="M36 28 h28 l-4 34 h-20z" fill="none" stroke="#f0dda6" stroke-width="2.2"/>
       <circle cx="50" cy="45" r="7" fill="#f0dda6" opacity=".9"/>
       <path d="M50 62 v18" stroke="#f0dda6" stroke-width="2"/>`,
      // 10 운명의 수레바퀴
      `<circle cx="50" cy="48" r="26" fill="none" stroke="#f0dda6" stroke-width="2.4"/>
       <circle cx="50" cy="48" r="9" fill="none" stroke="#f0dda6" stroke-width="1.8"/>
       <path d="M50 22 v52 M24 48 h52 M32 30 l36 36 M68 30 l-36 36" stroke="#f0dda6" stroke-width="1.6"/>`,
      // 11 정의
      `<path d="M50 16 v62 M26 32 h48" stroke="#f0dda6" stroke-width="2.4"/>
       <path d="M26 32 l-10 20 h20z M74 32 l-10 20 h20z" fill="none" stroke="#f0dda6" stroke-width="2"/>`,
      // 12 매달린 사람
      `<path d="M22 20 h56 M50 20 v22" stroke="#f0dda6" stroke-width="2.4"/>
       <circle cx="50" cy="52" r="10" fill="#f0dda6"/>
       <path d="M50 62 v14 M50 70 l-12 10" stroke="#f0dda6" stroke-width="2.2" fill="none"/>`,
      // 13 죽음
      `<path d="M22 26 q44 6 52 44" fill="none" stroke="#f0dda6" stroke-width="3"/>
       <path d="M70 22 v58" stroke="#f0dda6" stroke-width="2.4"/>
       <circle cx="40" cy="66" r="8" fill="none" stroke="#f0dda6" stroke-width="2"/>`,
      // 14 절제
      `<path d="M28 22 l8 20 -8 8z M72 46 l-8 20 8 8z" fill="#f0dda6" opacity=".9"/>
       <path d="M36 42 q14 14 28 24" fill="none" stroke="#f0dda6" stroke-width="2" stroke-dasharray="3 4"/>`,
      // 15 악마
      `<path d="M30 24 q6 12 12 10 M70 24 q-6 12 -12 10" stroke="#f0dda6" stroke-width="2.4" fill="none"/>
       <circle cx="50" cy="46" r="17" fill="none" stroke="#f0dda6" stroke-width="2.2"/>
       <circle cx="44" cy="44" r="2.5" fill="#f0dda6"/><circle cx="56" cy="44" r="2.5" fill="#f0dda6"/>
       <path d="M38 70 a6 6 0 0 0 12 0 a6 6 0 0 0 12 0" fill="none" stroke="#f0dda6" stroke-width="2"/>`,
      // 16 탑
      `<path d="M34 78 v-38 h32 v38z" fill="none" stroke="#f0dda6" stroke-width="2.4"/>
       <path d="M30 40 h40 l-20 -12z" fill="#f0dda6"/>
       <path d="M56 12 l-12 22 h10 l-8 18" stroke="#f0dda6" stroke-width="2.4" fill="none"/>`,
      // 17 별
      `<path d="M50 16 L57 42 L83 48 L57 54 L50 80 L43 54 L17 48 L43 42 Z" fill="#f0dda6"/>
       <circle cx="24" cy="24" r="2.2" fill="#f0dda6"/><circle cx="78" cy="26" r="1.8" fill="#f0dda6"/>
       <circle cx="76" cy="72" r="2" fill="#f0dda6"/><circle cx="22" cy="70" r="1.6" fill="#f0dda6"/>`,
      // 18 달
      `<path d="M62 20 a30 30 0 1 0 0 56 a24 24 0 1 1 0 -56z" fill="#f0dda6"/>
       <path d="M22 84 q14 -8 28 0 q14 8 28 0" stroke="#f0dda6" stroke-width="2" fill="none"/>`,
      // 19 태양
      `<circle cx="50" cy="48" r="18" fill="#f0dda6"/>
       <g stroke="#f0dda6" stroke-width="2.4" stroke-linecap="round">
        <path d="M50 16 v10 M50 70 v10 M18 48 h10 M72 48 h10
         M27 25 l7 7 M66 64 l7 7 M73 25 l-7 7 M34 64 l-7 7"/></g>`,
      // 20 심판
      `<path d="M20 40 l40 -16 v34 l-40 -8z" fill="none" stroke="#f0dda6" stroke-width="2.4"/>
       <path d="M60 30 h18 v22 h-18z" fill="#f0dda6" opacity=".85"/>
       <path d="M30 62 q12 12 26 10" stroke="#f0dda6" stroke-width="1.8" fill="none" stroke-dasharray="3 4"/>`,
      // 21 세계
      `<ellipse cx="50" cy="48" rx="26" ry="34" fill="none" stroke="#f0dda6" stroke-width="2.6"/>
       <circle cx="50" cy="48" r="13" fill="none" stroke="#f0dda6" stroke-width="1.8"/>
       <path d="M50 10 l4 8 -4 -2 -4 2z M50 86 l4 -8 -4 2 -4 -2z" fill="#f0dda6"/>`
    ];

    // 수트 문양
    function suitEmblem(si, cx, cy, s) {
      const t = `translate(${cx},${cy}) scale(${s})`;
      if (si === 0) return `<g transform="${t}" stroke="#f0dda6" stroke-width="2.4" fill="none" stroke-linecap="round">
        <path d="M0 14 V-14"/><path d="M0 -14 q7 4 5 12 q-7 -3 -5 -12z"/><path d="M0 -4 q-7 3 -5 11 q7 -3 5 -11z"/></g>`;
      if (si === 1) return `<g transform="${t}" stroke="#f0dda6" stroke-width="2.2" fill="none">
        <path d="M-9 -10 h18 v5 a9 9 0 0 1 -18 0z" fill="#f0dda6" opacity=".85"/>
        <path d="M0 4 v7 M-6 12 h12"/></g>`;
      if (si === 2) return `<g transform="${t}" stroke="#f0dda6" stroke-width="2.2" fill="none" stroke-linecap="round">
        <path d="M0 -15 v24"/><path d="M-8 9 h16"/><path d="M0 9 v7"/></g>`;
      return `<g transform="${t}"><circle r="12" fill="none" stroke="#f0dda6" stroke-width="2.2"/>
        <path d="M0 -9 L5.3 7 L-8.6 -3 H8.6 L-5.3 7 Z" fill="none" stroke="#f0dda6" stroke-width="1.5"/></g>`;
    }

    const PIP = {
      1: [[50, 46]],
      2: [[50, 30], [50, 62]],
      3: [[50, 24], [50, 46], [50, 68]],
      4: [[34, 30], [66, 30], [34, 62], [66, 62]],
      5: [[34, 26], [66, 26], [50, 46], [34, 66], [66, 66]],
      6: [[34, 24], [66, 24], [34, 46], [66, 46], [34, 68], [66, 68]],
      7: [[34, 22], [66, 22], [34, 42], [66, 42], [50, 56], [34, 70], [66, 70]],
      8: [[34, 20], [66, 20], [34, 38], [66, 38], [34, 56], [66, 56], [34, 74], [66, 74]],
      9: [[32, 20], [50, 20], [68, 20], [32, 46], [50, 46], [68, 46], [32, 72], [50, 72], [68, 72]],
      10: [[32, 18], [50, 18], [68, 18], [32, 38], [50, 38], [68, 38], [32, 58], [50, 58], [68, 58], [50, 76]]
    };

    function courtGlyph(ri, si) {
      // 10 페이지 / 11 나이트 / 12 퀸 / 13 킹
      const crown = {
        10: `<path d="M36 26 h28 v6 h-28z" fill="#f0dda6"/>`,
        11: `<path d="M34 30 l16 -12 16 12 -6 6 h-20z" fill="#f0dda6"/>`,
        12: `<path d="M34 30 l6 -12 10 8 10 -8 6 12z" fill="#f0dda6"/>
             <circle cx="50" cy="14" r="3" fill="#f0dda6"/>`,
        13: `<path d="M32 30 l4 -16 8 10 6 -14 6 14 8 -10 4 16z" fill="#f0dda6"/>`
      }[ri];
      return `${crown}
        <path d="M50 38 a12 12 0 0 1 12 12 v26 h-24 v-26 a12 12 0 0 1 12 -12z"
          fill="none" stroke="#f0dda6" stroke-width="2.2"/>
        ${suitEmblem(si, 50, 58, 0.62)}`;
    }

    function cardFaceSVG(c) {
      const gid = 'zf' + String(c.id).replace(/[^a-zA-Z0-9]/g, '');
      let art = '', top = '', bottom = c.n;
      if (c.major) {
        art = MG[c.mi] || '';
        top = ROMAN[c.mi] || '';
      } else {
        const num = c.ri < 10 ? c.ri + 1 : 0;
        if (num) {
          art = PIP[num].map(p => suitEmblem(c.si, p[0], p[1], num >= 9 ? 0.5 : (num >= 6 ? 0.62 : 0.82))).join('');
        } else {
          art = courtGlyph(c.ri, c.si);
        }
        top = c.suit;
      }
      return `<svg viewBox="0 0 180 290" xmlns="http://www.w3.org/2000/svg" class="csvg">
        <defs>
          <linearGradient id="${gid}bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3a2a63"/>
            <stop offset="55%" stop-color="#241a45"/>
            <stop offset="100%" stop-color="#171029"/>
          </linearGradient>
          <linearGradient id="${gid}fr" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f4e3ae"/>
            <stop offset="50%" stop-color="#cfa95f"/>
            <stop offset="100%" stop-color="#8f6a2c"/>
          </linearGradient>
        </defs>
        <rect x="2.5" y="2.5" width="175" height="285" rx="13"
          fill="url(#${gid}bg)" stroke="url(#${gid}fr)" stroke-width="3"/>
        <rect x="10" y="10" width="160" height="270" rx="9"
          fill="none" stroke="#dcc07d" stroke-width="1" opacity=".7"/>
        <text x="90" y="34" text-anchor="middle" fill="#e8d199" font-size="13"
          letter-spacing="1.5">${esc(top)}</text>
        <path d="M28 42 h124" stroke="#dcc07d" stroke-width=".8" opacity=".5"/>
        <g transform="translate(40,58) scale(1.0)">${art}</g>
        <path d="M28 246 h124" stroke="#dcc07d" stroke-width=".8" opacity=".5"/>
        <text x="90" y="268" text-anchor="middle" fill="#f3e8c8" font-size="15"
          font-weight="600">${esc(bottom)}</text>
      </svg>`;
    }

    /* ── 상태 ──────────────────────────────────────────────────────────── */
    let step = 'ask';
    let question = '';
    let deck = [];
    let mine = [], chars = [];
    let spread = [];
    let feed = [];
    let busy = false;

    function saveLast() {
      try {
        window.BamKV.setItem(K_LAST, JSON.stringify({
          question, deck, mine, chars, spread, feed, at: Date.now()
        }));
      } catch (e) {}
    }
    function loadLast() {
      try {
        const r = window.BamKV.getItem(K_LAST);
        if (!r) return null;
        const d = JSON.parse(r);
        if (!d || !d.deck || !d.deck.length || !d.feed || !d.feed.length) return null;
        return d;
      } catch (e) { return null; }
    }
    function clearLast() { try { window.BamKV.removeItem(K_LAST); } catch (e) {} }
    const who = () => mainChar();
    const avatar = () => charAvatar();

    function renderSet() {
      $('#s-prov').value = S.provider;
      $('#s-url').value = S.apiUrl;
      $('#s-key').value = S.apiKey;
      $('#s-model').value = S.model;
      $('#s-max').value = S.maxTokens;
      $('#s-turns').value = S.turns;
      $('#s-tn').textContent = S.turns + '턴';
      $('#s-persona').value = S.persona;
      $('#s-url-f').style.display = S.provider === 'custom' ? '' : 'none';
      $('#s-model').placeholder = PRESET[S.provider].model || '모델 이름';
    }

    const FLOW = ['ask', 'pick', 'read'];
    function markFlow(s) {
      const at = FLOW.indexOf(s);
      $('#t-flow').style.display = at < 0 ? 'none' : '';
      root.querySelectorAll('#t-flow span').forEach(el => {
        const k = FLOW.indexOf(el.dataset.f);
        el.classList.toggle('on', k === at);
        el.classList.toggle('done', at >= 0 && k < at);
      });
    }

    function go(s) {
      step = s;
      root.querySelectorAll('.step').forEach(el => el.classList.toggle('on', el.dataset.s === s));
      $('#t-body').scrollTop = 0;
      markFlow(s);
      if (s === 'ask') renderAsk();
      if (s === 'pick') turnText();
      if (s === 'set') renderSet();
      if (s === 'pick') renderDeck();
      if (s === 'read') renderRead();
    }

    /* ── 질문 ──────────────────────────────────────────────────────────── */
    const Q_TIPS = [
      ['서로의 마음', '우리는 서로를 어떻게 생각하고 있을까'],
      ['속마음', '그 사람이 말하지 않는 속마음은 무엇일까'],
      ['갈등', '지금 이 어긋남은 어디서 온 걸까'],
      ['미래', '우리는 앞으로 어떻게 될까'],
      ['궁합', '우리는 잘 맞는 사이일까'],
      ['재회', '우리는 다시 가까워질 수 있을까']
    ];
    function renderAsk() {
      const box = $('#t-chips');
      if (box && !box.childElementCount) {
        box.innerHTML = Q_TIPS.map((q, i) =>
          `<button data-a="qtip" data-qi="${i}">${esc(q[0])}</button>`).join('');
      }
      const ta = $('#t-q');
      $('#t-qn').textContent = String(ta.value.trim().length);
    }

    /* ── 섞기 ──────────────────────────────────────────────────────────── */
    let shufTimer = 0;
    // 부채를 가운데로 모았다가 다시 펼친다. 그 사이에 순서를 새로 섞는다
    function reshuffle() {
      if (busy || shufTimer) return;
      const box = $('#t-deck');
      const cds = [...box.querySelectorAll('.cd')];
      if (!cds.length) return;
      mine = []; chars = [];
      cds.forEach(c => {
        c.style.transition = 'transform .34s cubic-bezier(.4,.8,.4,1)';
        c.style.transform = 'rotate(0deg)';
      });
      shufTimer = setTimeout(() => {
        deck = shuffled().slice(0, 24);
        renderDeck();
        const again = [...box.querySelectorAll('.cd')];
        again.forEach(c => { c.style.transition = 'transform .5s cubic-bezier(.2,.85,.3,1)'; });
        shufTimer = 0;
      }, 420);
    }
    function stopShuffle() { clearInterval(shufTimer); shufTimer = 0; }

    /* ── 자리 ──────────────────────────────────────────────────────────── */
    // 두 장이 각각 무엇을 가리키는지 정해 둔다. 자리가 있어야 풀이가 매번 달라진다
    const SPREADS = {
      choice: { n: '갈림길',
        mine: ['그 길로 갔을 때', '그 길을 접었을 때', '내가 놓치고 있는 것'],
        char: ['상대가 바라는 쪽', '상대가 겁내는 쪽', '상대가 못 보는 것'] },
      future: { n: '앞날',
        mine: ['가까운 앞', '흐름을 가르는 것', '그 끝에 오는 것'],
        char: ['상대에게 다가오는 것', '상대를 붙잡는 것', '상대가 맞이할 끝'] },
      bond:   { n: '사이',
        mine: ['지금 보고 있는 것', '말하지 않은 것', '바라고 있는 것'],
        char: ['상대가 보고 있는 것', '상대가 말하지 않은 것', '상대가 바라는 것'] }
    };
    function pickSpread(q) {
      const t = String(q || '');
      if (/고를|골라|선택|둘 중|어느 쪽|할까 말까|해야 할까|말아야|그만둘|접을/.test(t)) return SPREADS.choice;
      if (/앞으로|미래|나중|언제|결과|될까|되나|어떻게 될|끝나|이뤄/.test(t)) return SPREADS.future;
      return SPREADS.bond;
    }
    const spreadOf = () => spread.length ? spread : pickSpread(question).mine;

    /* ── 카드 고르기 ───────────────────────────────────────────────────── */
    const NEED = 3;

    function renderDeck() {
      const box = $('#t-deck');
      const half = (deck.length - 1) / 2;
      box.innerHTML = deck.map((c, i) => {
        const isMine = mine.includes(i);
        const isChar = chars.includes(i);
        const cls = isMine ? ' pick' : (isChar ? ' byChar' : '');
        const p = half ? (i - half) / half : 0;
        const up = (isMine || isChar) ? -14 : 0;
        const st = `transform:rotate(${(p * 33).toFixed(2)}deg) translateY(${up}px);` +
          `z-index:${10 + i}`;
        return `<button class="cd${cls}" data-i="${i}" style="${st}">${cardBackSVG()}</button>`;
      }).join('');

      // 뽑아 놓은 카드를 부채 아래에 나란히 보여 준다
      const slot = (arr, who2) => Array.from({ length: NEED }, (_, k) =>
        arr[k] == null
          ? `<div class="sl empty"></div>`
          : `<div class="sl${who2}">${cardBackSVG()}</div>`).join('');
      $('#t-taken').innerHTML =
        `<div class="row">${slot(mine, '')}</div>` +
        `<div class="row ch">${slot(chars, ' by')}</div>`;
      turnText();
      const n = mine.length < NEED ? mine.length : chars.length;
      $('#t-picked').textContent = (mine.length === NEED && chars.length === NEED)
        ? '' : `${n} / ${NEED}`;
      // 내가 세 장을 고르면 완료를 누를 수 있다. 캐릭터는 그 뒤에 고른다
      $('#t-done').disabled = mine.length !== NEED;
    }

    // 지금 누구 차례인지 위에 적어 준다
    function turnText() {
      const n = $('#t-pkn'), g = $('#t-turn');
      if (!n || !g) return;
      if (mine.length < NEED) {
        n.textContent = me(); n.className = 'mine';
        g.innerHTML = `${esc(me())}님이 고를 차례입니다.<br>` +
          `질문을 떠올리며 신중하게 ${NEED}장을 고르세요.`;
      } else {
        n.textContent = who(); n.className = 'mine you';
        g.innerHTML = chars.length >= NEED
          ? `${esc(who())}님도 ${NEED}장을 골랐습니다.<br>이제 결과를 볼 수 있습니다.`
          : `${esc(me())}님이 ${NEED}장을 골랐습니다.<br>완료를 누르면 ${esc(who())}님이 고릅니다.`;
      }
    }

    function pickCard(i) {
      if (mine.length >= NEED) return;
      const at = mine.indexOf(i);
      if (at >= 0) mine.splice(at, 1);
      else if (mine.length < NEED) mine.push(i);
      renderDeck();
    }

    function charPicks() {
      if (chars.length) return;
      const pool = deck.map((_, i) => i).filter(i => !mine.includes(i))
        .sort(() => Math.random() - 0.5).slice(0, NEED);
      pool.forEach((idx, k) => setTimeout(() => {
        chars.push(idx); renderDeck();
      }, 700 * (k + 1)));
    }

    /* ── 해석 ──────────────────────────────────────────────────────────── */
    function faceHTML(c, label, order) {
      const d = typeof order === 'number' ? `style="animation-delay:${(order * 0.45).toFixed(2)}s"` : '';
      return `<div class="fslot">
        ${label ? `<em class="pos">${esc(label)}</em>` : ''}
        <div class="face${c.up ? '' : ' rev'}" ${d}>
          ${c.up ? '' : '<span class="rmark">역</span>'}
          <div class="pic">${cardFaceSVG(c)}</div>
          <b>${esc(c.n)}</b>
          <i>${esc(cardMean(c))}</i>
        </div>
      </div>`;
    }

    function renderRead() {
      const sp = pickSpread(question);
      if (!spread.length) spread = sp.mine;
      $('#t-qtop').textContent = question;
      $('#t-mine-h').textContent = me();
      $('#t-char-h').textContent = who();
      $('#t-char-h').className = 'you';
      $('#t-mine').innerHTML = mine.map((i, k) =>
        faceHTML(deck[i], '', k)).join('');
      $('#t-char').innerHTML = chars.map((i, k) =>
        faceHTML(deck[i], '', k + mine.length)).join('');
      renderFeed();
      if (!feed.length && !busy) interpret();
    }

    function renderFeed() {
      const out = $('#t-out');
      let html = '';
      for (const m of feed) {
        if (m.type === 'read') {
          html += `<div class="read"><h4>풀이</h4>${fmt(m.text)}</div>`;
        } else if (m.type === 'sent') {
          html += `<div class="sent">${esc(who())}에게서 메시지가 왔습니다.<br>
            <em>알림을 누르면 개인톡으로 들어갑니다.</em></div>`;
        } else if (m.type === 'err') {
          html += `<div class="err">${esc(m.text)}</div>`;
        } else if (m.me) {
          html += `<div class="mine"><div class="who">${esc(me())}</div>
            <div class="line">${fmt(m.text)}</div></div>`;
        } else {
          const av = avatar();
          html += `<div class="say">
            <div class="av"${av ? ` style="background-image:url('${esc(av)}')"` : ''}>${av ? '' : esc(who()[0] || '?')}</div>
            <div class="txt"><div class="who">${esc(who())}</div>
            <div class="line">${fmt(m.text)}</div></div></div>`;
        }
      }
      if (busy) html += `<div class="wait"><span class="dots"><i></i><i></i><i></i></span></div>`;
      const done = feed.some(f => f.type === 'read');
      const sent = feed.some(f => f.type === 'sent');
      if (done && !busy) {
        html += `<button class="go" data-a="react">${esc(who())}에게 ` +
          `${sent ? '반응 한 번 더 받기' : '반응 알림 받기'}</button>`;
      }
      out.innerHTML = html;
      $('#t-body').scrollTop = $('#t-body').scrollHeight;
    }

    function cardsText() {
      const sp = pickSpread(question);
      const line = (idx, names, who2) => idx.map((i, k) =>
        `  · ${names[k] || ('자리 ' + (k + 1))} → ${cardLabel(deck[i])} (${cardMean(deck[i])})`).join('\n');
      return [
        `이번 자리 짜임: ${sp.n}`,
        `${me()}님의 세 장`,
        line(mine, sp.mine),
        `${who()}님의 세 장`,
        line(chars, sp.char)
      ].join('\n');
    }

    async function interpret() {
      if (busy) return;
      busy = true; renderFeed();
      const sys = [
        '너는 타로 상담사이자, 아래 로그에 등장하는 인물을 연기하는 작가다.',
        '',
        '이번 질문은 이것이다. 반드시 이 질문에 답해야 한다.',
        `"${question}"`,
        '',
        '두 사람이 각각 세 장씩, 모두 여섯 장을 뽑았다.',
        '각 장에는 무엇을 가리키는 자리인지 이름이 붙어 있다.',
        '카드 뜻만 읽지 말고, 그 자리가 묻는 것에 답해야 한다.',
        '',
        '풀이만 출력한다. 다른 말은 쓰지 마라.',
        '',
        '[풀이]',
        '- 카드 뜻을 나열하지 마라. 질문에 대한 답으로 읽어야 한다.',
        '',
        '  풀이의 균형에 대해',
        '  - 나온 카드가 나쁘면 나쁘게 읽어라. 좋게 돌려 말하지 마라.',
        '  - 역방향, 소드 계열, 탑, 죽음, 악마 같은 카드가 나왔는데도',
        '    희망적으로만 마무리하는 것은 잘못된 풀이다.',
        '  - 여섯 장을 세어 좋은 카드와 나쁜 카드 중 어느 쪽이 많은지 먼저 보고,',
        '    그 비중대로 풀이의 온도를 정해라.',
        '  - 나쁘게 나왔으면 "어렵습니다", "권하지 않습니다" 같은 결론도 낼 수 있다.',
        '  - 좋게 나왔으면 좋게, 애매하면 애매하게. 있는 그대로 읽어라.',
        '',
        '- 결론을 먼저 말한다. 첫 두세 문장 안에 질문에 대한 답을 낸다.',
        '  질문에 쓰인 말을 그대로 받아서 답한다.',
        `  "바보일까"라고 물었으면 바보인지 아닌지를 분명히 말한다.`,
        '  질문을 비껴가서 관계 이야기로 흘리면 잘못된 답이다.',
        '- 그 다음에 왜 그렇게 읽었는지를 풀어 쓴다.',
        '  여섯 장을 다 짚을 필요는 없다. 결론을 떠받치는 카드만 골라 쓴다.',
        '  세 장 안팎이면 족하다. 나머지는 말하지 않아도 된다.',
        '- 카드를 짚을 때는 이름을 밝히되, 매번 같은 문형으로 쓰지 마라.',
        '  "○○ 자리에는 ○○가 나왔습니다"를 되풀이하는 것은 잘못된 답이다.',
        '  카드 이름을 문장 안에 자연스럽게 녹여라.',
        '- 열 문장 안팎. 결론이 먼저 서 있으면 짧아도 된다.',
        '- 한 문장은 45자 안팎. 쉼표로 계속 이어 붙이지 마라.',
        '- 줄을 나누지 말고 한 덩어리 글로 이어서 쓴다. 줄바꿈을 넣지 마라.',
        '- 번호나 목록으로 쓰지 마라.',
        '- 역방향이면 역방향의 의미로 읽는다.',
        '- 온라인 타로 사이트처럼 차분한 존댓말.',
        `- 두 사람을 "${me()}님", "${who()}님"이라고 부른다.`,
        '  "질문자"나 "상대"라고 쓰면 잘못된 답이다.',
        '',
        '- 풀이는 한국어로 쓴다.'
      ].join('\n');

      const usr = [
        '### 원본 대화 로그', logText(),
        '', '### 뽑힌 카드', cardsText()
      ].join('\n');

      try {
        const raw = await callLLM(sys, usr, 8000);
        const read = raw.replace(/\[풀이\]/g, '').trim();
        feed.push({ type: 'read', text: read });
      } catch (e) {
        feed.push({ type: 'err', text: '풀이를 받지 못했습니다\n\n' + e.message });
      } finally {
        busy = false; renderFeed(); saveLast();
      }
    }

    // 타로 화면 위에 알림을 띄운다. 누르면 그 개인톡방으로 들어간다
    let tNotiRoom = null, tNotiTimer = 0;
    function showTarotNoti(room, name, text) {
      tNotiRoom = room;
      const av = avatar();
      const el = $('#k-noti');
      el.innerHTML = `<div class="nbox">
          <div class="nav2"${av ? ` style="background-image:url('${esc(av)}')"` : ''}>${av ? '' : esc(String(name)[0] || '?')}</div>
          <div class="ntx"><b>${esc(name)}</b><p>${esc(text)}</p></div>
          <i>지금</i>
        </div>`;
      el.classList.add('on');
      clearTimeout(tNotiTimer);
      tNotiTimer = setTimeout(() => el.classList.remove('on'), 7000);
      if (navigator.vibrate) { try { navigator.vibrate(14); } catch (e) {} }
    }
    function openTarotNoti() {
      const room = tNotiRoom;
      clearTimeout(tNotiTimer);
      $('#k-noti').classList.remove('on');
      if (!room) return;
      api.destroy();
      backToPhone();
      openRoomFromTarot(room);
    }

    // 캐릭터 반응은 화면에 띄우지 않고, 핸드폰 개인톡으로 보낸다
    async function sendReaction() {
      if (busy) return;
      const read = (feed.find(f => f.type === 'read') || {}).text || '';
      busy = true; renderFeed();
      // 보낼 개인톡방에 정해진 언어와 번역 설정을 그대로 따른다
      const room0 = ownerRoom();
      const lg = roomLang(room0);
      const tr = !!(lg && S.trans);
      const sys = [
        `너는 아래 로그에 등장하는 "${who()}"를 연기하는 작가다.`,
        `방금 ${me()}와 함께 휴대폰 타로 앱으로 타로를 봤고,`,
        '그 결과를 보고 개인 메신저로 말을 건다.',
        '- 둘이 폰으로 같이 본 타로다. 종이 카드나 점집이 아니다.',
        '  "종이쪽지", "점쟁이", "카드를 뽑아준 사람" 같은 말은 쓰지 마라.',
        '- 앱 자체를 화제로 삼지 마라. 앱이 용한지 수상한지 따지지 마라.',
        '  "수상한 앱", "그런 앱 따위" 같은 말은 금지한다.',
        '  이미 같이 본 것이고 결과가 나왔다. 그 결과에 대해서만 말한다.',
        '',
        '이번 질문은 이것이다.',
        `"${question}"`,
        '',
        '호칭 규칙',
        ...callRule().map(x => x.startsWith('-') ? x : '- ' + x),
        '',
        '호칭 규칙',
        ...callRule().map(x => x.startsWith('-') ? x : '- ' + x),
        '',
        '반응을 쓸 때',
        '- 위 질문에 대한 대답이 되도록 말한다. 질문을 잊지 마라.',
        '- 자기 카드와 상대 카드에 모두 반응한다.',
        '',
        '가장 중요한 것 — 풀이 결과에 따라 태도가 달라야 한다.',
        '- 먼저 풀이가 이 관계에 좋은 쪽인지 나쁜 쪽인지 판단해라.',
        `- 나쁘게 나왔다면, ${who()}라면 그것을 어떻게 받아들일지 정해라.`,
        '  순순히 인정할 인물인가, 카드가 틀렸다고 부정할 인물인가,',
        '  웃어넘길 인물인가, 발끈할 인물인가, 오히려 더 매달릴 인물인가.',
        '  그 인물의 성격대로 반응해라. 무난하게 넘어가지 마라.',
        `- 좋게 나왔다면 ${who()}답게 기뻐하거나, 으스대거나, 쑥스러워하거나, 시큰둥해해라.`,
        '',
        '- 대사만 쓴다. 동작, 표정, 지문, 별표, 따옴표 모두 금지한다.',
        '- 로그에서 벌어지던 상황이나 소재는 가져오지 마라. 지금은 타로를 보는 자리다.',
        '- 다만 두 사람의 관계 자체는 이야기해도 된다.',
        '- 카드는 우연히 뽑힌 것이다. 카드 내용을 두고 상대를 탓하지 마라.',
        '  상대가 그런 카드를 골라서 그렇다는 식으로 몰아가지 마라.',
        '- 말줄임표, 물음표나 느낌표를 겹쳐 쓰는 것, 감탄사는',
        '  로그에 나온 만큼만 쓴다. 로그에 없으면 새로 만들지 마라.',
        '- 말줄임표는 이 글 전체에서 많아야 한 번이다. 문장 첫머리에는 붙이지 마라.',
        '  말끝을 흐려서 감정을 대신하지 마라.',
        '- 앞서 한 말과 같은 감탄사나 같은 첫머리를 반복하지 마라.',
        '- 줄을 나누지 말고 한 덩어리로 이어서 쓴다. 줄바꿈을 넣지 마라.',
        '- 메신저 한 통이다. 두세 문장 안에서 끝낸다.',
        '  네 문장을 넘기면 잘못된 답이다.',
        '- 풀이를 요약하거나 되풀이하지 마라. 결과를 보고 든 마음만 말한다.',
        '- 자기 세 장 중 마음에 걸리는 자리 하나만 짚는다. 전부 언급하지 마라.',
        '- 한 통으로 보낸다. 여러 통으로 쪼개지 마라.',
        '',
        '첫마디에 대해',
        '- 첫마디는 매번 다르게 시작한다. 이렇게 들어갈 수 있다.',
        '  타로부터 꺼내며 ("타로 봤는데", "타로에서")',
        '  카드 한 장을 짚으며 ("컵 2 나온 거 봤어?")',
        '  결과에 대한 반응부터 ("이거 좀 웃긴데.")',
        '  아무 설명 없이 본론부터 ("나 그거 아닌 것 같은데.")',
        '- 타로라는 말로 시작하지 않아도 된다. 둘 다 방금 같이 봤으니 안다.',
        `- 같은 것을 ${who()}라면 뭐라고 부를지 정해서 그 말로 시작해도 좋다.`,
        '  무뚝뚝하면 "아까 그거", 비꼬면 "그 결과라는 게" 하는 식이다.',
        '  본보기일 뿐이니 그대로 쓰지 말고 그 인물의 말로 새로 지어라.',
        '- 다만 매번 같은 첫마디로 시작하지는 마라.',
        ...(lg ? [
          '',
          `- 대사는 반드시 ${LANG_NAME[lg]}로 쓴다. 한국어로 쓰면 잘못된 답이다.`,
          '  번역투가 아니라 그 나라 말로 처음부터 쓴 것처럼 자연스럽게 써라.',
          ...(tr ? [
            '- 아래 두 줄만 출력한다. 다른 말은 쓰지 마라.',
            '  1줄: 원문',
            '  2줄: [번역] 으로 시작하는 한국어 번역'
          ] : [])
        ] : ['', '- 한국어로 쓴다.'])
      ].join('\n');

      const usr = [
        '### 원본 대화 로그', logText(),
        '', '### 뽑힌 카드', cardsText(),
        '', '### 방금 나온 풀이', String(read || '').slice(0, 500)
      ].join('\n');

      try {
        const raw = await callLLM(sys, usr, 3000);
        let body = raw.replace(/^\[반응\]\s*/, '').trim();
        let text = body, trText = '';
        if (tr) {
          const cut = body.split(/\n?\s*\[번역\]\s*/);
          text = (cut[0] || '').trim();
          trText = (cut[1] || '').replace(/\s*\n+\s*/g, ' ').trim();
        }
        text = text.replace(/\s*\n+\s*/g, ' ').trim();
        const room = room0;
        const label = room.ownerLabel || mainChar();
        room.feed.push({ name: label, text, tr: trText, ts: nextTime(room) });
        saveR();
        feed.push({ type: 'sent', text });
        busy = false; renderFeed(); saveLast();
        showTarotNoti(room, label, text);
      } catch (e) {
        busy = false;
        feed.push({ type: 'err', text: '반응을 받지 못했습니다\n\n' + e.message });
        renderFeed();
      }
    }

    async function talk(text) {
      if (busy) return;
      busy = true; renderFeed();
      const sys = [
        `너는 아래 로그에 등장하는 "${who()}"를 연기한다.`,
        '방금 상대와 함께 타로를 봤고, 그 자리에서 이야기를 나누는 중이다.',
        '',
        `이번에 본 질문: "${question}"`,
        '',
        '호칭 규칙',
        ...callRule().map(x => x.startsWith('-') ? x : '- ' + x),
        '',
        '',
        '- 대사만 쓴다. 동작, 표정, 지문, 별표, 따옴표 모두 금지한다.',
        '- 로그에서 벌어지던 상황이나 소재는 가져오지 마라. 지금은 타로를 보는 자리다.',
        '',
        '무엇에 답할 것인가 — 이것이 가장 중요하다',
        '- 상대가 방금 한 말에 먼저 답한다. 그 답이 대사의 중심이다.',
        '- 카드 이름과 풀이 내용은 상대가 그것을 물었을 때만 꺼낸다.',
        '  묻지 않았는데 카드로 화제를 되돌리지 마라.',
        '  카드 이야기는 이미 했다. 같은 카드를 계속 되뇌지 마라.',
        '- 카드는 우연히 뽑힌 것이다. 카드 내용을 두고 상대를 탓하지 마라.',
        '',
        '- 말줄임표, 물음표나 느낌표를 겹쳐 쓰는 것, 감탄사는',
        '  로그에 나온 만큼만 쓴다. 로그에 없으면 새로 만들지 마라.',
        '- 말줄임표는 이 글 전체에서 많아야 한 번이다. 문장 첫머리에는 붙이지 마라.',
        '  말끝을 흐려서 감정을 대신하지 마라.',
        '- 앞서 한 말과 같은 감탄사나 같은 첫머리를 반복하지 마라.',
        '- 2~4문장으로 짧게. 주고받기 좋게 쓴다.',
        '- 줄을 나누지 말고 한 덩어리로 이어서 쓴다. 줄바꿈을 넣지 마라.',
        '', '- 한국어로 쓴다.'
      ].join('\n');

      // 말이 오갈수록 카드 목록을 짧게 넣는다. 자꾸 카드로 돌아가는 것을 막는다
      const turnsSoFar = feed.filter(f => f.type === 'say').length;
      const cardBlock = turnsSoFar <= 2
        ? cardsText()
        : [mine, chars].map(a => a.map(i => cardLabel(deck[i])).join(' / ')).join('\n');

      const usr = [
        '### 원본 대화 로그', logText(),
        '', '### 뽑힌 카드 (묻지 않으면 먼저 꺼내지 마라)', cardBlock,
        '', '### 지금까지 이 자리에서 오간 말',
        feed.filter(f => f.type !== 'err').map(f =>
          (f.type === 'read' ? '[풀이] ' : (f.me ? '질문자: ' : who() + ': ')) + f.text).join('\n'),
        '', '### 방금 질문자가 한 말', text
      ].join('\n');

      try {
        const said = (await callLLM(sys, usr)).trim().replace(/\s*\n+\s*/g, ' ');
        feed.push({ type: 'say', text: said });
      } catch (e) {
        feed.push({ type: 'err', text: e.message });
      } finally {
        busy = false; renderFeed(); saveLast();
      }
    }

    /* ── 이벤트 ────────────────────────────────────────────────────────── */
    root.addEventListener('input', ev => {
      if (ev.target.id === 't-q') $('#t-qn').textContent = String(ev.target.value.trim().length);
    });
    root.addEventListener('click', ev => {
      // 추천 질문이 먼저다. 카드 고르기와 겹치지 않게 따로 받는다
      const tip = ev.target.closest('[data-qi]');
      if (tip) {
        const q = Q_TIPS[Number(tip.dataset.qi) || 0];
        if (!q) return;
        $('#t-q').value = q[1];
        root.querySelectorAll('#t-chips button').forEach(b => b.classList.remove('on'));
        tip.classList.add('on');
        $('#t-qn').textContent = String(q[1].length);
        return;
      }
      const cd = ev.target.closest('[data-i]');
      if (cd) return pickCard(Number(cd.dataset.i));

      const a = ev.target.closest('[data-a]')?.dataset.a;
      if (!a) return;

      if (a === 'quit') { api.destroy(); return backToPhone(); }
      if (a === 'reset') {
        question = ''; deck = []; mine = []; chars = []; feed = [];
        $('#t-q').value = '';
        clearLast(); stopShuffle();
        return go('ask');
      }
      if (a === 'toAsk') { stopShuffle(); return go('ask'); }
      if (a === 'toSet') { stopShuffle(); return go('set'); }
      if (a === 'scan') return scanProfiles();
      if (a === 'toShuffle') {
        const v = $('#t-q').value.trim();
        if (!v) return toast('질문을 적어 주세요');
        question = v;
        deck = shuffled().slice(0, 24);
        mine = []; chars = [];
        return go('pick');
      }
      if (a === 'reshuffle') return reshuffle();
      if (a === 'clearPick') {
        if (busy) return;
        mine = []; chars = [];
        return renderDeck();
      }
      if (a === 'charPick') { return charPicks(); }
      if (a === 'toRead') {
        if (mine.length !== NEED) return toast(`카드를 ${NEED}장 골라 주세요`);
        // 상대가 아직 안 골랐으면 여기서 채운다
        if (chars.length < NEED) {
          const pool = deck.map((_, i) => i).filter(i => !mine.includes(i) && !chars.includes(i))
            .sort(() => Math.random() - 0.5);
          while (chars.length < NEED && pool.length) chars.push(pool.pop());
        }
        feed = [];
        return go('read');
      }
      if (a === 'react') return sendReaction();
      if (a === 'knoti') return openTarotNoti();
    });

    function scanProfiles() {
      const found = [];
      const looksKey = v => typeof v === 'string' && v.length > 15 && /^[\w.\-]+$/.test(v);
      const looksUrl = v => typeof v === 'string' && /^https?:\/\//.test(v);
      const walk = (o, from, depth) => {
        if (!o || typeof o !== 'object' || depth > 4) return;
        if (Array.isArray(o)) return o.forEach(x => walk(x, from, depth + 1));
        let url = '', key = '', model = '';
        for (const [k, v] of Object.entries(o)) {
          const lk = k.toLowerCase();
          if (!url && looksUrl(v) && /url|base|endpoint|host/.test(lk)) url = v;
          if (!key && looksKey(v) && /key|token|secret|auth/.test(lk)) key = v;
          if (!model && typeof v === 'string' && v && /model/.test(lk)) model = v;
        }
        if (key || (url && model)) found.push({ from, url, key, model, name: o.name || o.label || o.title || '' });
        Object.values(o).forEach(v => walk(v, from, depth + 1));
      };
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        try { walk(JSON.parse(localStorage.getItem(k)), k, 0); } catch (e) {}
      }
      const out = $('#s-msg');
      if (!found.length) { out.textContent = '저장된 설정을 찾지 못했습니다.'; return; }
      out.innerHTML = found.slice(0, 8).map((f, i) =>
        `<button data-pick="${i}">${esc((f.name || f.from) + ' · ' +
          (f.model || '모델 미상') + (f.url ? ' · ' + f.url.slice(0, 34) : ''))}</button>`).join('');
      out.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
        const f = found[Number(b.dataset.pick)];
        if (f.url) { S.provider = 'custom'; S.apiUrl = f.url; }
        if (f.key) S.apiKey = f.key;
        if (f.model) S.model = f.model;
        saveS(); renderSet();
        $('#s-msg').textContent = '가져왔습니다.';
      });
    }

    const bindS = (sel, key, num) => {
      const el = $(sel);
      const apply = () => {
        S[key] = num ? Number(el.value) : el.value;
        if (key === 'turns') $('#s-tn').textContent = S.turns + '턴';
        saveS();
      };
      el.addEventListener('input', apply);
      el.addEventListener('change', () => {
        apply();
        if (key === 'provider') { S.model = ''; saveS(); renderSet(); }
      });
    };
    bindS('#s-prov', 'provider');
    bindS('#s-url', 'apiUrl');
    bindS('#s-key', 'apiKey');
    bindS('#s-model', 'model');
    bindS('#s-max', 'maxTokens', true);
    bindS('#s-turns', 'turns', true);
    bindS('#s-persona', 'persona');

    /* ── 키보드 ────────────────────────────────────────────────────────── */
    function trackKeyboard() {
      const vv = window.visualViewport;
      if (!vv) return;
      let raf = 0;
      const apply = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          root.style.height = vv.height + 'px';
          root.style.top = vv.offsetTop + 'px';
          root.style.setProperty('--sab', window.innerHeight - vv.height > 80 ? '0' : '1');
          const b = $('#t-body');
          if (step === 'read' && b) b.scrollTop = b.scrollHeight;
        });
      };
      vv.addEventListener('resize', apply);
      vv.addEventListener('scroll', apply);
      apply();
    }

    /* ── 시작 ──────────────────────────────────────────────────────────── */
    let lock = '';
    const api = {
      open() {
        root.style.display = 'flex';
        back.style.display = 'block';
        lock = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // 핸드폰이 이미 페이지를 잠가 두었으므로 여기서는 더 건드리지 않는다
        loadChatDOM();
        trackKeyboard();
        setTimeout(() => { $('#t-sub').textContent = who(); }, 400);
        const last = loadLast();
        if (last && clean(S.apiKey)) {
          question = last.question; deck = last.deck;
          mine = last.mine; chars = last.chars; feed = last.feed;
          return go('read');
        }
        go(clean(S.apiKey) ? 'ask' : 'set');
      },
      close() {
        root.style.display = 'none'; back.style.display = 'none';
        document.body.style.overflow = lock;
      },
      destroy() {
        stopShuffle();
        document.body.style.overflow = lock;
        root.remove(); back.remove(); style.remove();
        try { delete window[NS]; } catch (e) { window[NS] = undefined; }
      }
    };
    window[NS] = api;
    api.open();
    return api;
  }

  /* ── 시작 ──────────────────────────────────────────────────────────── */
  let lock = null;
  function unlock() {
    if (!lock) return;
    document.body.style.overflow = lock.bo;
    lock = null;
  }
  const api = {
    open() {
      root.style.display = 'flex';
      back.style.display = 'block';
      lock = { bo: document.body.style.overflow };
      document.body.style.overflow = 'hidden';
      loadChatDOM();
      trackKeyboard();
      go('home');
    },
    close() {
      root.style.display = 'none'; back.style.display = 'none';
      unlock();
    },
    destroy() {
      learnStop && learnStop();
      unlock();
      root.remove(); back.remove(); style.remove();
      try { delete window[NS]; } catch (e) { window[NS] = undefined; }
    },
    debug: extract
  };
  window[NS] = api;
  api.open();
})();
