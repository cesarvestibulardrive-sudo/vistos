// ============================================================
// Indicador de status e ponto de entrada após login autorizado
// ============================================================

const statusEl = document.getElementById("status-conexao");

function atualizarStatusRede() {
  if (navigator.onLine) {
    statusEl.textContent = "Online";
    statusEl.className = "status online";
  } else {
    statusEl.textContent = "Offline (alterações serão sincronizadas ao reconectar)";
    statusEl.className = "status offline";
  }
}
window.addEventListener("online", atualizarStatusRede);
window.addEventListener("offline", atualizarStatusRede);
atualizarStatusRede();

// Indicador simples de sincronização pendente com o Firestore
db.collection("_ping").doc("status").onSnapshot(
  { includeMetadataChanges: true },
  (doc) => {
    if (!navigator.onLine) return;
    if (doc.metadata.hasPendingWrites) {
      statusEl.textContent = "Sincronizando…";
      statusEl.className = "status sincronizando";
    } else {
      atualizarStatusRede();
    }
  },
  () => {
    // Documento/coleção ainda não existe — normal no início, ignorar.
  }
);

// Modo escuro — persiste a escolha em localStorage (só uma preferência
// de exibição, não dado do app; segue funcionando offline).
const btnTema = document.getElementById("btn-tema");
function aplicarTemaSalvo() {
  const tema = localStorage.getItem("vistos-tema") || "claro";
  document.documentElement.setAttribute("data-tema", tema);
  if (btnTema) btnTema.textContent = tema === "escuro" ? "☀️" : "🌙";
  // Bootstrap (instalado só dentro do Visto) segue o mesmo tema do app.
  const painelVistoEl = document.getElementById("painel-visto");
  if (painelVistoEl) {
    painelVistoEl.setAttribute("data-bs-theme", tema === "escuro" ? "dark" : "light");
  }
  // A cor da barra de status do celular/PWA instalado também acompanha —
  // sem isso ela ficava sempre na cor do modo claro, mesmo trocando pro
  // modo escuro dentro do app.
  const metaTema = document.querySelector('meta[name="theme-color"]');
  if (metaTema) metaTema.setAttribute("content", tema === "escuro" ? "#0d1115" : "#1b2430");
}
btnTema.addEventListener("click", () => {
  const atual = document.documentElement.getAttribute("data-tema") === "escuro" ? "claro" : "escuro";
  localStorage.setItem("vistos-tema", atual);
  aplicarTemaSalvo();
});
aplicarTemaSalvo();

// Registro do Service Worker (funcionamento offline do site em si)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Falha ao registrar Service Worker:", err);
    });
  });
}

// Troca de abas (Turmas / Visto / Ocorrências / Seminário / Relatório)
document.querySelectorAll(".aba").forEach((botao) => {
  botao.addEventListener("click", () => {
    if (botao.disabled) return;
    document.querySelectorAll(".aba").forEach((b) => b.classList.remove("ativa"));
    botao.classList.add("ativa");
    document.querySelectorAll(".painel-aba").forEach((p) => (p.style.display = "none"));
    const painel = document.getElementById("painel-" + botao.dataset.aba);
    if (painel) painel.style.display = "";

    if (botao.dataset.aba === "visto" && typeof initVisto === "function") {
      initVisto();
    }
    if (botao.dataset.aba === "chamada" && typeof initChamada === "function") {
      initChamada();
    }
    if (botao.dataset.aba === "ocorrencia" && typeof initOcorrencia === "function") {
      initOcorrencia();
    }
    if (botao.dataset.aba === "seminario" && typeof initSeminario === "function") {
      initSeminario();
    }
    if (botao.dataset.aba === "relatorio" && typeof initPesos === "function") {
      initPesos();
    }
    if (botao.dataset.aba === "admin" && typeof initAdmin === "function") {
      initAdmin();
    }
  });
});

// Chamado pelo auth.js assim que o login autorizado é confirmado.
function onLoginAutorizado(user) {
  console.log("Login autorizado:", user.email);
  initTurmas();
}
