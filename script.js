// --- GLOBALE VARIABLEN ---
let allQuestions = [], activeData = [], currentIdx = 0;
let stats = { correct: 0, wrong: 0 };
let sessionErrorPool = [], sessionUsedIds = new Set(), examWrongAnswers = [];
let isProcessing = false;

// Zeit-Variablen
let timerSeconds = 0, questionCountInBlock = 0;
let totalBlocks = parseInt(localStorage.getItem('fischer_total_blocks')) || 0;
let totalTimeAllBlocks = parseInt(localStorage.getItem('fischer_total_time')) || 0;
let timerInterval = null;

let errorList = JSON.parse(localStorage.getItem('fischer_errors')) || [];
let leaderboard = JSON.parse(localStorage.getItem('fischer_leaderboard')) || [];
let isExamMode = false;

// --- VOLLSTÄNDIGE SPECIES DATABASE ---
const speciesDatabase = {
    "Bachforelle": { maß: "26 cm", zeit: "01.10. – 15.03." },
    "Äsche": { maß: "35 cm", zeit: "01.01. – 30.04." },
    "Huchen": { maß: "90 cm", zeit: "15.02. – 30.06." },
    "Hecht": { maß: "50 cm", zeit: "15.02. – 30.04." },
    "Zander": { maß: "50 cm", zeit: "15.02. – 30.04." },
    "Barbe": { maß: "-", zeit: "01.05. – 30.06." },
    "Seeforelle": { maß: "-", zeit: "01.10. – 15.03." },
    "Renke": { maß: "-", zeit: "15.10. – 31.12." },
    "Felchen": { maß: "-", zeit: "15.10. – 31.12." },
    "Karpfen": { maß: "35 cm", zeit: "-" },
    "Seesaibling": { maß: "30 cm", zeit: "-" },
    "Schleie": { maß: "30 cm", zeit: "-" },
    "Edelkrebs": { maß: "12 cm", zeit: "01.08. – 31.07." },
    "Nerfling": { maß: "30 cm", zeit: "-" },
    "Aland": { maß: "30 cm", zeit: "-" },
    "Dreistachliger Stichling": { maß: "geschont", zeit: "ganzjährig" },
    "Stichling": { maß: "geschont", zeit: "ganzjährig" },
    "Bitterling": { maß: "geschont", zeit: "ganzjährig" },
    "Schlammpeitzger": { maß: "geschont", zeit: "ganzjährig" },
    "Steinbeißer": { maß: "geschont", zeit: "ganzjährig" },
    "Dorngrundel": { maß: "geschont", zeit: "ganzjährig" },
    "Kaulbarsch": { maß: "geschont", zeit: "ganzjährig" },
    "Mairenke": { maß: "geschont", zeit: "ganzjährig" },
    "Seelaube": { maß: "geschont", zeit: "ganzjährig" },
    "Maifisch": { maß: "geschont", zeit: "ganzjährig" },
    "Atlantischer Lachs": { maß: "geschont", zeit: "ganzjährig" },
    "Lachs": { maß: "geschont", zeit: "ganzjährig" },
    "Schied": { maß: "geschont", zeit: "ganzjährig" },
    "Rapfen": { maß: "geschont", zeit: "ganzjährig" },
    "Zährte": { maß: "geschont", zeit: "ganzjährig" },
    "Seerüßling": { maß: "geschont", zeit: "ganzjährig" },
    "Strömer": { maß: "geschont", zeit: "ganzjährig" },
    "Schneider": { maß: "geschont", zeit: "ganzjährig" },
    "Zingel": { maß: "geschont", zeit: "ganzjährig" },
    "Streber": { maß: "geschont", zeit: "ganzjährig" },
    "Zope": { maß: "geschont", zeit: "ganzjährig" },
    "Schrätzer": { maß: "geschont", zeit: "ganzjährig" },
    "Malermuschel": { maß: "geschont", zeit: "ganzjährig" },
    "Große Flussmuschel": { maß: "geschont", zeit: "ganzjährig" }
};

// --- HILFSFUNKTIONEN ---
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function updateProgressBar() {
    const bar = document.getElementById('progress-bar');
    if (bar && activeData.length > 0) {
        const progress = (currentIdx / activeData.length) * 100;
        bar.style.width = progress + "%";
    }
}

function updateStatsUI() {
    safeSetText('count-correct', stats.correct);
    safeSetText('count-wrong', stats.wrong);
    const total = stats.correct + stats.wrong;
    const rate = total === 0 ? 100 : Math.round((stats.correct / total) * 100);
    const rateEl = document.getElementById('success-rate');
    if (rateEl) {
        rateEl.innerText = rate;
        rateEl.classList.remove('rate-green', 'rate-yellow', 'rate-red');
        if (total > 0) {
            if (rate >= 90) rateEl.classList.add('rate-green');
            else if (rate >= 75) rateEl.classList.add('rate-yellow');
            else rateEl.classList.add('rate-red');
        }
    }
}

// --- TIMER ---
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timerSeconds++;
        const mins = Math.floor(timerSeconds / 60);
        const secs = timerSeconds % 60;
        safeSetText('timer-display', `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        updateLiveAverage();
    }, 1000);
}

function updateLiveAverage() {
    if (questionCountInBlock === 0) return;
    const projected = (timerSeconds / questionCountInBlock) * 60;
    safeSetText('live-average-display', `${Math.floor(projected/60).toString().padStart(2,'0')}:${Math.floor(projected%60).toString().padStart(2,'0')}`);
}

// --- DATA ---
fetch('MMM Fischerpruefung.txt').then(res => res.text()).then(text => { 
    allQuestions = parseText(text); 
    safeSetText('error-count', errorList.length);
});

function parseText(text) {
    const seenIds = new Set();
    return text.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#')).map(line => {
        const parts = line.split('\t');
        if (parts.length < 2) return null;
        const idMatch = parts[0].match(/^(\d+\.\d+)/);
        if (!idMatch || seenIds.has(idMatch[0])) return null;
        seenIds.add(idMatch[0]);
        const cat = idMatch[0].split('.')[0];
        const cols = parts[0].replace(idMatch[0], '').trim().split(/\s{2,}/);
        return { id: idMatch[0], category: cat, question: cols[0], options: cols.slice(1, 4), answer: parts.pop().trim() };
    }).filter(q => q && q.options.length === 3);
}

// --- LOGIK ---
function startExam(onlyErrors = false) {
    isExamMode = true; stats = { correct: 0, wrong: 0 }; questionCountInBlock = 0; timerSeconds = 0;
    activeData = [];
    if (onlyErrors && sessionErrorPool.length > 0) {
        activeData = [...sessionErrorPool];
    } else {
        for (let cat = 1; cat <= 5; cat++) {
            let catQ = allQuestions.filter(q => q.category == cat);
            let avail = catQ.filter(q => !sessionUsedIds.has(q.id));
            if (avail.length < 12) { catQ.forEach(q => sessionUsedIds.delete(q.id)); avail = catQ; }
            avail.sort(() => Math.random() - 0.5).slice(0, 12).forEach(q => { sessionUsedIds.add(q.id); activeData.push(q); });
        }
    }
    activeData.sort(() => Math.random() - 0.5);
    initQuiz();
}

function startQuiz(mode) {
    isExamMode = false; stats = { correct: 0, wrong: 0 }; questionCountInBlock = 0; timerSeconds = 0;
    activeData = (mode === 'errors') ? [...errorList] : [...allQuestions];
    activeData.sort(() => Math.random() - 0.5);
    initQuiz();
}

function initQuiz() {
    currentIdx = 0;
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    prepareUIForQuiz();
    startTimer();
    showQuestion();
}

function prepareUIForQuiz() {
    const container = document.getElementById('quiz-container');
    if (!container) return;
    container.innerHTML = `
        <div id="progress-container" style="width: 100%; background: #444; height: 12px; border-radius: 6px; margin-bottom: 20px; overflow: hidden; border: 1px solid #555;">
            <div id="progress-bar" style="width: 0%; height: 100%; background: var(--yellow); transition: width 0.4s ease;"></div>
        </div>
        <h2 id="question">Lade...</h2>
        <div id="options"></div>
        <div id="history-container"></div>
        <div id="species-info-container"></div>
    `;
}

function showQuestion() {
    isProcessing = false;
    updateProgressBar();
    if (currentIdx >= activeData.length) {
        clearInterval(timerInterval);
        if (isExamMode) showExamResults(); else location.reload();
        return;
    }
    const q = activeData[currentIdx];
    safeSetText('question', `Frage ${q.id}: ${q.question}`);
    safeSetText('count-remaining', activeData.length - currentIdx);
    displaySpeciesInfo(q.question + " " + q.options.join(" "));

    const optEl = document.getElementById('options');
    optEl.innerHTML = '';
    ['A', 'B', 'C'].forEach((label, i) => {
        const btn = document.createElement('button');
        btn.innerText = `${label}: ${q.options[i]}`;
        btn.onclick = () => checkAnswer(label, btn);
        optEl.appendChild(btn);
    });
}

function checkAnswer(selectedLetter, btn) {
    if (isProcessing) return;
    isProcessing = true;
    const q = activeData[currentIdx];
    const isCorrect = (selectedLetter === q.answer.trim());
    const delay = isCorrect ? 750 : 1500;

    if (isCorrect) {
        btn.classList.add('correct');
        stats.correct++;
        errorList = errorList.filter(e => e.id !== q.id);
    } else {
        btn.classList.add('wrong');
        stats.wrong++;
        if (!errorList.find(e => e.id === q.id)) errorList.push(q);
        if (!sessionErrorPool.find(e => e.id === q.id)) { sessionErrorPool.push(q); updateErrorSidebar(); }
    }

    // UPDATE HISTORY: Hier bleibt der Text stehen, bis die nächste Antwort getippt wird
    const histEl = document.getElementById('history-container');
    if (histEl) {
        histEl.innerHTML = `
            <div style="margin-top:20px; padding:15px; border-radius:8px; background: rgba(255,255,255,0.05); border: 1px solid ${isCorrect ? 'var(--green)' : 'var(--orange)'};">
                <p style="margin:0; font-size: 0.8rem; color: #888;">Letztes Ergebnis (Frage ${q.id}):</p>
                <p style="margin:5px 0; font-weight: bold;">${isCorrect ? '✅ Richtig' : '❌ Falsch'}</p>
                ${!isCorrect ? `<p style="margin:0; color:var(--yellow); font-size: 0.95rem;">Richtig war: ${q.options[['A','B','C'].indexOf(q.answer.trim())]}</p>` : ''}
            </div>
        `;
    }

    localStorage.setItem('fischer_errors', JSON.stringify(errorList));
    questionCountInBlock++;
    updateStatsUI();

    setTimeout(() => {
        currentIdx++;
        showQuestion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, delay);
}

function displaySpeciesInfo(text) {
    const container = document.getElementById('species-info-container');
    if (!container) return;
    container.innerHTML = '';
    const low = text.toLowerCase();
    Object.keys(speciesDatabase).forEach(f => {
        if (low.includes(f.toLowerCase())) {
            const d = speciesDatabase[f];
            container.innerHTML += `<div class="species-box"><strong>${f}</strong>: Maß: ${d.maß} | Zeit: ${d.zeit}</div>`;
        }
    });
}

function updateErrorSidebar() {
    const list = document.getElementById('session-error-list');
    if (list) list.innerHTML = sessionErrorPool.map(e => `<div class="session-error-item"><span class="session-error-id">${e.id}</span> ${e.question.substring(0,30)}...</div>`).join('');
}

function showExamResults() {
    const container = document.getElementById('quiz-container');
    container.innerHTML = `<h2>Prüfung beendet!</h2><p>${stats.correct} Richtig / ${stats.wrong} Falsch</p>
    <button onclick="startExam()">Nächste Prüfung</button><button onclick="startExam(true)" style="background:var(--orange)">Fehler wiederholen</button>`;
}

function exportErrors() {
    const blob = new Blob([JSON.stringify(errorList, null, 2)], {type: 'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Fehlerliste.txt';
    a.click();
}

document.addEventListener('keydown', (e) => {
    if (e.key === '0') startExam();
    const btns = document.querySelectorAll('#options button');
    if (e.key >= '1' && e.key <= '3' && btns.length > 0) btns[parseInt(e.key) - 1].click();
});

document.addEventListener('DOMContentLoaded', () => {
    const b1 = document.getElementById('btn-start-exam');
    const b2 = document.getElementById('btn-start-all');
    const b3 = document.getElementById('btn-start-errors');

    if (b1) b1.addEventListener('click', () => startExam());
    if (b2) b2.addEventListener('click', () => startQuiz('all'));
    if (b3) b3.addEventListener('click', () => startQuiz('errors'));
});