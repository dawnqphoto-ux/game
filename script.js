/* Game: Bé nói – tìm vần ao, eo
   Luồng: nhận giọng nói -> xử lí (có vần ao/eo không?) -> hiện hình phù hợp
   Hình: đặt ảnh trong thư mục images/. Nếu chưa có ảnh, game tự hiện emoji. */

// ===== 1. Cấu hình ảnh =====
const IMG_DIR = "images/";
const IMG_EXT = ".png";   // đổi thành ".webp" hoặc ".jpg" nếu bạn dùng định dạng khác

// "từ": ["tên-file-không-đuôi", "emoji dự phòng"]
const WORDS = {
  // ----- Vần AO (21 từ) -----
  "ao":        ["ao", "🏞️"],
  "áo":        ["ao-mac", "👕"],
  "cao":       ["huou-cao", "🦒"],
  "cáo":       ["con-cao", "🦊"],
  "báo":       ["con-bao", "🐆"],
  "bao":       ["banh-bao", "🥟"],
  "bánh bao":  ["banh-bao", "🥟"],
  "dao":       ["dao", "🔪"],
  "sao":       ["ngoi-sao", "⭐"],
  "ngôi sao":  ["ngoi-sao", "⭐"],
  "sáo":       ["chim-sao", "🐦"],
  "táo":       ["qua-tao", "🍎"],
  "quả táo":   ["qua-tao", "🍎"],
  "đào":       ["qua-dao", "🍑"],
  "gạo":       ["hat-gao", "🍚"],
  "chào":      ["chao-hoi", "👋"],
  "cháo":      ["chao-nong", "🥣"],
  "gào":       ["gao-thet", "📢"],
  "phao":      ["phao", "🛟"],
  "rào":       ["hang-rao", "🚧"],
  "xào":       ["xao", "🍳"],

  // ----- Vần EO (15 từ) -----
  "kẹo":       ["cai-keo", "🍬"],
  "cái kẹo":   ["cai-keo", "🍬"],
  "bèo":       ["beo", "🌿"],
  "leo":       ["leo-cay", "🧗"],
  "trèo":      ["leo-cay", "🧗"],
  "mèo":       ["meo", "🐱"],
  "đèo":       ["deo-nui", "⛰️"],
  "dẻo":       ["banh-deo", "🍡"],
  "chèo":      ["cheo-thuyen", "🚣"],
  "heo":       ["heo", "🐷"],
  "kéo":       ["cay-keo", "✂️"],
  "treo":      ["treo-tranh", "🖼️"],
  "veo":       ["nuoc-veo", "💧"],
  "lẽo":       ["lanh-leo", "❄️"],
  "lạnh lẽo":  ["lanh-leo", "❄️"],

  // ----- Cụm có cả hai vần -----
  "ao bèo":    ["ao-beo", "🌿"]
};

// Ưu tiên cụm dài (nhiều tiếng) trước
const KEYS = Object.keys(WORDS).sort((a, b) => b.split(" ").length - a.split(" ").length);

// Trả về thẻ <img>; nếu ảnh chưa có thì tự đổi sang emoji
function pic(word) {
  const [file, emoji] = WORDS[word];
  return `<img src="${IMG_DIR}${file}${IMG_EXT}" alt="${word}"
    onerror="this.replaceWith(document.createTextNode('${emoji}'))">`;
}

// ===== 2. Tiện ích =====
const $ = id => document.getElementById(id);
const normalize = s =>
  s.toLowerCase().normalize("NFC").replace(/[.,!?;:"'“”]/g, " ").replace(/\s+/g, " ").trim();

// Tiếng kết thúc bằng ao/eo (có thể kèm dấu thanh trên a hoặc e)
const VAN = /((a|à|á|ả|ã|ạ)o|(e|è|é|ẻ|ẽ|ẹ)o)$/;

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "vi-VN";
    u.rate = 0.7;
    speechSynthesis.speak(u);
  } catch (e) {}
}

function beep(ok) {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.value = ok ? 780 : 190;
    g.gain.value = 0.1;
    o.start(); o.stop(c.currentTime + 0.2);
  } catch (e) {}
}


// ===== 3. Nhận giọng nói =====
const setStatus = t => { $("heard").textContent = t; };

// Tô màu vần trong một chuỗi từ
const hlWord = s => s.split(" ")
  .map(t => VAN.test(t) ? t.replace(VAN, m => '<span class="hl">' + m + "</span>") : t)
  .join(" ");

$("mic").onclick = () => {
  if (!SR) { setStatus("Trình duyệt này chưa hỗ trợ micro. Hãy dùng Chrome, Edge hoặc Safari."); return; }
  const r = new SR();
  r.lang = "vi-VN";
  r.interimResults = false;
  r.maxAlternatives = 1;

  $("mic").classList.add("rec");
  $("mic").textContent = "👂 Đang nghe...";
  setStatus("");
  $("res").textContent = "";

  r.onresult = e => processSpeech(e.results[0][0].transcript);
  r.onerror = e => {
    setStatus(
      e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Chưa được cấp quyền micro. Hãy cho phép micro rồi thử lại."
        : e.error === "no-speech"
          ? "Máy chưa nghe thấy. Bé nói lại nhé!"
          : "Có lỗi (" + e.error + "). Thử lại nhé!");
  };
  r.onend = () => {
    $("mic").classList.remove("rec");
    $("mic").textContent = "🎤 Bấm và nói";
  };
  try { r.start(); } catch (e) {}
};

// ===== 4. Xử lí: có vần ao/eo không? tìm hình =====
function showPics(html, count) {
  // 1 hình: rất to; nhiều hình: nhỏ lại cho vừa màn hình
  const multi = count > 1;
  $("pics").style.setProperty("--w", multi ? "min(44vw, 480px)" : "min(94vw, 960px)");
  $("pics").style.setProperty("--h", multi ? "calc(45dvh - 110px)" : "calc(100dvh - 270px)");
  $("pics").innerHTML = html;
}

function processSpeech(text) {
  const tokens = normalize(text).split(" ").filter(Boolean);
  const said = tokens.join(" ");
  setStatus("");

  // 4.1 Tìm các tiếng có vần ao/eo
  const vanSyllables = tokens.filter(t => VAN.test(t));

  // 4.2 Tìm từ/cụm có hình (khớp cụm dài nhất trước)
  const found = [];
  let k = 0;
  while (k < tokens.length) {
    let hit = null;
    for (const key of KEYS) {
      const n = key.split(" ").length;
      if (tokens.slice(k, k + n).join(" ") === key) { hit = [key, n]; break; }
    }
    if (hit) { found.push(hit[0]); k += hit[1]; } else k++;
  }

  // 4.3 Kết luận
  const ok = vanSyllables.length > 0;
  beep(ok);

  if (!ok) {
    $("res").className = "res no";
    $("res").textContent = "❌ Không có vần ao hoặc eo";
    showPics(`<div class="pic"><div class="word">${said}</div><div class="emo">🤔</div></div>`, 1);
    return;
  }

  const vans = [...new Set(vanSyllables.map(t =>
    t.match(VAN)[0].replace(/[àáảãạ]/, "a").replace(/[èéẻẽẹ]/, "e")))];
  $("res").className = "res ok";
  $("res").textContent = "✅ Có vần " + vans.join(" và ");

  // 4.4 Chiếu hình thật to + từ
  if (found.length) {
    showPics(found.map(f =>
      `<div class="pic"><div class="word">${hlWord(f)}</div><div class="emo">${pic(f)}</div></div>`).join(""), found.length);
  } else {
    showPics(`<div class="pic"><div class="word">${hlWord(said)}</div><div class="emo">🌟</div></div>`, 1);
  }

  speak(said);
}

// ===== 6. Đăng ký PWA Service Worker =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
