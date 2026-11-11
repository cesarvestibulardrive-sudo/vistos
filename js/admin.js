// ============================================================
// Etapa de papéis — Administração (só o Webmaster vê esta aba)
//
// Cadastro de escolas e de usuários (e-mail → papéis → escolas que
// pode acessar). As telas de Coordenação/Direção (pesos, simulados,
// recuperação, aviso aos pais) vêm em etapas futuras — aqui é só a
// base: quem existe no sistema e o que cada um pode acessar.
// ============================================================

const painelAdmin = document.getElementById("painel-admin");

const estadoAdmin = {
  usuarios: [], // [{id, email, papeis, escolasPermitidas, ativo}]
};

let unsubUsuariosAdmin = null;

function initAdmin() {
  if (!eWebmaster()) {
    painelAdmin.innerHTML = `<p class="vazio-aviso">Acesso restrito ao Webmaster.</p>`;
    return;
  }

  if (unsubUsuariosAdmin) unsubUsuariosAdmin();
  unsubUsuariosAdmin = db.collection("usuarios").orderBy("email").onSnapshot(
    (snap) => {
      estadoAdmin.usuarios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAdmin();
    },
    (err) => console.warn("Não foi possível carregar usuários:", err)
  );

  renderAdmin();
}

function renderAdmin() {
  if (!painelAdmin || !eWebmaster()) return;

  let html = `
    <div class="coluna-titulo">
      <h2>Escolas</h2>
      <button class="btn-add" onclick="abrirFormEscola()">+ Nova escola</button>
    </div>
  `;

  if (estadoEscolas.escolas.length === 0) {
    html += `<p class="vazio-aviso">Nenhuma escola cadastrada ainda.</p>`;
  } else {
    html += `<div class="lista-cartoes">`;
    estadoEscolas.escolas.forEach((e) => {
      html += `
        <div class="item-cartao" style="cursor:default;">
          <span class="nome-item">${escaparHtml(e.nome)}</span>
          <span class="acoes-item">
            <button onclick="abrirFormEscola('${e.id}')" title="Editar">✎</button>
            <button onclick="confirmarExclusaoEscola('${e.id}')" title="Excluir">🗑</button>
          </span>
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `
    <div class="coluna-titulo" style="margin-top:24px;">
      <h2>Usuários</h2>
      <button class="btn-add" onclick="abrirFormUsuario()">+ Novo usuário</button>
    </div>
  `;

  if (estadoAdmin.usuarios.length === 0) {
    html += `<p class="vazio-aviso">Nenhum usuário cadastrado ainda (além de você).</p>`;
  } else {
    html += `<div class="lista-cartoes">`;
    estadoAdmin.usuarios.forEach((u) => {
      const papeisAtivos = Object.keys(u.papeis || {}).filter((p) => u.papeis[p]);
      const nomesEscolas = (u.escolasPermitidas || []).map((id) => nomeDaEscola(id) || "(escola removida)").join(", ");
      html += `
        <div class="item-cartao" style="cursor:default; flex-direction:column; align-items:stretch; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="nome-item">${escaparHtml(u.email)}${u.ativo === false ? ' <span class="subinfo-item">(inativo)</span>' : ""}</span>
            <span class="acoes-item">
              <button onclick="abrirFormUsuario('${u.id}')" title="Editar">✎</button>
              <button onclick="confirmarExclusaoUsuario('${u.id}')" title="Excluir">🗑</button>
            </span>
          </div>
          <span class="subinfo-item">${papeisAtivos.map(rotuloPapel).join(", ") || "sem papel"}${nomesEscolas ? " · " + escaparHtml(nomesEscolas) : ""}</span>
        </div>
      `;
    });
    html += `</div>`;
  }

  html += `
    <p style="margin-top:28px; font-size:0.78rem; opacity:0.7;">
      🔧 <a href="#" onclick="event.preventDefault(); executarMigracaoEscolasAntigas();">Vincular turmas antigas às escolas cadastradas</a>
      — roda uma vez só (pode repetir sem problema). Faz as turmas/atividades criadas antes
      desse sistema de papéis passarem a valer para coordenação/direção também, não só para você.
    </p>
  `;

  painelAdmin.innerHTML = html;
}

// ---------- Escolas ----------

function abrirFormEscola(id) {
  const e = id ? estadoEscolas.escolas.find((x) => x.id === id) : null;
  abrirModal(`
    <h3>${e ? "Editar escola" : "Nova escola"}</h3>
    <div class="campo-form">
      <label>Nome da escola</label>
      <input type="text" id="input-nome-escola" value="${e ? escaparHtml(e.nome) : ""}" placeholder="Ex: Colégio DASK" />
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarEscola('${e ? e.id : ""}')">Salvar</button>
    </div>
  `);
  document.getElementById("input-nome-escola").focus();
}

function salvarEscola(id) {
  const nome = document.getElementById("input-nome-escola").value.trim();
  if (!nome) {
    alert("Digite o nome da escola.");
    return;
  }
  const promessa = id
    ? db.collection("escolas").doc(id).update({ nome })
    : db.collection("escolas").add({ nome, criadoEm: firebase.firestore.FieldValue.serverTimestamp() });

  promessa.then(fecharModal).catch((err) => alert("Erro ao salvar: " + err.message));
}

function confirmarExclusaoEscola(id) {
  const e = estadoEscolas.escolas.find((x) => x.id === id);
  if (!e) return;
  abrirModal(`
    <h3>Excluir escola</h3>
    <p>Tem certeza que deseja excluir "${escaparHtml(e.nome)}"? As turmas já vinculadas a ela não são apagadas, mas ficam sem escola até você as reatribuir.</p>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" style="background: var(--erro);" onclick="excluirEscola('${id}')">Excluir</button>
    </div>
  `);
}

function excluirEscola(id) {
  db.collection("escolas").doc(id).delete().then(fecharModal).catch((err) => alert("Erro: " + err.message));
}

// ---------- Usuários ----------

function abrirFormUsuario(id) {
  const u = id ? estadoAdmin.usuarios.find((x) => x.id === id) : null;
  const papeis = (u && u.papeis) || {};
  const escolasSelecionadas = (u && u.escolasPermitidas) || [];

  abrirModal(`
    <h3>${u ? "Editar usuário" : "Novo usuário"}</h3>
    <div class="campo-form">
      <label>E-mail (conta Google que a pessoa vai usar para entrar)</label>
      <input type="email" id="input-email-usuario" value="${u ? escaparHtml(u.email) : ""}" placeholder="nome@gmail.com" ${u ? "disabled" : ""} />
    </div>
    <div class="campo-form">
      <label>Papéis (pode marcar mais de um)</label>
      <div class="opcoes-radio" style="flex-direction:column; gap:6px;">
        <label><input type="checkbox" id="papel-professor" ${papeis.professor ? "checked" : ""} /> Professor</label>
        <label><input type="checkbox" id="papel-coordenacao" ${papeis.coordenacao ? "checked" : ""} /> Coordenação</label>
        <label><input type="checkbox" id="papel-direcao" ${papeis.direcao ? "checked" : ""} /> Direção</label>
        <label><input type="checkbox" id="papel-webmaster" ${papeis.webmaster ? "checked" : ""} /> Webmaster</label>
      </div>
    </div>
    <div class="campo-form">
      <label>Escolas que este usuário pode acessar</label>
      <div style="max-height:160px; overflow-y:auto; border:1px solid var(--linha); border-radius:8px; padding:8px;">
        ${estadoEscolas.escolas.map((e) => `
          <label style="display:block; padding:4px 0;">
            <input type="checkbox" class="chk-escola-usuario" value="${e.id}" ${escolasSelecionadas.includes(e.id) ? "checked" : ""} /> ${escaparHtml(e.nome)}
          </label>
        `).join("") || "<p class='vazio-aviso' style='padding:0;'>Cadastre uma escola primeiro.</p>"}
      </div>
    </div>
    <div class="campo-form">
      <label><input type="checkbox" id="input-ativo-usuario" style="width:auto; margin-right:6px;" ${u && u.ativo === false ? "" : "checked"} /> Ativo (desmarque para suspender o acesso sem excluir o cadastro)</label>
    </div>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" onclick="salvarUsuario('${u ? u.id : ""}')">Salvar</button>
    </div>
  `);
  const campoEmail = document.getElementById("input-email-usuario");
  if (!u) campoEmail.focus();
}

function salvarUsuario(id) {
  const email = (id || document.getElementById("input-email-usuario").value.trim().toLowerCase());
  if (!email || !email.includes("@")) {
    alert("Digite um e-mail válido.");
    return;
  }
  if (email === EMAIL_AUTORIZADO) {
    alert("Esse e-mail já é o Webmaster principal do sistema — não precisa cadastrar.");
    return;
  }

  const papeis = {
    professor: document.getElementById("papel-professor").checked,
    coordenacao: document.getElementById("papel-coordenacao").checked,
    direcao: document.getElementById("papel-direcao").checked,
    webmaster: document.getElementById("papel-webmaster").checked,
  };
  if (!Object.values(papeis).some(Boolean)) {
    alert("Marque ao menos um papel.");
    return;
  }

  const escolasPermitidas = Array.from(document.querySelectorAll(".chk-escola-usuario:checked")).map((c) => c.value);
  const ativo = document.getElementById("input-ativo-usuario").checked;

  const dados = {
    email,
    papeis,
    escolasPermitidas,
    ativo,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
  };
  const ref = db.collection("usuarios").doc(email);
  const promessa = id
    ? ref.update(dados)
    : ref.set({ ...dados, criadoEm: firebase.firestore.FieldValue.serverTimestamp() });

  promessa.then(fecharModal).catch((err) => alert("Erro ao salvar: " + err.message));
}

function confirmarExclusaoUsuario(id) {
  abrirModal(`
    <h3>Excluir usuário</h3>
    <p>Tem certeza que deseja excluir o acesso de "${escaparHtml(id)}"? A pessoa perde o acesso ao sistema imediatamente.</p>
    <div class="acoes-modal">
      <button class="btn-secundario" onclick="fecharModal()">Cancelar</button>
      <button class="btn-primario" style="background: var(--erro);" onclick="excluirUsuario('${id}')">Excluir</button>
    </div>
  `);
}

function excluirUsuario(id) {
  db.collection("usuarios").doc(id).delete().then(fecharModal).catch((err) => alert("Erro: " + err.message));
}

// ---------- Migração: liga turmas/atividades antigas às escolas ----------
//
// Turmas/atividades criadas antes deste sistema de papéis têm só o
// campo de texto "escola" — sem escolaId nem professoresEmails elas só
// valem para o Webmaster principal. Esta função casa pelo nome exato
// já digitado (ajuste o nome da escola cadastrada para bater, se
// necessário, antes de rodar) e preenche professoresEmails com você
// nas que ainda não têm ninguém definido.
function normalizarNomeEscolaAdmin(texto) {
  return (texto || "").trim().toLowerCase();
}

async function executarMigracaoEscolasAntigas() {
  const confirmar = confirm(
    "Isso vai, em todas as turmas e atividades antigas (criadas antes do sistema de papéis):\n\n" +
    "• Preencher escolaId casando pelo nome exato da escola já digitado nelas.\n" +
    "• Preencher professoresEmails com você, nas que ainda não têm ninguém.\n\n" +
    "Pode rodar mais de uma vez sem problema. Continuar?"
  );
  if (!confirmar) return;

  try {
    const mapaPorNome = {};
    estadoEscolas.escolas.forEach((e) => { mapaPorNome[normalizarNomeEscolaAdmin(e.nome)] = e.id; });

    const turmasSnap = await db.collection("turmas").get();
    let turmasAtualizadas = 0;
    for (const doc of turmasSnap.docs) {
      const t = doc.data();
      const ajuste = {};
      const escolaId = mapaPorNome[normalizarNomeEscolaAdmin(t.escola || "")];
      if (escolaId && t.escolaId !== escolaId) ajuste.escolaId = escolaId;
      if (!Array.isArray(t.professoresEmails) || t.professoresEmails.length === 0) {
        ajuste.professoresEmails = [EMAIL_AUTORIZADO];
      }
      if (Object.keys(ajuste).length > 0) {
        await doc.ref.update(ajuste);
        turmasAtualizadas++;
      }
    }

    const atividadesSnap = await db.collection("atividades").get();
    let atividadesAtualizadas = 0;
    for (const doc of atividadesSnap.docs) {
      const a = doc.data();
      const ajuste = {};
      const escolaId = mapaPorNome[normalizarNomeEscolaAdmin(a.escola || "")];
      if (escolaId && a.escolaId !== escolaId) ajuste.escolaId = escolaId;
      if (!Array.isArray(a.professoresEmails) || a.professoresEmails.length === 0) {
        ajuste.professoresEmails = [EMAIL_AUTORIZADO];
      }
      if (Object.keys(ajuste).length > 0) {
        await doc.ref.update(ajuste);
        atividadesAtualizadas++;
      }
    }

    alert(
      `Migração concluída.\n\n${turmasAtualizadas} turma(s) atualizada(s).\n${atividadesAtualizadas} atividade(s) atualizada(s).\n\n` +
      `Se alguma turma não ficou vinculada a uma escola, é porque o nome digitado nela não bate exatamente com o nome de nenhuma escola cadastrada — edite a turma e selecione a escola correta.`
    );
  } catch (err) {
    alert("Erro durante a migração: " + err.message);
  }
}
