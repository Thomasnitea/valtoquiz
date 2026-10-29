(function () {
  const STORAGE_KEY = 'valtoQuizPlayer';
  const app = document.getElementById('app');

  let supabase = null;
  let player = null; // { id, naam }
  let quizState = null; // { fase, current_question_id, question_started_at }
  let question = null; // currently active question row
  let myAnswer = null; // answer row for the current question, if any
  let countdownTimer = null;

  function loadStoredPlayer() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function storePlayer(p) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }

  function render(html) {
    app.innerHTML = html;
  }

  function renderNotConfigured() {
    render(`
      <div class="card">
        <h1>Nog niet ingesteld</h1>
        <p>Vul eerst <code>js/config.js</code> in met je Supabase-project-url en anon key.</p>
      </div>
    `);
  }

  function renderJoinForm(errorMsg) {
    render(`
      <div class="card">
        <h1>Doe mee met de quiz</h1>
        <form id="join-form">
          <label for="naam">Jouw naam</label>
          <input id="naam" name="naam" type="text" maxlength="30" autocomplete="off" required />
          <button type="submit">Meedoen</button>
        </form>
        ${errorMsg ? `<p class="error">${errorMsg}</p>` : ''}
      </div>
    `);
    document.getElementById('join-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const naam = document.getElementById('naam').value.trim();
      if (!naam) return;
      const { data, error } = await supabase
        .from('players')
        .insert({ naam })
        .select()
        .single();
      if (error) {
        renderJoinForm('Kon niet meedoen, probeer het opnieuw.');
        return;
      }
      player = { id: data.id, naam: data.naam };
      storePlayer(player);
      await refreshAndRender();
    });
  }

  function renderWachten() {
    render(`
      <div class="card">
        <h1>Welkom, ${escapeHtml(player.naam)}!</h1>
        <p>Je doet mee. Wacht tot de presentator de quiz start&hellip;</p>
      </div>
    `);
  }

  function renderVraag() {
    clearCountdown();
    const opties = question.opties;
    render(`
      <div class="card">
        <p class="vraag-nummer">Vraag ${question.volgorde}</p>
        <h1>${escapeHtml(question.tekst)}</h1>
        <p id="countdown" class="countdown"></p>
        <div class="opties">
          ${opties
            .map(
              (optie, i) =>
                `<button class="optie-knop optie-${i}" data-index="${i}">${escapeHtml(optie)}</button>`
            )
            .join('')}
        </div>
      </div>
    `);
    document.querySelectorAll('.optie-knop').forEach((btn) => {
      btn.addEventListener('click', () => submitAnswer(Number(btn.dataset.index)));
    });
    startCountdown();
  }

  function renderVerzonden() {
    clearCountdown();
    render(`
      <div class="card">
        <h1>Antwoord verzonden!</h1>
        <p>Wachten tot iedereen heeft geantwoord&hellip;</p>
      </div>
    `);
  }

  function renderTijdOm() {
    clearCountdown();
    render(`
      <div class="card">
        <h1>Tijd is om</h1>
        <p>Je hebt niet op tijd geantwoord. Wachten op de presentator&hellip;</p>
      </div>
    `);
  }

  function renderOnthulling() {
    clearCountdown();
    const correct = question.opties[question.correct_index];
    let feedback;
    if (!myAnswer) {
      feedback = `<p class="feedback fout">Je hebt niet geantwoord.</p>`;
    } else if (myAnswer.is_correct) {
      feedback = `<p class="feedback goed">Goed zo! +${myAnswer.punten_behaald} punten</p>`;
    } else {
      feedback = `<p class="feedback fout">Helaas, dat was niet goed.</p>`;
    }
    render(`
      <div class="card">
        <h1>${escapeHtml(question.tekst)}</h1>
        <p class="correct-antwoord">Juiste antwoord: <strong>${escapeHtml(correct)}</strong></p>
        ${feedback}
      </div>
    `);
  }

  async function renderLeaderboard() {
    const top = await fetchLeaderboard(10);
    render(`
      <div class="card">
        <h1>Tussenstand</h1>
        <ol class="leaderboard">
          ${top
            .map(
              (row) =>
                `<li class="${row.player_id === player.id ? 'eigen-score' : ''}">
                  <span class="naam">${escapeHtml(row.naam)}</span>
                  <span class="score">${row.score}</span>
                </li>`
            )
            .join('')}
        </ol>
      </div>
    `);
  }

  function renderKlaar() {
    render(`
      <div class="card">
        <h1>Bedankt voor het meespelen!</h1>
        <p>De quiz is afgelopen.</p>
      </div>
    `);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function clearCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function startCountdown() {
    const el = document.getElementById('countdown');
    if (!el || !quizState.question_started_at || !question) return;
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

  async function submitAnswer(index) {
    if (myAnswer) return; // al geantwoord
    const isCorrect = index === question.correct_index;
    const punten = isCorrect ? question.punten : 0;
    const { data, error } = await supabase
      .from('answers')
      .insert({
        player_id: player.id,
        question_id: question.id,
        gekozen_index: index,
        is_correct: isCorrect,
        punten_behaald: punten,
      })
      .select()
      .single();
    if (!error) {
      myAnswer = data;
      renderVerzonden();
    }
  }

  async function fetchLeaderboard(limit) {
    const { data: players } = await supabase.from('players').select('id, naam');
    const { data: answers } = await supabase.from('answers').select('player_id, punten_behaald');
    const scores = {};
    (players || []).forEach((p) => (scores[p.id] = { player_id: p.id, naam: p.naam, score: 0 }));
    (answers || []).forEach((a) => {
      if (scores[a.player_id]) scores[a.player_id].score += a.punten_behaald;
    });
    return Object.values(scores)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async function fetchQuestion(id) {
    const { data } = await supabase.from('questions').select('*').eq('id', id).single();
    return data;
  }

  async function fetchMyAnswer(questionId) {
    const { data } = await supabase
      .from('answers')
      .select('*')
      .eq('player_id', player.id)
      .eq('question_id', questionId)
      .maybeSingle();
    return data || null;
  }

  async function refreshAndRender() {
    const { data: state } = await supabase.from('quiz_state').select('*').eq('id', 1).single();
    quizState = state;

    if (quizState.current_question_id) {
      question = await fetchQuestion(quizState.current_question_id);
      myAnswer = player ? await fetchMyAnswer(quizState.current_question_id) : null;
    } else {
      question = null;
      myAnswer = null;
    }

    renderCurrentState();
  }

  function renderCurrentState() {
    if (!player) return renderJoinForm();
    switch (quizState.fase) {
      case 'wachten':
        return renderWachten();
      case 'vraag': {
        const deadlinePassed =
          quizState.question_started_at &&
          Date.now() >
            new Date(quizState.question_started_at).getTime() + question.tijdslimiet_sec * 1000;
        if (myAnswer) return renderVerzonden();
        if (deadlinePassed) return renderTijdOm();
        return renderVraag();
      }
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
      .channel('quiz_state_speler')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_state' },
        async () => {
          await refreshAndRender();
        }
      )
      .subscribe();
  }

  async function init() {
    if (window.QUIZ_NOT_CONFIGURED) {
      renderNotConfigured();
      return;
    }
    supabase = window.getSupabaseClient();
    player = loadStoredPlayer();
    await refreshAndRender();
    subscribeRealtime();
  }

  init();
})();
