// ============================================================
// Usuários e papéis — carregado logo depois do auth.js, antes de
// todos os outros módulos, porque eles consultam estadoUsuarioAtual
// pra saber o que mostrar/permitir (ex: aba "Admin" só aparece pra
// Webmaster).
//
// Papéis possíveis: professor, coordenacao, direcao, webmaster. Um
// mesmo usuário pode ter mais de um papel ao mesmo tempo.
//
// EMAIL_AUTORIZADO (ver js/firebase-config.js) é o Webmaster
// principal: tem acesso total a tudo sempre, mesmo sem nenhum
// documento em "usuarios" — é quem nunca pode ficar trancado para
// fora do próprio sistema que administra.
// ============================================================

const estadoUsuarioAtual = {
  email: null,
  nome: null,
  papeis: {},             // { professor, coordenacao, direcao, webmaster }
  escolasPermitidas: [],  // [escolaId, ...]
  carregado: false,
};

const estadoEscolas = {
  escolas: [], // [{id, nome}]
};

let unsubEscolas = null;

function temPapel(papel) {
  return !!(estadoUsuarioAtual.papeis && estadoUsuarioAtual.papeis[papel]);
}

function eWebmaster() {
  return estadoUsuarioAtual.email === EMAIL_AUTORIZADO || temPapel("webmaster");
}

function podeAcessarEscola(escolaId) {
  if (eWebmaster()) return true;
  if (!escolaId) return false;
  return (estadoUsuarioAtual.escolasPermitidas || []).includes(escolaId);
}

function nomeDaEscola(escolaId) {
  const e = estadoEscolas.escolas.find((x) => x.id === escolaId);
  return e ? e.nome : "";
}

function rotuloPapel(p) {
  return { webmaster: "Webmaster", direcao: "Direção", coordenacao: "Coordenação", professor: "Professor" }[p] || p;
}

// Carrega o papel do usuário logado a partir de usuarios/{email}.
// Retorna true se a conta pode usar o sistema, false se o acesso deve
// ser negado (sem documento em "usuarios", ou documento marcado como
// inativo) — exceto para EMAIL_AUTORIZADO, que sempre entra.
async function carregarUsuarioAtual(user) {
  estadoUsuarioAtual.email = user.email;
  estadoUsuarioAtual.nome = user.displayName || user.email;

  if (user.email === EMAIL_AUTORIZADO) {
    estadoUsuarioAtual.papeis = { webmaster: true, direcao: true, coordenacao: true, professor: true };
    estadoUsuarioAtual.escolasPermitidas = estadoEscolas.escolas.map((e) => e.id);
    estadoUsuarioAtual.carregado = true;
    return true;
  }

  try {
    const doc = await db.collection("usuarios").doc(user.email).get();
    if (!doc.exists || doc.data().ativo === false) {
      estadoUsuarioAtual.carregado = false;
      return false;
    }
    const dados = doc.data();
    estadoUsuarioAtual.papeis = dados.papeis || {};
    estadoUsuarioAtual.escolasPermitidas = dados.escolasPermitidas || [];
    estadoUsuarioAtual.carregado = true;
    return true;
  } catch (err) {
    console.error("Erro ao carregar usuário:", err);
    estadoUsuarioAtual.carregado = false;
    return false;
  }
}

// Mantém a lista de escolas em memória, já filtrada pelas regras de
// segurança (cada usuário só recebe as escolas que pode acessar).
function iniciarListenerEscolas() {
  if (unsubEscolas) unsubEscolas();
  unsubEscolas = db.collection("escolas").orderBy("nome").onSnapshot(
    (snap) => {
      estadoEscolas.escolas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (estadoUsuarioAtual.email === EMAIL_AUTORIZADO) {
        estadoUsuarioAtual.escolasPermitidas = estadoEscolas.escolas.map((e) => e.id);
      }
      if (typeof renderAdmin === "function" && document.getElementById("painel-admin") && document.getElementById("painel-admin").innerHTML) {
        renderAdmin();
      }
    },
    (err) => console.warn("Não foi possível carregar a lista de escolas:", err)
  );
}

// Mostra/esconde a aba "Admin" conforme o papel de quem está logado.
function aplicarVisibilidadePapeis() {
  const btnAdmin = document.querySelector('.aba[data-aba="admin"]');
  if (btnAdmin) btnAdmin.style.display = eWebmaster() ? "" : "none";
}
