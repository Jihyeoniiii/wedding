/* 청첩장 편집 모드 (주소 뒤에 ?edit 를 붙이면 열립니다)
   - 글자: 화면에서 바로 눌러서 수정
   - 사진: 눌러서 바꾸기 / 보이는 부분 조정
   - 블록: 순서 바꾸기, 숨기기, 추가, 삭제
   - 자동 저장(이 기기), 게시하기(GitHub에 바로 올림) */
(function () {
  'use strict';
  var I, $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS_DRAFT = 'inv_draft_v1', LS_GH = 'inv_gh_v1', LS_HELP = 'inv_help_v1';
  var mem = {};
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] == null ? null : mem[k]; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };
  function esc(s) { return I.esc(s); }
  function C() { return I.content(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return 'b' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 5); }
  function move(arr, from, to) { arr.splice(to, 0, arr.splice(from, 1)[0]); }
  var IC = {
    edit: '✎', up: '↑', down: '↓', eye: '👁', trash: '🗑', plus: '+', grip: '⠿', copy: '⧉'
  };

  /* ---------------- 사진 임시 저장소 (게시 전 사진은 이 기기에 보관) ---------------- */
  var db = null, memImgs = {};
  function idbOpen() {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open('invite-editor', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('imgs', { keyPath: 'path' }); };
        r.onsuccess = function () { db = r.result; res(); };
        r.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function idbPut(rec) {
    memImgs[rec.path] = rec;
    if (!db) return Promise.resolve();
    return new Promise(function (res) { try { var tx = db.transaction('imgs', 'readwrite'); tx.objectStore('imgs').put(rec); tx.oncomplete = res; tx.onerror = res; } catch (e) { res(); } });
  }
  function idbAll() {
    if (!db) return Promise.resolve(Object.keys(memImgs).map(function (k) { return memImgs[k]; }));
    return new Promise(function (res) { try { var r = db.transaction('imgs').objectStore('imgs').getAll(); r.onsuccess = function () { res(r.result || []); }; r.onerror = function () { res([]); }; } catch (e) { res([]); } });
  }
  function idbDel(path) { delete memImgs[path]; if (db) try { db.transaction('imgs', 'readwrite').objectStore('imgs').delete(path); } catch (e) {} }

  function compress(file, max, q) {
    return new Promise(function (res) {
      if (!/^image\/(jpeg|png|webp|heic|heif)/i.test(file.type || '')) return res(file);
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b || file); }, 'image/jpeg', q);
      };
      im.onerror = function () { URL.revokeObjectURL(url); res(file); };
      im.src = url;
    });
  }
  function addFile(file, kind) {
    var isImg = kind !== 'music';
    return (isImg ? compress(file, 2000, 0.86) : Promise.resolve(file)).then(function (blob) {
      var ext = isImg ? 'jpg' : ((file.name.match(/\.(\w+)$/) || [])[1] || 'mp3').toLowerCase();
      var path = (isImg ? 'images/u/' : 'music/') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.' + ext;
      I.imgMap[path] = URL.createObjectURL(blob);
      return idbPut({ path: path, blob: blob, type: blob.type || file.type, published: false, t: Date.now() }).then(function () { return path; });
    });
  }
  function pickFiles(multiple, accept) {
    return new Promise(function (res) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept || 'image/*'; inp.multiple = !!multiple;
      inp.style.display = 'none'; document.body.appendChild(inp);
      inp.addEventListener('change', function () { res(Array.prototype.slice.call(inp.files || [])); inp.remove(); });
      inp.click();
    });
  }

  /* ---------------- 저장 / 되돌리기 ---------------- */
  var hist = [], lastSnap = '', published = null, saveT = null, renderT = null;
  function snapshot() {
    var s = JSON.stringify(C());
    if (s !== lastSnap) { hist.push(s); if (hist.length > 80) hist.shift(); lastSnap = s; }
    updUndo();
  }
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      store.set(LS_DRAFT, JSON.stringify({ t: Date.now(), content: C() }));
      status('이 기기에 저장됨 · 게시 전');
      markDirty(true);
    }, 300);
  }
  function commit(path, val, rerender) {
    snapshot();
    I.set(path, val);
    lastSnap = '';
    save();
    if (rerender !== false) scheduleRender();
  }
  function scheduleRender() { clearTimeout(renderT); renderT = setTimeout(function () { I.render(); }, 220); }
  function undo() {
    if (!hist.length) return I.toast('되돌릴 내용이 없어요.');
    var cur = JSON.stringify(C()), prev = hist.pop();
    if (prev === cur && hist.length) prev = hist.pop();
    lastSnap = '';
    I.setContent(JSON.parse(prev)); save(); refreshPanel(); updUndo();
  }
  function updUndo() { var b = $('[data-ed="undo"]'); if (b) b.disabled = !hist.length; }
  function status(t) { var s = $('.ed-status'); if (s) s.textContent = t; }
  function markDirty(d) { var b = $('[data-ed="publish"]'); if (b) b.classList.toggle('dirty', !!d); }

  /* ---------------- 블록 종류와 편집 항목 ---------------- */
  var RATIO = [['', '기본'], ['auto', '원본 비율 그대로'], ['1/1', '정사각형'], ['4/5', '세로 4:5'], ['3/4', '세로 3:4'], ['2/3', '세로 2:3'], ['4/3', '가로 4:3'], ['16/9', '가로 16:9']];
  var GAP = [['', '기본'], ['0', '붙여서'], ['2', '아주 좁게'], ['6', '좁게'], ['12', '넓게']];
  var LAYOUT_OPTS = [['grid', '갤러리형 (3-3-2)'], ['full', '1장씩 크게'], ['two', '2장씩'], ['three', '3장씩'], ['big2', '큰 1장 + 작은 2장'], ['slide', '넘겨보기'], ['masonry', '자유 높이 (2열)']];
  var photoFields = [
    { k: 'title', t: 'text', l: '제목 (비우면 없음)' },
    { k: 'layout', t: 'select', l: '사진 배치', o: LAYOUT_OPTS },
    { k: 'ratio', t: 'select', l: '사진 비율', o: RATIO },
    { k: 'gap', t: 'select', l: '사진 간격', o: GAP },
    { k: 'photos', t: 'photos', l: '사진 (끌어서 순서 변경)' }
  ];
  var SCHEMA = {
    cover: [{ k: 'photo', t: 'image', l: '메인 사진' }, { k: 'script', t: 'text', l: '사진 위 손글씨 (영어 추천)' }, { k: 'sub', t: 'text', l: '손글씨 아래 작은 글씨', ph: '예: 2027. 10. 09 SAT' }],
    greeting: [{ k: 'title', t: 'text', l: '제목' }, { k: 'text', t: 'textarea', l: '인사말' }],
    quote: [{ k: 'text', t: 'textarea', l: '글귀' }, { k: 'source', t: 'text', l: '출처' }],
    profile: [{ t: 'note', l: '이름, 연락처, 혼주 정보는 [기본정보]에서 고쳐요.' }, { k: 'groomPhoto', t: 'image', l: '신랑 사진' }, { k: 'groomBio', t: 'textarea', l: '신랑 소개' }, { k: 'bridePhoto', t: 'image', l: '신부 사진' }, { k: 'brideBio', t: 'textarea', l: '신부 소개' }],
    calendar: [{ k: 'title', t: 'text', l: '제목' }, { t: 'note', l: '날짜, 시간, 예식장은 [기본정보]에서 넣어요. 날짜를 넣으면 달력과 D-day가 자동으로 생겨요.' }],
    location: [{ k: 'title', t: 'text', l: '제목' }, { t: 'note', l: '예식장 이름과 주소는 [기본정보]에서 넣어요.' },
      { k: 'items', t: 'list', l: '교통 안내', add: { icon: '🚌', title: '버스', text: '' }, f: [{ k: 'icon', t: 'text', l: '아이콘(이모지)' }, { k: 'title', t: 'text', l: '제목' }, { k: 'text', t: 'textarea', l: '내용' }] }],
    notice: [{ k: 'title', t: 'text', l: '제목 (동그란 띠)' }, { k: 'text', t: 'textarea', l: '내용' }, { k: 'button', t: 'text', l: '버튼 글자 (비우면 없음)' }, { k: 'url', t: 'text', l: '버튼 링크 (비우면 오시는 길로 이동)' }],
    photos: photoFields.concat([{ k: 'caption', t: 'text', l: '사진 설명 (선택)' }]),
    gallery: photoFields,
    interview: [{ k: 'title', t: 'text', l: '제목' }, { k: 'text', t: 'textarea', l: '설명' },
      { k: 'items', t: 'list', l: '질문과 답', add: { q: '새 질문', a: '' }, f: [{ k: 'q', t: 'text', l: '질문' }, { k: 'a', t: 'textarea', l: '답' }] }],
    history: [{ k: 'title', t: 'text', l: '제목' },
      { k: 'items', t: 'list', l: '타임라인', add: { date: '20XX', title: '제목', text: '', photo: '' }, f: [{ k: 'photo', t: 'image', l: '사진' }, { k: 'date', t: 'text', l: '날짜' }, { k: 'title', t: 'text', l: '제목' }, { k: 'text', t: 'textarea', l: '내용' }] }],
    tabs: [{ k: 'items', t: 'list', l: '탭', add: { tab: '새 탭', photo: '', text: '' }, f: [{ k: 'tab', t: 'text', l: '탭 이름' }, { k: 'photo', t: 'image', l: '사진 (선택)' }, { k: 'text', t: 'textarea', l: '내용' }] }],
    text: [{ k: 'title', t: 'text', l: '제목 (선택)' }, { k: 'photo', t: 'image', l: '사진 (선택)' }, { k: 'text', t: 'textarea', l: '내용' }],
    accounts: [{ k: 'title', t: 'text', l: '제목' }, { k: 'text', t: 'textarea', l: '설명' },
      { k: 'groom', t: 'list', l: '신랑측 계좌', add: { role: '신랑', name: '', bank: '', number: '', kakaopay: '' }, f: [{ k: 'role', t: 'text', l: '관계 (신랑/아버지/어머니)' }, { k: 'name', t: 'text', l: '예금주' }, { k: 'bank', t: 'text', l: '은행' }, { k: 'number', t: 'text', l: '계좌번호' }, { k: 'kakaopay', t: 'text', l: '카카오페이 송금 링크 (선택)' }] },
      { k: 'bride', t: 'list', l: '신부측 계좌', add: { role: '신부', name: '', bank: '', number: '', kakaopay: '' }, f: [{ k: 'role', t: 'text', l: '관계 (신부/아버지/어머니)' }, { k: 'name', t: 'text', l: '예금주' }, { k: 'bank', t: 'text', l: '은행' }, { k: 'number', t: 'text', l: '계좌번호' }, { k: 'kakaopay', t: 'text', l: '카카오페이 송금 링크 (선택)' }] }],
    rsvp: [{ k: 'title', t: 'text', l: '제목' }, { k: 'text', t: 'textarea', l: '설명' }, { t: 'note', l: '처음 접속할 때 팝업으로 띄우려면 [기본정보]에서 켜요. 답변은 구글 시트에 쌓여요.' }],
    photoShare: [{ k: 'title', t: 'text', l: '제목' }, { k: 'text', t: 'textarea', l: '설명' }, { t: 'note', l: '하객 사진은 구글드라이브 WeddingPhoto. 폴더에 보낸 사람 이름별로 원본 그대로 모여요.' }],
    guestbook: [{ k: 'title', t: 'text', l: '제목' }],
    together: [{ k: 'title', t: 'text', l: '제목' }, { k: 'since', t: 'date', l: '사귄 날 (비우면 숨김)' }],
    wreath: [{ k: 'url', t: 'text', l: '화환 주문 링크 (비우면 숨김)' }, { k: 'text', t: 'text', l: '설명' }],
    ending: [{ k: 'photo', t: 'image', l: '사진' }, { k: 'text', t: 'textarea', l: '사진 위 글' }]
  };
  var NEW = {
    greeting: { title: '소중한 분들을 초대합니다.', text: '인사말을 적어주세요.' },
    quote: { text: '글귀를 적어주세요.', source: '' },
    profile: { groomPhoto: '', bridePhoto: '', groomBio: '소개를 적어주세요.', brideBio: '소개를 적어주세요.' },
    calendar: { title: '예식 안내' },
    location: { title: '오시는 길', items: [] },
    notice: { title: '피로연 안내', text: '내용을 적어주세요.', button: '', url: '' },
    photos: { title: '', layout: 'two', ratio: '', gap: '', photos: [], caption: '' },
    gallery: { title: '갤러리', layout: 'grid', photos: [] },
    interview: { title: '웨딩 인터뷰', text: '두 분의 인터뷰를 준비했습니다.', items: [{ q: '새 질문', a: '' }] },
    history: { title: '우리의 히스토리', items: [{ date: '20XX', title: '첫만남', text: '', photo: '' }] },
    tabs: { items: [{ tab: '안내', photo: '', text: '내용을 적어주세요.' }] },
    text: { title: '제목', text: '내용을 적어주세요.', photo: '' },
    accounts: { title: '마음 전하실 곳', text: '', groom: [], bride: [] },
    rsvp: { title: '참석 여부 전달', text: '참석 여부를 알려주세요.' },
    photoShare: { title: '사진 공유하기', text: '결혼식 날 찍어주신 사진을 나눠주세요.' },
    guestbook: { title: '방명록' },
    together: { title: '함께한 시간', since: '' },
    wreath: { url: '', text: '축하의 마음을 담아 전해보세요.' },
    ending: { photo: '', text: '' }
  };
  var ADD_ORDER = ['photos', 'text', 'notice', 'gallery', 'greeting', 'quote', 'profile', 'calendar', 'location', 'interview', 'history', 'tabs', 'accounts', 'rsvp', 'photoShare', 'guestbook', 'together', 'wreath', 'ending'];
  var ADD_DESC = { photos: '사진을 원하는 모양으로 배치', text: '제목 + 글 + 사진', notice: '테두리 박스 안내 (피로연 등)', gallery: '눌러서 크게 보는 사진 모음' };

  var SITE = [
    { t: 'head', l: '신랑' },
    { k: 'site.groom.last', t: 'text', l: '성' }, { k: 'site.groom.first', t: 'text', l: '이름' }, { k: 'site.groom.phone', t: 'tel', l: '연락처' },
    { k: 'site.groom.relation', t: 'text', l: '관계 (장남/차남/아들)' },
    { k: 'site.groom.father.name', t: 'text', l: '아버지 성함' }, { k: 'site.groom.father.phone', t: 'tel', l: '아버지 연락처' },
    { k: 'site.groom.mother.name', t: 'text', l: '어머니 성함' }, { k: 'site.groom.mother.phone', t: 'tel', l: '어머니 연락처' },
    { t: 'head', l: '신부' },
    { k: 'site.bride.last', t: 'text', l: '성' }, { k: 'site.bride.first', t: 'text', l: '이름' }, { k: 'site.bride.phone', t: 'tel', l: '연락처' },
    { k: 'site.bride.relation', t: 'text', l: '관계 (장녀/차녀/딸)' },
    { k: 'site.bride.father.name', t: 'text', l: '아버지 성함' }, { k: 'site.bride.father.phone', t: 'tel', l: '아버지 연락처' },
    { k: 'site.bride.mother.name', t: 'text', l: '어머니 성함' }, { k: 'site.bride.mother.phone', t: 'tel', l: '어머니 연락처' },
    { t: 'head', l: '예식' },
    { k: 'site.wedding.date', t: 'date', l: '날짜 (비우면 미정)' }, { k: 'site.wedding.time', t: 'time', l: '시간' },
    { k: 'site.wedding.venue', t: 'text', l: '예식장 이름' }, { k: 'site.wedding.hall', t: 'text', l: '홀 이름' },
    { k: 'site.wedding.address', t: 'text', l: '주소 (넣으면 지도 표시)' }, { k: 'site.wedding.tel', t: 'tel', l: '예식장 전화번호' },
    { k: 'site.wedding.tbdText', t: 'textarea', l: '날짜 미정일 때 문구' },
    { t: 'head', l: '디자인' },
    { k: 'site.theme.accent', t: 'color', l: '포인트 색' },
    { k: 'site.theme.font', t: 'select', l: '글꼴', o: [['chosun', '조선굴림 (원본)'], ['nanum', '나눔명조'], ['gowun', '고운바탕'], ['maru', '마루부리'], ['pretendard', '프리텐다드 (고딕)']] },
    { k: 'site.footer', t: 'text', l: '맨 아래 영문 손글씨' },
    { t: 'head', l: '배경음악' },
    { k: 'site.music.src', t: 'music', l: '음악 파일 (mp3, 저작권 확인된 음원만)' }, { k: 'site.music.autoplay', t: 'toggle', l: '첫 터치 때 자동 재생' },
    { t: 'head', l: '공유 미리보기 (카톡/문자)' },
    { k: 'site.share.title', t: 'text', l: '제목', ph: '비우면 "신랑 ♥ 신부 결혼합니다."' }, { k: 'site.share.desc', t: 'text', l: '설명', ph: '소중한 분들을 초대합니다.' },
    { k: 'site.share.image', t: 'image', l: '미리보기 사진 (가로 사진 추천)' },
    { t: 'head', l: '기능' },
    { k: 'site.rsvpPopup', t: 'toggle', l: '처음 접속할 때 참석 여부 팝업 띄우기' },
    { k: 'site.api.scriptUrl', t: 'text', l: '구글 연결 주소 (사진공유/방명록/참석여부)', ph: 'https://script.google.com/macros/s/.../exec' },
    { k: 'site.kakaoKey', t: 'text', l: '카카오 JavaScript 키 (선택)' }
  ];

  /* ---------------- 패널 (오른쪽 / 휴대폰은 아래) ---------------- */
  var panelMode = null, panelArg = null;
  function openPanel(title, html, mode, arg) {
    var p = $('.ed-panel');
    panelMode = mode; panelArg = arg;
    $('.ed-p-title', p).textContent = title;
    var body = $('.ed-p-body', p), st = (mode === p._lastMode && arg === p._lastArg) ? body.scrollTop : 0;
    body.innerHTML = html; body.scrollTop = st;
    p._lastMode = mode; p._lastArg = arg;
    p.classList.add('open'); document.body.classList.add('ed-panel-open');
    bindPanel(body);
  }
  function closePanel() {
    $('.ed-panel').classList.remove('open'); document.body.classList.remove('ed-panel-open'); panelMode = null;
    $$('.blk.ed-sel').forEach(function (s) { s.classList.remove('ed-sel'); });
  }
  function refreshPanel() {
    if (panelMode === 'block') openBlock(panelArg, true);
    else if (panelMode === 'site') openSite();
    else if (panelMode === 'structure') openStructure();
  }

  function field(f, base) {
    if (f.t === 'note') return '<p class="ed-note">' + esc(f.l) + '</p>';
    if (f.t === 'head') return '<h4 class="ed-head">' + esc(f.l) + '</h4>';
    var path = base ? base + '.' + f.k : f.k, v = I.get(path), lab = '<label class="ed-l">' + esc(f.l) + '</label>';
    var ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
    switch (f.t) {
      case 'text': case 'tel': case 'date': case 'time':
        return '<div class="ed-f">' + lab + '<input type="' + f.t + '" data-p="' + path + '" value="' + esc(v == null ? '' : v) + '"' + ph + '></div>';
      case 'color':
        return '<div class="ed-f">' + lab + '<div class="ed-row"><input type="color" data-p="' + path + '" value="' + esc(v || '#e08d62') + '"><button class="ed-mini" data-reset-color="' + path + '">원래 색</button></div></div>';
      case 'textarea':
        return '<div class="ed-f">' + lab + '<textarea data-p="' + path + '" rows="' + Math.min(10, Math.max(3, String(v || '').split('\n').length + 1)) + '"' + ph + '>' + esc(v || '') + '</textarea><small class="ed-tip">줄바꿈은 그대로 반영 · **글자** 는 포인트 색</small></div>';
      case 'select':
        return '<div class="ed-f">' + lab + '<select data-p="' + path + '">' + f.o.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v == null ? '' : v) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
      case 'toggle':
        return '<div class="ed-f ed-tg"><label><input type="checkbox" data-p="' + path + '" data-bool="1"' + (v ? ' checked' : '') + '> ' + esc(f.l) + '</label></div>';
      case 'image':
        var p = I.P(v), src = p.src ? (I.imgMap[p.src] || p.src) : '';
        return '<div class="ed-f">' + lab + '<div class="ed-img">' + (src ? '<img src="' + esc(src) + '" style="object-position:' + p.x + '% ' + p.y + '%" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'ed-noimg\',textContent:\'파일 없음\'}))">' : '<div class="ed-noimg">사진 없음</div>') +
          '<div class="ed-img-b"><button class="ed-mini" data-img-act="replace" data-ip="' + path + '">' + (src ? '바꾸기' : '넣기') + '</button>' +
          (src ? '<button class="ed-mini" data-img-act="focus" data-ip="' + path + '">보이는 부분</button><button class="ed-mini ed-danger" data-img-act="remove" data-ip="' + path + '">빼기</button>' : '') + '</div></div></div>';
      case 'music':
        return '<div class="ed-f">' + lab + '<div class="ed-row"><span class="ed-file">' + esc(v ? String(v).split('/').pop() : '없음') + '</span><button class="ed-mini" data-music="' + path + '">' + (v ? '바꾸기' : '넣기') + '</button>' + (v ? '<button class="ed-mini ed-danger" data-music-del="' + path + '">빼기</button>' : '') + '</div></div>';
      case 'photos':
        var list = v || [];
        return '<div class="ed-f">' + lab + '<div class="ed-photos" data-pp="' + path + '">' + list.map(function (it, k) {
          var q = I.P(it), s = I.imgMap[q.src] || q.src;
          return '<div class="ed-ph" data-k="' + k + '"><div class="ed-grip" title="끌어서 순서 변경"><img src="' + esc(s) + '" style="object-position:' + q.x + '% ' + q.y + '%" onerror="this.style.visibility=\'hidden\'"></div>' +
            '<div class="ed-ph-b"><button data-img-act="focus" data-ip="' + path + '.' + k + '" title="보이는 부분">◎</button><button data-img-act="replace" data-ip="' + path + '.' + k + '" title="바꾸기">↻</button><button class="ed-danger" data-ph-del="' + path + '" data-k="' + k + '" title="삭제">×</button></div></div>';
        }).join('') + '<button class="ed-ph-add" data-ph-add="' + path + '">+ 사진<br>추가</button></div><small class="ed-tip">' + list.length + '장 · 사진을 끌어서 순서를 바꿔요</small></div>';
      case 'list':
        var arr = v || [];
        return '<div class="ed-f ed-list">' + lab + '<div class="ed-items" data-lp="' + path + '">' + arr.map(function (it, k) {
          return '<div class="ed-item" data-k="' + k + '"><div class="ed-item-h"><span class="ed-grip" title="끌어서 순서 변경">' + IC.grip + '</span><b>' + (k + 1) + '</b>' +
            '<span class="ed-sp"></span><button class="ed-mini" data-li-mv="' + path + '" data-k="' + k + '" data-d="-1">' + IC.up + '</button><button class="ed-mini" data-li-mv="' + path + '" data-k="' + k + '" data-d="1">' + IC.down + '</button>' +
            '<button class="ed-mini ed-danger" data-li-del="' + path + '" data-k="' + k + '">삭제</button></div>' +
            f.f.map(function (sf) { return field(sf, path + '.' + k); }).join('') + '</div>';
        }).join('') + '</div><button class="ed-btn2" data-li-add="' + path + '" data-tpl="' + esc(JSON.stringify(f.add || {})) + '">+ ' + esc(f.l) + ' 추가</button></div>';
    }
    return '';
  }

  function openBlock(i, keep) {
    var b = C().blocks[i]; if (!b) return closePanel();
    $$('.blk.ed-sel').forEach(function (s) { s.classList.remove('ed-sel'); });
    var sec = $('.blk[data-bi="' + i + '"]'); if (sec) { sec.classList.add('ed-sel'); if (!keep) sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    var html = (SCHEMA[b.type] || []).map(function (f) { return field(f, 'blocks.' + i); }).join('') +
      '<div class="ed-foot"><button class="ed-mini" data-bk="hide" data-i="' + i + '">' + (b.hidden ? '다시 보이기' : '숨기기') + '</button>' +
      (b.type !== 'cover' ? '<button class="ed-mini" data-bk="dup" data-i="' + i + '">복제</button><button class="ed-mini ed-danger" data-bk="del" data-i="' + i + '">이 블록 삭제</button>' : '') + '</div>';
    openPanel(I.LABEL[b.type] + ' 편집', html, 'block', i);
  }
  function openSite() { openPanel('기본정보', SITE.map(function (f) { return field(f, ''); }).join(''), 'site'); }

  function openStructure() {
    var bl = C().blocks;
    var html = '<p class="ed-note">끌어서 순서를 바꾸고, 눈 버튼으로 숨길 수 있어요. 숨긴 블록은 손님에게 안 보여요.</p><div class="ed-struct">' + bl.map(function (b, i) {
      var t = String(b.title || b.script || '').replace(/\*\*/g, '').split('\n')[0];
      return '<div class="ed-srow' + (b.hidden ? ' off' : '') + '" data-k="' + i + '">' + (b.type === 'cover' ? '<span class="ed-grip off">' + IC.grip + '</span>' : '<span class="ed-grip" title="끌어서 이동">' + IC.grip + '</span>') +
        '<span class="ed-sn"><b>' + esc(I.LABEL[b.type]) + '</b>' + (t && t !== I.LABEL[b.type] ? ' <small>' + esc(t.slice(0, 18)) + '</small>' : '') + '</span>' +
        '<button class="ed-mini" data-bk="hide" data-i="' + i + '" title="숨기기/보이기">' + (b.hidden ? '숨김' : IC.eye) + '</button>' +
        '<button class="ed-mini" data-bk="open" data-i="' + i + '">편집</button></div>';
    }).join('') + '</div><button class="ed-btn2" data-add-at="' + bl.length + '">+ 블록 추가</button>';
    openPanel('구성 (섹션 순서)', html, 'structure');
  }

  function openAdd(at) {
    var html = '<p class="ed-note">' + (at + 1) + '번째 자리에 넣어요.</p><div class="ed-addgrid">' + ADD_ORDER.map(function (t) {
      return '<button data-add-type="' + t + '" data-at="' + at + '"><b>' + esc(I.LABEL[t]) + '</b>' + (ADD_DESC[t] ? '<small>' + esc(ADD_DESC[t]) + '</small>' : '') + '</button>';
    }).join('') + '</div>';
    openPanel('블록 추가', html, 'add', at);
  }

  function bindPanel(body) {
    var sp = $('.ed-photos', body);
    $$('.ed-photos', body).forEach(function (box) {
      sortable(box, '.ed-ph', '.ed-grip', function (from, to) {
        var path = box.getAttribute('data-pp'), arr = (I.get(path) || []).slice(); move(arr, from, to); commit(path, arr); refreshPanel();
      });
    });
    $$('.ed-items', body).forEach(function (box) {
      sortable(box, '.ed-item', '.ed-item-h .ed-grip', function (from, to) {
        var path = box.getAttribute('data-lp'), arr = clone(I.get(path) || []); move(arr, from, to); commit(path, arr); refreshPanel();
      });
    });
    $$('.ed-struct', body).forEach(function (box) {
      sortable(box, '.ed-srow', '.ed-grip:not(.off)', function (from, to) {
        var bl = C().blocks; if (to === 0 && bl[0] && bl[0].type === 'cover') to = 1;
        snapshot(); move(bl, from, to); lastSnap = ''; save(); I.render(); openStructure();
      });
    });
    return sp;
  }

  /* 끌어서 순서 바꾸기 (마우스/손가락 모두) */
  function sortable(box, itemSel, handleSel, onMove) {
    box.addEventListener('pointerdown', function (e) {
      var h = e.target.closest(handleSel); if (!h || !box.contains(h)) return;
      var item = h.closest(itemSel); if (!item) return;
      e.preventDefault();
      var items = $$(itemSel, box), from = items.indexOf(item), to = from;
      var r = item.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, moved = false;
      var ghost = item.cloneNode(true); ghost.className += ' ed-ghost';
      ghost.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
      function mv(ev) {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        if (!moved) { moved = true; document.body.appendChild(ghost); item.classList.add('ed-dragging'); }
        ghost.style.transform = 'translate(' + (ev.clientX - sx) + 'px,' + (ev.clientY - sy) + 'px) scale(1.03)';
        var best = from, bd = 1e9;
        items.forEach(function (o, i) { var q = o.getBoundingClientRect(); var d = Math.hypot(ev.clientX - (q.left + q.width / 2), ev.clientY - (q.top + q.height / 2)); if (d < bd) { bd = d; best = i; } });
        to = best; items.forEach(function (o, i) { o.classList.toggle('ed-drop', i === to && i !== from); });
        var pb = box.closest('.ed-p-body'); if (pb) { var pr = pb.getBoundingClientRect(); if (ev.clientY < pr.top + 40) pb.scrollTop -= 12; else if (ev.clientY > pr.bottom - 40) pb.scrollTop += 12; }
      }
      function up() {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        ghost.remove(); item.classList.remove('ed-dragging'); items.forEach(function (o) { o.classList.remove('ed-drop'); });
        if (moved && to !== from) onMove(from, to);
      }
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }

  /* ---------------- 사진 바꾸기 / 보이는 부분 조정 ---------------- */
  function imgMenu(path, anchor) {
    var v = I.P(I.get(path));
    var m = I.modal('<h3>사진</h3>' + (v.src ? '<div class="ed-img big"><img src="' + esc(I.imgMap[v.src] || v.src) + '" style="object-position:' + v.x + '% ' + v.y + '%"></div>' : '') +
      '<div class="ed-col"><button class="l-btn" data-x="replace">' + (v.src ? '사진 바꾸기' : '사진 넣기') + '</button>' +
      (v.src ? '<button class="o-btn" data-x="focus">보이는 부분 조정 (위치·확대)</button><button class="o-btn" data-x="remove">사진 빼기</button>' : '') + '</div>', 'ed-ui');
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b) return;
      m.close(); imgAct(b.getAttribute('data-x'), path, anchor);
    });
  }
  function isListPhoto(path) { return /\.photos\.\d+$/.test(path); }
  function imgAct(act, path, anchor) {
    if (act === 'replace') {
      pickFiles(false).then(function (files) {
        if (!files.length) return;
        I.toast('사진 준비 중...');
        addFile(files[0]).then(function (np) { commit(path, { src: np, x: 50, y: 50, z: 1 }, false); I.render(); refreshPanel(); I.toast('사진을 바꿨어요. (게시하기를 눌러야 손님에게 보여요)'); });
      });
    } else if (act === 'remove') {
      if (isListPhoto(path)) { var lp = path.replace(/\.\d+$/, ''), k = +path.split('.').pop(), arr = (I.get(lp) || []).slice(); arr.splice(k, 1); commit(lp, arr, false); }
      else commit(path, '', false);
      I.render(); refreshPanel();
    } else if (act === 'focus') focusEditor(path, anchor);
  }
  function focusEditor(path, anchor) {
    var v = I.P(I.get(path)); if (!v.src) return;
    var ratio = 1;
    var el = anchor || $('[data-img="' + path + '"]');
    if (el) { var r = el.getBoundingClientRect(); if (r.width && r.height) ratio = r.width / r.height; }
    var st = { x: v.x, y: v.y, z: v.z };
    var m = I.modal('<h3>보이는 부분 조정</h3><p class="ed-note">사진을 끌어서 위치를 맞추고, 아래 막대로 확대해요.</p>' +
      '<div class="ed-frame" style="aspect-ratio:' + ratio + '"><img src="' + esc(I.imgMap[v.src] || v.src) + '" draggable="false"></div>' +
      '<label class="ed-zoom">확대 <input type="range" min="1" max="3" step="0.01" value="' + st.z + '"></label>' +
      '<div class="ed-row" style="justify-content:center;margin-top:14px"><button class="o-btn" data-x="reset" style="margin:0">처음대로</button><button class="l-btn" data-x="ok" style="margin:0">완료</button></div>', 'ed-ui ed-focus');
    var fr = $('.ed-frame', m), im = $('img', fr), zr = $('input[type=range]', m);
    function paint() { im.style.objectPosition = st.x + '% ' + st.y + '%'; im.style.transformOrigin = st.x + '% ' + st.y + '%'; im.style.transform = 'scale(' + st.z + ')'; }
    paint();
    var drag = null;
    fr.addEventListener('pointerdown', function (e) { e.preventDefault(); drag = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y }; fr.setPointerCapture(e.pointerId); });
    fr.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var r = fr.getBoundingClientRect(), k = 1.6 / st.z;
      st.x = Math.max(0, Math.min(100, drag.sx - (e.clientX - drag.x) / r.width * 100 * k));
      st.y = Math.max(0, Math.min(100, drag.sy - (e.clientY - drag.y) / r.height * 100 * k));
      paint();
    });
    fr.addEventListener('pointerup', function () { drag = null; });
    zr.addEventListener('input', function () { st.z = +zr.value; paint(); });
    m.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b) return;
      if (b.getAttribute('data-x') === 'reset') { st = { x: 50, y: 50, z: 1 }; zr.value = 1; paint(); return; }
      commit(path, { src: v.src, x: Math.round(st.x * 10) / 10, y: Math.round(st.y * 10) / 10, z: Math.round(st.z * 100) / 100 }, false);
      m.close(); I.render(); refreshPanel();
    });
  }
  function addPhotos(path) {
    pickFiles(true).then(function (files) {
      if (!files.length) return;
      I.toast(files.length + '장 준비 중...');
      var arr = (I.get(path) || []).slice(), chain = Promise.resolve();
      files.forEach(function (f) { chain = chain.then(function () { return addFile(f).then(function (np) { arr.push({ src: np, x: 50, y: 50, z: 1 }); }); }); });
      chain.then(function () { commit(path, arr, false); I.render(); refreshPanel(); I.toast(files.length + '장 추가했어요.'); });
    });
  }

  /* ---------------- 화면 위 편집 표시 (블록 버튼, 글자 바로 고치기) ---------------- */
  var PT = (function () { var d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; })();
  function afterRender() {
    if (document.body.classList.contains('ed-preview')) return;
    var bl = C().blocks;
    $$('#app .blk').forEach(function (sec) {
      var i = +sec.getAttribute('data-bi'), b = bl[i]; if (!b) return;
      var chip = document.createElement('div'); chip.className = 'ed-ui ed-chip';
      chip.innerHTML = '<span>' + esc(I.LABEL[b.type]) + (b.hidden ? ' · 숨김' : '') + '</span><button data-bk="open" data-i="' + i + '">' + IC.edit + ' 편집</button>' +
        (b.type !== 'cover' ? '<button data-bk="up" data-i="' + i + '" title="위로">' + IC.up + '</button><button data-bk="down" data-i="' + i + '" title="아래로">' + IC.down + '</button>' : '') +
        '<button data-bk="hide" data-i="' + i + '" title="숨기기">' + (b.hidden ? '보이기' : '숨기기') + '</button>';
      sec.appendChild(chip);
      var add = document.createElement('button'); add.className = 'ed-ui ed-add'; add.setAttribute('data-add-at', i + 1); add.textContent = '+ 여기에 블록 추가';
      sec.appendChild(add);
      if (panelMode === 'block' && panelArg === i) sec.classList.add('ed-sel');
    });
    $$('#app [data-edit]').forEach(function (el) {
      el.setAttribute('contenteditable', PT); el.setAttribute('spellcheck', 'false');
      if (!el.getAttribute('data-hint')) el.setAttribute('data-hint', '여기를 눌러 입력');
    });
  }
  document.addEventListener('focusin', function (e) {
    var el = e.target.closest && e.target.closest('#app [data-edit]'); if (!el) return;
    var v = I.get(el.getAttribute('data-edit'));
    el.classList.add('ed-editing'); el.textContent = v == null ? '' : String(v);
  });
  document.addEventListener('focusout', function (e) {
    var el = e.target.closest && e.target.closest('#app [data-edit]'); if (!el) return;
    el.classList.remove('ed-editing');
    var path = el.getAttribute('data-edit'), old = I.get(path) == null ? '' : String(I.get(path));
    var val = el.innerText.replace(/\u00a0/g, ' ').replace(/\n+$/, '');
    if (val !== old) { commit(path, val, false); }
    el.innerHTML = I.fmt(val); el.classList.toggle('empty', !I.has(val));
    if (panelMode) setTimeout(refreshPanel, 0);
  });
  document.addEventListener('keydown', function (e) {
    var el = e.target.closest && e.target.closest('#app [data-edit]');
    if (el && e.key === 'Escape') el.blur();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target.closest && e.target.closest('input,textarea,[contenteditable]'))) { e.preventDefault(); undo(); }
  });
  // 붙여넣기는 글자만
  document.addEventListener('paste', function (e) {
    var el = e.target.closest && e.target.closest('#app [data-edit]'); if (!el || PT === 'plaintext-only') return;
    e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text'));
  });

  /* ---------------- 클릭 처리 ---------------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (document.body.classList.contains('ed-preview') && !t.closest('[data-ed]')) return;
    // 편집 중에는 링크 이동 막기
    var a = t.closest('#app a'); if (a && !t.closest('.ed-ui')) e.preventDefault();
    var img = t.closest('#app [data-img]');
    if (img && !t.closest('.ed-ui') && !t.closest('[data-edit]')) { e.preventDefault(); e.stopPropagation(); return imgMenu(img.getAttribute('data-img'), img); }
    var ap = t.closest('[data-addphotos]'); if (ap) { e.stopPropagation(); return addPhotos(ap.getAttribute('data-addphotos') + '.photos'); }
    var x;
    if ((x = t.closest('[data-ed]'))) return tool(x.getAttribute('data-ed'));
    if ((x = t.closest('[data-bk]'))) { e.stopPropagation(); return blockAct(x.getAttribute('data-bk'), +x.getAttribute('data-i')); }
    if ((x = t.closest('[data-add-at]'))) { e.stopPropagation(); return openAdd(+x.getAttribute('data-add-at')); }
    if ((x = t.closest('[data-add-type]'))) {
      var type = x.getAttribute('data-add-type'), at = +x.getAttribute('data-at');
      snapshot(); var nb = clone(NEW[type] || {}); nb.type = type; nb.id = uid();
      C().blocks.splice(at, 0, nb); lastSnap = ''; save(); I.render(); openBlock(at);
      if (type === 'photos' || type === 'gallery') setTimeout(function () { addPhotos('blocks.' + at + '.photos'); }, 300);
      return;
    }
    if ((x = t.closest('[data-img-act]'))) return imgAct(x.getAttribute('data-img-act'), x.getAttribute('data-ip'));
    if ((x = t.closest('[data-ph-add]'))) return addPhotos(x.getAttribute('data-ph-add'));
    if ((x = t.closest('[data-ph-del]'))) { var pp = x.getAttribute('data-ph-del'), arr = (I.get(pp) || []).slice(); arr.splice(+x.getAttribute('data-k'), 1); commit(pp, arr, false); I.render(); return refreshPanel(); }
    if ((x = t.closest('[data-li-add]'))) { var lp = x.getAttribute('data-li-add'), la = clone(I.get(lp) || []); la.push(JSON.parse(x.getAttribute('data-tpl'))); commit(lp, la, false); I.render(); return refreshPanel(); }
    if ((x = t.closest('[data-li-del]'))) { if (!confirm('이 항목을 삭제할까요?')) return; var dp = x.getAttribute('data-li-del'), da = clone(I.get(dp) || []); da.splice(+x.getAttribute('data-k'), 1); commit(dp, da, false); I.render(); return refreshPanel(); }
    if ((x = t.closest('[data-li-mv]'))) { var mp = x.getAttribute('data-li-mv'), ma = clone(I.get(mp) || []), k = +x.getAttribute('data-k'), to = k + (+x.getAttribute('data-d')); if (to < 0 || to >= ma.length) return; move(ma, k, to); commit(mp, ma, false); I.render(); return refreshPanel(); }
    if ((x = t.closest('[data-music]'))) { var mpth = x.getAttribute('data-music'); return pickFiles(false, 'audio/*').then(function (fs) { if (!fs.length) return; addFile(fs[0], 'music').then(function (np) { commit(mpth, np, false); refreshPanel(); I.toast('음악을 넣었어요. 게시 후 새로고침하면 적용돼요.'); }); }); }
    if ((x = t.closest('[data-music-del]'))) { commit(x.getAttribute('data-music-del'), '', false); return refreshPanel(); }
    if ((x = t.closest('[data-reset-color]'))) { commit(x.getAttribute('data-reset-color'), '#e08d62'); return refreshPanel(); }
    if (t.closest('.ed-p-close')) return closePanel();
  }, true);

  function blockAct(act, i) {
    var bl = C().blocks, b = bl[i]; if (!b) return;
    if (act === 'open') return openBlock(i);
    snapshot();
    if (act === 'hide') b.hidden = !b.hidden;
    else if (act === 'up') { var min = bl[0] && bl[0].type === 'cover' ? 1 : 0; if (i <= min) return I.toast('맨 위예요.'); move(bl, i, i - 1); i--; }
    else if (act === 'down') { if (i >= bl.length - 1) return I.toast('맨 아래예요.'); move(bl, i, i + 1); i++; }
    else if (act === 'dup') { var nb = clone(b); nb.id = uid(); bl.splice(i + 1, 0, nb); i++; }
    else if (act === 'del') { if (!confirm(I.LABEL[b.type] + ' 블록을 삭제할까요? (↶ 되돌리기로 살릴 수 있어요)')) return; bl.splice(i, 1); lastSnap = ''; save(); I.render(); return closePanel(); }
    lastSnap = ''; save(); I.render();
    if (panelMode === 'structure') openStructure(); else if (panelMode === 'block') openBlock(i, true);
    var s = $('.blk[data-bi="' + i + '"]'); if (s && (act === 'up' || act === 'down')) s.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // 패널 입력 → 바로 반영
  document.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('.ed-panel [data-p]')) snapshot(); });
  document.addEventListener('input', function (e) {
    var el = e.target.closest && e.target.closest('.ed-panel [data-p]'); if (!el) return;
    var v = el.getAttribute('data-bool') ? el.checked : el.value;
    I.set(el.getAttribute('data-p'), v); lastSnap = '';
    save(); scheduleRender();
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest && e.target.closest('.ed-panel select[data-p], .ed-panel input[type=checkbox][data-p]'); if (!el) return;
    if (/\.layout$/.test(el.getAttribute('data-p'))) refreshPanel();
  });

  /* ---------------- 상단 도구 ---------------- */
  function tool(name) {
    if (name === 'structure') return panelMode === 'structure' ? closePanel() : openStructure();
    if (name === 'site') return panelMode === 'site' ? closePanel() : openSite();
    if (name === 'undo') return undo();
    if (name === 'preview') {
      var on = document.body.classList.toggle('ed-preview');
      $('[data-ed="preview"]').textContent = on ? '편집으로' : '미리보기';
      if (on) { closePanel(); $$('.ed-chip,.ed-add').forEach(function (x) { x.remove(); }); $$('#app [data-edit]').forEach(function (el) { el.removeAttribute('contenteditable'); }); window.scrollTo(0, 0); }
      else I.render();
      return;
    }
    if (name === 'publish') return openPublish();
    if (name === 'help') return help(true);
  }

  /* ---------------- GitHub 게시 ---------------- */
  function ghCfg() {
    var s = C().site.github || {}, saved = {};
    try { saved = JSON.parse(store.get(LS_GH) || '{}'); } catch (e) {}
    return { owner: saved.owner || s.owner || 'Jihyeoniiii', repo: saved.repo || s.repo || 'wedding', branch: saved.branch || s.branch || 'main', token: saved.token || '' };
  }
  function siteUrl(g) {
    var o = g.owner.toLowerCase();
    return g.repo.toLowerCase() === o + '.github.io' ? 'https://' + o + '.github.io/' : 'https://' + o + '.github.io/' + g.repo + '/';
  }
  function gh(method, url, body) {
    var g = ghCfg();
    var h = { Authorization: 'Bearer ' + g.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (body) h['Content-Type'] = 'application/json';
    return fetch('https://api.github.com/repos/' + g.owner + '/' + g.repo + url, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      .then(function (r) {
        if (r.ok) return r.status === 204 ? null : r.json();
        return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error((j.message || 'GitHub 오류') + ' (' + r.status + ')'); e.status = r.status; throw e; });
      });
  }
  function u8decode(b64) { var bin = atob(String(b64).replace(/\s/g, '')), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder('utf-8').decode(u); }
  function blobB64(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = rej; r.readAsDataURL(blob); }); }
  function contentJs() {
    return '/* 청첩장 내용 파일\n   보통은 직접 고칠 필요 없어요. 청첩장 주소 뒤에 ?edit 를 붙여서 화면에서 고치고 "게시하기"를 누르면 이 파일이 자동으로 바뀝니다. */\nwindow.CONTENT = ' + JSON.stringify(C(), null, 2) + ';\n';
  }
  function ogBlock(g) {
    var s = C().site, sh = s.share || {}, g1 = s.groom || {}, b1 = s.bride || {};
    var title = sh.title || ((g1.last || '') + (g1.first || '') + ' ♥ ' + (b1.last || '') + (b1.first || '') + ' 결혼합니다.');
    var desc = sh.desc || '소중한 분들을 초대합니다.', base = siteUrl(g);
    var im = I.P(sh.image).src || (C().blocks[0] && C().blocks[0].type === 'cover' ? I.P(C().blocks[0].photo).src : '') || 'images/og.jpg';
    var abs = /^https?:/.test(im) ? im : base + im.replace(/^\.?\//, '');
    return { title: title, html: '<!--OG-->\n  <meta property="og:type" content="website">\n  <meta property="og:title" content="' + esc(title) + '">\n  <meta property="og:description" content="' + esc(desc) + '">\n  <meta property="og:image" content="' + esc(abs) + '">\n  <meta property="og:url" content="' + esc(base) + '">\n  <!--/OG-->' };
  }
  function openPublish() {
    var g = ghCfg();
    var html = '<p class="ed-note">고친 내용을 GitHub에 올려서 손님이 보는 청첩장에 반영해요. 보통 1~2분 뒤에 바뀌어요.</p>' +
      '<div class="ed-f"><label class="ed-l">저장소</label><div class="ed-row"><input type="text" id="gh-owner" value="' + esc(g.owner) + '" style="flex:1"> / <input type="text" id="gh-repo" value="' + esc(g.repo) + '" style="flex:1"></div></div>' +
      '<div class="ed-f"><label class="ed-l">게시 열쇠 (GitHub 토큰) ' + (g.token ? '<span class="ed-ok">저장됨</span>' : '<span class="ed-bad">필요</span>') + '</label>' +
      '<input type="password" id="gh-token" placeholder="' + (g.token ? '바꿀 때만 입력' : 'github_pat_... 붙여넣기') + '" autocomplete="off">' +
      '<small class="ed-tip">이 기기에만 저장돼요. 청첩장 파일에는 들어가지 않아요. <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">열쇠 만들기</a></small></div>' +
      '<button class="l-btn ed-wide" id="gh-go">지금 게시하기</button>' +
      '<div class="ed-log" id="gh-log"></div>' +
      '<p class="ed-tip" style="margin-top:14px">청첩장 주소: <a href="' + esc(siteUrl(g)) + '" target="_blank" rel="noopener">' + esc(siteUrl(g)) + '</a></p>' +
      '<hr class="ed-hr"><button class="ed-btn2" id="gh-pull">다른 기기에서 게시한 내용 불러오기</button>' +
      '<button class="ed-btn2" id="ed-export">내용 파일로 내려받기 (백업)</button>' +
      (published ? '<button class="ed-btn2 ed-danger" id="ed-discard">편집한 내용 버리고 게시된 상태로</button>' : '');
    openPanel('게시하기', html, 'publish');
    var saveCfg = function () {
      var cur = ghCfg(), tk = ($('#gh-token').value || '').trim();
      store.set(LS_GH, JSON.stringify({ owner: $('#gh-owner').value.trim() || cur.owner, repo: $('#gh-repo').value.trim() || cur.repo, branch: cur.branch, token: tk || cur.token }));
    };
    $('#gh-go').addEventListener('click', function () { saveCfg(); publish(); });
    $('#gh-pull').addEventListener('click', function () { saveCfg(); pull(); });
    $('#ed-export').addEventListener('click', function () {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([contentJs()], { type: 'text/javascript' })); a.download = 'content.js'; a.click();
    });
    var dc = $('#ed-discard'); if (dc) dc.addEventListener('click', function () {
      if (!confirm('이 기기에서 편집한 내용을 버리고 게시된 상태로 돌아갈까요?')) return;
      store.del(LS_DRAFT); snapshot(); I.setContent(clone(published)); markDirty(false); status('게시된 상태'); closePanel();
    });
  }
  function log(t, cls) { var l = $('#gh-log'); if (l) l.innerHTML += '<div class="' + (cls || '') + '">' + esc(t) + '</div>'; status(t); }
  var publishing = false;
  function publish() {
    var g = ghCfg();
    if (!g.token) return log('게시 열쇠(토큰)를 먼저 넣어주세요.', 'ed-bad');
    if (publishing) return;
    publishing = true; $('#gh-go').disabled = true; $('#gh-log').innerHTML = '';
    var json = JSON.stringify(C()), baseSha, treeSha, entries = [], pend = [];
    log('GitHub에 연결하는 중...');
    gh('GET', '/git/ref/heads/' + g.branch).then(function (ref) {
      baseSha = ref.object.sha;
      return gh('GET', '/git/commits/' + baseSha);
    }).then(function (cm) {
      treeSha = cm.tree.sha;
      return idbAll();
    }).then(function (all) {
      pend = all.filter(function (r) { return !r.published && json.indexOf('"' + r.path + '"') > -1; });
      log('올릴 사진/음악 ' + pend.length + '개');
      var chain = Promise.resolve(), n = 0;
      pend.forEach(function (r) {
        chain = chain.then(function () { return blobB64(r.blob); }).then(function (b) { return gh('POST', '/git/blobs', { content: b, encoding: 'base64' }); })
          .then(function (bl) { n++; entries.push({ path: r.path, mode: '100644', type: 'blob', sha: bl.sha }); status('사진 올리는 중 ' + n + '/' + pend.length); });
      });
      return chain;
    }).then(function () {
      C().site._pub = Date.now();
      return gh('POST', '/git/blobs', { content: contentJs(), encoding: 'utf-8' }).then(function (bl) { entries.push({ path: 'content.js', mode: '100644', type: 'blob', sha: bl.sha }); });
    }).then(function () {
      return gh('GET', '/contents/index.html?ref=' + g.branch).then(function (f) {
        var html = u8decode(f.content), og = ogBlock(g);
        var nh = html.replace(/<!--OG-->[\s\S]*?<!--\/OG-->/, og.html).replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(og.title) + '</title>');
        if (nh !== html) return gh('POST', '/git/blobs', { content: nh, encoding: 'utf-8' }).then(function (bl) { entries.push({ path: 'index.html', mode: '100644', type: 'blob', sha: bl.sha }); });
      }).catch(function () {});
    }).then(function () {
      return gh('POST', '/git/trees', { base_tree: treeSha, tree: entries });
    }).then(function (tr) {
      return gh('POST', '/git/commits', { message: '청첩장 수정 ' + new Date().toLocaleString('ko-KR'), tree: tr.sha, parents: [baseSha] });
    }).then(function (nc) {
      return gh('PATCH', '/git/refs/heads/' + g.branch, { sha: nc.sha });
    }).then(function () {
      pend.forEach(function (r) { r.published = true; idbPut(r); });
      published = clone(C());
      store.set(LS_DRAFT, JSON.stringify({ t: Date.now(), content: C(), published: true }));
      markDirty(false);
      log('게시 완료! 1~2분 뒤 청첩장에 반영돼요. (카톡 미리보기는 더 늦게 바뀔 수 있어요)', 'ed-ok');
    }).catch(function (e) {
      var msg = e.status === 401 ? '게시 열쇠가 맞지 않거나 만료됐어요.' : e.status === 404 ? '저장소를 찾을 수 없거나 열쇠에 이 저장소 권한이 없어요.' : e.status === 403 ? '열쇠에 쓰기 권한(Contents: Read and write)이 없어요.' : e.status === 409 ? '저장소가 비어 있어요. 파일을 먼저 한 번 올려야 해요.' : (e.message || '알 수 없는 오류');
      log('게시 실패: ' + msg, 'ed-bad');
    }).then(function () { publishing = false; var b = $('#gh-go'); if (b) b.disabled = false; });
  }
  function pull() {
    var g = ghCfg();
    if (!g.token) return log('게시 열쇠(토큰)를 먼저 넣어주세요.', 'ed-bad');
    gh('GET', '/contents/content.js?ref=' + g.branch).then(function (f) {
      var t = u8decode(f.content), c = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      if (!confirm('GitHub에 게시된 내용으로 바꿀까요? (이 기기에서 게시 안 한 수정은 사라져요)')) return;
      snapshot(); published = clone(c); I.setContent(c); store.set(LS_DRAFT, JSON.stringify({ t: Date.now(), content: c, published: true })); markDirty(false);
      log('불러왔어요.', 'ed-ok');
    }).catch(function (e) { log('불러오기 실패: ' + (e.message || ''), 'ed-bad'); });
  }

  /* ---------------- 도움말 ---------------- */
  function help(force) {
    if (!force && store.get(LS_HELP)) return;
    store.set(LS_HELP, '1');
    I.modal('<h3>편집 모드 사용법</h3><div class="ed-help">' +
      '<p><b>글자</b> 화면의 글자를 누르면 바로 고칠 수 있어요. 줄바꿈도 그대로 들어가요.</p>' +
      '<p><b>사진</b> 사진을 누르면 바꾸기, 보이는 부분(위치·확대) 조정을 할 수 있어요.</p>' +
      '<p><b>블록</b> 각 블록 위의 [편집]에서 사진 배치(2장씩, 넘겨보기 등)와 목록을 고쳐요. ↑↓로 순서, [숨기기]로 감추기.</p>' +
      '<p><b>구성</b> 위쪽 [구성]에서 전체 순서를 끌어서 바꾸고, 새 블록을 추가해요.</p>' +
      '<p><b>저장</b> 고친 내용은 이 기기에 자동 저장돼요. 손님에게 보이게 하려면 [게시하기]를 눌러요.</p></div>', 'ed-ui');
  }

  /* ---------------- 시작 ---------------- */
  function init(Inv) {
    I = Inv;
    published = clone(C());
    document.body.classList.add('editing');
    var bar = document.createElement('div'); bar.className = 'ed-ui ed-bar';
    bar.innerHTML = '<button data-ed="structure">구성</button><button data-ed="site">기본정보</button><button data-ed="undo" title="되돌리기" disabled>↶</button>' +
      '<span class="ed-status">편집 모드</span><button data-ed="help" title="도움말">?</button><button data-ed="preview">미리보기</button><button data-ed="publish" class="ed-pub">게시하기</button>';
    document.body.appendChild(bar);
    var panel = document.createElement('aside'); panel.className = 'ed-ui ed-panel';
    panel.innerHTML = '<div class="ed-p-h"><b class="ed-p-title"></b><button class="ed-p-close" aria-label="닫기">✕</button></div><div class="ed-p-body"></div>';
    document.body.appendChild(panel);
    var draft = null;
    try { draft = JSON.parse(store.get(LS_DRAFT) || 'null'); } catch (e) {}
    idbOpen().then(idbAll).then(function (all) {
      all.forEach(function (r) { if (r.blob) I.imgMap[r.path] = URL.createObjectURL(r.blob); });
      var pubT = (published.site || {})._pub || 0, dT = draft && draft.content ? ((draft.content.site || {})._pub || 0) : 0;
      var useDraft = draft && draft.content && JSON.stringify(draft.content) !== JSON.stringify(published) && (!draft.published || dT > pubT);
      if (useDraft) {
        I.setContent(draft.content);
        if (!draft.published) {
          status('편집 중이던 내용을 불러왔어요 · 게시 전'); markDirty(true);
          if (pubT > dT) setTimeout(function () { I.toast('다른 기기에서 더 최근에 게시한 내용이 있어요. [게시하기]에서 확인해주세요.'); }, 800);
        } else status('마지막 게시 내용');
      } else { I.render(); status('편집 모드'); }
      InviteEditor.ready = true; afterRender(); help(false);
      // 이미 인터넷에 올라간 사진은 임시 보관함에서 정리
      all.filter(function (r) { return r.published; }).forEach(function (r) {
        fetch(r.path, { method: 'HEAD', cache: 'no-store' }).then(function (res) { if (res.ok) { idbDel(r.path); } }).catch(function () {});
      });
    });
  }
  var InviteEditor = window.InviteEditor = { init: init, afterRender: afterRender, ready: false };
})();
