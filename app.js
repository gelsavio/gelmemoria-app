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

/* =========================================================
   SISTEMA DE ÁUDIO NATIVO (8 FREQUÊNCIAS)
========================================================= */
let audioCtx;
// Frequências expandidas para 8 notas estáveis (Evita estalos e travamentos)
const FREQUENCIES = [329.63, 261.63, 293.66, 392.00, 440.00, 493.88, 523.25, 587.33];

function initAudio() {
    if (!audioCtx) {
        audioCtx = new(window.AudioContext || window.webkitAudioContext)();
    }
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

    // Fix crucial de âncora de volume inicial para reprodução contínua
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + (duration / 1000));
    oscillator.stop(audioCtx.currentTime + (duration / 1000));
}

/* =========================================================
   GERENCIAMENTO DE USUÁRIOS E DIFICULDADE
========================================================= */
let users = [];
let currentUser = null;

function loadUsers() {
    const stored = localStorage.getItem('gapsi_users');
    if (stored) users = JSON.parse(stored);
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

    // Faz a varredura e gerencia exibição de até 8 pads
    for (let i = 0; i < 8; i++) {
        document.getElementById(`pad-${i}`).style.display = (i < currentColorCount) ? 'block' : 'none';
    }
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

    if (users.length === 0) {
        listEl.innerHTML = '<li style="justify-content:center; color:#94a3b8;">Nenhum perfil cadastrado</li>';
        return;
    }

    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div onclick="selectUser('${user.id}')" style="flex-grow:1; font-weight:600;">
                👤 ${user.name} <span style="color:#3b82f6; font-size:11px; margin-left:5px;">(Max: ${user.bestScore})</span>
            </div>
            <button class="delete-user-btn" onclick="deleteUser('${user.id}', event)">✕</button>
        `;
        listEl.appendChild(li);
    });
}

function createNewUser() {
    applySettings();
    initAudio();
    const name = document.getElementById('new-user-name').value.trim();
    const age = document.getElementById('new-user-age').value;

    if (!name) { alert("Por favor, digite um nome."); return; }

    const newUser = {
        id: Date.now().toString(),
        name: name,
        age: parseInt(age) || 0,
        bestScore: 0
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

function deleteUser(id, event) {
    event.stopPropagation();
    if (confirm("Excluir usuário e apagar pontuações de forma definitiva?")) {
        users = users.filter(u => u.id !== id);
        saveUsers();
        renderUserList();
        if (currentUser && currentUser.id === id) playAnonymous();
    }
}

function updatePlayerUI() {
    document.getElementById('current-player-name').textContent = currentUser ? currentUser.name : 'Anônimo';
    document.getElementById('high-score').textContent = currentUser ? currentUser.bestScore : '0';
}

/* =========================================================
   NÚCLEO DINÂMICO DE JOGO (MÁQUINA DE ESTADOS)
========================================================= */
function clearAllTimeouts() {
    gameTimeouts.forEach(clearTimeout);
    gameTimeouts = [];
}

function setTrackedTimeout(fn, delay) {
    const id = setTimeout(fn, delay);
    gameTimeouts.push(id);
    return id;
}

function resetGameStats() {
    sequence = [];
    score = 0;
    document.getElementById('current-score').textContent = score;
}

function toggleGame() {
    initAudio();
    const btn = document.getElementById('start-btn');

    if (isPlaying) {
        isPlaying = false;
        isAcceptingInput = false;
        clearAllTimeouts();
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

    sequence.push(Math.floor(Math.random() * currentColorCount));
    setTrackedTimeout(playSequence, 800);
}

async function playSequence() {
    for (let i = 0; i < sequence.length; i++) {
        if (!isPlaying) return;

        await new Promise(resolve => setTrackedTimeout(resolve, 150));
        if (!isPlaying) return;

        activatePad(sequence[i], 500);
        await new Promise(resolve => setTrackedTimeout(resolve, 500));
    }
    if (isPlaying) isAcceptingInput = true;
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

    activatePad(index, 300);

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

function gameOver() {
    isPlaying = false;
    isAcceptingInput = false;
    clearAllTimeouts();

    const btn = document.getElementById('start-btn');
    btn.textContent = 'JOGAR';
    btn.classList.remove('stop');

    if (isSoundEnabled) {
        isSoundEnabled = false;
        playTone(1, 1000);
        setTimeout(() => { isSoundEnabled = true; }, 1000);
    }

    if (currentUser && score > currentUser.bestScore) {
        currentUser.bestScore = score;
        saveUsers();
        updatePlayerUI();
    }

    // Mensagem transparente e clara explicitando o erro do jogador
    document.getElementById('gameover-msg').innerHTML =
        `<span style="font-size: 40px;">❌</span><br><br><strong>Você errou a sequência de cores!</strong><br><br>O teste de memória foi encerrado.<br>Sua pontuação final nesta rodada: <strong>${score}</strong> acertos.`;
    document.getElementById('gameover-overlay').classList.add('show');
}

function closeGameOver() {
    document.getElementById('gameover-overlay').classList.remove('show');
    resetGameStats();
}

window.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    showLoginModal();
});