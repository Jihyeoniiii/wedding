/* 모바일 청첩장 본체: content.js 내용을 화면에 그립니다. (내용 수정은 주소 뒤 ?edit) */
(function () {
  'use strict';
  var C = window.CONTENT || { site: {}, blocks: [] };
  var EDIT = /[?&]edit\b/.test(location.search) || !!window.__FORCE_EDIT;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- helpers ---------------- */
  function has(v) { return v != null && String(v).trim() !== ''; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>').replace(/\n/g, '<br>'); }
  function get(path) { return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, C); }
  function set(path, val) {
    var ks = path.split('.'), o = C;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }
  function P(v) {
    if (!v) return { src: '', x: 50, y: 50, z: 1 };
    if (typeof v === 'string') return { src: v, x: 50, y: 50, z: 1 };
    return { src: v.src || '', x: v.x == null ? 50 : v.x, y: v.y == null ? 50 : v.y, z: v.z || 1 };
  }
  var imgMap = {};  // 편집 중 아직 게시 안 된 사진 (경로 -> 미리보기 주소)
  function resolve(src) { return imgMap[src] || src; }
  function pic(v, path, cls, attrs) {
    var p = P(v);
    var da = ' data-img="' + esc(path) + '"' + (attrs || '');
    if (!has(p.src)) return '<div class="ph ' + (cls || '') + '"' + da + '>' + (EDIT ? '+ 사진 넣기' : '') + '</div>';
    var st = 'object-position:' + p.x + '% ' + p.y + '%;' + (p.z > 1 ? 'transform:scale(' + p.z + ');transform-origin:' + p.x + '% ' + p.y + '%;' : '');
    return '<img src="' + esc(resolve(p.src)) + '" class="' + (cls || '') + '" style="' + st + '"' + da + ' alt="" loading="lazy" decoding="async" onerror="__ph(this)">';
  }
  window.__ph = function (el) {
    var d = document.createElement('div');
    d.className = 'ph ' + el.className;
    if (el.getAttribute('data-img')) d.setAttribute('data-img', el.getAttribute('data-img'));
    if (el.getAttribute('data-k') != null) d.setAttribute('data-k', el.getAttribute('data-k'));
    d.textContent = EDIT ? (el.getAttribute('src') || '').slice(0, 40) + '\n사진을 넣어주세요' : '';
    d.style.whiteSpace = 'pre-line';
    if (el.parentNode) el.parentNode.replaceChild(d, el);
  };
  // 글자 칸: 편집모드에서는 빈칸도 보여주고 누르면 바로 고칠 수 있게 표시
  function T(path, tag, cls, hint) {
    var v = get(path);
    if (!has(v) && !EDIT) return '';
    tag = tag || 'p';
    return '<' + tag + ' class="' + (cls || '') + (has(v) ? '' : ' empty') + '" data-edit="' + esc(path) + '"' + (hint ? ' data-hint="' + esc(hint) + '"' : '') + '>' + fmt(v) + '</' + tag + '>';
  }
  function toast(msg) {
    var t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, 2400);
  }
  function copy(text, msg) {
    var done = function () { toast(msg || '복사되었습니다.'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fb); else fb();
    function fb() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('복사에 실패했어요.'); }
      document.body.removeChild(ta);
    }
  }
  var ICON = {
    menu: '<svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
    sms: '<svg viewBox="0 0 24 24"><path d="M4 4h16a1 1 0 011 1v11a1 1 0 01-1 1H8l-4 4V5a1 1 0 011-1z"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"/></svg>',
    share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'
  };

  /* ---------------- site info ---------------- */
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function S() { return C.site || (C.site = {}); }
  function names() {
    var g = S().groom || {}, b = S().bride || {};
    return { g: (g.last || '') + (g.first || ''), b: (b.last || '') + (b.first || ''), gs: g.first || '', bs: b.first || '' };
  }
  function wDate() {
    var w = S().wedding || {};
    if (!has(w.date)) return null;
    var dp = String(w.date).split(/[-./]/).map(Number), tp = has(w.time) ? String(w.time).split(':').map(Number) : [0, 0];
    var d = new Date(dp[0], dp[1] - 1, dp[2], tp[0] || 0, tp[1] || 0);
    return isNaN(d) ? null : d;
  }
  function dateText() {
    var d = wDate(), w = S().wedding || {};
    if (!d) return '';
    var s = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WD[d.getDay()] + '요일';
    if (has(w.time)) { var h = d.getHours(), m = d.getMinutes(); s += ' ' + (h < 12 ? '오전 ' : '오후 ') + (h % 12 === 0 ? 12 : h % 12) + '시' + (m ? ' ' + m + '분' : ''); }
    return s;
  }
  function venueText() { var w = S().wedding || {}; return [w.venue, w.hall].filter(has).join(' '); }

  /* ---------------- theme ---------------- */
  var FONTS = {
    chosun: { name: '조선굴림 (원본)', family: "'ChosunGu', serif", css: '' },
    nanum: { name: '나눔명조', family: "'Nanum Myeongjo', serif", css: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&display=swap' },
    gowun: { name: '고운바탕', family: "'Gowun Batang', serif", css: 'https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap' },
    maru: { name: '마루부리', family: "'MaruBuri', serif", css: 'https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css' },
    pretendard: { name: '프리텐다드 (고딕)', family: "'Pretendard', sans-serif", css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css' }
  };
  function mix(hex, amt) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#efc8ae';
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var f = function (c) { return Math.round(c + (255 - c) * amt); };
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }
  function applyTheme() {
    var th = S().theme || {}, root = document.documentElement.style;
    var acc = /^#[0-9a-f]{6}$/i.test(th.accent || '') ? th.accent : '#e08d62';
    root.setProperty('--accent', acc);
    root.setProperty('--btn', mix(acc, 0.45));
    root.setProperty('--accent-soft', mix(acc, 0.92));
    var f = FONTS[th.font] || FONTS.chosun;
    root.setProperty('--font', f.family);
    if (f.css && !document.querySelector('link[data-font="' + th.font + '"]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = f.css; l.setAttribute('data-font', th.font); document.head.appendChild(l);
    }
  }

  /* ---------------- photo layouts ---------------- */
  var LAYOUTS = { grid: '갤러리형 (3-3-2)', full: '1장씩 크게', two: '2장씩', three: '3장씩', big2: '큰 1장 + 작은 2장', slide: '넘겨보기', masonry: '자유 높이 (2열)' };
  function ratioCss(r) { return has(r) && r !== 'auto' ? 'aspect-ratio:' + String(r).replace('/', ' / ') + ';' : ''; }
  function photoLayout(b, p) {
    var list = (b.photos || []), lay = b.layout || 'grid', n = list.length;
    var gap = (b.gap == null || b.gap === '') ? (lay === 'grid' ? 2 : 6) : +b.gap;
    if (!n) return EDIT ? '<div class="ph pl-empty" data-addphotos="' + esc(p) + '">+ 사진 추가</div>' : '';
    var item = function (v, k, style, cls) {
      return '<div class="pi rv ' + (cls || '') + '" style="' + (style || '') + '--d:' + Math.min(k % 6, 5) * 70 + 'ms" data-lb="' + esc(p) + '" data-k="' + k + '">' + pic(v, p + '.photos.' + k, '', ' data-k="' + k + '"') + '</div>';
    };
    if (lay === 'grid') {
      var spans = list.map(function () { return 2; }), rem = n % 3;
      if (n === 1) spans[0] = 6; else if (rem === 2) { spans[n - 1] = 3; spans[n - 2] = 3; } else if (rem === 1) { for (var q = n - 4; q < n; q++) spans[q] = 3; }
      return '<div class="pl pl-grid" style="gap:' + gap + 'px">' + list.map(function (v, k) { return item(v, k, 'grid-column:span ' + spans[k] + ';'); }).join('') + '</div>';
    }
    if (lay === 'slide') {
      return '<div class="pl pl-slide" style="gap:' + gap + 'px">' + list.map(function (v, k) { return item(v, k, ratioCss(b.ratio || '4/5'), 'sl'); }).join('') + '</div>' +
        '<div class="dots">' + list.map(function (v, k) { return '<i class="' + (k ? '' : 'on') + '"></i>'; }).join('') + '</div>';
    }
    if (lay === 'masonry') {
      return '<div class="pl pl-masonry" style="column-gap:' + gap + 'px">' + list.map(function (v, k) { return item(v, k, 'margin-bottom:' + gap + 'px;', 'nat'); }).join('') + '</div>';
    }
    var cols = lay === 'two' ? 2 : lay === 'three' ? 3 : lay === 'big2' ? 2 : 1;
    var dr = lay === 'full' ? (b.ratio || 'auto') : lay === 'three' ? (b.ratio || '1/1') : (b.ratio || '3/4');
    return '<div class="pl" style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:' + gap + 'px">' + list.map(function (v, k) {
      var big = lay === 'big2' && k % 3 === 0;
      var r = big ? (b.ratio || '4/3') : (lay === 'big2' ? '1/1' : dr);
      return item(v, k, (big ? 'grid-column:span 2;' : '') + ratioCss(r), r === 'auto' ? 'nat' : '');
    }).join('') + '</div>';
  }

  /* ---------------- blocks ---------------- */
  var LABEL = {
    cover: '메인', greeting: '인사말', quote: '글귀', profile: '소개', calendar: '예식 안내', location: '오시는 길', notice: '박스 안내',
    photos: '사진', gallery: '갤러리', interview: '웨딩 인터뷰', history: '히스토리', tabs: '탭 안내', text: '자유 글', accounts: '마음 전하실 곳',
    rsvp: '참석 여부', photoShare: '사진 공유', guestbook: '방명록', together: '함께한 시간', wreath: '화환 보내기', ending: '엔딩'
  };
  var R = {};

  R.cover = function (b, p) {
    return '<div class="cv-img">' + pic(b.photo, p + '.photo', 'bg') + '</div>' +
      (has(b.script) ? '<div class="hw-wrap"><svg class="hw" viewBox="0 0 1000 200" aria-label="' + esc(b.script) + '"><text x="500" y="140" text-anchor="middle">' + esc(b.script) + '</text></svg></div>' : '') +
      T(p + '.sub', 'div', 'cv-sub', '작은 글씨 (예: 2027.10.09 SAT)');
  };
  R.greeting = function (b, p) { return T(p + '.title', 'h2', 'sec-title rv') + T(p + '.text', 'p', 'sec-text rv'); };
  R.quote = function (b, p) { return T(p + '.text', 'p', 'sec-text rv') + T(p + '.source', 'p', 'src rv', '출처'); };

  R.profile = function (b, p) {
    function one(side, role) {
      var s = S()[side] || {}, par = [s.father && s.father.name, s.mother && s.mother.name].filter(has);
      return '<div class="' + (side === 'groom' ? 'g' : 'b') + '"><div class="ph-wrap rv">' + pic(b[side + 'Photo'], p + '.' + side + 'Photo') + '</div>' +
        '<div class="name rv"><span class="role">' + role + '</span>' + esc((s.last || '') + (s.first || '')) +
        (has(s.phone) ? ' <a class="tel" href="tel:' + esc(s.phone) + '" aria-label="전화">' + ICON.phone + '</a>' : '') + '</div>' +
        T(p + '.' + side + 'Bio', 'div', 'bio rv') +
        (par.length ? '<div class="parents rv">' + esc(par.join('·')) + ' 의 ' + esc(s.relation || '') + '</div>' : '') + '</div>';
    }
    var anyTel = ['groom', 'bride'].some(function (k) { var s = S()[k] || {}; return has(s.phone) || (s.father && has(s.father.phone)) || (s.mother && has(s.mother.phone)); });
    return '<div class="cols">' + one('groom', '신랑') + one('bride', '신부') + '</div>' + (anyTel ? '<button class="o-btn rv" data-act="contact">혼주에게 연락하기</button>' : '');
  };

  R.calendar = function (b, p) {
    var h = T(p + '.title', 'h2', 'sec-title rv'), d = wDate(), nm = names();
    if (!d) {
      return h + '<div class="tbd-box rv"><div class="big">Save the Date</div>' + T('site.wedding.tbdText', 'p', 'sec-text') +
        (venueText() ? '<p class="sec-text" style="margin-top:12px">' + esc(venueText()) + '</p>' : '') +
        (EDIT ? '<p class="edit-hint">날짜가 정해지면 [기본정보]에 넣어주세요. 달력이 자동으로 생겨요.</p>' : '') + '</div>';
    }
    h += '<p class="when rv">' + esc(dateText()) + '</p>' + (venueText() ? '<p class="where rv">' + esc(venueText()) + '</p>' : '');
    var y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
    h += '<div class="month rv">' + (m + 1) + '월</div><div class="cal rv">';
    WD.forEach(function (w, i) { h += '<div class="wd' + (i === 0 ? ' sun' : '') + '">' + w + '</div>'; });
    for (var i = 0; i < first; i++) h += '<div></div>';
    for (var k = 1; k <= last; k++) h += '<div class="' + (k === d.getDate() ? 'day-on' : '') + ((first + k - 1) % 7 === 0 ? ' sun' : '') + '"><span>' + k + '</span></div>';
    h += '</div>';
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var diff = Math.round((new Date(y, m, d.getDate()) - today) / 86400000);
    h += '<div class="dday rv"><div>' + esc(nm.gs) + ' <span class="heart">♥</span> ' + esc(nm.bs) + ' 의 결혼식이</div><div class="row2">' +
      (diff === 0 ? '<span>오늘입니다!</span>' : '<span class="num">' + Math.abs(diff) + '</span><span>' + (diff > 0 ? '일 남았습니다.' : '일 지났습니다.') + '</span>') + '</div></div>';
    return h;
  };

  R.location = function (b, p) {
    var w = S().wedding || {};
    if (!has(w.address) && !has(w.venue) && !EDIT) return '';
    var q = encodeURIComponent(w.address || w.venue || ''), qn = encodeURIComponent(w.venue || w.address || '');
    var h = T(p + '.title', 'h2', 'sec-title rv');
    if (!has(w.address) && !has(w.venue)) h += '<p class="edit-hint">[기본정보]에 예식장 이름과 주소를 넣으면 지도와 길찾기 버튼이 생겨요. (지금은 손님에게 이 칸이 안 보여요)</p>';
    h += '<div class="rv">' + (has(w.venue) ? '<p class="vname">' + esc(w.venue) + '</p>' : '') + (has(w.hall) ? '<p class="addr">' + esc(w.hall) + '</p>' : '') +
      (has(w.address) ? '<p class="addr">' + esc(w.address) + ' <button class="copy-mini" data-copy="' + esc(w.address) + '">복사</button></p>' : '') +
      (has(w.tel) ? '<p class="addr"><a href="tel:' + esc(w.tel) + '">Tel. ' + esc(w.tel) + '</a></p>' : '') + '</div>';
    if (has(w.address)) h += '<div class="map rv"><iframe loading="lazy" title="지도" src="https://maps.google.com/maps?q=' + q + '&z=16&output=embed"></iframe></div>';
    if (has(w.address) || has(w.venue)) h += '<div class="navs rv"><a href="tmap://search?name=' + qn + '"><i style="background:linear-gradient(135deg,#e8336f,#5a6cf0)"></i>티맵</a>' +
      '<a href="https://map.kakao.com/link/search/' + q + '" target="_blank" rel="noopener"><i style="background:#ffd400"></i>카카오맵</a>' +
      '<a href="https://map.naver.com/p/search/' + qn + '" target="_blank" rel="noopener"><i style="background:#03c75a"></i>네이버지도</a></div>';
    var items = b.items || [];
    if (items.length) h += '<div class="dir">' + items.map(function (it, k) {
      var ip = p + '.items.' + k;
      return '<div class="it rv"><h4>' + esc(it.icon || '') + ' <span data-edit="' + ip + '.title">' + fmt(it.title) + '</span></h4>' + T(ip + '.text', 'p') + '</div>';
    }).join('') + '</div>';
    return h;
  };

  R.notice = function (b, p) {
    var loc = C.blocks.filter(function (x) { return x.type === 'location'; })[0];
    var url = has(b.url) ? b.url : (loc ? '#blk-' + loc.id : '#');
    return '<div class="box rv"><div class="badge" data-edit="' + p + '.title">' + fmt(b.title) + '</div>' + T(p + '.text', 'p', 'sec-text') +
      (has(b.button) ? '<a class="o-btn" href="' + esc(url) + '"' + (/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(b.button) + '</a>' : '') + '</div>';
  };

  R.photos = function (b, p) { return T(p + '.title', 'h2', 'sec-title rv', '제목 (선택)') + photoLayout(b, p) + T(p + '.caption', 'p', 'caption rv', '사진 설명 (선택)'); };
  R.gallery = function (b, p) { return T(p + '.title', 'h2', 'sec-title rv') + photoLayout(b, p); };

  R.interview = function (b, p) {
    if (!(b.items || []).length && !EDIT) return '';
    return T(p + '.title', 'h2', 'sec-title rv') + T(p + '.text', 'p', 'sec-text rv') + '<button class="l-btn rv" data-act="interview" data-p="' + p + '">인터뷰 읽어보기</button>';
  };

  R.history = function (b, p) {
    var items = b.items || [];
    if (!items.length && !EDIT) return '';
    return T(p + '.title', 'h2', 'sec-title rv') + '<div class="tl">' + items.map(function (it, k) {
      var ip = p + '.items.' + k;
      return '<div class="row rv' + (k % 2 ? ' rev' : '') + '"><div class="pic"><div class="im">' + pic(it.photo, ip + '.photo') + '</div>' + T(ip + '.date', 'div', 'dt') + '</div>' +
        '<div class="txt">' + T(ip + '.title', 'h5') + T(ip + '.text', 'p') + '</div></div>';
    }).join('') + '</div>';
  };

  R.tabs = function (b, p) {
    var tabs = b.items || [];
    if (!tabs.length) return EDIT ? '<p class="edit-hint">[편집]에서 탭을 추가하세요.</p>' : '';
    return '<div class="tabs rv">' + tabs.map(function (t, i) { return '<button class="' + (i ? '' : 'on') + '" data-tab="' + i + '">' + esc(t.tab || '탭') + '</button>'; }).join('') + '</div>' +
      tabs.map(function (t, i) {
        var ip = p + '.items.' + i;
        return '<div class="tab-pane' + (i ? '' : ' on') + '" data-pane="' + i + '">' + (has(P(t.photo).src) || EDIT ? '<div class="im">' + pic(t.photo, ip + '.photo') + '</div>' : '') + T(ip + '.text', 'p', 'sec-text') + '</div>';
      }).join('');
  };

  R.text = function (b, p) {
    return T(p + '.title', 'h2', 'sec-title rv', '제목 (선택)') + (has(P(b.photo).src) ? '<div class="im rv">' + pic(b.photo, p + '.photo') + '</div>' : '') + T(p + '.text', 'p', 'sec-text rv');
  };

  R.accounts = function (b, p) {
    var g = (b.groom || []).filter(function (x) { return has(x.number); }), br = (b.bride || []).filter(function (x) { return has(x.number); });
    if (!g.length && !br.length && !EDIT) return '';
    function grp(list, title, cls) {
      if (!list.length) return '';
      return '<div class="acc-group rv"><button class="acc-head ' + cls + '" data-act="acc">' + title + ICON.down + '</button><div class="acc-body">' + list.map(function (x) {
        return '<div class="acc-row"><div class="info"><div><b>' + esc(x.role || '') + '</b>' + esc(x.name || '') + '</div><div>' + esc(x.bank || '') + ' ' + esc(x.number) + '</div></div>' +
          '<div class="btns"><button data-copy="' + esc((x.bank || '') + ' ' + x.number) + '" data-msg="계좌번호가 복사되었습니다.">복사하기</button>' +
          (has(x.kakaopay) ? '<a class="kp" href="' + esc(x.kakaopay) + '" target="_blank" rel="noopener">카카오페이</a>' : '') + '</div></div>';
      }).join('') + '</div></div>';
    }
    return T(p + '.title', 'h2', 'sec-title rv') + T(p + '.text', 'p', 'sec-text rv') + grp(g, '신랑측', 'g') + grp(br, '신부측', 'b') +
      (!g.length && !br.length ? '<p class="edit-hint">[편집]에서 계좌를 추가하세요. (계좌가 없으면 손님에게 이 칸이 안 보여요)</p>' : '');
  };

  R.rsvp = function (b, p) { return T(p + '.title', 'h2', 'sec-title rv') + T(p + '.text', 'p', 'sec-text rv') + '<button class="l-btn rv" data-act="rsvp">참석 여부 전달</button>'; };

  R.photoShare = function (b, p) {
    return T(p + '.title', 'h2', 'sec-title rv') + T(p + '.text', 'p', 'sec-text rv') +
      '<div class="drop rv"><div class="cam">📷</div>' +
      '<input type="text" class="up-name" maxlength="20" placeholder="보내시는 분 성함 (선택)">' +
      '<div><button class="l-btn" data-act="pick">사진·영상 선택하기</button></div>' +
      '<input type="file" class="up-file" accept="image/*,video/*" multiple hidden>' +
      '<p class="hint">원본 그대로, 용량 제한 없이 올라가요.<br>여러 개를 한 번에 고를 수 있어요. 올리는 동안 화면을 닫지 말아주세요.</p>' +
      '<div class="bar" hidden><i></i></div><div class="uplist"></div><div class="up-done"></div></div>';
  };

  R.guestbook = function (b, p) {
    return T(p + '.title', 'h2', 'sec-title rv') + '<div class="gb-list gb-main rv"><p class="gb-empty">아직 작성된 방명록이 없습니다.<br>첫 방명록을 작성해주세요.</p></div>' +
      '<div class="gb-btns rv"><button class="s-btn" data-act="gb-all">전체보기</button><button class="s-btn" data-act="gb-write">작성</button></div>';
  };

  R.together = function (b, p) {
    if (!has(b.since)) return EDIT ? T(p + '.title', 'p', 'ttl') + '<p class="edit-hint">[편집]에서 사귄 날을 넣으면 함께한 시간이 실시간으로 올라가요.</p>' : '';
    return T(p + '.title', 'p', 'ttl rv') + '<p class="cnt rv" data-since="' + esc(b.since) + '"></p>';
  };

  R.wreath = function (b, p) {
    if (!has(b.url)) return EDIT ? '<p class="edit-hint">[편집]에서 화환 주문 링크를 넣으면 보여요.</p>' : '';
    return '<a class="rv" href="' + esc(b.url) + '" target="_blank" rel="noopener"><span class="ic">💐</span><span><h4>축하화환 보내기</h4>' + T(p + '.text', 'p') + '</span></a>';
  };

  R.ending = function (b, p) { return '<div class="frame rv">' + pic(b.photo, p + '.photo') + T(p + '.text', 'p', 'ov') + '</div>'; };

  function blockTitle(b) {
    if (b.type === 'cover') return '메인';
    var t = String(b.title || '').replace(/\*\*/g, '').split('\n')[0];
    return has(t) ? t : (LABEL[b.type] || b.type);
  }

  /* ---------------- render ---------------- */
  var revealIO = null;
  function render() {
    applyTheme();
    var nm = names();
    document.title = nm.g + ' ♥ ' + nm.b + ' 결혼합니다.';
    var html = '';
    (C.blocks || []).forEach(function (b, i) {
      if (!b || !R[b.type]) return;
      if (b.hidden && !EDIT) return;
      if (!b.id) b.id = 'b' + Math.random().toString(36).slice(2, 8);
      var inner = R[b.type](b, 'blocks.' + i);
      if (!inner) { if (!EDIT) return; inner = '<p class="edit-hint">' + LABEL[b.type] + ' (내용이 비어서 손님에게는 안 보여요)</p>'; }
      html += '<section id="blk-' + esc(b.id) + '" class="blk t-' + b.type + (b.hidden ? ' is-hidden' : '') + '" data-bi="' + i + '" data-menu="' + esc(blockTitle(b)) + '">' + inner + '</section>';
    });
    html += '<footer><div class="logo" data-edit="site.footer">' + esc(S().footer || 'Our Wedding') + '</div><small>Made with love · ' + esc(nm.g) + ' ♥ ' + esc(nm.b) + '</small></footer>';
    $('#app').innerHTML = html;
    buildChrome();
    afterRender();
  }

  // 메인 손글씨: 글씨 모양에 맞춰 크기를 맞춘 뒤 왼쪽부터 써지게
  function playHandwriting() {
    $$('.hw').forEach(function (svg) {
      svg.classList.remove('go');
      var go = function () {
        var t = $('text', svg);
        try { var bb = t.getBBox(); if (bb.width > 0) svg.setAttribute('viewBox', (bb.x - 24) + ' ' + (bb.y - 12) + ' ' + (bb.width + 48) + ' ' + (bb.height + 24)); } catch (e) {}
        void svg.getBoundingClientRect();
        requestAnimationFrame(function () { svg.classList.add('go'); });
      };
      if (document.fonts && document.fonts.load) document.fonts.load('120px "Great Vibes"').then(go, go); else go();
    });
    $$('.cv-sub').forEach(function (s) { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; });
  }
  // 요소별 등장 효과 (원본처럼 하나씩, 끝은 부드럽게 감속)
  function setupReveal(animate) {
    if (revealIO) revealIO.disconnect();
    var els = $$('.rv');
    if (!animate || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    els.forEach(function (el) { el.style.transition = 'none'; el.classList.remove('in'); });
    void document.body.offsetHeight;
    els.forEach(function (el) { el.style.transition = ''; });
    revealIO = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    els.forEach(function (el) { revealIO.observe(el); });
  }

  function afterRender() {
    playHandwriting();
    setupReveal(!EDIT);
    // 넘겨보기 점 표시
    if ('IntersectionObserver' in window) $$('.pl-slide').forEach(function (sl) {
      var dots = $$('i', sl.nextElementSibling), items = $$('.pi', sl);
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) { if (e.isIntersecting) { var k = items.indexOf(e.target); dots.forEach(function (d, j) { d.classList.toggle('on', j === k); }); } });
      }, { root: sl, threshold: 0.6 });
      items.forEach(function (x) { io.observe(x); });
    });
    // 함께한 시간
    clearInterval(afterRender._t);
    var tcs = $$('[data-since]');
    if (tcs.length) {
      var tick = function () { tcs.forEach(function (el) { el.textContent = since(el.getAttribute('data-since')); }); };
      tick(); afterRender._t = setInterval(tick, 1000);
    }
    gbLoad();
    if (window.InviteEditor && window.InviteEditor.ready) window.InviteEditor.afterRender();
  }

  function since(s) {
    var sp = String(s).split(/[-./ :T]/).map(Number), st = new Date(sp[0], (sp[1] || 1) - 1, sp[2] || 1, sp[3] || 0, sp[4] || 0), now = new Date();
    if (isNaN(st)) return '';
    var y = now.getFullYear() - st.getFullYear(), mo = now.getMonth() - st.getMonth(), d = now.getDate() - st.getDate();
    var rest = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) - (st.getHours() * 3600 + st.getMinutes() * 60 + st.getSeconds());
    if (rest < 0) { rest += 86400; d--; }
    if (d < 0) { mo--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (mo < 0) { y--; mo += 12; }
    return '"' + (y ? y + '년 ' : '') + mo + '개월 ' + d + '일 ' + Math.floor(rest / 3600) + '시간 ' + Math.floor(rest % 3600 / 60) + '분 ' + (rest % 60) + '초"';
  }

  /* ---------------- chrome: header, menu, fabs ---------------- */
  var chromeBuilt = false;
  function buildChrome() {
    var nm = names();
    if (!chromeBuilt) {
      var c = document.createElement('div');
      c.innerHTML = '<div class="topbar"><button class="icon-btn" data-act="menu" aria-label="메뉴">' + ICON.menu + '</button><div class="ttl"></div><span class="icon-btn"></span></div>' +
        '<button class="icon-btn music-fab" data-act="music" aria-label="배경음악" hidden>' + ICON.soundOff + '</button>' +
        '<div class="menu-dim" data-act="menu-close"></div><nav class="menu"></nav>' +
        '<div class="fab-wrap"><button class="fab top" data-act="top" aria-label="맨 위로">' + ICON.up + '</button><button class="fab" data-act="share" aria-label="공유">' + ICON.share + '</button></div>';
      while (c.firstChild) document.body.appendChild(c.firstChild);
      window.addEventListener('scroll', onScroll, { passive: true });
      chromeBuilt = true;
    }
    $('.topbar .ttl').innerHTML = esc(nm.gs) + '<i>♥</i>' + esc(nm.bs);
    $('.menu').innerHTML = $$('#app section[data-menu]').map(function (s) { return '<a href="#' + s.id + '" data-act="menu-close">' + esc(s.getAttribute('data-menu')) + '</a>'; }).join('');
    $('.music-fab').hidden = !has((S().music || {}).src);
    onScroll();
  }
  function onScroll() {
    var y = window.scrollY || window.pageYOffset, cv = $('.t-cover');
    var lim = cv ? cv.offsetHeight - 60 : 10;
    var tb = $('.topbar'); if (tb) tb.classList.toggle('show', y > lim);
    var ft = $('.fab.top'); if (ft) ft.classList.toggle('show', y > 400);
  }

  /* ---------------- music ---------------- */
  var audio = null;
  function initMusic() {
    var m = S().music || {};
    if (!has(m.src)) return;
    audio = new Audio(resolve(m.src)); audio.loop = true; audio.preload = 'auto';
    var setIcon = function () { $('.music-fab').innerHTML = audio.paused ? ICON.soundOff : ICON.soundOn; };
    audio.addEventListener('play', setIcon); audio.addEventListener('pause', setIcon);
    if (m.autoplay && !EDIT) {
      var evs = ['touchstart', 'click', 'scroll'];
      var tryPlay = function (e) {
        if (e && e.target && e.target.closest && e.target.closest('[data-act="music"]')) return;
        audio.play().catch(function () {});
        evs.forEach(function (ev) { window.removeEventListener(ev, tryPlay, true); });
      };
      audio.play().catch(function () { evs.forEach(function (ev) { window.addEventListener(ev, tryPlay, { capture: true, passive: true }); }); });
    }
  }

  /* ---------------- modal ---------------- */
  function modal(inner, cls) {
    var m = document.createElement('div');
    m.className = 'modal ' + (cls || '');
    m.innerHTML = '<div class="card"><button class="x" aria-label="닫기">' + ICON.close + '</button>' + inner + '</div>';
    document.body.appendChild(m); document.body.classList.add('lock');
    requestAnimationFrame(function () { m.classList.add('open'); });
    var close = function () { m.classList.remove('open'); setTimeout(function () { m.remove(); if (!$('.modal')) document.body.classList.remove('lock'); }, 200); };
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.x')) close(); });
    m.close = close;
    return m;
  }
  function contactModal() {
    function row(r, p) {
      if (!p || (!has(p.name) && !has(p.phone))) return '';
      return '<div class="contact-row"><span class="r">' + r + '</span><span class="nm">' + esc(p.name || '') + '</span>' +
        (has(p.phone) ? '<a href="tel:' + esc(p.phone) + '" aria-label="전화">' + ICON.phone + '</a><a href="sms:' + esc(p.phone) + '" aria-label="문자">' + ICON.sms + '</a>' : '') + '</div>';
    }
    function grp(k, side, cls, role) {
      var s = S()[k] || {};
      return '<div class="contact-grp ' + cls + '"><h4>' + side + '</h4>' + row(role, { name: (s.last || '') + (s.first || ''), phone: s.phone }) + row('아버지', s.father) + row('어머니', s.mother) + '</div>';
    }
    modal('<h3>연락하기</h3>' + grp('groom', '신랑측', 'g', '신랑') + grp('bride', '신부측', 'b', '신부'));
  }
  function interviewModal(p) {
    var b = get(p) || {};
    modal('<h3>' + fmt(b.title || '웨딩 인터뷰') + '</h3>' + (b.items || []).map(function (it, i) {
      return '<div class="qa"><p class="q">' + (i + 1) + '. ' + fmt(it.q) + '</p><p class="a">' + fmt(it.a) + '</p></div>';
    }).join(''));
  }

  /* ---------------- api (Google Apps Script) ---------------- */
  function API() { return ((S().api || {}).scriptUrl || '').trim(); }
  function apiPost(payload) {
    if (!has(API())) return Promise.reject(new Error('NO_API'));
    return fetch(API(), { method: 'POST', body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || '오류'); return j; });
  }
  function apiGet(action) {
    if (!has(API())) return Promise.reject(new Error('NO_API'));
    return fetch(API() + (API().indexOf('?') > -1 ? '&' : '?') + 'action=' + action + '&t=' + Date.now()).then(function (r) { return r.json(); });
  }
  function apiErr(e) {
    if (e && e.message === 'NO_API') toast('아직 구글 연결 전이에요. ([기본정보] > 구글 연결 주소)');
    else toast('전송에 실패했어요. 잠시 후 다시 시도해주세요.');
  }

  /* ---------------- rsvp ---------------- */
  function rsvpForm() {
    function seg(n, label, opts) {
      return '<div class="fl"><span class="lb">' + label + ' <em>*</em></span><div class="seg">' + opts.map(function (o) { return '<label><input type="radio" name="' + n + '" value="' + o + '"><span>' + o + '</span></label>'; }).join('') + '</div></div>';
    }
    var m = modal('<h3>참석 여부 전달</h3><form class="form" novalidate>' +
      seg('side', '어느 측 하객이신가요?', ['신랑측', '신부측']) + seg('attend', '참석 여부', ['참석', '불참']) + seg('meal', '식사 여부', ['예정', '안함', '미정']) +
      '<div class="fl"><label class="lb">성함 <em>*</em></label><input type="text" name="name" maxlength="20" placeholder="성함을 입력해주세요"></div>' +
      '<div class="fl"><span class="lb">본인 포함 인원</span><div class="seg">' + [1, 2, 3, 4, '5+'].map(function (n, i) { return '<label><input type="radio" name="count" value="' + n + '"' + (i ? '' : ' checked') + '><span>' + n + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="fl"><label class="lb">동행인 성함</label><input type="text" name="companions" maxlength="60" placeholder="(선택)"></div>' +
      '<div class="fl"><label class="lb">연락처</label><input type="tel" name="phone" maxlength="20" placeholder="(선택)"></div>' +
      '<div class="fl"><label class="agree"><input type="checkbox" name="agree"> (필수) 개인정보 수집 및 활용 동의 <a href="#" data-terms>[자세히보기]</a></label>' +
      '<div class="terms">[수집 항목] 이름, 연락처 등 입력한 항목<br>[이용 목적] 결혼식 참석 여부 확인 및 안내<br>[보유 기간] 결혼식 종료 후 지체 없이 파기<br>동의를 거부할 수 있으나, 거부 시 전달이 불가합니다.</div></div>' +
      '<button class="l-btn" type="submit">전달하기</button></form>');
    var f = $('form', m);
    $('[data-terms]', m).addEventListener('click', function (e) { e.preventDefault(); $('.terms', m).classList.toggle('on'); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (n) { var el = f.querySelector('[name="' + n + '"]:checked') || f.querySelector('[name="' + n + '"]:not([type=radio])'); return el ? el.value.trim() : ''; };
      if (!v('side')) return toast('어느 측 하객인지 선택해주세요.');
      if (!v('attend')) return toast('참석 여부를 선택해주세요.');
      if (!v('meal')) return toast('식사 여부를 선택해주세요.');
      if (!v('name')) return toast('성함을 입력해주세요.');
      if (!f.agree.checked) return toast('개인정보 수집에 동의해주세요.');
      var btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = '전송 중...';
      apiPost({ action: 'rsvp', side: v('side'), attend: v('attend'), meal: v('meal'), name: v('name'), count: v('count'), companions: v('companions'), phone: v('phone') })
        .then(function () { m.close(); toast('참석 여부가 전달되었습니다. 감사합니다!'); })
        .catch(function (err) { apiErr(err); btn.disabled = false; btn.textContent = '전달하기'; });
    });
  }
  function rsvpPopup() {
    var blk = C.blocks.filter(function (b) { return b.type === 'rsvp' && !b.hidden; })[0];
    if (!blk) return;
    var key = 'rsvp_hide_' + new Date().toDateString();
    try { if (localStorage.getItem(key)) return; } catch (e) {}
    var nm = names();
    var m = modal('<h3>' + fmt(blk.title) + '</h3><p class="sec-text" style="font-size:14.5px">' + fmt(blk.text) + '</p>' +
      '<div class="sum"><div>♡ <span class="g">신랑</span> ' + esc(nm.g) + ', <span class="b">신부</span> ' + esc(nm.b) + '</div>' +
      '<div>📅 ' + esc(dateText() || '날짜 미정') + '</div>' + (venueText() ? '<div>📍 ' + esc(venueText()) + '</div>' : '') + '</div>' +
      '<button class="l-btn" data-go>참석 여부 전달</button><div><button class="nomore">✓ 오늘 하루 보지 않기</button></div>');
    $('[data-go]', m).addEventListener('click', function () { m.close(); rsvpForm(); });
    $('.nomore', m).addEventListener('click', function () { try { localStorage.setItem(key, '1'); } catch (e) {} m.close(); });
  }

  /* ---------------- guestbook ---------------- */
  var gbItems = [], gbLoaded = false;
  function gbHtml(list) {
    if (!list.length) return '<p class="gb-empty">아직 작성된 방명록이 없습니다.<br>첫 방명록을 작성해주세요.</p>';
    return list.map(function (it) {
      return '<div class="gb-item"><div class="top"><b>' + esc(it.name) + '</b><span>' + esc(it.date || '') + ' <button data-del="' + esc(it.id) + '" aria-label="삭제">×</button></span></div><div class="msg">' + esc(it.msg) + '</div></div>';
    }).join('');
  }
  function gbLoad(force) {
    var box = $('.gb-main'); if (!box) return;
    if (gbLoaded && !force) { box.innerHTML = gbHtml(gbItems.slice(0, 5)); return; }
    apiGet('guestbook').then(function (j) {
      gbLoaded = true; gbItems = (j && j.items) || [];
      var b2 = $('.gb-main'); if (b2) b2.innerHTML = gbHtml(gbItems.slice(0, 5));
      var all = $('.modal .gb-all-list'); if (all) all.innerHTML = gbHtml(gbItems);
    }).catch(function () {});
  }
  function gbWrite() {
    var m = modal('<h3>방명록 작성</h3><form class="form">' +
      '<div class="fl"><label class="lb">성함 <em>*</em></label><input type="text" name="name" maxlength="20"></div>' +
      '<div class="fl"><label class="lb">비밀번호 <em>*</em> <small style="color:#aaa">(삭제할 때 필요해요)</small></label><input type="password" name="pw" maxlength="20"></div>' +
      '<div class="fl"><label class="lb">내용 <em>*</em></label><textarea name="msg" maxlength="300" placeholder="축하의 한마디를 남겨주세요"></textarea></div>' +
      '<button class="l-btn" type="submit">작성하기</button></form>');
    var f = $('form', m);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.name.value.trim(), pw = f.pw.value, msg = f.msg.value.trim();
      if (!name || !pw || !msg) return toast('모든 칸을 입력해주세요.');
      var btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = '저장 중...';
      apiPost({ action: 'guestbook_add', name: name, pw: pw, msg: msg })
        .then(function () { m.close(); toast('방명록이 등록되었습니다.'); gbLoad(true); })
        .catch(function (err) { apiErr(err); btn.disabled = false; btn.textContent = '작성하기'; });
    });
  }
  function gbDelete(id) {
    var pw = window.prompt('작성할 때 입력한 비밀번호를 입력해주세요.');
    if (!pw) return;
    apiPost({ action: 'guestbook_delete', id: id, pw: pw })
      .then(function () { toast('삭제되었습니다.'); gbLoad(true); })
      .catch(function (err) { if (err.message === 'NO_API') apiErr(err); else toast('비밀번호가 일치하지 않아요.'); });
  }

  /* ---------------- guest photo upload -> Google Drive (원본, 용량 제한 없음) ---------------- */
  var uploading = false;
  window.addEventListener('beforeunload', function (e) { if (uploading) { e.preventDefault(); e.returnValue = ''; } });
  var CHUNK = 8 * 1024 * 1024; // 8MB (256KB의 배수)

  function putDirect(url, file, onProg) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest();
      x.open('PUT', url);
      x.upload.onprogress = function (e) { onProg(e.loaded / file.size); };
      x.onload = function () { (x.status === 200 || x.status === 201) ? res() : rej({ net: true, status: x.status }); };
      x.onerror = function () { rej({ net: true }); };
      x.send(file);
    });
  }
  function b64(blob) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = rej; r.readAsDataURL(blob); });
  }
  // 브라우저에서 드라이브로 바로 못 보낼 때: 구글 스크립트를 거쳐 8MB씩 이어서 보냄
  function relay(url, file, onProg) {
    return apiPost({ action: 'upload_status', uploadUrl: url, total: file.size }).then(function (st) {
      if (st.done) return;
      var start = st.next || 0, tries = 0;
      function step() {
        if (start >= file.size) return Promise.resolve();
        var end = Math.min(start + CHUNK, file.size);
        return b64(file.slice(start, end)).then(function (data) {
          return apiPost({ action: 'upload_chunk', uploadUrl: url, start: start, total: file.size, mimeType: file.type, data: data });
        }).then(function (j) {
          tries = 0; start = j.done ? file.size : (j.next != null ? j.next : end); onProg(start / file.size);
          return j.done ? null : step();
        }, function (e) {
          if (++tries > 3) throw e;
          return new Promise(function (r) { setTimeout(r, 1500 * tries); }).then(function () {
            return apiPost({ action: 'upload_status', uploadUrl: url, total: file.size }).then(function (s2) { if (s2.done) { start = file.size; return; } start = s2.next || 0; return step(); });
          });
        });
      }
      return step();
    });
  }
  function uploadOne(file, who, onProg) {
    return apiPost({ action: 'upload_init', name: who, fileName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, origin: /^https?:/.test(location.origin) ? location.origin : '' })
      .then(function (j) {
        return putDirect(j.uploadUrl, file, onProg).catch(function (e) {
          if (!e || !e.net) throw e;
          return relay(j.uploadUrl, file, onProg);   // 끊기거나 막히면 이어 올리기
        });
      });
  }
  function uploadFiles(files, box) {
    if (!has(API())) return apiErr(new Error('NO_API'));
    var list = $('.uplist', box), bar = $('.bar', box), done = $('.up-done', box);
    var who = ($('.up-name', box).value || '').trim() || '익명';
    files = Array.prototype.slice.call(files);
    var total = files.reduce(function (a, f) { return a + f.size; }, 0) || 1, sent = 0;
    list.innerHTML = files.map(function (f, i) { return '<div class="u" data-u="' + i + '"><span class="n">' + esc(f.name) + '</span><span class="s">대기</span></div>'; }).join('');
    bar.hidden = false; $('i', bar).style.width = '0%'; done.textContent = '';
    uploading = true;
    var ok = 0, i = 0;
    function st(idx, text, cls) { var s = $('[data-u="' + idx + '"] .s', list); s.textContent = text; s.className = 's ' + (cls || ''); }
    function next() {
      if (i >= files.length) {
        uploading = false;
        done.textContent = ok === files.length ? ok + '개 모두 올라갔어요. 소중한 사진 감사합니다 💛' : ok + '/' + files.length + '개 완료 (실패한 파일은 다시 시도해주세요)';
        $('.up-file', box).value = '';
        return;
      }
      var idx = i++, f = files[idx];
      if (!/^(image|video)\//.test(f.type || '')) { st(idx, '사진/영상만', 'err'); sent += f.size; return next(); }
      st(idx, '0%');
      uploadOne(f, who, function (r) {
        st(idx, Math.floor(r * 100) + '%');
        $('i', bar).style.width = Math.min(100, Math.round((sent + f.size * r) / total * 100)) + '%';
      }).then(function () { ok++; st(idx, '완료', 'ok'); }, function () { st(idx, '실패', 'err'); })
        .then(function () { sent += f.size; $('i', bar).style.width = Math.round(sent / total * 100) + '%'; next(); });
    }
    next();
  }

  /* ---------------- lightbox ---------------- */
  function lightbox(list, start) {
    if (!list.length) return;
    var idx = start;
    var lb = document.createElement('div'); lb.className = 'lightbox';
    lb.innerHTML = '<div class="cnt"></div><button class="x" aria-label="닫기">' + ICON.close + '</button><div class="stage"></div>' +
      '<button class="nav prev" aria-label="이전">' + ICON.prev + '</button><button class="nav next" aria-label="다음">' + ICON.next + '</button>';
    document.body.appendChild(lb); document.body.classList.add('lock');
    var stage = $('.stage', lb);
    function show() {
      idx = (idx + list.length) % list.length;
      stage.innerHTML = '<img src="' + esc(resolve(P(list[idx]).src)) + '" alt="" onerror="__ph(this)">';
      $('.cnt', lb).textContent = (idx + 1) + ' / ' + list.length;
    }
    show(); requestAnimationFrame(function () { lb.classList.add('open'); });
    function close() { lb.remove(); document.body.classList.remove('lock'); }
    lb.addEventListener('click', function (e) {
      if (e.target.closest('.x') || e.target === stage) close();
      else if (e.target.closest('.prev')) { idx--; show(); }
      else if (e.target.closest('.next')) { idx++; show(); }
    });
    var sx = null;
    stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (sx == null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 45) { idx += dx < 0 ? 1 : -1; show(); }
    });
  }

  /* ---------------- share ---------------- */
  function share() {
    var url = location.href.split('#')[0].replace(/[?&]edit\b[^&]*/, ''), title = document.title, og = $('meta[property="og:image"]');
    var key = S().kakaoKey;
    function fb() {
      if (navigator.share) navigator.share({ title: title, url: url }).catch(function () {});
      else copy(url, '청첩장 주소가 복사되었습니다.');
    }
    if (!has(key)) return fb();
    var go = function () {
      try {
        if (!window.Kakao.isInitialized()) window.Kakao.init(key);
        window.Kakao.Share.sendDefault({
          objectType: 'feed',
          content: { title: title, description: dateText() || '소중한 분들을 초대합니다.', imageUrl: og ? og.content : '', link: { mobileWebUrl: url, webUrl: url } },
          buttons: [{ title: '청첩장 보기', link: { mobileWebUrl: url, webUrl: url } }]
        });
      } catch (e) { fb(); }
    };
    if (window.Kakao) return go();
    var s = document.createElement('script'); s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js'; s.onload = go; s.onerror = fb; document.head.appendChild(s);
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act],[data-copy],[data-lb],[data-tab],[data-del]');
    if (!t) return;
    if (EDIT && (e.target.closest('[data-edit]') || e.target.closest('.ed-ui') || e.target.closest('[data-img]'))) return;
    if (t.hasAttribute('data-copy')) return copy(t.getAttribute('data-copy'), t.getAttribute('data-msg') || '주소가 복사되었습니다.');
    if (t.hasAttribute('data-lb')) return lightbox((get(t.getAttribute('data-lb')) || {}).photos || [], +t.getAttribute('data-k'));
    if (t.hasAttribute('data-del')) return gbDelete(t.getAttribute('data-del'));
    if (t.hasAttribute('data-tab')) {
      var sc = t.closest('section'), n = t.getAttribute('data-tab');
      $$('[data-tab]', sc).forEach(function (b) { b.classList.toggle('on', b === t); });
      $$('[data-pane]', sc).forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-pane') === n); });
      return;
    }
    switch (t.getAttribute('data-act')) {
      case 'menu': $('.menu').classList.add('open'); $('.menu-dim').classList.add('open'); break;
      case 'menu-close': $('.menu').classList.remove('open'); $('.menu-dim').classList.remove('open'); break;
      case 'music': if (audio) { if (audio.paused) audio.play().catch(function () {}); else audio.pause(); } break;
      case 'top': window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }); break;
      case 'share': share(); break;
      case 'contact': contactModal(); break;
      case 'interview': interviewModal(t.getAttribute('data-p')); break;
      case 'rsvp': rsvpForm(); break;
      case 'acc': t.parentNode.classList.toggle('open'); break;
      case 'gb-write': gbWrite(); break;
      case 'gb-all': modal('<h3>방명록</h3><div class="gb-list gb-all-list">' + gbHtml(gbItems) + '</div>'); break;
      case 'pick': $('.up-file', t.closest('.drop')).click(); break;
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.classList && e.target.classList.contains('up-file') && e.target.files && e.target.files.length && !uploading) uploadFiles(e.target.files, e.target.closest('.drop'));
  });

  /* ---------------- public API (편집기에서 사용) ---------------- */
  var Invite = window.Invite = {
    EDIT: EDIT, get: get, set: set, P: P, esc: esc, fmt: fmt, has: has, imgMap: imgMap, LABEL: LABEL, LAYOUTS: LAYOUTS, FONTS: FONTS,
    render: render, toast: toast, modal: modal,
    // 편집 모드 [미리보기]: 손님 화면과 똑같이 움직임을 다시 재생
    replayMotion: function () { window.scrollTo(0, 0); playHandwriting(); setupReveal(true); onScroll(); },
    content: function () { return C; },
    setContent: function (c) { C = window.CONTENT = c; render(); }
  };

  function start() {
    render();
    initMusic();
    if (EDIT) {
      if (window.InviteEditor) window.InviteEditor.init(Invite);
      else {
        var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/editor.css?v=' + Date.now(); document.head.appendChild(l);
        var s = document.createElement('script'); s.src = 'js/editor.js?v=' + Date.now(); s.onload = function () { window.InviteEditor.init(Invite); }; document.body.appendChild(s);
      }
    } else if (S().rsvpPopup) setTimeout(rsvpPopup, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
