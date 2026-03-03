const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Mümkün olan her adresten bağlantıya izin ver (Live Server vs. için gerekli)
        methods: ["GET", "POST"]
    }
});
const path = require('path');

// Sunucu statik dosyaları (HTML, CSS, JS) servis eder
app.use(express.static(path.join(__dirname, '/')));

const PORT = process.env.PORT || 3000;

// Odaları tutacağımız nesne: roomID -> { players: { socketId: playerIndex }, state: {...} }
const rooms = {};

// Rastgele bir oda ID oluşturma
function generateRoomId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('Bir kullanıcı bağlandı:', socket.id);

    // OYUNCU ODA KURMA VEYA ODAYA KATILMA EKRANI
    socket.on('joinRoom', (data) => {
        let roomId = data && data.roomId ? data.roomId : (typeof data === 'string' ? data : null);
        let playerName = data && data.playerName ? data.playerName : "MİSAFİR";

        // Oda belirtilmemişse yeni oda kur
        if (!roomId) {
            roomId = generateRoomId();

            // İlk giren oyuncu odanın kurallarını (modunu) belirler
            const mode = data && data.gameMode ? data.gameMode : "501";
            let startScore = 501;
            if (mode === "301") startScore = 301;
            else if (mode === "cricket") startScore = 0;

            rooms[roomId] = {
                players: {}, // socketId -> { index: 0/1, name: '...', skin: '...' }
                playerCount: 0,
                gameMode: mode,
                gameState: {
                    activePlayer: 0,
                    scores: [startScore, startScore],
                    cricketScores: [0, 0],
                    cricketMarks: {
                        15: [0, 0], 16: [0, 0], 17: [0, 0], 18: [0, 0], 19: [0, 0], 20: [0, 0], 25: [0, 0]
                    },
                    dartsInRound: 2,
                    windX: 0,
                    windY: 0,
                    windIntensity: 0,
                    windAngle: 0
                }
            };
        }

        const room = rooms[roomId];

        // Odaya en fazla 2 kişi girebilir
        if (!room || room.playerCount >= 2) {
            socket.emit('errorMsg', 'Oda dolu veya bulunamadı.');
            return;
        }

        // Oyuncu ataması (0: P1, 1: P2)
        const playerIndex = room.playerCount;
        const playerSkin = data && data.skin ? data.skin : "standard";
        room.players[socket.id] = { index: playerIndex, name: playerName, skin: playerSkin };
        room.playerCount++;

        socket.join(roomId);
        socket.roomId = roomId;

        console.log(`${socket.id} (P${playerIndex + 1}: ${playerName}) ${roomId} odasına katıldı.`);

        // Oyuncuya rolünü (P1 veya P2) ve odayı bildir
        socket.emit('joined', {
            roomId: roomId,
            playerIndex: playerIndex
        });

        // Eğer 2 kişi olduysa oyunu başlat
        if (room.playerCount === 2) {
            // İlk rüzgarı belirle
            updateWind(roomId);

            // Oyuncu bilgilerini çıkar
            const pNames = [];
            const pSkins = [];
            for (let socketId in room.players) {
                let p = room.players[socketId];
                pNames[p.index] = p.name;
                pSkins[p.index] = p.skin;
            }

            io.to(roomId).emit('gameStart', {
                gameState: room.gameState,
                playerNames: pNames,
                gameMode: room.gameMode,
                playerSkins: pSkins,
                map: room.map // Oyun başlarken haritayı her iki oyuncuya da yolla
            });
            console.log(`[${roomId}] Oyun başladı! Oyuncular: ${pNames.join(' vs ')} | Harita: ${room.map}`);
        }
    });

    // ATIŞ GELDİĞİNDE
    socket.on('dartThrown', (data) => {
        const roomId = socket.roomId;
        if (!roomId) return;

        const room = rooms[roomId];
        if (!room || !room.players[socket.id]) return;

        const playerIndex = room.players[socket.id].index;

        // Sadece sırası gelen oyuncu atış yapabilir
        if (room.gameState.activePlayer !== playerIndex) {
            console.warn(`[${roomId}] P${playerIndex + 1} sıra kendisinde değilken atış yapmayı denedi.`);
            return;
        }

        // Atış bilgisini (diğer) oyuncuya da gönder
        io.to(roomId).emit('dartLanded', {
            playerIndex: playerIndex,
            targetX: data.targetX,
            targetY: data.targetY,
            score: data.score
        });
    });

    // SIRA DEĞİŞİMİ / RÜZGAR DEĞİŞİMİ
    socket.on('roundEnded', (data) => {
        const roomId = socket.roomId;
        if (!roomId) return;
        const room = rooms[roomId];

        // Puanları güncelle
        room.gameState.scores = data.scores;
        if (data.cricketScores) {
            room.gameState.cricketScores = data.cricketScores;
            room.gameState.cricketMarks = data.cricketMarks;
        }

        // Sırayı karşıya geçir
        room.gameState.activePlayer = room.gameState.activePlayer === 0 ? 1 : 0;

        // Yeni rüzgar belirle
        updateWind(roomId);

        // Herkese duyur
        io.to(roomId).emit('turnSwitched', {
            gameState: room.gameState
        });
    });

    // EMOJI GÖNDERİMİ
    socket.on('sendEmoji', (data) => {
        const roomId = socket.roomId;
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room || !room.players[socket.id]) return;

        const playerIndex = room.players[socket.id].index;

        // Sadece diğer oyuncuya gönderiyoruz (broadcasting to others in room)
        socket.to(roomId).emit('receiveEmoji', {
            playerIndex: playerIndex,
            emoji: data.emoji
        });
    });

    // CHAT GÖNDERİMİ
    socket.on('sendChat', (data) => {
        const roomId = socket.roomId;
        if (!roomId) return;
        const room = rooms[roomId];
        if (!room || !room.players[socket.id]) return;

        const player = room.players[socket.id];

        // Odadaki herkese gönder (Kendi dahil)
        io.to(roomId).emit('receiveChat', {
            playerName: player.name,
            message: data.message
        });
    });

    // KULLANICI KOPTUĞUNDA
    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı:', socket.id);
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            io.to(roomId).emit('playerLeft', 'Rakip oyundan ayrıldı.');
            // Odayı temizle
            delete rooms[roomId];
        }
    });
});

function updateWind(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const angle = Math.random() * Math.PI * 2;
    const intensity = Math.random() * 1.5 + 0.2;

    room.gameState.windAngle = angle;
    room.gameState.windIntensity = intensity;
    room.gameState.windX = Math.cos(angle) * intensity;
    room.gameState.windY = Math.sin(angle) * intensity;
}

http.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor. Tarayıcınızdan http://localhost:${PORT} adresine gidin.`);
});
