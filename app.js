/* =========================================================
   ESTADO E CONFIGURAÇÕES DO JOGO
========================================================= */
let isSoundEnabled = true;
let currentColorCount = 4;
let isPlaying = false;
let gameTimeouts = [];

let sequence = [];
let playerStep = 0;
let score = 0;
let isAcceptingInput = false;

// Variáveis de Tempo de Reação
let lastClickTime = 0;
let sessionReactionTimes = [];

// Paleta de cores para desenhar as "fatias" do gráfico empilhado
const segmentColors = ['#f43f5e', '#3b82f6', '#eab308', '#84cc16', '#a855f7', '#06b6d4', '#f97316', '#ec4899', '#10b981', '#6366f1'];

/* =========================================================
   SISTEMA DE ÁUDIO NATIVO E TEMAS
========================================================= */
let audioCtx;
const FREQUENCIES = [329.63, 261.63, 293.66, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25];

function initAudio() {
    if (!audioCtx) audioCtx = new(window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    document.getElementById('sound-btn').textContent = isSoundEnabled ? '🔊' : '🔇';
}

function playTone(index, duration = 400) {
    if (!isSoundEnabled || !audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(FREQUENCIES[index], audioCtx.currentTime);
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + (duration / 1000));
    oscillator.stop(audioCtx.currentTime + (duration / 1000));
}

function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('gapsi_theme', themeName);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('gapsi_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeRadios = document.getElementsByName('themeSelect');
    for (const r of themeRadios) {
        if (r.value === savedTheme) r.checked = true;
    }
}

/* =========================================================
   GERENCIAMENTO DE USUÁRIOS E MIGRAÇÃO DE DADOS
========================================================= */
let users = [];
let currentUser = null;

function loadUsers() {
    const stored = localStorage.getItem('gapsi_users');
    if (stored) {
        users = JSON.parse(stored);
        users.forEach(u => {
            if (!u.scores) u.scores = { 4: u.bestScore || 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
            if (u.scores[9] === undefined) u.scores[9] = 0;

            // Migração: garante formato array-de-arrays (histórico de rodadas).
            // Reseta se: speed não existe, ou se speed[4] é um número (formato v1),
            // ou se speed[4] é um array plano de números (formato v2 — uma única rodada).
            const sp = u.speed;
            if (!sp || typeof sp[4] === 'number' ||
                (Array.isArray(sp[4]) && sp[4].length > 0 && typeof sp[4][0] === 'number')) {
                u.speed = { 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
            }
            // Garante que todas as chaves existam (migração de versões intermediárias)
            [4, 5, 6, 7, 8, 9].forEach(k => { if (!Array.isArray(u.speed[k])) u.speed[k] = []; });
        });
    }
}

function saveUsers() {
    localStorage.setItem('gapsi_users', JSON.stringify(users));
}

function applySettings() {
    const radios = document.getElementsByName('colorCount');
    for (const r of radios) {
        if (r.checked) currentColorCount = parseInt(r.value);
    }

    const board = document.getElementById('board');
    board.className = `simon-board board-${currentColorCount}`;

    for (let i = 0; i < 9; i++) {
        document.getElementById(`pad-${i}`).style.display = (i < currentColorCount) ? 'block' : 'none';
    }
    updatePlayerUI();
}

function showLoginModal() {
    loadUsers();
    renderUserList();
    if (isPlaying) toggleGame();
    document.getElementById('login-overlay').classList.add('show');
}

function renderUserList() {
    const listEl = document.getElementById('user-list');
    listEl.innerHTML = '';

    // Ordenar alfabeticamente
    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

    if (sortedUsers.length === 0) {
        listEl.innerHTML = '<li style="justify-content:center; color: var(--text-muted);">Nenhum perfil cadastrado</li>';
        return;
    }

    sortedUsers.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div onclick="selectUser('${user.id}')" style="flex-grow:1; font-weight:600; text-align: left;">
                👤 ${user.name.toUpperCase()}
            </div>
            <div class="user-actions">
                <button class="btn-stat" title="Ver Estatísticas" onclick="showStats('${user.id}', event)">📊</button>
                <button class="delete-user-btn" title="Excluir" onclick="requestDeleteUser('${user.id}', event)">✕</button>
            </div>
        `;
        listEl.appendChild(li);
    });
}

function createNewUser() {
    applySettings();
    initAudio();
    // Adicione o .toUpperCase() aqui
    const name = document.getElementById('new-user-name').value.trim().toUpperCase();
    const age = document.getElementById('new-user-age').value;

    if (!name) { alert("Por favor, digite um nome."); return; }

    const newUser = {
        id: Date.now().toString(),
        name: name, // Já será salvo como maiúsculo
        age: parseInt(age) || 0,
        scores: { 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
        speed: { 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] }
    };

    users.push(newUser);
    saveUsers();
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-age').value = '';
    selectUser(newUser.id);
}

function selectUser(id) {
    applySettings();
    initAudio();
    currentUser = users.find(u => u.id === id);
    finalizeLogin();
}

function playAnonymous() {
    applySettings();
    initAudio();
    currentUser = null;
    finalizeLogin();
}

function finalizeLogin() {
    updatePlayerUI();
    document.getElementById('login-overlay').classList.remove('show');
    resetGameStats();
}

let userToDelete = null;

function requestDeleteUser(id, event) {
    event.stopPropagation();
    userToDelete = id;
    document.getElementById('confirm-overlay').classList.add('show');
}

function closeConfirm() {
    document.getElementById('confirm-overlay').classList.remove('show');
    userToDelete = null;
}

function executeDelete() {
    if (userToDelete) {
        users = users.filter(u => u.id !== userToDelete);
        saveUsers();
        renderUserList();
        if (currentUser && currentUser.id === userToDelete) playAnonymous();
    }
    closeConfirm();
}

/* =========================================================
   ESTATÍSTICAS (GRÁFICO DE BARRAS EMPILHADAS)
========================================================= */
function showStats(id, event) {
    event.stopPropagation();
    const user = users.find(u => u.id === id);
    if (!user) return;

    document.getElementById('stats-user-name').textContent = user.name;
    const chartScore = document.getElementById('stats-chart');
    const chartSpeed = document.getElementById('stats-speed-chart');

    chartScore.innerHTML = '';
    chartSpeed.innerHTML = '';

    const maxScore = Math.max(...Object.values(user.scores), 10);

    [4, 5, 6, 7, 8, 9].forEach(colors => {
        // --- 1. Gráfico de Pontos ---
        const record = user.scores[colors];
        chartScore.innerHTML += `
            <div class="bar-wrapper">
                <span class="bar-value" style="font-size: 10px; margin-bottom: 2px;">${record > 0 ? record : ''}</span>
                <div style="display: flex; gap: 2px; align-items: flex-end; height: 60px;">
                    <div class="bar-fill-score" style="height: ${(record / maxScore) * 100}%" title="Melhor: ${record}"></div>
                </div>
                <span class="bar-label">${colors}C</span>
            </div>
        `;

        // --- 2. Gráfico de Velocidade (Tentativa 0 + 5 Últimas) ---
        const history = user.speed[colors] || [];

        // Encontrar a melhor rodada (Tentativa 0)
        let bestRound = null;
        let bestTotal = Infinity;
        history.forEach(round => {
            const total = round.reduce((a, b) => a + b, 0);
            if (total > 0 && total < bestTotal) {
                bestTotal = total;
                bestRound = round;
            }
        });

        const last5 = history.slice(-5);
        const allToDisplay = bestRound ? [bestRound, ...last5] : last5;
        const maxTotal = allToDisplay.reduce((max, r) => {
            const t = r.reduce((a, b) => a + b, 0);
            return t > max ? t : max;
        }, 1);

        function buildBar(round, label, isBest) {
            const total = round.reduce((a, b) => a + b, 0);
            const heightPct = (total / maxTotal) * 100;
            const displayTime = (total / 1000).toFixed(1) + 's';
            let segmentsHTML = '';
            round.forEach((t, i) => {
                const pct = (t / total) * 100;
                const color = isBest ? '#f59e0b' : segmentColors[i % segmentColors.length];
                segmentsHTML += `<div class="bar-segment" style="height:${pct}%;background:${color};" title="Toque ${i + 1}: ${(t / 1000).toFixed(2)}s"></div>`;
            });
            return `
                <div class="bar-wrapper" style="width:20px;"> 
                 <span class="bar-value" style="font-size:7px;">${total > 0 ? displayTime : ''}</span>
                 <div class="bar-fill-container" style="height:${heightPct}%">${segmentsHTML}</div>
                 <span class="bar-label" style="font-size:7px;">${label}</span>
                </div>`;
        }

        let barsHTML = '';
        // Slot 0: Melhor Resultado
        barsHTML += bestRound ? buildBar(bestRound, '🏆', true) : '<div class="bar-wrapper" style="width:22px;"><span class="bar-label" style="font-size:8px;">—</span></div>';

        // Slots 1 a 5: Histórico
        for (let i = 0; i < 5; i++) {
            barsHTML += last5[i] ? buildBar(last5[i], `${i + 1}`, false) : '<div class="bar-wrapper" style="width:22px;"><span class="bar-label" style="font-size:8px;">—</span></div>';
        }

        chartSpeed.innerHTML += `
            <div class="stats-speed-group">
                <span class="stats-speed-label">${colors}C</span>
                <div class="stats-speed-bars">${barsHTML}</div>
            </div>
        `;
    });

    document.getElementById('stats-overlay').classList.add('show');
}

// Função auxiliar para mudar a mensagem
function updateStatus(text, type) {
    const el = document.getElementById('status-message');
    el.textContent = text;
    el.className = 'status-' + type;
}

async function playSequence() {
    updateStatus("Preste atenção agora!", "attention"); // MENSAGEM 1

    for (let i = 0; i < sequence.length; i++) {
        if (!isPlaying) return;
        await new Promise(resolve => setTrackedTimeout(resolve, 150));
        if (!isPlaying) return;
        activatePad(sequence[i], 500);
        await new Promise(resolve => setTrackedTimeout(resolve, 500));
    }

    if (isPlaying) {
        updateStatus("Sua vez!", "turn"); // MENSAGEM 2
        isAcceptingInput = true;
        lastClickTime = performance.now();
    }
}

function closeStats() {
    document.getElementById('stats-overlay').classList.remove('show');
}

function updatePlayerUI() {
    document.getElementById('current-player-name').textContent = currentUser ? currentUser.name : 'Anônimo';
    document.getElementById('high-score').textContent = currentUser ? currentUser.scores[currentColorCount] : '0';
}

/* =========================================================
   NÚCLEO DO JOGO E CAPTURA DE TEMPOS DE TOQUE
========================================================= */
function clearAllTimeouts() {
    gameTimeouts.forEach(clearTimeout);
    gameTimeouts = [];
    document.querySelectorAll('.pad').forEach(pad => pad.classList.remove('active'));
}

function setTrackedTimeout(fn, delay) {
    const id = setTimeout(fn, delay);
    gameTimeouts.push(id);
    return id;
}

// Ajuste na função que limpa os tempos para evitar o bug do "nível 4 com vários tempos"
function resetGameStats() {
    sequence = [];
    score = 0;
    sessionReactionTimes = [];
    document.getElementById('current-score').textContent = score;
    // Força a mensagem inicial sempre que uma rodada é resetada
    updateStatus("Prepare-se para começar!", "idle");
    clearAllTimeouts();
}

function toggleGame() {
    initAudio();
    const btn = document.getElementById('start-btn');

    if (isPlaying) {
        isPlaying = false;
        isAcceptingInput = false;
        btn.textContent = 'JOGAR';
        btn.classList.remove('stop');
        resetGameStats();
    } else {
        isPlaying = true;
        btn.textContent = 'PARAR';
        btn.classList.add('stop');
        resetGameStats();
        nextRound();
    }
}

function nextRound() {
    if (!isPlaying) return;
    score = sequence.length;
    document.getElementById('current-score').textContent = score;
    playerStep = 0;
    isAcceptingInput = false;

    sessionReactionTimes = []; // Reinicia os tempos de reação para a nova rodada
    lastClickTime = 0; // Zera para não herdar o tempo do clique anterior
    sequence.push(Math.floor(Math.random() * currentColorCount));
    setTrackedTimeout(playSequence, 800);
}



function activatePad(index, duration) {
    const pad = document.getElementById(`pad-${index}`);
    if (!pad) return;
    pad.classList.add('active');
    playTone(index, duration);
    setTrackedTimeout(() => { pad.classList.remove('active'); }, duration);
}

function handlePadClick(index) {
    if (!isAcceptingInput || !isPlaying) return;

    const now = performance.now();

    // Se houver um clique anterior, calculamos o intervalo (Delta)
    if (lastClickTime > 0) {
        const deltaTime = now - lastClickTime;
        sessionReactionTimes.push(deltaTime);
    }

    // Atualiza o marcador do último clique
    lastClickTime = now;

    // Feedback visual e sonoro
    activatePad(index, 300);

    // Lógica do Jogo
    if (index === sequence[playerStep]) {
        playerStep++;
        if (playerStep === sequence.length) {
            isAcceptingInput = false;
            setTrackedTimeout(nextRound, 600);
        }
    } else {
        gameOver();
    }
}

const mensagensPositivas = [
    "Você foi incrível! Cada jogada deixa seu cérebro mais forte.",
    "Uau, que foco! Brincar com você é muito divertido.",
    "A prática faz a gente crescer, que tal mais uma?",
    "Sua memória é fantástica! Adorei ver você tentar.",
    "Muito bem! O mais legal é que a gente sempre pode tentar outra vez.",
    "Que jogada legal! Respire fundo e vamos para a próxima aventura!",
    "Você prestou muita atenção, parabéns! Vamos treinar mais um pouquinho?",
    "Adorei seu esforço! O importante é se divertir e aprender."
];

function gameOver() {
    isPlaying = false;
    isAcceptingInput = false;

    // Atualiza o botão da interface para o estado inicial
    const btn = document.getElementById('start-btn');
    btn.textContent = 'JOGAR';
    btn.classList.remove('stop');

    // Feedback sonoro de erro
    if (isSoundEnabled) {
        isSoundEnabled = false;
        playTone(2, 600);
        setTimeout(() => { isSoundEnabled = true; }, 800);
    }

    // Salva os dados se houver um usuário logado e se a rodada teve pelo menos um toque
    if (currentUser && sessionReactionTimes.length > 0) {
        const times = [...sessionReactionTimes];

        // Adiciona a rodada atual ao histórico (array de arrays)
        currentUser.speed[currentColorCount].push(times);

        // Mantém apenas as últimas 5 tentativas no histórico de rodadas
        if (currentUser.speed[currentColorCount].length > 5) {
            currentUser.speed[currentColorCount].shift();
        }

        // Atualiza recorde de pontos se superado
        if (score > currentUser.scores[currentColorCount]) {
            currentUser.scores[currentColorCount] = score;
        }

        saveUsers();
        updatePlayerUI();
    }

    // Exibe a mensagem de feedback para a criança
    const fraseSorteada = mensagensPositivas[Math.floor(Math.random() * mensagensPositivas.length)];
    const textoPonto = score === 1 ? 'ponto' : 'pontos';

    document.getElementById('gameover-msg').innerHTML =
        `<span style="font-size: 55px; display: inline-block; margin-bottom: 10px; animation: bounce 2s infinite;">🌟</span><br>
        <strong style="font-size: 16px;">${fraseSorteada}</strong><br><br>
        <div style="color: var(--text-muted); font-size: 14px; margin-bottom: 25px;">Você conseguiu <strong style="color: #3b82f6; font-size: 18px;">${score}</strong> ${textoPonto} nesta rodada!</div>`;

    document.getElementById('gameover-overlay').classList.add('show');

    // Limpa todos os timeouts ativos para evitar conflitos na próxima rodada
    clearAllTimeouts();
}


function closeGameOver() {
    document.getElementById('gameover-overlay').classList.remove('show');
    resetGameStats();
}

window.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadUsers();
    showLoginModal();
});