/**
 * 모바일 청첩장 백엔드 (구글 Apps Script)
 * - 하객 사진/영상: 구글드라이브 "WeddingPhoto." 폴더에 원본 그대로, 용량 제한 없이 저장 (보낸 사람 이름별 폴더)
 *   (드라이브 '이어 올리기' 방식: 큰 영상도 끊기면 이어서 올라감)
 * - 방명록, 참석여부: 이 스크립트가 붙은 구글 시트에 저장
 */

var FOLDER_ID = '1CWQWA-ZNh_DZ_5HCkth9YVfuB6G7VbQW';   // WeddingPhoto. 폴더
var SHEET_ID = '1UWwMeZjg8zyJYSwUvMf5exGGstdcaFnEM6GPKD4h3jE'; // "청첩장 데이터" 시트 (방명록, 참석여부)
// 관리자 비번(어떤 방명록이든 삭제 가능)은 코드에 쓰지 마세요. 프로젝트 설정(톱니) > 스크립트 속성에 ADMIN_PASSWORD 로 넣으면 돼요.
var ADMIN_PASSWORD = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || '';
var TZ = 'Asia/Seoul';
// 권한 안내용 (지우지 마세요): DriveApp.createFile()

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'guestbook') return json({ ok: true, items: listGuestbook() });
  return json({ ok: true, msg: 'wedding api is running' });
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad request' }); }
  try {
    switch (d.action) {
      case 'upload_init': return json(uploadInit(d));
      case 'upload_chunk': return json(uploadChunk(d));
      case 'upload_status': return json(uploadStatus(d));
      case 'guestbook_add': return json(addGuestbook(d));
      case 'guestbook_delete': return json(deleteGuestbook(d));
      case 'rsvp': return json(addRsvp(d));
    }
    return json({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

/* ---------- 하객 사진 업로드 (드라이브 이어 올리기) ---------- */
function guestFolder(name) {
  var root = DriveApp.getFolderById(FOLDER_ID);
  var who = clean(name, 20) || '익명';
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var it = root.getFoldersByName(who);
    return it.hasNext() ? it.next() : root.createFolder(who);
  } finally { lock.releaseLock(); }
}

// 1) 업로드 주소 만들기: 브라우저는 이 주소로 파일을 드라이브에 바로 보냄 (스크립트 용량 한도와 무관)
function uploadInit(d) {
  var type = String(d.mimeType || '');
  if (!/^(image|video)\//.test(type)) throw new Error('사진/영상만 올릴 수 있어요');
  var size = Number(d.size || 0);
  if (!(size > 0)) throw new Error('빈 파일');
  var folder = guestFolder(d.name);
  var stamp = Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss');
  var meta = { name: stamp + '_' + (clean(d.fileName, 120) || 'file'), parents: [folder.getId()], mimeType: type };
  var headers = {
    Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
    'X-Upload-Content-Type': type,
    'X-Upload-Content-Length': String(size)
  };
  if (d.origin && /^https?:\/\/[^\s]+$/.test(d.origin)) headers.Origin = d.origin;  // 브라우저에서 바로 올릴 수 있게 허용
  var r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    method: 'post', contentType: 'application/json; charset=UTF-8', payload: JSON.stringify(meta), headers: headers, muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error('init ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
  var h = r.getHeaders(), loc = h.Location || h.location;
  if (!loc) throw new Error('no upload url');
  return { ok: true, uploadUrl: loc };
}

// 2) (예비) 브라우저가 바로 못 보낼 때 8MB씩 받아서 대신 전달
function uploadChunk(d) {
  checkUploadUrl(d.uploadUrl);
  var bytes = Utilities.base64Decode(d.data || '');
  var start = Number(d.start), total = Number(d.total), end = start + bytes.length - 1;
  var r = UrlFetchApp.fetch(d.uploadUrl, {
    method: 'put', payload: bytes, contentType: d.mimeType || 'application/octet-stream',
    headers: { 'Content-Range': 'bytes ' + start + '-' + end + '/' + total }, muteHttpExceptions: true, followRedirects: false
  });
  return progress(r, end + 1);
}

// 3) 어디까지 올라갔는지 확인 (이어 올리기용)
function uploadStatus(d) {
  checkUploadUrl(d.uploadUrl);
  var r = UrlFetchApp.fetch(d.uploadUrl, {
    method: 'put', payload: '', headers: { 'Content-Range': 'bytes */' + Number(d.total) }, muteHttpExceptions: true, followRedirects: false
  });
  return progress(r, 0);
}

function progress(r, fallbackNext) {
  var c = r.getResponseCode();
  if (c === 200 || c === 201) return { ok: true, done: true };
  if (c === 308) {
    var h = r.getHeaders(), range = h.Range || h.range || '';
    var m = /bytes=0-(\d+)/.exec(range);
    return { ok: true, done: false, next: m ? Number(m[1]) + 1 : (range ? fallbackNext : 0) };
  }
  throw new Error('upload ' + c + ' ' + r.getContentText().slice(0, 200));
}
function checkUploadUrl(u) {
  if (!/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/.test(String(u || ''))) throw new Error('bad upload url');
}

/* ---------- 방명록 ---------- */
function gbSheet() { return sheet('방명록', ['id', '작성시간', '이름', '내용', 'pw']); }

function listGuestbook() {
  var sh = gbSheet(), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 4).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    var dt = r[1] instanceof Date ? Utilities.formatDate(r[1], TZ, 'yyyy.MM.dd') : String(r[1]).slice(0, 10);
    return { id: String(r[0]), date: dt, name: String(r[2]), msg: String(r[3]) };
  }).reverse();
}
function addGuestbook(d) {
  var name = clean(d.name, 20), msg = clean(d.msg, 300, true), pw = String(d.pw || '');
  if (!name || !msg || !pw) throw new Error('missing');
  var id = Utilities.getUuid().slice(0, 8);
  withLock(function () { gbSheet().appendRow([id, new Date(), name, msg, hash(pw, id)]); });
  return { ok: true, id: id };
}
function deleteGuestbook(d) {
  var sh = gbSheet(), last = sh.getLastRow();
  if (last < 2) throw new Error('not found');
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(d.id)) {
      var row = i + 2, saved = sh.getRange(row, 5).getValue();
      var isAdmin = ADMIN_PASSWORD && String(d.pw) === ADMIN_PASSWORD;
      if (!isAdmin && saved !== hash(String(d.pw || ''), String(d.id))) throw new Error('wrong password');
      withLock(function () { sh.deleteRow(row); });
      return { ok: true };
    }
  }
  throw new Error('not found');
}

/* ---------- 참석 여부 ---------- */
var RSVP_HEAD = ['전달시간', '구분', '참석', '식사', '성함', '인원', '동행인', '연락처'];
function addRsvp(d) {
  if (!clean(d.name, 20)) throw new Error('missing name');
  withLock(function () {
    sheet('참석여부', RSVP_HEAD).appendRow([new Date(), clean(d.side, 10), clean(d.attend, 10), clean(d.meal, 10), clean(d.name, 20), clean(d.count, 5), clean(d.companions, 60), clean(d.phone, 20)]);
  });
  return { ok: true };
}

/* ---------- 공통 ---------- */
function sheet(name, headers) {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); sh.getRange(1, 1, 1, headers.length).setFontWeight('bold'); }
  return sh;
}
function clean(v, max, multiline) {
  var s = String(v == null ? '' : v);
  s = multiline ? s.replace(/\r/g, '') : s.replace(/[\r\n]+/g, ' ');
  s = s.replace(/[\\\/:*?"<>|]/g, function (c) { return max >= 100 ? '_' : c; });  // 파일 이름에 못 쓰는 글자
  s = s.replace(/^[=+\-@]/, "'$&");   // 시트 수식 주입 방지
  return s.trim().slice(0, max);
}
function hash(pw, salt) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw + ':' + salt, Utilities.Charset.UTF_8));
}
function withLock(fn) { var lock = LockService.getScriptLock(); lock.waitLock(20000); try { fn(); } finally { lock.releaseLock(); } }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

/** 처음 한 번 ▶ 실행해서 권한 허용 */
function setup() {
  Logger.log('폴더: ' + DriveApp.getFolderById(FOLDER_ID).getName());
  gbSheet(); sheet('참석여부', RSVP_HEAD);
  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  Logger.log('준비 완료!');
}
