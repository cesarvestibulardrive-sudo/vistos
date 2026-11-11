// ============================================================
// Autenticação: login Google + carregamento do papel do usuário
// (ver js/usuarios.js para o que cada papel pode fazer).
// ============================================================

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Persistência offline do Firestore (cache local)
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Persistência offline: várias abas abertas, cache ativo em apenas uma.");
  } else if (err.code === "unimplemented") {
    console.warn("Este navegador não suporta persistência offline do Firestore.");
  }
});

const telaLogin = document.getElementById("tela-login");
const telaNegado = document.getElementById("tela-negado");
const telaApp = document.getElementById("tela-app");
const btnLogin = document.getElementById("btn-login-google");
const btnLogout = document.getElementById("btn-logout");
const btnLogoutNegado = document.getElementById("btn-logout-negado");

function mostrarTela(tela) {
  [telaLogin, telaNegado, telaApp].forEach((t) => t.classList.add("escondido"));
  tela.classList.remove("escondido");
}

btnLogin.addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((err) => {
    console.error("Erro no login:", err);
    alert("Não foi possível entrar. Verifique sua conexão e tente novamente.");
  });
});

function sair() {
  auth.signOut();
}
btnLogout.addEventListener("click", sair);
btnLogoutNegado.addEventListener("click", sair);

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    mostrarTela(telaLogin);
    return;
  }

  if (!user.emailVerified) {
    mostrarTela(telaNegado);
    return;
  }

  iniciarListenerEscolas();
  const autorizado = await carregarUsuarioAtual(user);

  if (!autorizado) {
    mostrarTela(telaNegado);
    return;
  }

  mostrarTela(telaApp);
  const nomeEl = document.getElementById("usuario-nome");
  if (nomeEl) nomeEl.textContent = user.displayName || user.email;

  aplicarVisibilidadePapeis();

  if (typeof onLoginAutorizado === "function") {
    onLoginAutorizado(user);
  }
});
