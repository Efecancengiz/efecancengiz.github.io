const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const p1ScoreDisplay = document.getElementById('p1ScoreDisplay');
const p2ScoreDisplay = document.getElementById('p2ScoreDisplay');
const p1NameDisplay = document.getElementById('p1NameDisplay');
const p2NameDisplay = document.getElementById('p2NameDisplay');
const p1Box = document.getElementById('p1Box');
const p2Box = document.getElementById('p2Box');
const menuOverlay = document.getElementById('menuOverlay');
const gameModeSelect = document.getElementById('gameModeSelect');
const dartSkinSelect = document.getElementById('dartSkinSelect');
const playLocalBtn = document.getElementById('playLocalBtn');
const playBtn = document.getElementById('playBtn');
const emojiBar = document.getElementById('emojiBar');

// NEW: BEST SCORE TRACKING
let bestRecord = localStorage.getItem('dartBestRecord') ? parseInt(localStorage.getItem('dartBestRecord')) : null;
const recordDisplay = document.getElementById('recordDisplay');
const bestRecordText = document.getElementById('bestRecordText');

function updateLobbyRecordUI() {
    if (bestRecord) {
        recordDisplay.classList.remove('hidden');
        bestRecordText.innerText = bestRecord + " ATIŞ";
    }
}
updateLobbyRecordUI();

// RÜTBE VE XP SİSTEMİ
let totalXP = localStorage.getItem('dart_playerXP') ? parseInt(localStorage.getItem('dart_playerXP')) : 0;

function getRankDetails(xp) {
    if (xp < 500) return { name: "ACEMİ", icon: "🥱", color: "from-slate-400 to-slate-600", next: 500 };
    if (xp < 1500) return { name: "BRONZ", icon: "🥉", color: "from-orange-400 to-orange-600", next: 1500 };
    if (xp < 3500) return { name: "GÜMÜŞ", icon: "🥈", color: "from-gray-300 to-gray-500", next: 3500 };
    if (xp < 7000) return { name: "ALTIN", icon: "🥇", color: "from-yellow-300 to-yellow-600", next: 7000 };
    if (xp < 12000) return { name: "ELMAS", icon: "💎", color: "from-cyan-300 to-blue-500", next: 12000 };
    return { name: "ŞAMPİYON", icon: "👑", color: "from-purple-400 to-pink-600", next: xp }; // Max
}

function updateRankUI() {
    const rank = getRankDetails(totalXP);
    document.getElementById('rankIcon').innerText = rank.icon;
    const rn = document.getElementById('rankName');
    rn.innerText = rank.name;

    // Text color based on rank
    if (rank.name === "ALTIN") rn.className = "text-lg font-black text-yellow-400 sports-font tracking-wider";
    else if (rank.name === "ELMAS") rn.className = "text-lg font-black text-cyan-400 sports-font tracking-wider";
    else if (rank.name === "ŞAMPİYON") rn.className = "text-lg font-black text-purple-400 sports-font tracking-wider";
    else rn.className = "text-lg font-black text-white sports-font tracking-wider";

    // Progress bar
    let prevCap = 0;
    if (rank.name === "BRONZ") prevCap = 500;
    if (rank.name === "GÜMÜŞ") prevCap = 1500;
    if (rank.name === "ALTIN") prevCap = 3500;
    if (rank.name === "ELMAS") prevCap = 7000;
    if (rank.name === "ŞAMPİYON") prevCap = 12000;

    const progress = rank.name === "ŞAMPİYON" ? 100 : ((totalXP - prevCap) / (rank.next - prevCap)) * 100;
    const pb = document.getElementById('rankProgress');
    pb.style.width = `${progress}%`;
    pb.className = `h-full bg-gradient-to-r ${rank.color}`;
}
updateRankUI();

function addXP(amount) {
    totalXP += amount;
    localStorage.setItem('dart_playerXP', totalXP);
    updateRankUI();

    // Rank up bildirimi
    Sound.play(800, 'sine', 0.5, 0.2);
    showAnnounce(`+${amount} XP`, "#22c55e");
}

// ZOOM FEATURE
const zoomBtn = document.getElementById('zoomBtn');
let isZoomed = false;
let currentZoomScale = 1;
let targetZoomScale = 1;
let currentZoomPanX = 0;
let currentZoomPanY = 0;
let targetZoomPanX = 0;
let targetZoomPanY = 0;

zoomBtn.addEventListener('click', () => {
    isZoomed = !isZoomed;
    if (isZoomed) {
        targetZoomScale = 2.5; // Zoom in level

        // If there are thrown darts, zoom to their center-of-mass
        if (thrownDarts.length > 0) {
            let sumX = 0; let sumY = 0;
            thrownDarts.forEach(d => { sumX += d.x; sumY += d.y; });
            let centerX = sumX / thrownDarts.length;
            let centerY = sumY / thrownDarts.length;
            targetZoomPanX = BOARD_X - centerX;
            targetZoomPanY = BOARD_Y - centerY;
        } else {
            targetZoomPanX = 0;
            targetZoomPanY = 0;
        }
        zoomBtn.classList.add('border-emerald-500', 'bg-emerald-900/50', 'ring-2', 'ring-emerald-400', 'shadow-[0_0_15px_rgba(16,185,129,0.5)]');
    } else {
        targetZoomScale = 1;
        targetZoomPanX = 0;
        targetZoomPanY = 0;
        zoomBtn.classList.remove('border-emerald-500', 'bg-emerald-900/50', 'ring-2', 'ring-emerald-400', 'shadow-[0_0_15px_rgba(16,185,129,0.5)]');
    }
});

const announcementLayer = document.getElementById('announcementLayer');
const announcementText = document.getElementById('announcementText');
const resultBox = document.getElementById('resultBox');
const winnerText = document.getElementById('winnerText');
const finalThrowCount = document.getElementById('finalThrowCount');
const windArrow = document.getElementById('windArrow');
const windIntensity = document.getElementById('windIntensity');
const nicknameInput = document.getElementById('nicknameInput');
const roomInput = document.getElementById('roomInput');
const waitingScreen = document.getElementById('waitingScreen');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');

// MULTIPLAYER DEĞİŞKENLERİ
let socket = null;
let myPlayerIndex = null; // 0 veya 1
let myRoomId = null;
let playerNames = ["OYUNCU 1", "OYUNCU 2"]; // Varsayılan isimler

if (typeof io !== 'undefined') {
    // Chrome Eklentisi (veya testler) için çevrimiçi sunucu (Render) adresi sabitlendi
    let serverUrl = 'https://dart-oyunu-backend.onrender.com';

    socket = io(serverUrl);

    socket.on('connect', () => {
        console.log('Sunucuya bağlandı!');
        playBtn.innerText = "OYNA & ODA KUR";
    });

    socket.on('connect_error', (err) => {
        console.warn('Sunucuya bağlanılamadı:', err.message);
        playBtn.innerText = "SUNUCU BAĞLANTISI BEKLENİYOR...";
    });
} else {
    console.warn("Socket.io yüklenemedi. Sunucuya bağlanılamadı.");
}

let vW = 1000, vH = 1000, scale = 1;

// OYUN DURUMU (SERVER'DAN SENKRONİZE EDİLECEK)
let gameActive = false;
let isLocalMode = true; // Tek cihaz modu

let currentGameMode = "501"; // 501, 301, cricket
// let currentMap = "pub"; // pub, stadium, club // Harita seçimi kaldırıldı
let myDartSkin = "standard";
let p2DartSkin = "standard"; // Sadece multiplayer için

// Standard Modes
let scores = [501, 501];
let previousScores = [501, 501];

// Cricket Mode tracking: { 15: [0,0], 16: [0,0] ... 20: [0,0], 25: [0,0] } where inner arr is marks per player
let cricketMarks = {
    15: [0, 0], 16: [0, 0], 17: [0, 0], 18: [0, 0], 19: [0, 0], 20: [0, 0], 25: [0, 0] // 25=Bull
};
let cricketScores = [0, 0]; // Points accumulated from closed numbers
let previousCricketScores = [0, 0];
let previousCricketMarks = JSON.parse(JSON.stringify(cricketMarks));
let activePlayer = 0; // 0: P1, 1: P2
let dartsInRound = 2;
let totalThrows = [0, 0];

// ZORLUK MEKANİKLERİ: RÜZGAR VE NİŞAN
let windX = 0; // Rüzgarın yatay itme gücü
let windY = 0; // Rüzgarın dikey itme gücü
let swaySpeed = 0.08; // Nişangah titreme hızı 
let swayAmplitudeX = 8; // Nişangah X titreme genliği (Küçültüldü)
let swayAmplitudeY = 6; // Nişangah Y titreme genliği (Küçültüldü)

// BOARD FİZİKLERİ VE KONUMU
let BOARD_X = vW / 2;
let BOARD_Y = vH / 2; // Tam merkez
const BOARD_R = 130; // Tahtanın yarıçapını küçülttük (daha uzaktan görünüm)
const BASE_SCALE_RATIO = BOARD_R / 320;

const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

let thrownDarts = [];
let currentDart = null;
let isAiming = false;
let aimX = BOARD_X, aimY = BOARD_Y;
let aimSway = 0;

// GÜÇ SİSTEMİ EKLENTİSİ
let isPowering = false;
let powerLevel = 0; // 0.0 - 1.0 arası
let powerDir = 1;
let powerSpeed = 0.035; // Barın dolup/boşalma hızı

// V görsel efektler
let particles = [];
let floatingTexts = [];
let cameraShake = 0; // Şiddet

// SES SİSTEMİ (Sentetik ama daha derin)
const Sound = {
    ctx: null,
    crowdOsc: null,
    crowdGain: null,
    isCrowdActive: false,
    isMuted: false, // SES KAPATMA BAYRAĞI
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    play(freq, type, dur, vol = 0.1, falloff = true) {
        if (this.isMuted) return;
        try {
            this.init();
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (falloff) {
                osc.frequency.exponentialRampToValueAtTime(freq * 0.5, this.ctx.currentTime + dur);
            }
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
            osc.start(); osc.stop(this.ctx.currentTime + dur);
        } catch (e) { }
    },
    speak(text, type = "normal") {
        if (Sound.isMuted) return;
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-GB';

            if (type === "epic") {
                utterance.pitch = 0.5; // Çok kalın epic ses (180 veya Game Shot)
                utterance.rate = 0.8;
                utterance.volume = 1.0;
            } else if (type === "bust") {
                utterance.pitch = 0.3; // Hayal kırıklığı tonu (çok pes)
                utterance.rate = 0.7;
                utterance.volume = 1.0;
            } else {
                utterance.pitch = 0.9; // Normal anons
                utterance.rate = 1.0;
                utterance.volume = 0.8;
            }

            // İngiliz Spiker varsa seç
            const voices = speechSynthesis.getVoices();
            const ukBoy = voices.find(v => v.lang === 'en-GB' && v.name.includes('Male'));
            if (ukBoy) utterance.voice = ukBoy;

            speechSynthesis.cancel(); // Önceki lafı kes
            speechSynthesis.speak(utterance);
        }
    },
    startCrowd() {
        if (this.isMuted) return;
        try {
            this.init();
            if (this.isCrowdActive) return;

            const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400; // Uğultu efekti için düşük frekans

            this.crowdGain = this.ctx.createGain();
            this.crowdGain.gain.value = 0.05; // Arka planda kısık sesle

            noise.connect(filter);
            filter.connect(this.crowdGain);
            this.crowdGain.connect(this.ctx.destination);

            noise.start();
            this.crowdOsc = noise;
            this.isCrowdActive = true;
        } catch (e) { }
    },
    stopCrowd() {
        if (this.crowdOsc) {
            try {
                this.crowdOsc.stop();
                this.crowdOsc.disconnect();
            } catch (e) { }
            this.crowdOsc = null;
        }
        this.isCrowdActive = false;
    },
    crowdCheer() {
        if (this.isMuted) return;
        if (this.crowdGain) {
            this.crowdGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.crowdGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
            this.crowdGain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.5);
            this.crowdGain.gain.exponentialRampToValueAtTime(0.05, this.ctx.currentTime + 3);
        }
    },
    crowdAww() {
        if (this.isMuted) return;
        if (this.crowdGain) {
            this.crowdGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.crowdGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
            this.crowdGain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.2);
            this.crowdGain.gain.exponentialRampToValueAtTime(0.05, this.ctx.currentTime + 2);
        }
    },
    thud(heavy = false) {
        // Ahşap vurma sesi (tok)
        let f = heavy ? 60 : 80;
        this.play(f, 'sine', 0.2, heavy ? 0.6 : 0.4);
        setTimeout(() => this.play(heavy ? 40 : 50, 'triangle', 0.15, heavy ? 0.4 : 0.2), 10);
    },
    wire() {
        // Tele çarpma (zing)
        this.play(800, 'triangle', 0.1, 0.1, false);
        this.play(1200, 'sine', 0.2, 0.05, false);
    },
    whoosh() {
        // Dartın havayı yarma sesi (beyaz gürültü benzeri yüksek frekans)
        this.play(400, 'square', 0.15, 0.05);
    },
    cheer() {
        // Ufak bir bildirim sesi
        this.play(440, 'sine', 0.1, 0.2, false);
        setTimeout(() => this.play(554, 'sine', 0.1, 0.2, false), 100);
        setTimeout(() => this.play(659, 'sine', 0.3, 0.2), 200);
    }
};

// PARÇACIK (SPARK/DUST) SİSTEMİ
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
        this.color = color;
        this.size = Math.random() * 3 + 1;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.95; this.vy *= 0.95; // Sürtünme
        this.vy += 0.1; // Yerçekimi
        this.life -= this.decay;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// YÜZEN YAZI (FLOATING SCORE)
class FloatingText {
    constructor(x, y, text, color, scale = 1) {
        this.x = x; this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.vy = -2 - Math.random();
        this.scale = scale;
    }
    update() {
        this.y += this.vy;
        this.life -= 0.02;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.font = `bold ${30 * this.scale}px Oswald`;
        ctx.textAlign = 'center';
        // Stroke (outline)
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000';
        ctx.strokeText(this.text, this.x, this.y);
        // Fill
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// DART SINIFI (GELİŞMİŞ 3D)
class Dart {
    constructor(targetX, targetY, playerIndex = 0, slowMo = false) {
        this.startX = vW / 2 + (Math.random() * vW / 3 - vW / 6); // Ekranın altından daha rastgele çıkar
        this.startY = vH + 200;
        this.x = this.startX;
        this.y = this.startY;
        this.z = 0;
        this.history = []; // Trail (iz) için
        this.playerIndex = playerIndex; // 0: P1 (Red), 1: P2 (Blue)
        this.isSlowMo = slowMo; // Ağır Çekim Özelliği

        // Hedefte sapma (Artık sadece local player'da hesaplanacak, socket üzerinden gidecek)
        this.targetX = targetX;
        this.targetY = targetY;

        this.isFlying = true;
        this.progress = 0;
        this.speed = this.isSlowMo ? 0.008 : 0.04; // Ağır çekim hızı (Beşte Bir)

        // Uçuş açısı (ekranın dışından hedefe doğru)
        this.flightAngle = Math.atan2(this.targetY - this.startY, this.targetX - this.startX);
        // Tahtaya saplandığında duracağı kalıcı rastgele eğim açısı (10 - 25 derece)
        this.stuckAngle = (Math.random() * 0.5 - 0.25) + Math.PI / 2 + (this.flightAngle - Math.PI / 2) * 0.2;
    }

    update() {
        if (!this.isFlying) return;

        this.progress += this.speed;
        // Trail kaydı (her 2 frame'de 1)
        if (Math.random() > (this.isSlowMo ? 0.1 : 0.3)) this.history.push({ x: this.x, y: this.y });
        if (this.history.length > (this.isSlowMo ? 25 : 8)) this.history.shift(); // SlowMo da iz uzar

        if (this.progress >= 1) {
            this.progress = 1;
            this.isFlying = false;
            this.x = this.targetX;
            this.y = this.targetY;
            this.z = 1;

            if (this.isSlowMo) {
                targetZoomScale = 1; // Slow-mo bitince eski haline dönmeye başla (atış sonrası)
            }

            registerHit(this.targetX, this.targetY, this);
        } else {
            // Ciddi parabolik uçuş kavisleri
            const arc = Math.sin(this.progress * Math.PI) * -200;
            this.x = this.startX + (this.targetX - this.startX) * this.progress;
            this.y = this.startY + (this.targetY - this.startY) * this.progress + arc;
            // Ease-out (Hedefe yaklaşırken yavaşlar gibi)
            this.z = Math.pow(this.progress, 0.8);

            // Ağır Çekim Kamerası: Oku tam detaylı şekilde havadayken takip et ve yakınlaş (Sinematik 3. Şahıs)
            if (this.isSlowMo) {
                // Oku yakından takip et (FOV daralır, odak sadece oktur)
                targetZoomScale = 2.0 + (this.progress * 2.5); // Çok daha derin bir zoom

                // Ekranın tam ortasında dartı tutmak için offset (-BOARD_X ve -BOARD_Y ekrandaki merkeze hizalar)
                targetZoomPanX = (BOARD_X - this.x);
                targetZoomPanY = (BOARD_Y - this.y) - 50; // Oku ekranın hafif altında tut (Atışı izlet)

                // Arkaplan kararma / motion blur hissi (Arka planı çizim esnasında dinamik kapatacağız)
            }
        }
    }

    draw() {
        ctx.save();

        // 1) TRAIL (Uçuş İzi) - sadece uçarken
        if (this.isFlying && this.history.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.history[0].x, this.history[0].y);
            for (let i = 1; i < this.history.length; i++) ctx.lineTo(this.history[i].x, this.history[i].y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 4 * (1 - this.z); // Yaklaştıkça iz incelir
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Ölçek (yakındayken devasa, saplandığında tahtanın boyutuna uygun)
        const dScale = (2.5 - (this.z * 1.5)) * BASE_SCALE_RATIO;

        // 2) GÖLGE DİNAMİĞİ
        if (this.isFlying) {
            // Uçarken yerdeki devasa bulanık gölge
            const shadowDist = 150 * (1 - this.progress);
            ctx.fillStyle = `rgba(0,0,0,${0.2 * this.progress})`;
            ctx.beginPath();
            ctx.ellipse(this.x + shadowDist * 0.5, this.y + shadowDist, 20 * dScale, 5 * dScale, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.translate(this.x, this.y);
        ctx.scale(dScale, dScale);

        // Açı hesaplaması
        let rot = this.isFlying ? this.flightAngle + (Math.PI / 2) : this.stuckAngle;
        ctx.rotate(rot);

        // Sabit Gölge (Tahtaya saplandığında dökülen gölge)
        if (!this.isFlying) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            // Gövde gölgesi
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 35); ctx.lineTo(4, 38); ctx.fill();
            // Kanat gölgesi
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.moveTo(8, 25); ctx.lineTo(25, 45); ctx.lineTo(15, 50); ctx.fill();
        }

        // DART ÇİZİMİ (Detaylı Metalik)
        let sColor1, sColor2, sColor3, bodyColor1, bodyColor2;

        const skin = this.playerIndex === myPlayerIndex || isLocalMode && this.playerIndex === 0 ? myDartSkin : p2DartSkin;

        if (skin === "gold") {
            sColor1 = '#b45309'; sColor2 = '#fef08a'; sColor3 = '#d97706';
            bodyColor1 = '#78350f'; bodyColor2 = '#451a03';
        } else if (skin === "neon") {
            sColor1 = '#0ea5e9'; sColor2 = '#e0f2fe'; sColor3 = '#0284c7';
            bodyColor1 = '#0f172a'; bodyColor2 = '#082f49';
        } else { // standard
            sColor1 = '#475569'; sColor2 = '#f8fafc'; sColor3 = '#94a3b8';
            bodyColor1 = '#0f172a'; bodyColor2 = '#334155';
        }

        // Metal İğne Uç
        const pointGrad = ctx.createLinearGradient(-1, 0, 1, -18);
        pointGrad.addColorStop(0, '#475569');
        pointGrad.addColorStop(0.5, '#f8fafc');
        pointGrad.addColorStop(1, '#94a3b8');
        ctx.fillStyle = pointGrad;
        ctx.beginPath(); ctx.moveTo(-1.5, 0); ctx.lineTo(1.5, 0); ctx.lineTo(0, -18); ctx.fill();

        // Barrel (Gövde)
        const barrelGrad = ctx.createLinearGradient(-3.5, 0, 3.5, 0);
        barrelGrad.addColorStop(0, bodyColor1);
        barrelGrad.addColorStop(0.3, bodyColor2); // Yansıma
        barrelGrad.addColorStop(0.7, bodyColor1);
        barrelGrad.addColorStop(1, '#020617');
        ctx.fillStyle = barrelGrad;
        // Gövdeyi silindir gibi çentikli yapalım
        ctx.beginPath();
        ctx.moveTo(-2.5, 0); ctx.lineTo(2.5, 0);
        ctx.lineTo(3.5, 5); ctx.lineTo(3.5, 30);
        ctx.lineTo(1.5, 35); ctx.lineTo(-1.5, 35);
        ctx.lineTo(-3.5, 30); ctx.lineTo(-3.5, 5);
        ctx.closePath();
        ctx.fill();

        // Gövde yatay çizgiler (Grip ringler - skin rengine göre)
        ctx.strokeStyle = sColor3;
        ctx.lineWidth = 0.5;
        for (let i = 8; i <= 28; i += 3) {
            ctx.beginPath(); ctx.moveTo(-3.5, i); ctx.lineTo(3.5, i); ctx.stroke();
        }

        // Stem (Şaft)
        ctx.fillStyle = sColor1;
        ctx.fillRect(-1.5, 35, 3, 15);

        // Flight (Kanatlar)
        // Kanat rengini playerIndex'e göre veya local/online durumuna göre ayarla
        let flightColor = '#3b82f6'; // Blue
        let flightColorAlt = '#1d4ed8';
        if (isLocalMode && this.playerIndex === 0 || !isLocalMode && this.playerIndex === 0) {
            flightColor = '#ef4444'; // Red
            flightColorAlt = '#b91c1c';
        }

        ctx.fillStyle = flightColor;
        ctx.globalAlpha = 0.9;

        // Sol kanat
        ctx.beginPath(); ctx.moveTo(0, 40); ctx.bezierCurveTo(-15, 45, -15, 55, 0, 55); ctx.fill();
        // Sağ kanat
        ctx.beginPath(); ctx.moveTo(0, 40); ctx.bezierCurveTo(15, 45, 15, 55, 0, 55); ctx.fill();
        // Orta kanat dikine (İnce çizgi)
        ctx.fillStyle = flightColorAlt;
        ctx.fillRect(-0.5, 38, 1, 18);

        ctx.globalAlpha = 1.0;

        ctx.restore();
    }
}

let boardImg = new Image();
boardImg.src = 'dartboard.png?v=2';

function drawBoard() {
    // Arka plandaki şık ortamın önüne, tahtayı vurgulamak için hafif karartma
    const wallGrad = ctx.createRadialGradient(BOARD_X, BOARD_Y, BOARD_R * 0.5, BOARD_X, BOARD_Y, BOARD_R + 200);
    wallGrad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    wallGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, vW, vH);

    // Tahtanın koruyucu yastığı (Surround Ring) ve dev duvar gölgesi
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 50 * BASE_SCALE_RATIO;
    ctx.shadowOffsetY = 25 * BASE_SCALE_RATIO;

    ctx.fillStyle = '#111'; // Koyu siyah sünger pano
    ctx.beginPath();
    ctx.arc(BOARD_X, BOARD_Y, BOARD_R + 80 * BASE_SCALE_RATIO, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; // Gölgeyi kapat

    // Dart tahtası (Yapay zeka ile üretilen fotorealistik görseli çiz)
    ctx.save();
    ctx.beginPath();
    ctx.arc(BOARD_X, BOARD_Y, BOARD_R, 0, Math.PI * 2);
    ctx.clip(); // Tahtayı görseldeki kusurlar olmasın diye tam jilet gibi yuvarlak içine al

    if (boardImg.complete && boardImg.naturalHeight !== 0) {
        // Görselin tam tahta ölçümüzün üzerine esnetilmeden / bozulmadan çizilmesi
        ctx.drawImage(boardImg, BOARD_X - BOARD_R, BOARD_Y - BOARD_R, BOARD_R * 2, BOARD_R * 2);
    } else {
        // Yüklenene kadar karanlık durur
        ctx.fillStyle = '#0a0a0a';
        ctx.fill();
    }

    ctx.restore();
}

function calculateScore(x, y) {
    const dx = x - BOARD_X;
    const dy = y - BOARD_Y;
    const distance = Math.hypot(dx, dy);

    // Tahtanın dışına atıldı
    if (distance > BOARD_R * 0.75) return { points: 0, mult: 0, text: 'MISS' };

    // Bullseye (Daha daraltıldı)
    if (distance <= BOARD_R * 0.03) return { points: 50, mult: 1, text: 'BULLSEYE' }; // Inner Bullseye
    if (distance <= BOARD_R * 0.08) return { points: 25, mult: 1, text: '25' }; // Outer Bullseye

    let angle = Math.atan2(dy, dx);
    angle += Math.PI / 2 + (Math.PI / 20);
    if (angle < 0) angle += Math.PI * 2;

    const sliceIndex = Math.floor((angle / (Math.PI * 2)) * 20) % 20;
    const basePoints = SECTORS[sliceIndex];

    // Double (Zorluk: Alan aynı ama sapma çoksa vurmak zor)
    if (distance > BOARD_R * 0.71 && distance <= BOARD_R * 0.75) {
        return { points: basePoints * 2, mult: 2, text: `D${basePoints}` };
    }
    // Treble (Zorluk: Daha daraltıldı - PROFESYONEL ZORLUK)
    if (distance > BOARD_R * 0.43 && distance <= BOARD_R * 0.45) { // 0.425 ve 0.455'ten 0.43 ve 0.45'e daraltıldı
        return { points: basePoints * 3, mult: 3, text: `T${basePoints}` };
    }

    return { points: basePoints, mult: 1, text: `${basePoints}` }; // Single
}

function updateWind(syncIntensity = null, syncAngle = null) {
    if (syncIntensity !== null && syncAngle !== null) {
        // Sunucudan gelen rüzgarı uygula
        windX = Math.cos(syncAngle) * syncIntensity;
        windY = Math.sin(syncAngle) * syncIntensity;

        const deg = syncAngle * (180 / Math.PI);
        windArrow.style.transform = `rotate(${deg}deg)`;
        windIntensity.innerText = syncIntensity.toFixed(1);

        swaySpeed = 0.08 + (syncIntensity * 0.02);
        swayAmplitudeX = 15 + (syncIntensity * 4);
        swayAmplitudeY = 10 + (syncIntensity * 3);
    } else {
        // Local yedek (normalde artık sunucudan gelecek)
        const angle = Math.random() * Math.PI * 2;
        const intensity = Math.random() * 1.5 + 0.2;

        windX = Math.cos(angle) * intensity;
        windY = Math.sin(angle) * intensity;
        const deg = angle * (180 / Math.PI);
        windArrow.style.transform = `rotate(${deg}deg)`;
        windIntensity.innerText = intensity.toFixed(1);
        swaySpeed = 0.08 + (intensity * 0.02);
        swayAmplitudeX = 15 + (intensity * 4);
        swayAmplitudeY = 10 + (intensity * 3);
    }
}

function spawnParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

async function showAnnounce(text, color, isCritical = false) {
    announcementText.innerText = text;
    announcementText.style.color = color || 'white';

    // Eğer bitiriş veya Treble 20 ise deli gibi parlasın
    if (isCritical) {
        announcementText.style.textShadow = `0 0 30px ${color}, 0 0 60px ${color}, 0 10px 40px #000`;
        announcementText.classList.add('scale-110'); // Extra büyüme
    } else {
        announcementText.style.textShadow = `0 0 10px ${color}, 0 10px 40px #000`;
        announcementText.classList.remove('scale-110');
    }

    announcementLayer.classList.add('show');
    await new Promise(r => setTimeout(r, 1200));
    announcementLayer.classList.remove('show');
}

function registerHit(x, y, dartObj) {
    const hit = calculateScore(x, y);

    // SES VE EFEKT KARARLARI
    if (hit.text === 'MISS') {
        Sound.thud(true); // Duvara çarpma gibi kalın ses
        spawnParticles(x, y, '#64748b'); // Toz kalksın
    } else if (hit.mult === 3 || hit.points >= 25) {
        Sound.thud();
        Sound.cheer(); // İyi atış sesi
        cameraShake = 15; // Ekranı salla
        spawnParticles(x, y, hit.points === 50 ? '#ef4444' : '#facc15'); // Kıvılcımlar
    } else if (hit.mult === 2) {
        Sound.thud();
        cameraShake = 5;
        spawnParticles(x, y, '#22c55e');
    } else {
        Sound.thud();
        spawnParticles(x, y, '#cbd5e1'); // Normal saplanma tozu
    }

    // HAVADA YÜZEN PUAN YAZISI (Eylem noktasına)
    if (hit.points > 0) {
        let color = '#fff';
        let txtScale = 1;
        if (hit.mult === 3) { color = '#facc15'; txtScale = 1.6; }
        else if (hit.mult === 2) { color = '#4ade80'; txtScale = 1.3; }
        else if (hit.points === 50) { color = '#ef4444'; txtScale = 2; }
        floatingTexts.push(new FloatingText(x, y, hit.text, color, txtScale));
    }

    dartsInRound--;
    const activePrefix = activePlayer === 0 ? 'p1' : 'p2';
    document.getElementById(`d-icon-${activePrefix}-${2 - dartsInRound}`).classList.add('used');

    if (currentGameMode === "cricket") {
        let pts = hit.points;
        let mult = hit.mult;
        let rawNum = pts > 0 && mult > 0 ? pts / mult : 0;
        let isWinningHit = false;

        if (rawNum >= 15 && rawNum <= 21 || rawNum === 25) {
            const validNum = rawNum === 50 ? 25 : rawNum; // bull correction since bull points = 25/50 but base=25
            let marksToAdd = mult;
            let currentMarks = cricketMarks[validNum][activePlayer];

            // Hit logic
            while (marksToAdd > 0) {
                if (cricketMarks[validNum][activePlayer] < 3) {
                    cricketMarks[validNum][activePlayer]++;
                } else {
                    // Can only score if opponent hasn't closed it
                    if (cricketMarks[validNum][activePlayer === 0 ? 1 : 0] < 3) {
                        cricketScores[activePlayer] += validNum;
                    }
                }
                marksToAdd--;
            }

            // Check win condition
            // 1) Have we closed all?
            let allClosed = true;
            const targetNums = [15, 16, 17, 18, 19, 20, 25];
            for (let n of targetNums) {
                if (cricketMarks[n][activePlayer] < 3) allClosed = false;
            }
            // 2) Do we have the highest or equal score?
            if (allClosed && cricketScores[activePlayer] >= cricketScores[activePlayer === 0 ? 1 : 0]) {
                isWinningHit = true;
            }
        }

        if (isWinningHit) {
            // Check Record for Cricket
            totalThrows[activePlayer]++; // Count the final throw
            let isNewRecord = false;
            if (isLocalMode || myPlayerIndex === activePlayer) {
                if (!bestRecord || totalThrows[activePlayer] < bestRecord) {
                    bestRecord = totalThrows[activePlayer];
                    localStorage.setItem('dartBestRecord', bestRecord);
                    isNewRecord = true;
                    updateLobbyRecordUI();
                }
            }

            updateScoreUI();
            const winnerName = playerNames[activePlayer] || `OYUNCU ${activePlayer + 1}`;
            showAnnounce(`${winnerName} KAZANDI!`, "#22c55e", true);

            if (isNewRecord) {
                setTimeout(() => showAnnounce("🔥 YENİ REKOR! 🔥", "#fbbf24", true), 1200);
            }

            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    Sound.cheer();
                    spawnParticles(BOARD_X + (Math.random() * 400 - 200), BOARD_Y + (Math.random() * 400 - 200), '#facc15');
                    spawnParticles(BOARD_X + (Math.random() * 400 - 200), BOARD_Y + (Math.random() * 400 - 200), '#22c55e');
                }, i * 300);
            }
            setTimeout(endGame, isNewRecord ? 3500 : 2500);
            return;
        } else {
            if (hit.mult > 1 || hit.points >= 25) {
                let col = "#60a5fa";
                if (hit.mult === 3) col = "#facc15";
                if (hit.points === 50) col = "#ef4444";
                showAnnounce(hit.text, col, hit.mult === 3 || hit.points === 50);
            }
        }

    } else {
        // 301 / 501 LOGIC
        let tempScore = scores[activePlayer] - hit.points;

        if (tempScore < 0 || tempScore === 1 || (tempScore === 0 && hit.mult !== 2)) {
            // BUST!
            Sound.speak("No Score!", "bust"); // Daha dramatik
            Sound.crowdAww();
            showAnnounce("BUST!", "#ef4444", true);
            Sound.play(150, 'sawtooth', 0.5); // Hata sesi
            scores[activePlayer] = previousScores[activePlayer];
            dartsInRound = 0;
        } else if (tempScore === 0 && hit.mult === 2) {
            // KAZANDIN!
            Sound.speak("Game Shot! And the match.", "epic"); // Çok kalın ve coşkulu
            Sound.crowdCheer();

            totalThrows[activePlayer]++; // Count the winning throw
            let isNewRecord = false;

            if (isLocalMode || myPlayerIndex === activePlayer) {
                if (!bestRecord || totalThrows[activePlayer] < bestRecord) {
                    bestRecord = totalThrows[activePlayer];
                    localStorage.setItem('dartBestRecord', bestRecord);
                    isNewRecord = true;
                    updateLobbyRecordUI();
                }
            }

            scores[activePlayer] = 0;
            updateScoreUI();
            const winnerName = playerNames[activePlayer] || `OYUNCU ${activePlayer + 1}`;
            showAnnounce(`${winnerName} KAZANDI!`, "#22c55e", true);

            if (isNewRecord) {
                setTimeout(() => showAnnounce("🔥 YENİ REKOR! 🔥", "#fbbf24", true), 1200);
            }

            // Konfeti
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    Sound.cheer();
                    spawnParticles(BOARD_X + (Math.random() * 400 - 200), BOARD_Y + (Math.random() * 400 - 200), '#facc15');
                    spawnParticles(BOARD_X + (Math.random() * 400 - 200), BOARD_Y + (Math.random() * 400 - 200), '#22c55e');
                }, i * 300);
            }

            setTimeout(endGame, isNewRecord ? 3500 : 2500);
            return;
        } else {
            // Normal isabet
            scores[activePlayer] = tempScore;
            if (hit.mult > 1 || hit.points >= 25) {
                let col = "#60a5fa";

                if (hit.mult === 3) {
                    col = "#facc15";
                    if (hit.points === 60) { // T20 attıysa
                        Sound.speak(hit.text, "epic"); // Vurgulu "T 20" vs.
                    } else {
                        Sound.speak(hit.text);
                    }
                } else if (hit.points === 50) {
                    col = "#ef4444";
                    Sound.speak("Bullseye!", "epic");
                } else {
                    Sound.speak(hit.text);
                }

                showAnnounce(hit.text, col, hit.mult === 3 || hit.points === 50);
            } else {
                // Basit sayılar
                if (hit.points > 0) Sound.speak(hit.points.toString());
            }
        }
    }

    updateScoreUI();

    if (dartsInRound <= 0 && gameActive && scores[activePlayer] > 0) {
        setTimeout(() => {
            // Turn switch is handled via server if multiplayer
            if (!isLocalMode && myPlayerIndex !== null) {
                if (myPlayerIndex === activePlayer) {
                    socket.emit('roundEnded', {
                        scores: scores,
                        cricketScores: cricketScores,
                        cricketMarks: cricketMarks
                    });
                }
            } else if (isLocalMode) {
                // Local fallback play
                thrownDarts = [];
                dartsInRound = 2;
                activePlayer = activePlayer === 0 ? 1 : 0;
                previousScores[activePlayer] = scores[activePlayer];
                previousCricketScores[activePlayer] = cricketScores[activePlayer];
                previousCricketMarks = JSON.parse(JSON.stringify(cricketMarks));
                document.querySelectorAll('.dart-icon').forEach(d => d.classList.remove('used'));
                updateWind();
                updateActivePlayerUI();

                const nextName = playerNames[activePlayer] || `OYUNCU ${activePlayer + 1}`;
                showAnnounce(`${nextName} SIRA SİZDE`, "#38bdf8", false);
                Sound.play(500, 'sine', 0.3, 0.1);

                // Sıra değişince otomatik zoomu kapat
                if (isZoomed) zoomBtn.click();
            }
        }, 1500);
    }
}

function update() {
    if (!ctx) return;

    // Arka planı tamamen temizle (vW ve vH dinamik boyutta)
    ctx.clearRect(0, 0, vW, vH);
    ctx.save();

    // Zoom Interpolation
    currentZoomScale += (targetZoomScale - currentZoomScale) * 0.1;
    currentZoomPanX += (targetZoomPanX - currentZoomPanX) * 0.1;
    currentZoomPanY += (targetZoomPanY - currentZoomPanY) * 0.1;

    // Kamera (Ekran Sallantısı)
    let shakeX = 0, shakeY = 0;
    if (cameraShake > 0) {
        shakeX = (Math.random() - 0.5) * cameraShake;
        shakeY = (Math.random() - 0.5) * cameraShake;
        cameraShake *= 0.85; // Sönümlenme
        if (cameraShake < 0.5) cameraShake = 0;
    }

    ctx.translate(shakeX, shakeY); // Shake uygula
    ctx.scale(scale, scale);

    // Apply Zoom relative to virtual board center
    ctx.translate(BOARD_X, BOARD_Y);
    ctx.scale(currentZoomScale, currentZoomScale);
    ctx.translate(-BOARD_X + currentZoomPanX, -BOARD_Y + currentZoomPanY);

    drawBoard();

    // Atılmış Dartlar
    thrownDarts.forEach(d => d.draw());

    // Havada Uçan Dart
    if (currentDart) {
        currentDart.update();
        currentDart.draw();
        if (!currentDart.isFlying) {
            thrownDarts.push(currentDart);
            currentDart = null;

            // 2. atış kalmadığında (tur bittiğinde) zoom aç
            if (dartsInRound === 0 && !isZoomed) {
                zoomBtn.click();
            }
        }
    }

    // Vignette (SlowMo durumunda kenarları karart)
    if (currentDart && currentDart.isSlowMo) {
        // Kararma merkezini oku takip edecek şekilde ayarlıyoruz (Focus on Dart)
        const cx = currentDart.x;
        const cy = currentDart.y;
        // Opacity ve Blur (Kararma) objeye yaklaştıkça artar 0.6 -> 0.85
        const darkAlpha = 0.85 * currentDart.progress;

        const grad = ctx.createRadialGradient(cx, cy, BOARD_R * 0.2, cx, cy, vH);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${darkAlpha})`);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for full screen draw
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, vW * scale, vH * scale); // Scale ile gerçek ekrana çizelim
        ctx.restore();
    }

    // Parçacıklar (Hit Sparks)
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Yüzen Metinler
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.update();
        ft.draw(ctx);
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    // Nişangah (Aim Cursor - Professional Version)
    if (isAiming && dartsInRound > 0 && !currentDart) {
        // Nefes alma titremesi (Zorlaştırıldı)
        aimSway += swaySpeed;
        const sx = aimX + Math.sin(aimSway) * swayAmplitudeX;
        const sy = aimY + Math.cos(aimSway * 1.5) * swayAmplitudeY; // Eliptik gezinme

        ctx.beginPath();
        ctx.arc(sx, sy, 25, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Şeffaf beyaz dış halka
        ctx.lineWidth = 1.5; ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, 15, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'; // Kırmızı iç halka
        ctx.lineWidth = 3; ctx.stroke();

        // Crosshair çizgileri
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.moveTo(sx - 35, sy); ctx.lineTo(sx - 10, sy);
        ctx.moveTo(sx + 10, sy); ctx.lineTo(sx + 35, sy);
        ctx.moveTo(sx, sy - 35); ctx.lineTo(sx, sy - 10);
        ctx.moveTo(sx, sy + 10); ctx.lineTo(sx, sy + 35);
        ctx.stroke();

        // Merkez kırmızı nokta
        ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill();
    }

    ctx.restore();

    // Loop devam ettir
    if (gameActive || menuOverlay.classList.contains('hidden') === false) requestAnimationFrame(update);
}

// KONTROLLER
const getXY = (e) => {
    const r = canvas.getBoundingClientRect();
    let sx = (e.touches ? e.touches[0].clientX : e.clientX); let sy = (e.touches ? e.touches[0].clientY : e.clientY);
    let screenX = (sx - r.left) / scale;
    let screenY = (sy - r.top) / scale;

    // Büyüteçten (Zoom) kaynaklı görsel sapmaları gidermek (tersine çevirmek) için:
    let worldX = ((screenX - BOARD_X) / currentZoomScale) + BOARD_X - currentZoomPanX;
    let worldY = ((screenY - BOARD_Y) / currentZoomScale) + BOARD_Y - currentZoomPanY;

    return { x: worldX, y: worldY };
};

const startAim = (e) => {
    if (!gameActive || dartsInRound <= 0 || currentDart || isZoomed) return;
    isAiming = true;
    const pos = getXY(e);
    aimX = pos.x; aimY = pos.y;
};

const moveAim = (e) => {
    if (!isAiming || isZoomed) return;
    const pos = getXY(e);
    aimX = pos.x; aimY = pos.y;
};

function updateScoreUI() {
    p1ScoreDisplay.innerText = scores[0];
    p2ScoreDisplay.innerText = scores[1];
    p1NameDisplay.innerText = playerNames[0];
    p2NameDisplay.innerText = playerNames[1];
}

function updateActivePlayerUI() {
    const dartsP1 = document.getElementById('dartsLeftContainerP1');
    const dartsP2 = document.getElementById('dartsLeftContainerP2');

    if (activePlayer === 0) {
        p1Box.classList.add('active-pulse');
        p1Box.style.background = 'rgba(20, 83, 45, 0.6)';
        p1Box.style.borderColor = 'rgba(34, 197, 94, 0.2)';
        p1ScoreDisplay.classList.add('text-emerald-400', 'text-shadow-emerald');
        p1ScoreDisplay.classList.remove('text-slate-300', 'glowing-text');
        dartsP1.style.opacity = '1';
        dartsP1.style.transform = 'scale(1)';

        p2Box.classList.remove('active-pulse');
        p2Box.style.background = 'rgba(15, 23, 42, 0.6)';
        p2Box.style.borderColor = 'rgba(255,255,255,0.1)';
        p2ScoreDisplay.classList.add('text-slate-300', 'glowing-text');
        p2ScoreDisplay.classList.remove('text-emerald-400', 'text-shadow-emerald');
        dartsP2.style.opacity = '0.4';
        dartsP2.style.transform = 'scale(0.9)';
    } else {
        p2Box.classList.add('active-pulse');
        p2Box.style.background = 'rgba(20, 83, 45, 0.6)';
        p2Box.style.borderColor = 'rgba(34, 197, 94, 0.2)';
        p2ScoreDisplay.classList.add('text-emerald-400', 'text-shadow-emerald');
        p2ScoreDisplay.classList.remove('text-slate-300', 'glowing-text');
        dartsP2.style.opacity = '1';
        dartsP2.style.transform = 'scale(1)';

        p1Box.classList.remove('active-pulse');
        p1Box.style.background = 'rgba(15, 23, 42, 0.6)';
        p1Box.style.borderColor = 'rgba(255,255,255,0.1)';
        p1ScoreDisplay.classList.add('text-slate-300', 'glowing-text');
        p1ScoreDisplay.classList.remove('text-emerald-400', 'text-shadow-emerald');
        dartsP1.style.opacity = '0.4';
        dartsP1.style.transform = 'scale(0.9)';
    }
}

const throwDart = () => {
    // Sadece sıra bendeyse veya tekli oyuncudayken atış yapabilirim
    let canThrow = isLocalMode ? true : (myPlayerIndex !== null && myPlayerIndex === activePlayer);
    if (!isAiming || !gameActive || dartsInRound <= 0 || !canThrow || isZoomed) return;

    isAiming = false;
    isPowering = false;
    totalThrows[activePlayer]++;
    Sound.whoosh(); // Atış efekti

    // Titremenin güncel pozisyonu + Sadece Rüzgar Sapması
    let finalTargetX = aimX + Math.sin(aimSway) * swayAmplitudeX + (windX * 30);
    let finalTargetY = aimY + Math.cos(aimSway * 1.5) * swayAmplitudeY + (windY * 30);

    // Eğer 301/501 modundaysak ve kazandıran potansiyel bir yoldaysak slow-mo tetiklenebilir
    let isSlowMo = false;
    if (currentGameMode !== "cricket") {
        // Eğer oyuncu kazanmaya çok yakınsa
        if (scores[activePlayer] <= 40) {
            isSlowMo = true;
            // Eğer oyun bitmiyorsa bile 1 kere söylese yeter
            if (dartsInRound === 2) {
                Sound.speak("Game point...");
            }
        }
    }

    // Eğer online moddaysak, sunucuya GÜNCELLENMİŞ X,Y değerlerini atalım. Hedefe varış yerini client söyler
    if (!isLocalMode && myPlayerIndex !== null) {
        socket.emit('dartThrown', { targetX: finalTargetX, targetY: finalTargetY, score: 0 });
    }

    currentDart = new Dart(finalTargetX, finalTargetY, activePlayer, isSlowMo);
};

canvas.addEventListener('mousedown', startAim);
window.addEventListener('mousemove', moveAim);
window.addEventListener('mouseup', throwDart);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startAim(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveAim(e); }, { passive: false });
window.addEventListener('touchend', throwDart);


function startLocalGame() {
    const nickname = nicknameInput.value.trim().toUpperCase();
    if (!nickname) {
        alert("Lütfen oyuna başlamadan önce bir kullanıcı adı girin!");
        nicknameInput.focus();
        return;
    }

    isLocalMode = true;
    menuOverlay.classList.add('hidden');
    resultBox.classList.add('hidden');

    // Get selections
    currentGameMode = gameModeSelect.value;
    myDartSkin = dartSkinSelect.value;

    // Emoji Bar UI show for local (optional, but fun)
    emojiBar.classList.remove('hidden');
    zoomBtn.classList.remove('hidden');
    document.getElementById("muteBtn").classList.remove('hidden');

    gameActive = true;

    // Chat UI'ını göster (Sadece online)
    document.getElementById('chatBoxContainer').classList.remove('hidden');

    // Local start resets
    playerNames = [nickname, "MİSAFİR"];

    // Mode based initial scores
    let initialScore = 501;
    if (currentGameMode === "301") initialScore = 301;
    else if (currentGameMode === "cricket") initialScore = 0; // Cricket starts at 0

    scores = [initialScore, initialScore];
    previousScores = [initialScore, initialScore];
    activePlayer = 0;
    dartsInRound = 2;
    totalThrows = [0, 0];
    thrownDarts = [];
    currentDart = null;

    updateScoreUI();
    updateActivePlayerUI();
    updateWind(); // Local random wind
    document.querySelectorAll('.dart-icon').forEach(d => d.classList.remove('used'));

    Sound.startCrowd(); // Seyirci Olayları Aktif
    Sound.play(600, 'sine', 0.5, 0.1);
    showAnnounce(`${playerNames[0]} SIRA SİZDE`, "#38bdf8", false);
    Sound.speak("Game On!");

    if (!ctx) resize();
    ctx.clearRect(0, 0, vW, vH);
    ctx.save(); ctx.scale(scale, scale); drawBoard(); ctx.restore();

    update(); // Start loop
}

function startOnlineGame() {
    const nickname = nicknameInput.value.trim().toUpperCase();
    if (!nickname) {
        alert("Lütfen oyuna başlamadan önce bir kullanıcı adı girin!");
        nicknameInput.focus();
        return;
    }

    isLocalMode = false;

    if (!socket || !socket.connected) {
        alert("Sunucuya bağlanılamadı. Lütfen 'node server.js' komutunun arka planda çalıştığına emin olun ve tekrar deneyin.");
        return;
    }

    // Get selections
    currentGameMode = gameModeSelect.value;
    myDartSkin = dartSkinSelect.value;

    // Sunucuya odaya katılma isteği gönder 
    const rCode = roomInput.value.trim().toUpperCase();
    const joinData = {
        roomId: rCode.length > 0 ? rCode : null,
        playerName: nickname,
        gameMode: currentGameMode,
        skin: myDartSkin
    };
    socket.emit('joinRoom', joinData);

    menuOverlay.classList.add('hidden');
    resultBox.classList.add('hidden');
    waitingScreen.classList.remove('hidden'); // Bekleme ekranını göster
    roomCodeDisplay.innerText = "Yükleniyor...";

    if (!ctx) resize();
    ctx.clearRect(0, 0, vW, vH);
    ctx.save(); ctx.scale(scale, scale); drawBoard(); ctx.restore();
}

// Oyun Bitiş Kontrolcüsü (Eksik fonksiyona yama)
function endGame() {
    gameActive = false;

    // Zoom açıksa kapat
    if (isZoomed) zoomBtn.click();

    // Arayüzleri temizle
    zoomBtn.classList.add('hidden');
    document.getElementById("muteBtn").classList.add('hidden');
    emojiBar.classList.add('hidden');
    resultBox.classList.remove('hidden');

    // Son skorları güncelle
    p1ScoreDisplay.innerText = "0";
    p2ScoreDisplay.innerText = "0";

    updateLobbyRecordUI();

    // XP EKLEME (Win/Loss) MANTIĞI
    if (isLocalMode) {
        if (activePlayer === 0) addXP(50); // Local win
        else addXP(10); // Local loss
    } else if (myPlayerIndex !== null) {
        if (myPlayerIndex === activePlayer) addXP(150); // Online win daha çok verir
        else addXP(30); // Online teselli
    }

    setTimeout(() => {
        menuOverlay.classList.remove('hidden');
    }, 3000); // 3 saniye sonra tam lobi ekranına dön
}

// --- SOCKET.IO EVENT LİSTENER'LARI --- //
if (socket) {
    socket.on('joined', (data) => {
        myRoomId = data.roomId;
        myPlayerIndex = data.playerIndex;
        roomCodeDisplay.innerText = myRoomId;
        console.log("Odaya bağlandık:", myRoomId);
    });

    socket.on('errorMsg', (msg) => {
        alert(msg);
        waitingScreen.classList.add('hidden');
        menuOverlay.classList.remove('hidden');
    });

    socket.on('playerLeft', (msg) => {
        alert(msg);
        location.reload(); // En temizi sayfayı yenilemek
    });

    // Gelen Chat Mesajı
    socket.on('receiveChat', (data) => {
        const chatContainer = document.getElementById('chatMessages');
        const isMe = data.playerName === playerNames[myPlayerIndex];

        const msgDiv = document.createElement('div');
        msgDiv.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in`;

        msgDiv.innerHTML = `
                    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-1 mb-0.5">${data.playerName}</span>
                    <div class="${isMe ? 'bg-emerald-600/80 text-white' : 'bg-slate-700/80 text-white'} px-3 py-1.5 rounded-xl rounded-t-sm text-sm border ${isMe ? 'border-emerald-500' : 'border-slate-500'} inline-block max-w-[90%] break-words shadow-md">
                        ${data.message}
                    </div>
                `;

        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Eğer benden gelmediyse ufak bir tık sesi
        if (!isMe) Sound.play(600, 'square', 0.1, 0.1, false);
    });

    socket.on('gameStart', (data) => {
        waitingScreen.classList.add('hidden'); // Lobby ekranını kapa
        emojiBar.classList.remove('hidden'); // Emojileri göster
        zoomBtn.classList.remove('hidden'); // Zoom göster
        document.getElementById("muteBtn").classList.remove('hidden'); // Ses butonunu göster

        gameActive = true;
        // Sunucudan gelen state'i al
        const gs = data.gameState;
        playerNames = data.playerNames || ["OYUNCU 1", "OYUNCU 2"];

        // Modes & Skins sync
        currentGameMode = data.gameMode || "501";
        if (data.playerSkins) {
            myDartSkin = data.playerSkins[myPlayerIndex];
            p2DartSkin = data.playerSkins[myPlayerIndex === 0 ? 1 : 0];
        }

        scores = gs.scores;
        previousScores = [...scores];
        activePlayer = gs.activePlayer;
        dartsInRound = gs.dartsInRound;
        totalThrows = [0, 0];
        thrownDarts = [];
        currentDart = null;
        particles = [];
        floatingTexts = [];

        updateScoreUI();
        updateActivePlayerUI();
        updateWind(gs.windIntensity, gs.windAngle);
        document.querySelectorAll('.dart-icon').forEach(d => d.classList.remove('used'));

        Sound.startCrowd(); // Haritaya Özel Kalabalık Sesi Başlat

        // Oyun başladığında ufak bir giriş "ding" sesi
        Sound.play(600, 'sine', 0.5, 0.1);
        Sound.speak("Game On!");

        const turnName = playerNames[activePlayer] || `OYUNCU ${activePlayer + 1}`;
        showAnnounce(`${turnName} SIRA SİZDE`, "#38bdf8", false);
        update(); // Gameloop start
    });

    socket.on('dartLanded', (data) => {
        // Rakibin attığı dartı kendi ekranımızda canlandır
        if (data.playerIndex !== myPlayerIndex) {
            totalThrows[activePlayer]++;
            Sound.whoosh();
            currentDart = new Dart(data.targetX, data.targetY, data.playerIndex);
        }
    });

    socket.on('turnSwitched', (data) => {
        const gs = data.gameState;
        scores = gs.scores;
        previousScores = [...scores];

        if (gs.cricketScores) {
            cricketScores = gs.cricketScores;
            previousCricketScores = [...cricketScores];
            cricketMarks = gs.cricketMarks || cricketMarks;
            previousCricketMarks = JSON.parse(JSON.stringify(cricketMarks));
        }

        activePlayer = gs.activePlayer;
        dartsInRound = gs.dartsInRound;

        thrownDarts = [];
        document.querySelectorAll('.dart-icon').forEach(d => d.classList.remove('used'));

        updateWind(gs.windIntensity, gs.windAngle);
        updateScoreUI();
        updateActivePlayerUI();

        const turnName = playerNames[activePlayer] || `OYUNCU ${activePlayer + 1}`;
        showAnnounce(`${turnName} SIRA SİZDE`, "#38bdf8", false);
        Sound.play(500, 'sine', 0.3, 0.1);
    });

    // Emoji Reaksiyonlarını Dinleme
    socket.on('receiveEmoji', (data) => {
        showFloatingEmoji(data.emoji, data.playerIndex);
    });
}

// --- EMOJİ SİSTEMİ ---
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const char = btn.getAttribute('data-emoji');

        // Butonda anlık bir tıklama efekti
        btn.classList.add('scale-125', 'bg-emerald-500/30');
        setTimeout(() => btn.classList.remove('scale-125', 'bg-emerald-500/30'), 200);

        // Kendi ekranımızda direkt göster
        const indexToShow = isLocalMode ? activePlayer : myPlayerIndex;
        showFloatingEmoji(char, indexToShow);

        // Online ise rakibe gönder
        if (!isLocalMode && socket && socket.connected) {
            socket.emit('sendEmoji', { emoji: char });
        }
    });
});

function showFloatingEmoji(char, playerIndex) {
    // Sağdan veya soldan çıkartalım oyuncuya göre
    const isMe = (playerIndex === myPlayerIndex) || (isLocalMode && playerIndex === 0);

    // Eğer ben atıyorsam ortadan ekranın aşağısından, o atıyorsa tepeden çıksın
    let startX = isMe ? (vW / 2 + 100) : (vW / 2 - 100);
    let startY = isMe ? vH - 100 : 150;

    // Çıktığı yerde biraz da partikül patlatalım
    for (let i = 0; i < 6; i++) {
        spawnParticles(startX, startY, '#fcd34d');
    }

    floatingTexts.push(new FloatingText(startX, startY, char, '#ffffff', 3));
    Sound.play(800, 'sine', 0.15, 0.2, false); // Özel Emoji Sesi
}

function endGame() {
    gameActive = false;
    const winnerName = playerNames[activePlayer] || `OYUNCU ${activePlayer + 1}`;
    winnerText.innerText = `${winnerName} KAZANDI!`;
    finalThrowCount.innerText = totalThrows[activePlayer];
    menuOverlay.classList.remove('hidden');
    resultBox.classList.remove('hidden');
    playBtn.innerText = "TEKRAR ODA KUR";
    playLocalBtn.innerText = "TEKRAR CİHAZDA OYNA";
}

playBtn.addEventListener('click', startOnlineGame);
playLocalBtn.addEventListener('click', startLocalGame);

function resize() {
    const w = window.innerWidth; const h = window.innerHeight;
    canvas.width = w; canvas.height = h;

    // Dart tahtasını sığdırmak için ölçek (referans 1000x1000)
    scale = Math.min(w / 1000, h / 1000);

    // Ekran formatına göre sanal genişlik ve yüksekliği genişlet
    vW = w / scale;
    vH = h / scale;

    // Tahtayı ekranın tam ortasına yerleştir
    BOARD_X = vW / 2;
    BOARD_Y = vH / 2;

    if (!gameActive) {
        ctx.clearRect(0, 0, vW, vH);
        ctx.save(); ctx.scale(scale, scale); drawBoard(); ctx.restore();
    }
}


// Lobiyi açarken envanteri kontrol et
const originalLobbyUpdate = window.updateLobbyRecordUI;
window.updateLobbyRecordUI = function () {
    if (originalLobbyUpdate) originalLobbyUpdate();

    // Eğer updateLobbyRecordUI daha önceden tanımlanmışsa (ki HTML'de var),
    // Sadece içine skin kilitlerini eklemek için bir yama atıyoruz
    const currentXP = parseInt(localStorage.getItem('dart_playerXP')) || 0;
    const goldSkinUnlocked = currentXP >= 1000;
    const neonSkinUnlocked = currentXP >= 4000;

    const skinSelect = document.getElementById("dartSkinSelect");
    if (skinSelect) {
        const goldOpt = skinSelect.querySelector('option[value="gold"]');
        if (goldOpt) {
            goldOpt.disabled = !goldSkinUnlocked;
            goldOpt.innerText = goldSkinUnlocked ? "Altın Şampiyon ★" : "🔒 Altın Şampiyon (Gümüş I)";
        }
        const neonOpt = skinSelect.querySelector('option[value="neon"]');
        if (neonOpt) {
            neonOpt.disabled = !neonSkinUnlocked;
            neonOpt.innerText = neonSkinUnlocked ? "Neon Siber ⚡" : "🔒 Neon Siber (Altın I)";
        }

        // Kilitliyse standaard'a zorla
        if ((skinSelect.value === "gold" && !goldSkinUnlocked) ||
            (skinSelect.value === "neon" && !neonSkinUnlocked)) {
            skinSelect.value = "standard";
        }
    }
};

window.onload = () => {
    updateLobbyRecordUI(); // Lobi verileri ve skin kilitleri yüklenirken tetiklensin
    resize();
    drawBoard();
};

// Ses Açma / Kapama (Mute) Butonu Dinleyicisi
const muteButtonEl = document.getElementById("muteBtn");
const muteIcon = document.getElementById("muteIcon");
if (muteButtonEl) {
    muteButtonEl.addEventListener('click', () => {
        Sound.isMuted = !Sound.isMuted;
        if (Sound.isMuted) {
            muteIcon.innerText = "🔇";
            Sound.stopCrowd(); // Çalan tribün sesi varsa sustur
        } else {
            muteIcon.innerText = "🔊";
            // Eğer maç oynanıyorsa ve sessizlik kalktıysa kalabalığı geri başlat
            if (gameActive) {
                Sound.startCrowd();
            }
        }
    });
}

