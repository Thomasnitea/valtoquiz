// Gedeelde Supabase-client, gebruikt door zowel host.js als speler.js.
(function () {
  const cfg = window.QUIZ_CONFIG || {};
  const notConfigured =
    !cfg.supabaseUrl ||
    !cfg.supabaseAnonKey ||
    cfg.supabaseUrl.includes('JOUW-PROJECT') ||
    cfg.supabaseAnonKey.includes('JOUW-ANON-KEY');

  window.QUIZ_NOT_CONFIGURED = notConfigured;

  window.getSupabaseClient = function () {
    if (notConfigured) return null;
    if (!window._quizSupabaseClient) {
      window._quizSupabaseClient = window.supabase.createClient(
        cfg.supabaseUrl,
        cfg.supabaseAnonKey
      );
    }
    return window._quizSupabaseClient;
  };
})();
