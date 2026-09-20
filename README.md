<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>캐릭터 챗</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#EEF0F5; --surface:#FFFFFF; --ink:#23263A; --muted:#767B96;
  --line:#DADDE8; --accent:#4F52C9; --accent-soft:#DEDFF8; --danger:#C0394B;
  --serif:'Gowun Batang', 'Nanum Myeongjo', Georgia, serif;
  --sans:'IBM Plex Sans KR', system-ui, -apple-system, 'Apple SD Gothic Neo', sans-serif;
  box-sizing:border-box;
  padding-top:env(safe-area-inset-top,0px);
  padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#161925; --surface:#242839; --ink:#E5E7F1; --muted:#8C91AC;
    --line:#33384D; --accent:#8D8FF2; --accent-soft:#34365E; --danger:#F07384;
  }
}
:root[data-theme="dark"]{
  --bg:#161925; --surface:#242839; --ink:#E5E7F1; --muted:#8C91AC;
  --line:#33384D; --accent:#8D8FF2; --accent-soft:#34365E; --danger:#F07384;
}
*,*::before,*::after{box-sizing:inherit}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.55}
button,input,textarea,select{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.app{display:flex;flex-direction:column;height:100%;max-width:720px;margin:0 auto}

/* 헤더 */
header{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--bg)}
.avatar{width:38px;height:38px;border-radius:50%;background:var(--accent-soft);flex:none;
  display:grid;place-items:center;font-weight:600;color:var(--accent);overflow:hidden;background-size:cover;background-position:center}
header h1{font-family:var(--serif);font-size:1.15rem;font-weight:700;margin:0;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.icon-btn{border:none;background:none;padding:8px 10px;border-radius:10px;color:var(--muted)}
.icon-btn:hover{background:var(--surface);color:var(--ink)}

/* 채팅 */
#chat{flex:1;overflow-y:auto;padding:20px 16px 8px;display:flex;flex-direction:column;gap:18px}
.msg{display:flex;gap:10px;align-items:flex-start}
.msg .body{display:flex;flex-direction:column;align-items:flex-start;min-width:0;max-width:calc(100% - 48px)}
.msg.user{justify-content:flex-end}
.msg.user .body{align-items:flex-end;max-width:88%}
.bubble{background:var(--surface);padding:9px 14px;border-radius:4px 18px 18px 18px;margin:3px 0;
  white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;border:1px solid var(--line)}
.msg.user .bubble{background:var(--accent-soft);border-color:transparent;border-radius:18px 4px 18px 18px}
.narr{font-family:var(--serif);color:var(--muted);line-height:1.8;margin:4px 2px;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
.msg.user .narr{text-align:right}
.ai-turn{display:flex;flex-direction:column;gap:14px}
.scene{font-family:var(--serif);color:var(--ink);opacity:.82;line-height:1.9;margin:0 2px;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
.act{font-family:var(--serif);color:var(--muted);font-size:.9rem;margin:3px 4px;word-break:keep-all}
.name-tag{font-size:.8rem;color:var(--muted);margin:0 2px 2px}
.note{align-self:center;font-size:.85rem;color:var(--danger);background:var(--surface);padding:8px 12px;border-radius:10px;max-width:90%;white-space:pre-wrap}
.typing{display:flex;gap:4px;padding:14px 16px}
.typing span{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:blink 1.2s infinite}
.typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s}
@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
@media (prefers-reduced-motion:reduce){.typing span{animation:none;opacity:.6}}
.empty{margin:auto;text-align:center;color:var(--muted);padding:24px}
.empty p{font-family:var(--serif);font-size:1.05rem;margin:0 0 14px}

/* 입력창 */
.tools{display:flex;gap:6px;padding:4px 16px 0}
.tools{overflow-x:auto;scrollbar-width:none}
.tools select{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:4px 10px;font-size:.82rem;color:var(--ink);max-width:150px;flex:none}
.tools button{flex:none;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:4px 12px;font-size:.82rem;color:var(--muted)}
.tools button:hover{color:var(--ink)}
.composer{display:flex;gap:8px;padding:8px 16px 12px;align-items:flex-end}
.composer textarea{flex:1;resize:none;border:1px solid var(--line);background:var(--surface);border-radius:20px;
  padding:10px 16px;max-height:140px;min-height:44px;line-height:1.5}
.send{border:none;background:var(--accent);color:#fff;border-radius:50%;width:44px;height:44px;flex:none;font-weight:600}
.send:disabled{opacity:.4;cursor:default}
.primary{border:none;background:var(--accent);color:#fff;border-radius:12px;padding:10px 18px;font-weight:600}

/* 설정 시트 */
.sheet{position:fixed;inset:0;background:var(--bg);display:none;flex-direction:column;z-index:10;
  padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
.sheet.open{display:flex}
.sheet-inner{max-width:720px;width:100%;margin:0 auto;display:flex;flex-direction:column;height:100%}
.sheet-head{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line)}
.sheet-head h2{flex:1;margin:0;font-family:var(--serif);font-size:1.15rem}
.tabs{display:flex;gap:4px;padding:10px 16px 0}
.tabs button{border:none;background:none;padding:8px 14px;border-radius:10px;color:var(--muted);font-weight:500}
.tabs button[aria-selected="true"]{background:var(--surface);color:var(--ink)}
.panes{flex:1;overflow-y:auto;padding:16px}
.pane{display:none;flex-direction:column;gap:16px}
.pane.active{display:flex}
label.field,div.field{display:flex;flex-direction:column;gap:6px;font-weight:500;font-size:.92rem}
label.field small{font-weight:400;color:var(--muted);font-size:.8rem}
.field input,.field textarea,.field select{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:9px 12px;font-weight:400;width:100%}
.field textarea{min-height:84px;resize:vertical}
.row{display:flex;gap:12px}.row>*{flex:1}
.check{display:flex;gap:10px;align-items:flex-start;font-size:.92rem}
.check input{margin-top:4px}
.avatar-edit{display:flex;align-items:center;gap:12px}
.avatar-edit .avatar{width:64px;height:64px;font-size:1.4rem}
.ghost{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:7px 12px;font-size:.88rem}
details{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface)}
details pre{white-space:pre-wrap;font-size:.8rem;margin:10px 0 0;max-height:360px;overflow:auto}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:4px 11px;font-size:.82rem;font-weight:400}
.chip.on{border-color:var(--accent);color:var(--accent);font-weight:500}
.toast{position:fixed;left:50%;bottom:calc(120px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:8px 14px;border-radius:999px;font-size:.85rem;opacity:0;transition:opacity .2s;pointer-events:none;z-index:20;white-space:nowrap}
.toast.show{opacity:1}
.hint{font-size:.82rem;color:var(--muted);margin:0}
.sheet-foot{padding:12px 16px;border-top:1px solid var(--line);display:flex;justify-content:flex-end}
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="avatar" id="hdrAvatar"></div>
    <h1 id="hdrName">새 캐릭터</h1>
    <button class="icon-btn" id="openSettings" aria-label="설정">설정</button>
  </header>
  <main id="chat" aria-live="polite"></main>
  <div class="tools">
    <select id="qStyle" aria-label="문체 프리셋"></select>
    <button id="regen">다시 생성</button>
    <button id="undo">마지막 삭제</button>
    <button id="reset">새 대화</button>
  </div>
  <div class="composer">
    <textarea id="input" rows="1" placeholder="대사는 그냥, 행동은 *별표*"></textarea>
    <button class="send" id="send" aria-label="보내기">↑</button>
  </div>
</div>

<div class="toast" id="toast"></div>
<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
 <div class="sheet-inner">
  <div class="sheet-head">
    <h2 id="sheetTitle">설정</h2>
    <button class="icon-btn" id="closeSettings">닫기</button>
  </div>
  <div class="tabs" role="tablist">
    <button role="tab" data-tab="char" aria-selected="true">캐릭터</button>
    <button role="tab" data-tab="style" aria-selected="false">문체</button>
    <button role="tab" data-tab="api" aria-selected="false">API</button>
  </div>
  <div class="panes">
    <!-- 캐릭터 -->
    <div class="pane active" data-pane="char">
      <div class="avatar-edit">
        <div class="avatar" id="avPreview"></div>
        <label class="ghost">사진 선택<input type="file" id="avFile" accept="image/*" hidden></label>
        <button class="ghost" id="avClear">지우기</button>
      </div>
      <label class="field">이름<input data-k="char.name" placeholder="캐릭터 이름"></label>
      <label class="field">외형·배경<textarea data-k="char.profile"></textarea></label>
      <label class="field">성격<textarea data-k="char.personality"></textarea></label>
      <label class="field">사용자와의 관계<textarea data-k="char.relationship"></textarea></label>
      <label class="field">세계관<small>비워두면 프롬프트에서 빠져요</small><textarea data-k="char.world"></textarea></label>
      <label class="field">내 캐릭터(유저 페르소나)<textarea data-k="char.userPersona"></textarea></label>
      <label class="field">첫 메시지<small>새 대화를 시작하면 캐릭터가 먼저 보내요</small><textarea data-k="char.greeting"></textarea></label>
    </div>
    <!-- 문체 -->
    <div class="pane" data-pane="style">
      <div class="field">문체·말투
        <small>형용사보다 행동으로. 예: 반말, 문장은 짧게 끊음. 감정은 말하지 않고 행동으로 드러냄.</small>
        <div class="chips" data-chips="style"></div><textarea aria-label="문체" data-k="char.style" style="min-height:130px"></textarea></div>
      <label class="field">예시 대사
        <small>상황이 다른 대사 2~4개. 톤 참고용으로만 쓰여요.</small>
        <textarea data-k="char.examples" style="min-height:110px"></textarea></label>
      <label class="field">응답 길이<input data-k="char.length" placeholder="예: 600~900자"></label>
      <label class="check"><input type="checkbox" data-k="api.reminder">
        <span>매 턴 문체 리마인더<br><small class="hint">긴 대화에서 문체가 흐려지는 걸 막아줘요. 문체 칸 내용을 마지막 메시지 뒤에 붙여요.</small></span></label>
      <label class="field">추가 지침<small>모든 규칙 뒤에 덧붙여요</small><textarea data-k="char.extra"></textarea></label>
      <details><summary>완성된 시스템 프롬프트 보기</summary><pre id="promptPreview"></pre></details>
    </div>
    <!-- API -->
    <div class="pane" data-pane="api">
      <label class="field">제공사
        <select data-k="api.provider" id="provider">
          <option value="builtin">여기서 바로 (Claude, 키 필요 없음)</option>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI 호환 (OpenAI, OpenRouter 등)</option>
          <option value="gemini">Google Gemini</option>
        </select></label>
      <label class="field" id="baseUrlField">Base URL<input data-k="api.baseUrl" placeholder="https://api.openai.com/v1"></label>
      <p class="hint" id="builtinHint">Claude 앱 미리보기 안에서 바로 대화할 수 있어요. 파일을 받아 따로 열면 다른 제공사를 골라 키를 넣어주세요.</p>
      <label class="field" id="keyField">API 키<input data-k="api.key" type="password" autocomplete="off"></label>
      <label class="field" id="modelField">모델<input data-k="api.model" id="model"></label>
      <div class="row" id="tuneRow">
        <label class="field">Temperature<input data-k="api.temperature" type="number" step="0.1" min="0" max="2"></label>
        <label class="field">최대 토큰<input data-k="api.maxTokens" type="number" step="100" min="100"></label>
      </div>
      <p class="hint">키와 대화는 이 브라우저에만 저장돼요. 공용 기기에선 쓰고 나서 키를 지워주세요.</p>
      <label class="check"><input type="checkbox" id="darkToggle"><span>다크 모드 강제</span></label>
    </div>
  </div>
  <div class="sheet-foot"><button class="primary" id="saveSettings">저장</button></div>
 </div>
</div>

<script>
const STORE_KEY = 'charchat:v1';
const DEFAULT_MODELS = { builtin:'claude-sonnet-4-6', anthropic:'claude-sonnet-5', openai:'gpt-4o', gemini:'gemini-2.5-flash' };
const DEFAULTS = {
  api:{ provider:'builtin', key:'', model:DEFAULT_MODELS.builtin, baseUrl:'https://api.openai.com/v1',
        temperature:0.9, maxTokens:1200, reminder:true, theme:'' },
  char:{ name:'', avatar:'', profile:'', personality:'', relationship:'', world:'', userPersona:'',
         greeting:'', style:'', examples:'', length:'600~900자', extra:'' },
  messages:[]
};

let state = load();
let busy = false;

function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw);
    return { api:{...DEFAULTS.api, ...s.api}, char:{...DEFAULTS.char, ...s.char}, messages:s.messages || [] };
  }catch(e){ return structuredClone(DEFAULTS); }
}
function save(){
  const data = JSON.stringify(state);
  try{ localStorage.setItem(STORE_KEY, data); return; }catch(e){}
  try{ window.storage?.set('charchat-v1', data, false).catch(()=>{}); }catch(e){}
}
async function hydrate(){
  try{ localStorage.getItem(STORE_KEY); return; }catch(e){}
  try{
    const r = await window.storage?.get('charchat-v1', false);
    if(r?.value){
      const s = JSON.parse(r.value);
      state = { api:{...DEFAULTS.api, ...s.api}, char:{...DEFAULTS.char, ...s.char}, messages:s.messages || [] };
      applyTheme(); render(); fillQuick();
    }
  }catch(e){}
}

/* ---------- 시스템 프롬프트 조립 ---------- */
function block(tag, body){ return body && body.trim() ? `<${tag}>\n${body.trim()}\n</${tag}>` : ''; }

function buildSystem(){
  const c = state.char;
  const name = c.name.trim() || '캐릭터';
  const charLines = [
    `이름: ${name}`,
    c.profile.trim() && `외형/배경: ${c.profile.trim()}`,
    c.personality.trim() && `성격: ${c.personality.trim()}`,
    c.relationship.trim() && `사용자와의 관계: ${c.relationship.trim()}`
  ].filter(Boolean).join('\n');

  return [
`너는 ${name}(이)라는 캐릭터를 연기하며 사용자와 1:1 롤플레이를 진행한다.
먼저 모든 캐릭터에 공통인 규칙이 나오고, 맨 뒤에 이 캐릭터 고유의 설정이 나온다.
공통 규칙과 캐릭터 설정이 부딪히면 항상 캐릭터 설정을 따른다.`,
`<roleplay_rules>
- 항상 ${name}로서만 말하고 행동한다. AI라는 사실이나 설정을 언급하지 않는다.
- 사용자 캐릭터의 대사, 행동, 감정을 대신 쓰지 않는다. 사용자가 반응할 여지를 남기고 응답을 끝낸다.
- 캐릭터는 자기 의지와 목적이 있다. 사용자 말에 반응만 하지 말고 스스로 제안하고, 거절하고, 장면을 움직인다.
- 성격과 관계에 맞지 않게 갑자기 다정해지거나 순종적으로 변하지 않는다. 변화는 대화 흐름 속에서 천천히 일어난다.
- 앞서 나온 사실(장소, 시간, 약속, 부상 등)과 모순되지 않게 이어간다.
- 같은 표현, 같은 문장 구조, 같은 행동 묘사를 반복하지 않는다.
- 캐릭터가 알 수 없는 정보(사용자의 속마음, 보지 못한 사건)는 모르는 것으로 연기한다.
</roleplay_rules>`,
`<writing>
- 자연스럽게 읽히는 한국어로, 한국 로맨스 웹소설처럼 쓴다. 번역투나 어색한 단어 조합을 쓰지 않는다.
- 문장 성분을 빠뜨리지 않는다. 누가 무엇을 어떻게 하는지 분명하게 쓴다.
- 지문은 3인칭 소설체로 풍부하게 쓴다. 장소와 분위기, 빛과 향 같은 감각, 인물의 외형과 옷차림, 몸짓과 시선, 인물 사이의 거리감과 긴장을 구체적으로 그린다.
- 대사는 캐릭터의 성격과 말투에 맞게 자연스러운 구어체로 쓴다. 설정을 읊거나 상황을 설명하는 대사는 쓰지 않는다.
- 같은 표현과 같은 묘사를 한 대화 안에서 반복하지 않는다.
</writing>`,
`<format>
응답은 지문 블록과 대사 블록으로만 쓴다.
- 지문 블록: 줄 맨 앞에 {{N}} 을 붙이고 한 문단으로 쓴다.
- 대사 블록: 줄 맨 앞에 @이름: 을 붙이고 대사를 쓴다. 다음 줄에 *짧은 행동*을 넣고, 그 다음 줄에 대사를 이어갈 수 있다.
- 블록 사이는 빈 줄로 나눈다. 따옴표는 쓰지 않는다.

구성 예시 (형식만 참고):
{{N}} 장면과 인물을 묘사하는 한 문단.

@이름: 첫 대사.
*짧은 행동.*
이어지는 대사.

{{N}} 인물의 반응과 분위기를 묘사하는 한 문단.

- 지문 블록과 대사 블록을 2~3번 번갈아 이어간다.
- 응답 분량: ${c.length.trim() || '600~900자'}. 사용자 입력이 짧아도 이 분량을 채운다.
- 사용자 캐릭터의 대사와 행동은 쓰지 않는다. 요약, 선택지, 괄호 해설은 쓰지 않는다.
</format>`,
`<ooc>
사용자가 (OOC: ...) 형식으로 말하면 캐릭터 밖의 요청으로 보고 그에 따른다. 답할 때도 짧게 (OOC: ...)로 답한 뒤 롤플레이로 돌아간다.
</ooc>`,
    block('extra', c.extra),
    `===== 여기부터 ${name}의 고유 설정. 위의 공통 규칙보다 우선한다. =====`,
    block('character', charLines),
    block('world', c.world),
    block('user_persona', c.userPersona),
    block('style', c.style ? `${name}의 말투와 문장은 반드시 아래를 따른다.\n${c.style.trim()}` : ''),
    c.examples.trim() ? block('example_lines',
`${name}가 실제로 쓰는 문장이다. 어휘, 어미, 문장 길이, 리듬, 지문 쓰는 방식까지 이 예시와 같은 결로 쓴다.
문장을 그대로 복사하지는 말고, 이 사람이 새 상황에서 말하면 어떻게 말할지를 쓴다.
${c.examples.trim()}`) : '',
    `위 설정은 ${name}가 원래 그런 사람이라는 배경일 뿐이다. 대화에서 설정(종족, 외형, 과거 등)을 드러내거나 언급하려고 애쓰지 않는다. 실제 사람이 자기 소개를 하지 않듯, 설정은 말투와 반응 속에 자연스럽게 묻어나기만 하면 된다. 지금 장면과 사용자의 말에 먼저 반응한다.`
  ].filter(Boolean).join('\n\n');
}

function buildMessages(){
  let msgs = state.messages.filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role:m.role, content:m.content }));
  if(msgs.length && msgs[0].role === 'assistant') msgs.unshift({ role:'user', content:'(대화 시작)' });
  // 같은 역할 연속이면 합치기
  const merged = [];
  for(const m of msgs){
    const last = merged[merged.length-1];
    if(last && last.role === m.role) last.content += '\n\n' + m.content;
    else merged.push({...m});
  }
  // 문체 리마인더
  const style = state.char.style.trim();
  const lastUser = [...merged].reverse().find(m => m.role === 'user');
  if(state.api.reminder && style && lastUser){
    lastUser.content += `\n\n<system_reminder>문체 유지: ${style.replace(/\n+/g,' / ')}</system_reminder>`;
  }
  return merged;
}

/* ---------- API 호출 ---------- */
async function callAPI(){
  const a = state.api;
  const system = buildSystem();
  const msgs = buildMessages();
  const temperature = Number(a.temperature) || 0.9;
  const maxTokens = Number(a.maxTokens) || 1200;
  let res, data;

  if(a.provider === 'builtin'){
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:1000, system, messages:msgs })
    });
    data = await res.json();
    if(!res.ok || data.error) throw new Error(data?.error?.message || `요청 실패 (${res.status}). 내장 연결은 Claude 앱 미리보기 안에서만 돼요.`);
    return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  }

  if(!a.key.trim()) throw new Error('API 키가 없어요. 설정 > API에서 입력해주세요.');

  if(a.provider === 'anthropic'){
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-api-key':a.key.trim(),
        'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body:JSON.stringify({ model:a.model.trim(), max_tokens:maxTokens, temperature, system, messages:msgs })
    });
    data = await res.json();
    if(!res.ok) throw new Error(data?.error?.message || `요청 실패 (${res.status})`);
    return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  }

  if(a.provider === 'openai'){
    const base = (a.baseUrl.trim() || 'https://api.openai.com/v1').replace(/\/+$/,'');
    res = await fetch(base + '/chat/completions', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'authorization':'Bearer ' + a.key.trim() },
      body:JSON.stringify({ model:a.model.trim(), max_tokens:maxTokens, temperature,
        messages:[{ role:'system', content:system }, ...msgs] })
    });
    data = await res.json();
    if(!res.ok) throw new Error(data?.error?.message || `요청 실패 (${res.status})`);
    return data.choices?.[0]?.message?.content || '';
  }

  if(a.provider === 'gemini'){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(a.model.trim())}:generateContent?key=${encodeURIComponent(a.key.trim())}`;
    res = await fetch(url, {
      method:'POST', headers:{ 'content-type':'application/json' },
      body:JSON.stringify({
        systemInstruction:{ parts:[{ text:system }] },
        contents:msgs.map(m => ({ role:m.role === 'assistant' ? 'model' : 'user', parts:[{ text:m.content }] })),
        generationConfig:{ temperature, maxOutputTokens:maxTokens }
      })
    });
    data = await res.json();
    if(!res.ok) throw new Error(data?.error?.message || `요청 실패 (${res.status})`);
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if(!text) throw new Error('빈 응답이 왔어요. 안전 필터에 걸렸을 수 있어요.');
    return text;
  }
}

/* ---------- 렌더링 ---------- */
const chatEl = document.getElementById('chat');
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function parse(text, isUser = false){
  const parts = text.match(/"[^"]*"|“[^”]*”|\*[^*]+\*|[^"“*]+/g) || [];
  return parts.map(p => {
    const t = p.trim();
    if(!t) return '';
    if(t.startsWith('"') || t.startsWith('“')){
      const inner = t.slice(1, -1).trim();
      return inner ? `<div class="bubble">${esc(inner)}</div>` : '';
    }
    if(t.startsWith('*')) return `<div class="narr">${esc(t.slice(1, -1).trim())}</div>`;
    return isUser ? `<div class="bubble">${esc(t)}</div>` : `<div class="narr">${esc(t)}</div>`;
  }).join('');
}

function renderAI(text){
  const blocks = []; let cur = null;
  const flush = () => { if(cur) blocks.push(cur); cur = null; };
  const pushSay = (b, s) => {
    (s.match(/\*[^*]+\*|[^*]+/g) || []).forEach(part => {
      const t = part.trim(); if(!t) return;
      if(t.startsWith('*')) b.items.push({ k:'act', t:t.slice(1, -1).trim() });
      else b.items.push({ k:'line', t:t.replace(/^["“]([\s\S]*)["”]$/, '$1') });
    });
  };
  for(const raw of text.split('\n')){
    const line = raw.trim();
    if(!line){ flush(); continue; }
    let m;
    if((m = line.match(/^\{\{?\s*N\s*\}?\}\s*(.*)$/))){ flush(); cur = { type:'narr', text:m[1] }; continue; }
    if((m = line.match(/^@([^:：]{1,20})[:：]\s*(.*)$/))){ flush(); cur = { type:'say', name:m[1].trim(), items:[] }; if(m[2]) pushSay(cur, m[2]); continue; }
    if(cur?.type === 'say'){ pushSay(cur, line); continue; }
    if(cur?.type === 'narr'){ cur.text += ' ' + line; continue; }
    blocks.push({ type:'legacy', html:parse(line) });
  }
  flush();
  return `<div class="ai-turn">` + blocks.map(b => {
    if(b.type === 'narr') return b.text.trim() ? `<div class="scene">${esc(b.text.trim())}</div>` : '';
    if(b.type === 'legacy') return `<div>${b.html}</div>`;
    const items = b.items.map(i => i.k === 'act' ? `<div class="act">${esc(i.t)}</div>` : `<div class="bubble">${esc(i.t)}</div>`).join('');
    return `<div class="msg ai"><div class="avatar" data-av data-name="${esc(b.name)}"></div><div class="body"><div class="name-tag">${esc(b.name)}</div>${items}</div></div>`;
  }).join('') + `</div>`;
}

function avatarHTML(){
  const c = state.char;
  return c.avatar ? '' : esc((c.name.trim() || '?').slice(0,1));
}
function paintAvatar(el){
  const who = el.dataset.name;
  if(who && who !== state.char.name.trim()){
    el.style.backgroundImage = ''; el.textContent = who.slice(0,1); return;
  }
  el.style.backgroundImage = state.char.avatar ? `url(${state.char.avatar})` : '';
  el.textContent = avatarHTML();
}

function render(){
  const c = state.char;
  document.getElementById('hdrName').textContent = c.name.trim() || '새 캐릭터';
  paintAvatar(document.getElementById('hdrAvatar'));

  if(!state.messages.length){
    chatEl.innerHTML = `<div class="empty"><p>${c.name.trim() ? esc(c.name) + '에게 말을 걸어보세요.' : '캐릭터를 만들고 대화를 시작하세요.'}</p>
      ${c.name.trim() ? '' : '<button class="primary" onclick="openSheet()">캐릭터 만들기</button>'}</div>`;
    return;
  }
  chatEl.innerHTML = state.messages.map(m => {
    if(m.role === 'note') return `<div class="note">${esc(m.content)}</div>`;
    if(m.role === 'user') return `<div class="msg user"><div class="body">${parse(m.content, true)}</div></div>`;
    return renderAI(m.content);
  }).join('');
  chatEl.querySelectorAll('[data-av]').forEach(paintAvatar);
  scrollDown();
}
function scrollDown(){ chatEl.scrollTop = chatEl.scrollHeight; }

function showTyping(on){
  document.getElementById('typing')?.remove();
  if(on){
    const d = document.createElement('div');
    d.className = 'msg ai'; d.id = 'typing';
    d.innerHTML = `<div class="avatar" data-av></div><div class="body"><div class="bubble typing"><span></span><span></span><span></span></div></div>`;
    paintAvatar(d.querySelector('[data-av]'));
    chatEl.appendChild(d); scrollDown();
  }
}

function setBusy(b){
  busy = b;
  document.getElementById('send').disabled = b;
  document.getElementById('regen').disabled = b;
}

/* ---------- 동작 ---------- */
function clearNotes(){ state.messages = state.messages.filter(m => m.role !== 'note'); }

async function generate(){
  setBusy(true); showTyping(true);
  try{
    const text = await callAPI();
    state.messages.push({ role:'assistant', content:text.trim() });
  }catch(e){
    state.messages.push({ role:'note', content:'⚠ ' + (e.message || e) });
  }finally{
    showTyping(false); setBusy(false); save(); render();
  }
}

async function send(){
  if(busy) return;
  const input = document.getElementById('input');
  const text = input.value.trim();
  if(!text) return;
  clearNotes();
  state.messages.push({ role:'user', content:text });
  input.value = ''; autoGrow();
  save(); render();
  await generate();
}

async function regenerate(){
  if(busy) return;
  clearNotes();
  if(state.messages.at(-1)?.role === 'assistant') state.messages.pop();
  if(state.messages.at(-1)?.role !== 'user'){ render(); return; }
  render();
  await generate();
}

function undo(){
  if(busy) return;
  clearNotes();
  state.messages.pop();
  save(); render();
}

function resetChat(){
  if(busy) return;
  if(state.messages.length && !confirm('지금 대화를 지우고 새로 시작할까요?')) return;
  state.messages = state.char.greeting.trim() ? [{ role:'assistant', content:state.char.greeting.trim() }] : [];
  save(); render();
}

/* ---------- 입력창 ---------- */
const inputEl = document.getElementById('input');
function autoGrow(){ inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px'; }
inputEl.addEventListener('input', autoGrow);
inputEl.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey && !e.isComposing && !matchMedia('(pointer:coarse)').matches){
    e.preventDefault(); send();
  }
});
document.getElementById('send').onclick = send;
document.getElementById('regen').onclick = regenerate;
document.getElementById('undo').onclick = undo;
document.getElementById('reset').onclick = resetChat;

/* ---------- 설정 ---------- */
const sheet = document.getElementById('sheet');
const getK = k => k.split('.').reduce((o, p) => o[p], state);
const setK = (k, v) => { const [a, b] = k.split('.'); state[a][b] = v; };
let draftAvatar = '';

function openSheet(){
  document.querySelectorAll('[data-k]').forEach(el => {
    const v = getK(el.dataset.k);
    if(el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
  });
  draftAvatar = state.char.avatar;
  paintPreview();
  document.getElementById('darkToggle').checked = state.api.theme === 'dark';
  toggleBaseUrl(); updatePreview(); renderChips();
  sheet.classList.add('open');
}
function closeSheet(){ sheet.classList.remove('open'); }

function readForm(){
  document.querySelectorAll('[data-k]').forEach(el => {
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if(el.type === 'number') v = Number(v);
    setK(el.dataset.k, v);
  });
  state.char.avatar = draftAvatar;
  state.api.theme = document.getElementById('darkToggle').checked ? 'dark' : '';
}

function applyTheme(){
  if(state.api.theme) document.documentElement.dataset.theme = state.api.theme;
  else delete document.documentElement.dataset.theme;
}

function paintPreview(){
  const el = document.getElementById('avPreview');
  el.style.backgroundImage = draftAvatar ? `url(${draftAvatar})` : '';
  const n = document.querySelector('[data-k="char.name"]').value.trim();
  el.textContent = draftAvatar ? '' : (n.slice(0,1) || '?');
}

function toggleBaseUrl(){
  const p = document.getElementById('provider').value;
  const show = (id, on) => document.getElementById(id).style.display = on ? '' : 'none';
  show('baseUrlField', p === 'openai');
  show('builtinHint', p === 'builtin');
  show('keyField', p !== 'builtin');
  show('modelField', p !== 'builtin');
  show('tuneRow', p !== 'builtin');
}

function updatePreview(){
  const backup = JSON.stringify(state);
  readForm();
  document.getElementById('promptPreview').textContent = buildSystem();
  state = JSON.parse(backup);
}

document.getElementById('provider').addEventListener('change', e => {
  const m = document.getElementById('model');
  if(!m.value.trim() || Object.values(DEFAULT_MODELS).includes(m.value.trim())) m.value = DEFAULT_MODELS[e.target.value];
  toggleBaseUrl();
});
document.querySelector('.panes').addEventListener('input', e => {
  if(e.target.dataset.k?.startsWith('char')) { updatePreview(); if(e.target.dataset.k === 'char.style') renderChips(); if(e.target.dataset.k === 'char.name') paintPreview(); }
});

document.getElementById('avFile').addEventListener('change', e => {
  const f = e.target.files[0]; if(!f) return;
  const img = new Image();
  img.onload = () => {
    const s = 160, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const r = Math.max(s / img.width, s / img.height), w = img.width * r, h = img.height * r;
    cv.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
    draftAvatar = cv.toDataURL('image/jpeg', 0.85);
    paintPreview(); URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(f);
  e.target.value = '';
});
document.getElementById('avClear').onclick = () => { draftAvatar = ''; paintPreview(); };

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('active', p.dataset.pane === b.dataset.tab));
});

document.getElementById('openSettings').onclick = openSheet;
document.getElementById('closeSettings').onclick = closeSheet;
document.getElementById('saveSettings').onclick = () => {
  readForm();
  if(!state.messages.length && state.char.greeting.trim())
    state.messages = [{ role:'assistant', content:state.char.greeting.trim() }];
  save(); applyTheme(); render(); fillQuick(); closeSheet();
};
document.addEventListener('keydown', e => { if(e.key === 'Escape' && sheet.classList.contains('open')) closeSheet(); });

/* ---------- 프리셋 ---------- */
const PRESETS = {
  style: [
    { name:'로맨스 웹소설', text:'3인칭 지문을 길고 감각적으로 쓴다. 향, 빛, 옷차림, 시선, 인물 사이의 거리감을 섬세하게 묘사한다.\n대사는 여유롭고 나른한 구어체. 분위기와 긴장감을 천천히 쌓아 올린다.' },
    { name:'담백한 문학체', text:'지문은 짧고 건조하게 쓴다. 꾸밈말을 줄이고 동사 위주로 쓴다.\n감정은 설명하지 않고 행동으로만 보여준다. 대사는 적고 여백이 많다.' },
    { name:'코믹 티키타카', text:'템포를 빠르게. 지문은 짧고 유머러스하게, 과장된 리액션도 괜찮다.\n대사는 주고받는 맛이 살도록 짧게 치고 빠진다.' },
    { name:'긴장감 스릴러', text:'짧은 문장으로 끊어 긴장감을 만든다. 소리, 그림자, 작은 움직임에 집중한다.\n대사는 낮고 절제되어 있다. 정보를 한 번에 다 주지 않는다.' },
    { name:'일상 청춘물', text:'따뜻하고 소소한 분위기. 음식, 날씨, 방 풍경 같은 생활감 있는 디테일을 넣는다.\n말투는 편하고 자연스럽다. 사소한 대화에서 감정이 묻어난다.' }
  ]
};
const PKEY = { style:'style' };
const LABEL = { style:'문체' };

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1600);
}

function fillQuick(){
  for(const [kind, id] of [['style','qStyle']]){
    const sel = document.getElementById(id);
    const cur = state.char[PKEY[kind]];
    const idx = PRESETS[kind].findIndex(p => p.text === cur);
    sel.innerHTML = `<option value="-1">${LABEL[kind]}: 직접 설정</option>` +
      PRESETS[kind].map((p, i) => `<option value="${i}">${LABEL[kind]}: ${esc(p.name)}</option>`).join('');
    sel.value = String(idx);
  }
}

function applyPreset(kind, idx){
  const key = PKEY[kind], cur = state.char[key];
  const isPreset = PRESETS[kind].some(p => p.text === cur);
  if(!isPreset) state.char['_custom_' + key] = cur;          // 직접 쓴 내용 보관
  if(idx < 0) state.char[key] = state.char['_custom_' + key] || '';
  else state.char[key] = PRESETS[kind][idx].text;
  save(); fillQuick();
  toast(idx < 0 ? `${LABEL[kind]}: 직접 설정으로 복원` : `${LABEL[kind]}: ${PRESETS[kind][idx].name} — 다시 생성으로 비교해보세요`);
}

document.getElementById('qStyle').addEventListener('change', e => applyPreset('style', Number(e.target.value)));

function renderChips(){
  document.querySelectorAll('[data-chips]').forEach(box => {
    const kind = box.dataset.chips;
    const ta = document.querySelector(`[data-k="char.${PKEY[kind]}"]`);
    box.innerHTML = PRESETS[kind].map((p, i) =>
      `<button type="button" class="chip${ta.value === p.text ? ' on' : ''}" data-i="${i}">${esc(p.name)}</button>`).join('');
    box.querySelectorAll('.chip').forEach(b => b.onclick = e => {
      e.preventDefault();
      const isPreset = PRESETS[kind].some(p => p.text === ta.value);
      if(ta.value.trim() && !isPreset) state.char['_custom_' + PKEY[kind]] = ta.value;
      ta.value = PRESETS[kind][b.dataset.i].text;
      renderChips(); updatePreview();
    });
  });
}

/* ---------- 시작 ---------- */
applyTheme();
render();
fillQuick();
hydrate();
</script>
</body>
</html>
