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
let pendingAttemptStats = null;

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
    updateThemeButtons(themeName);
}

function updateThemeButtons(themeName) {
    document.querySelectorAll('.btn-toggle[data-theme]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
}

function setColorCount(count) {
    currentColorCount = count;
    localStorage.setItem('gapsi_color_count', count);
    applySettings();
    updateColorCountButtons(count);
}

function updateColorCountButtons(count) {
    document.querySelectorAll('.btn-toggle[data-count]').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.count) === count);
    });
}

function loadTheme() {
    const savedTheme = localStorage.getItem('gapsi_theme') || 'dark';
    applyTheme(savedTheme);
}

function loadSettings() {
    const savedTheme = localStorage.getItem('gapsi_theme') || 'dark';
    const savedCount = parseInt(localStorage.getItem('gapsi_color_count') || currentColorCount, 10);
    currentColorCount = [4, 5, 6, 7, 8, 9].includes(savedCount) ? savedCount : 4;
    applyTheme(savedTheme);
    updateColorCountButtons(currentColorCount);
    applySettings();
}

/* =========================================================
   GERENCIAMENTO DE USUÁRIOS E MIGRAÇÃO DE DADOS
========================================================= */
let users = [];
let currentUser = null;
const MOODS = [{
        id: 'muito_feliz',
        label: 'Muito feliz',
        color: '#F59E0B',
        bg: '#FFF3C4',
        svg: `<circle cx="40" cy="40" r="36" fill="#FFF3C4" stroke="#F59E0B" stroke-width="3"/><ellipse cx="28" cy="33" rx="5" ry="6" fill="#1A2332"/><ellipse cx="52" cy="33" rx="5" ry="6" fill="#1A2332"/><circle cx="30" cy="31" r="2" fill="white"/><circle cx="54" cy="31" r="2" fill="white"/><path d="M20 46 Q40 62 60 46" fill="#F59E0B" stroke="#D97706" stroke-width="2"/><ellipse cx="18" cy="44" rx="7" ry="5" fill="#FCA5A5" opacity="0.5"/><ellipse cx="62" cy="44" rx="7" ry="5" fill="#FCA5A5" opacity="0.5"/>`
    },
    {
        id: 'feliz',
        label: 'Feliz',
        color: '#10B981',
        bg: '#D1FAE5',
        svg: `<circle cx="40" cy="40" r="36" fill="#D1FAE5" stroke="#10B981" stroke-width="3"/><ellipse cx="28" cy="34" rx="4.5" ry="5" fill="#1A2332"/><ellipse cx="52" cy="34" rx="4.5" ry="5" fill="#1A2332"/><circle cx="30" cy="32" r="2" fill="white"/><circle cx="54" cy="32" r="2" fill="white"/><path d="M22 49 Q40 60 58 49" fill="none" stroke="#065F46" stroke-width="3" stroke-linecap="round"/><ellipse cx="18" cy="46" rx="6" ry="4" fill="#6EE7B7" opacity="0.5"/><ellipse cx="62" cy="46" rx="6" ry="4" fill="#6EE7B7" opacity="0.5"/>`
    },
    {
        id: 'neutro',
        label: 'Neutro',
        color: '#94A3B8',
        bg: '#F1F5F9',
        svg: `<circle cx="40" cy="40" r="36" fill="#F1F5F9" stroke="#94A3B8" stroke-width="3"/><ellipse cx="28" cy="35" rx="4.5" ry="5" fill="#1A2332"/><ellipse cx="52" cy="35" rx="4.5" ry="5" fill="#1A2332"/><circle cx="30" cy="33" r="2" fill="white"/><circle cx="54" cy="33" r="2" fill="white"/><line x1="23" y1="51" x2="57" y2="51" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>`
    },
    {
        id: 'triste',
        label: 'Triste',
        color: '#3B82F6',
        bg: '#EFF6FF',
        svg: `<circle cx="40" cy="40" r="36" fill="#EFF6FF" stroke="#3B82F6" stroke-width="3"/><ellipse cx="28" cy="35" rx="4.5" ry="5" fill="#1A2332"/><ellipse cx="52" cy="35" rx="4.5" ry="5" fill="#1A2332"/><circle cx="30" cy="33" r="2" fill="white"/><circle cx="54" cy="33" r="2" fill="white"/><path d="M21 26 Q28 21 35 26" fill="none" stroke="#1A2332" stroke-width="2.5" stroke-linecap="round"/><path d="M45 26 Q52 21 59 26" fill="none" stroke="#1A2332" stroke-width="2.5" stroke-linecap="round"/><path d="M22 53 Q40 43 58 53" fill="none" stroke="#1D4ED8" stroke-width="3" stroke-linecap="round"/><ellipse cx="54" cy="44" rx="3" ry="4" fill="#93C5FD" opacity="0.8"/>`
    },
    {
        id: 'medo',
        label: 'Com medo',
        color: '#A855F7',
        bg: '#FAF5FF',
        svg: `<circle cx="40" cy="40" r="36" fill="#FAF5FF" stroke="#A855F7" stroke-width="3"/><ellipse cx="28" cy="33" rx="7" ry="7.5" fill="#1A2332"/><ellipse cx="52" cy="33" rx="7" ry="7.5" fill="#1A2332"/><circle cx="30" cy="30" r="3" fill="white"/><circle cx="54" cy="30" r="3" fill="white"/><ellipse cx="40" cy="52" rx="10" ry="6.5" fill="#7C3AED"/><path d="M18 24 Q27 18 36 24" fill="none" stroke="#1A2332" stroke-width="2.5" stroke-linecap="round"/><path d="M44 24 Q53 18 62 24" fill="none" stroke="#1A2332" stroke-width="2.5" stroke-linecap="round"/>`
    },
    {
        id: 'irritado',
        label: 'Irritado',
        color: '#EF4444',
        bg: '#FEF2F2',
        svg: `<circle cx="40" cy="40" r="36" fill="#FEF2F2" stroke="#EF4444" stroke-width="3"/><ellipse cx="28" cy="34" rx="4.5" ry="5" fill="#1A2332"/><ellipse cx="52" cy="34" rx="4.5" ry="5" fill="#1A2332"/><circle cx="30" cy="32" r="2" fill="white"/><circle cx="54" cy="32" r="2" fill="white"/><path d="M20 24 Q29 19 36 24" fill="none" stroke="#1A2332" stroke-width="2.5" stroke-linecap="round"/><path d="M44 24 Q53 19 60 24" fill="none" stroke="#1A2332" stroke-width="2.5" stroke-linecap="round"/><path d="M23 55 Q40 45 57 55" fill="none" stroke="#DC2626" stroke-width="3" stroke-linecap="round"/>`
    }
];

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

function saveRoundHistory() {
    if (!currentUser || sessionReactionTimes.length === 0) return;

    const times = [...sessionReactionTimes];
    if (!currentUser.speed) currentUser.speed = { 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
    if (!currentUser.speed[currentColorCount]) currentUser.speed[currentColorCount] = [];

    currentUser.speed[currentColorCount].push(times);
    if (currentUser.speed[currentColorCount].length > 5) currentUser.speed[currentColorCount].shift();

    if (score > currentUser.scores[currentColorCount]) {
        currentUser.scores[currentColorCount] = score;
    }

    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx >= 0) users[idx] = currentUser;
    saveUsers();
    updatePlayerUI();
}

function buildAttemptStats() {
    if (!currentUser || sessionReactionTimes.length === 0) return null;

    const sorted = [...sessionReactionTimes].sort((a, b) => a - b);
    const avg = Math.round(sessionReactionTimes.reduce((s, v) => s + v, 0) / sessionReactionTimes.length);
    const median = sorted.length % 2 === 0 ?
        Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) :
        Math.round(sorted[Math.floor(sorted.length / 2)]);
    const worst = Math.round(sorted[sorted.length - 1]);
    const latestMood = getLatestMoodData(currentUser);

    return {
        date: new Date().toLocaleDateString('pt-BR'),
        colorCount: currentColorCount,
        score,
        avg,
        median,
        worst,
        errors: 0,
        times: [...sessionReactionTimes],
        moodId: latestMood ? latestMood.id : null,
        moodLabel: latestMood ? latestMood.label : null
    };
}

function saveSession() {
    if (!currentUser || !pendingAttemptStats) return;

    if (!currentUser.sessions) currentUser.sessions = [];
    currentUser.sessions.push(pendingAttemptStats);
    if (currentUser.sessions.length > 5) currentUser.sessions.shift();

    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx >= 0) users[idx] = currentUser;
    saveUsers();
    pendingAttemptStats = null;
}

function updatePendingAttemptStats() {
    const stats = buildAttemptStats();
    if (stats) pendingAttemptStats = stats;
}

function renderMoodGrid() {
    const grid = document.getElementById('mood-grid');
    if (!grid) return;
    grid.innerHTML = '';
    MOODS.forEach(mood => {
        const btn = document.createElement('button');
        btn.className = 'mood-option';
        btn.innerHTML = `
            <svg viewBox="0 0 80 80" width="40" height="40" xmlns="http://www.w3.org/2000/svg">${mood.svg}</svg>
            <span>${mood.label}</span>
        `;
        btn.onclick = () => saveMood(mood);
        grid.appendChild(btn);
    });
}

function showMoodModal() {
    renderMoodGrid();
    document.getElementById('mood-overlay').classList.add('show');
}

function closeMoodModal() {
    document.getElementById('mood-overlay').classList.remove('show');
}

function saveMood(mood) {
    if (!currentUser) return;
    if (!currentUser.moods) currentUser.moods = [];
    currentUser.moods.push({
        id: mood.id,
        label: mood.label,
        date: new Date().toLocaleDateString('pt-BR'),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    if (currentUser.moods.length > 10) currentUser.moods.shift();
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx >= 0) users[idx] = currentUser;
    saveUsers();
    updatePlayerUI();
    closeMoodModal();
}

function buildMoodIcon(moodId, size = 20) {
    const moodData = MOODS.find(m => m.id === moodId);
    if (!moodData) return '<span style="font-size:0.95rem;">🙂</span>';
    return `<svg viewBox="0 0 80 80" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${moodData.svg}</svg>`;
}

function getLatestMoodData(user = currentUser) {
    if (!user || !user.moods || user.moods.length === 0) return null;
    return user.moods[user.moods.length - 1];
}

function openStatsShortcut(event) {
    event.stopPropagation();
    if (currentUser) {
        showStats(currentUser.id, event);
    } else {
        showPlayerModal();
    }
}

function showStats(id, event) {
    event.stopPropagation();
    const user = users.find(u => u.id === id);
    if (!user) return;

    closePlayerModal();
    document.getElementById('stats-user-name').textContent = user.name;
    const chart = document.getElementById('stats-chart');
    chart.innerHTML = '';

    if (!user.sessions || user.sessions.length === 0) {
        chart.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Nenhuma sessão registrada ainda.</p>';
    } else {
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:0.78rem;';
        table.innerHTML = `
            <thead>
                <tr style="color:var(--text-muted);border-bottom:1px solid var(--border-color);">
                    <th style="padding:6px 4px;text-align:left;">Data</th>
                    <th style="padding:6px 4px;text-align:left;">Cores</th>
                    <th style="padding:6px 4px;text-align:right;">Pont.</th>
                    <th style="padding:6px 4px;text-align:right;">Média</th>
                    <th style="padding:6px 4px;text-align:right;">Mediana</th>
                    <th style="padding:6px 4px;text-align:right;">Pior</th>
                    <th style="padding:6px 4px;text-align:center;">Humor</th>
                </tr>
            </thead>
            <tbody id="stats-tbody"></tbody>
        `;
        chart.appendChild(table);
        const tbody = table.querySelector('#stats-tbody');
        user.sessions.forEach((s, i) => {
            const isLast = i === user.sessions.length - 1;
            const tr = document.createElement('tr');
            tr.style.cssText = `border-bottom:1px solid var(--border-color);${isLast ? 'font-weight:700;' : ''}`;
            tr.innerHTML = `
                <td style="padding:6px 4px;">${s.date}</td>
                <td style="padding:6px 4px;">${s.colorCount}C</td>
                <td style="padding:6px 4px;text-align:right;">${s.score}</td>
                <td style="padding:6px 4px;text-align:right;">${s.avg}ms</td>
                <td style="padding:6px 4px;text-align:right;">${s.median}ms</td>
                <td style="padding:6px 4px;text-align:right;">${s.worst}ms</td>
                <td style="padding:6px 4px;text-align:center;" title="${s.moodLabel || ''}">${s.moodId ? buildMoodIcon(s.moodId, 18) : '—'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('stats-overlay').classList.add('show');
}

function applySettings() {
    const board = document.getElementById('board');
    if (board) {
        board.className = `simon-board board-${currentColorCount}`;
    }

    for (let i = 0; i < 9; i++) {
        const pad = document.getElementById(`pad-${i}`);
        if (pad) {
            pad.style.display = (i < currentColorCount) ? 'block' : 'none';
        }
    }

    updateColorCountButtons(currentColorCount);
    updatePlayerUI();
}

function showLoginModal() {
    loadUsers();
    loadSettings();
    if (isPlaying) toggleGame();
    document.getElementById('login-overlay').classList.add('show');
    document.getElementById('player-modal-overlay').classList.remove('show');
}

function showPlayerModal() {
    loadUsers();
    renderUserList();
    document.getElementById('player-modal-overlay').classList.add('show');
}

function closePlayerModal() {
    document.getElementById('player-modal-overlay').classList.remove('show');
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
    document.getElementById('player-modal-overlay').classList.remove('show');
    resetGameStats();
    if (currentUser) showMoodModal();
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

    const moodBadge = document.getElementById('current-mood-badge');
    if (moodBadge) {
        const latestMood = getLatestMoodData(currentUser);
        if (latestMood) {
            const moodData = MOODS.find(m => m.id === latestMood.id);
            moodBadge.innerHTML = moodData ? buildMoodIcon(moodData.id, 18) : '🙂';
            moodBadge.title = moodData ? moodData.label : latestMood.label;
        } else {
            moodBadge.innerHTML = '🙂';
            moodBadge.title = 'Humor não registrado';
        }
    }
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
    pendingAttemptStats = null;
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
        if (pendingAttemptStats) {
            saveSession();
        }
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
        const deltaTime = Math.round(now - lastClickTime);
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
            saveRoundHistory();
            updatePendingAttemptStats();
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

    // Salva os dados se houver um usuário logado e se a tentativa tiver pelo menos um sucesso registrado
    if (currentUser && pendingAttemptStats) {
        saveRoundHistory();
        saveSession();
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
    renderMoodGrid();
    showLoginModal();
});