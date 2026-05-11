// Cliente Supabase compartilhado entre todas as páginas.
// As chaves abaixo são "publishable" — feitas pra exposição no browser.
// Toda segurança vem das policies RLS no banco.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const SUPABASE_URL = 'https://htaihtmpnwzyxamkhnty.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_cld9ukkeynLD15lgf47G7g_XT3uNnYS';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'innova-auth',
  },
});

// Expõe globalmente pra scripts não-módulos (sidebar.js etc)
window.supabase = supabase;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Helpers públicos
window.innovaAuth = {
  async getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },
  async signOut() {
    // Timeout de 5s — se a rede oscilar e a resposta do signOut não voltar,
    // limpa storage manualmente e redireciona mesmo assim. O usuário não fica
    // preso "clicando em Sair sem nada acontecer".
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('signOut timeout')), 5000)),
      ]);
    } catch (e) {
      console.warn('[signOut] timeout/erro, limpando storage local e seguindo:', e.message);
      try { localStorage.removeItem('innova-auth'); } catch {}
    }
    location.href = 'login.html';
  },
  onChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => callback(session?.user || null, event));
  },
};

// Notifica scripts não-módulos que carregaram
document.dispatchEvent(new CustomEvent('supabase-ready'));

// Helper pra esperar o cliente em outros scripts
window.whenSupabaseReady = (cb) => {
  if (window.supabase) cb(window.supabase);
  else document.addEventListener('supabase-ready', () => cb(window.supabase), { once: true });
};
