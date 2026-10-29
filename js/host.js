(function () {
  const app = document.getElementById('app');
  let supabase = null;
  let quizState = null;
  let questions = []; // alle vragen, gesorteerd op volgorde
  let question = null; // huidige vraag
  let players = [];
  let answersForQuestion = [];

  function render(html) {
    app.innerHTML = html;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderNotConfigured() {
    render(`
      <div class="card">
        <h1>Nog niet ingesteld</h1>
        <p>Vul eerst <code>js/config.js</code> in met je Supabase-project-url en anon key, en voer <code>supabase/schema.sql</code> uit in de Supabase SQL editor.</p>
      </div>
    `);
  }

  function joinUrl() {
    return new URL('speler.html', window.location.href).href;
  }

  function renderWachten() {
    const url = joinUrl();
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
    render(`
      <div class="host-scherm wachten">
        <h1>Scan de QR-code om mee te doen</h1>
        <img class="qr" src="${qrSrc}" alt="QR-code om mee te doen" />
        <p class="join-link">${escapeHtml(url)}</p>
        <p class="spelers-teller">${players.length} speler(s) meegedaan</p>
        <button id="start-btn" ${players.length === 0 ? 'disabled' : ''}>Start quiz</button>
      </div>
    `);
    document.getElementById('start-btn').addEventListener('click', startQuiz);
  }

  function renderVraag() {
    const aantalGeantwoord = answersForQuestion.length;
    render(`
      <div class="host-scherm vraag">
        <p class="vraag-nummer">Vraag ${question.volgorde} / ${questions.length}</p>
        <h1>${escapeHtml(question.tekst)}</h1>
        <ul class="opties-lijst">
          ${question.opties.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}
        </ul>
        <p id="countdown" class="countdown"></p>
        <p class="teller">${aantalGeantwoord} / ${players.length} heeft geantwoord</p>
        <button id="onthul-btn">Onthul antwoord</button>
      </div>
    `);
    document.getElementById('onthul-btn').addEventListener('click', onthulAntwoord);
    startCountdown();
  }

  function renderOnthulling() {
    const correct = question.opties[question.correct_index];
    const aantalGoed = answersForQuestion.filter((a) => a.is_correct).length;
    render(`
      <div class="host-scherm onthulling">
        <h1>${escapeHtml(question.tekst)}</h1>
        <p class="correct-antwoord">Juiste antwoord: <strong>${escapeHtml(correct)}</strong></p>
        <p class="teller">${aantalGoed} / ${answersForQuestion.length} had het goed</p>
        <button id="leaderboard-btn">Toon tussenstand</button>
      </div>
    `);
    document.getElementById('leaderboard-btn').addEventListener('click', toonLeaderboard);
  }

  async function renderLeaderboard() {
    const top = await fetchLeaderboard(10);
    const isLaatsteVraag = question.volgorde >= questions.length;
    render(`
      <div class="host-scherm leaderboard">
        <h1>Tussenstand</h1>
        <ol class="leaderboard-lijst">
          ${top
            .map((row) => `<li><span class="naam">${escapeHtml(row.naam)}</span><span class="score">${row.score}</span></li>`)
            .join('')}
        </ol>
        <button id="volgende-btn">${isLaatsteVraag ? 'Quiz afronden' : 'Volgende vraag'}</button>
      </div>
    `);
    document.getElementById('volgende-btn').addEventListener('click', volgendeVraagOfKlaar);
  }

  async function renderKlaar() {
    const top = await fetchLeaderboard(10);
    render(`
      <div class="host-scherm klaar">
        <h1>Eindstand</h1>
        <ol class="leaderboard-lijst">
          ${top
            .map((row) => `<li><span class="naam">${escapeHtml(row.naam)}</span><span class="score">${row.score}</span></li>`)
            .join('')}
        </ol>
        <button id="reset-btn">Nieuwe quiz starten</button>
      </div>
    `);
    document.getElementById('reset-btn').addEventListener('click', resetQuiz);
  }

  let countdownTimer = null;
  function clearCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }
  function startCountdown() {
    clearCountdown();
    const el = document.getElementById('countdown');
    if (!el || !quizState.question_started_at) return;
    const deadline =
      new Date(quizState.question_started_at).getTime() + question.tijdslimiet_sec * 1000;
    function tick() {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      el.textContent = remaining + 's';
      if (remaining <= 0) clearCountdown();
    }
    tick();
    countdownTimer = setInterval(tick, 250);
  }

  async function fetchLeaderboard(limit) {
    const { data: answers } = await supabase.from('answers').select('player_id, punten_behaald');
    const scores = {};
    players.forEach((p) => (scores[p.id] = { player_id: p.id, naam: p.naam, score: 0 }));
    (answers || []).forEach((a) => {
      if (scores[a.player_id]) scores[a.player_id].score += a.punten_behaald;
    });
    return Object.values(scores)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async function startQuiz() {
    const eerste = questions[0];
    await supabase
      .from('quiz_state')
      .update({
        fase: 'vraag',
        current_question_id: eerste.id,
        question_started_at: new Date().toISOString(),
      })
      .eq('id', 1);
  }

  async function onthulAntwoord() {
    await supabase.from('quiz_state').update({ fase: 'onthulling' }).eq('id', 1);
  }

  async function toonLeaderboard() {
    await supabase.from('quiz_state').update({ fase: 'leaderboard' }).eq('id', 1);
  }

  async function volgendeVraagOfKlaar() {
    const volgende = questions.find((q) => q.volgorde === question.volgorde + 1);
    if (volgende) {
      await supabase
        .from('quiz_state')
        .update({
          fase: 'vraag',
          current_question_id: volgende.id,
          question_started_at: new Date().toISOString(),
        })
        .eq('id', 1);
    } else {
      await supabase.from('quiz_state').update({ fase: 'klaar' }).eq('id', 1);
    }
  }

  async function resetQuiz() {
    if (!confirm('Weet je zeker dat je een nieuwe quiz wilt starten? Dit wist geen spelers/scores, maar begint opnieuw bij de lobby.')) return;
    await supabase
      .from('quiz_state')
      .update({ fase: 'wachten', current_question_id: null, question_started_at: null })
      .eq('id', 1);
  }

  async function loadQuestions() {
    const { data } = await supabase.from('questions').select('*').order('volgorde');
    questions = data || [];
  }

  async function loadPlayers() {
    const { data } = await supabase.from('players').select('id, naam').order('created_at');
    players = data || [];
  }

  async function loadAnswersForQuestion(questionId) {
    if (!questionId) {
      answersForQuestion = [];
      return;
    }
    const { data } = await supabase.from('answers').select('*').eq('question_id', questionId);
    answersForQuestion = data || [];
  }

  async function refreshAndRender() {
    const { data: state } = await supabase.from('quiz_state').select('*').eq('id', 1).single();
    quizState = state;
    await loadPlayers();

    if (quizState.current_question_id) {
      question = questions.find((q) => q.id === quizState.current_question_id) || null;
      await loadAnswersForQuestion(quizState.current_question_id);
    } else {
      question = null;
      answersForQuestion = [];
    }

    renderCurrentState();
  }

  function renderCurrentState() {
    switch (quizState.fase) {
      case 'wachten':
        return renderWachten();
      case 'vraag':
        return renderVraag();
      case 'onthulling':
        return renderOnthulling();
      case 'leaderboard':
        return renderLeaderboard();
      case 'klaar':
        return renderKlaar();
      default:
        return renderWachten();
    }
  }

  function subscribeRealtime() {
    supabase
      .channel('host_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_state' }, refreshAndRender)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, refreshAndRender)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, refreshAndRender)
      .subscribe();
  }

  async function init() {
    if (window.QUIZ_NOT_CONFIGURED) {
      renderNotConfigured();
      return;
    }
    supabase = window.getSupabaseClient();
    await loadQuestions();
    await refreshAndRender();
    subscribeRealtime();
  }

  init();
})();
