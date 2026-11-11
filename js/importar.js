// ============================================================
// Importação de backup do Vistos.exe — página de uso único
// ============================================================

function normalizar(texto) {
  return (texto || "").trim().toLowerCase();
}

const estadoImportacao = {
  backup: null,
  turmasExistentes: [], // [{id, nome, escola, ...}] já no Firestore
  mapeamento: [],        // um item por turma do backup
};

function onLoginAutorizado() {
  // Nada a fazer até o usuário escolher o arquivo.
}

document.getElementById("input-arquivo").addEventListener("change", async (e) => {
  const arquivo = e.target.files[0];
  if (!arquivo) return;

  try {
    const texto = await arquivo.text();
    const backup = JSON.parse(texto);
    if (!backup.turmas || !backup.atividadesVisto) {
      alert("Esse arquivo não parece ser um backup do Vistos.exe (faltam 'turmas' ou 'atividadesVisto').");
      return;
    }
    estadoImportacao.backup = backup;
    await prepararPreview();
  } catch (err) {
    alert("Não consegui ler esse arquivo: " + err.message);
  }
});

function inferirDisciplina(turmaBackup) {
  if (turmaBackup.disciplina && turmaBackup.disciplina.trim()) return turmaBackup.disciplina.trim();
  const escola = normalizar(turmaBackup.escola);
  if (escola.includes("copac")) return "Física";
  if (escola.includes("etec")) return "Química";
  return "Ciências";
}

async function prepararPreview() {
  const snap = await db.collection("turmas").get();
  estadoImportacao.turmasExistentes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  estadoImportacao.mapeamento = estadoImportacao.backup.turmas.map((tb) => {
    const existente = estadoImportacao.turmasExistentes.find(
      (te) => normalizar(te.escola) === normalizar(tb.escola) && normalizar(te.nome) === normalizar(tb.nome)
    );
    const qtdAtividades = (estadoImportacao.backup.atividadesVisto[tb.id] || []).length;

    return {
      turmaBackup: tb,
      turmaExistenteId: existente ? existente.id : null,
      escola: tb.escola,
      disciplina: inferirDisciplina(tb),
      sistema: tb.tipoMencao === "porcentagem" ? "porcentagem" : "mencao",
      qtdAlunos: (tb.alunos || []).length,
      qtdAtividades,
    };
  });

  renderPreview();
}

function renderPreview() {
  const corpo = document.getElementById("corpo-tabela-preview");
  corpo.innerHTML = estadoImportacao.mapeamento
    .map((m, i) => `
      <tr>
        <td>${escaparHtmlImp(m.turmaBackup.nome)}</td>
        <td><span class="selo ${m.turmaExistenteId ? "existente" : "nova"}">${m.turmaExistenteId ? "Existente" : "Nova"}</span></td>
        <td><input type="text" id="escola-${i}" value="${escaparHtmlImp(m.escola)}" /></td>
        <td><input type="text" id="disciplina-${i}" value="${escaparHtmlImp(m.disciplina)}" /></td>
        <td>
          <select id="sistema-${i}">
            <option value="mencao" ${m.sistema === "mencao" ? "selected" : ""}>Menções</option>
            <option value="porcentagem" ${m.sistema === "porcentagem" ? "selected" : ""}>Porcentagem</option>
          </select>
        </td>
        <td>${m.qtdAlunos}</td>
        <td>${m.qtdAtividades}</td>
      </tr>
    `)
    .join("");

  document.getElementById("area-preview").classList.remove("escondido");
}

function escaparHtmlImp(texto) {
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
}

function log(msg) {
  const el = document.getElementById("log");
  el.textContent += msg + "\n";
  el.scrollTop = el.scrollHeight;
}

function mapearRegistro(reg) {
  if (!reg || reg.status === "faltou") return { notaBruta: null, materialEsquecido: false };
  const materialEsquecido = reg.motivo === "esqueceu_apostila";
  const notaBruta = reg.percentual === null || reg.percentual === undefined ? 0 : reg.percentual;
  return { notaBruta, materialEsquecido };
}

document.getElementById("btn-confirmar-importacao").addEventListener("click", async () => {
  document.getElementById("btn-confirmar-importacao").disabled = true;
  document.getElementById("area-log").classList.remove("escondido");
  log("Iniciando importação...\n");

  try {
    for (let i = 0; i < estadoImportacao.mapeamento.length; i++) {
      // Lê os valores atuais dos campos (o usuário pode ter editado).
      const m = estadoImportacao.mapeamento[i];
      m.escola = document.getElementById(`escola-${i}`).value.trim();
      m.disciplina = document.getElementById(`disciplina-${i}`).value.trim();
      m.sistema = document.getElementById(`sistema-${i}`).value;

      await importarTurma(m);
    }
    log("\n✅ Importação concluída! Você já pode fechar esta página e conferir na aba Turmas / Visto.");
  } catch (err) {
    log("\n❌ Erro: " + err.message);
    console.error(err);
  }
});

async function importarTurma(m) {
  const tb = m.turmaBackup;
  log(`\n== ${tb.nome} (${m.escola}) ==`);

  // 1. Turma: usa a existente ou cria uma nova.
  let turmaId = m.turmaExistenteId;
  if (!turmaId) {
    const novaTurma = await db.collection("turmas").add({
      nome: tb.nome,
      escola: m.escola,
      professoresEmails: [EMAIL_AUTORIZADO],
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });
    turmaId = novaTurma.id;
    log(`  Turma criada.`);
  } else {
    log(`  Turma já existia — completando.`);
  }

  // 2. Alunos: casa por nome normalizado; cria quem faltar.
  const alunosSnap = await db.collection("turmas").doc(turmaId).collection("alunos").get();
  const mapaAlunosExistentes = {};
  alunosSnap.docs.forEach((d) => { mapaAlunosExistentes[normalizar(d.data().nome)] = d.id; });

  const mapaAntigoParaNovo = {};
  let criados = 0;
  for (const alunoBackup of tb.alunos || []) {
    const chave = normalizar(alunoBackup.nome);
    if (mapaAlunosExistentes[chave]) {
      mapaAntigoParaNovo[alunoBackup.id] = mapaAlunosExistentes[chave];
    } else {
      const novoAluno = await db.collection("turmas").doc(turmaId).collection("alunos").add({
        nome: alunoBackup.nome,
        status: "ativo",
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
      mapaAntigoParaNovo[alunoBackup.id] = novoAluno.id;
      mapaAlunosExistentes[chave] = novoAluno.id;
      criados++;
    }
  }
  log(`  Alunos: ${criados} novo(s), ${(tb.alunos || []).length - criados} já existiam.`);

  // 3. Disciplina: casa por nome normalizado dentro da turma; cria se faltar.
  const discSnap = await db.collection("turmas").doc(turmaId).collection("disciplinas").get();
  let disciplinaDoc = discSnap.docs.find((d) => normalizar(d.data().nome) === normalizar(m.disciplina));
  let disciplinaId;
  if (disciplinaDoc) {
    disciplinaId = disciplinaDoc.id;
  } else {
    const dadosDisc = {
      nome: m.disciplina,
      nomeNormalizado: normalizar(m.disciplina),
      sistemaAvaliacao: m.sistema,
      escola: m.escola,
      escolaNormalizado: normalizar(m.escola),
      turmaId,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (m.sistema === "mencao") {
      dadosDisc.faixasMencao = { I: 0, R: 40, B: 60, MB: 80 };
    }
    const novaDisc = await db.collection("turmas").doc(turmaId).collection("disciplinas").add(dadosDisc);
    disciplinaId = novaDisc.id;
    log(`  Disciplina "${m.disciplina}" criada (${m.sistema}).`);
  }

  // Atualiza a contagem de disciplinas da turma (pro selo verde/vermelho).
  const discSnapAtualizado = await db.collection("turmas").doc(turmaId).collection("disciplinas").get();
  await db.collection("turmas").doc(turmaId).update({ qtdDisciplinas: discSnapAtualizado.size });

  // 4. Atividades + vistos.
  const atividadesBackup = (estadoImportacao.backup.atividadesVisto[tb.id] || []);
  const atividadesExistentesSnap = await db.collection("atividades")
    .where("turmaIds", "array-contains", turmaId)
    .get();
  const jaImportadas = new Set(
    atividadesExistentesSnap.docs
      .filter((d) => normalizar(d.data().disciplinaNome) === normalizar(m.disciplina))
      .map((d) => `${normalizar(d.data().titulo)}|${d.data().data || ""}`)
  );

  let atividadesCriadas = 0;
  let atividadesPuladas = 0;

  for (const ativBackup of atividadesBackup) {
    const chaveAtiv = `${normalizar(ativBackup.nome)}|${ativBackup.data || ""}`;
    if (jaImportadas.has(chaveAtiv)) {
      atividadesPuladas++;
      continue;
    }

    const registros = ativBackup.registros || {};
    let pendentes = 0;
    const vistosParaGravar = [];

    Object.keys(registros).forEach((alunoIdAntigo) => {
      const novoAlunoId = mapaAntigoParaNovo[alunoIdAntigo];
      if (!novoAlunoId) return; // aluno não encontrado no backup.alunos — ignora
      const { notaBruta, materialEsquecido } = mapearRegistro(registros[alunoIdAntigo]);
      if (notaBruta === null) pendentes++;
      // Sem desconto por material esquecido — mesma regra do Visto (ver js/visto.js).
      const notaFinal = notaBruta === null ? null : notaBruta;
      vistosParaGravar.push({ novoAlunoId, notaBruta, materialEsquecido, notaFinal });
    });

    const atividadeRef = await db.collection("atividades").add({
      escola: m.escola,
      professoresEmails: [EMAIL_AUTORIZADO],
      disciplinaNome: m.disciplina,
      titulo: ativBackup.nome,
      data: ativBackup.data || null,
      descricao: ativBackup.descricao || "",
      prazo: ativBackup.novoPrazo || null,
      turmaIds: [turmaId],
      pendentesPorTurma: { [turmaId]: pendentes },
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    });

    const lote = db.batch();
    vistosParaGravar.forEach((v) => {
      const ref = atividadeRef.collection("vistos").doc(`${turmaId}_${v.novoAlunoId}`);
      lote.set(ref, {
        turmaId,
        alunoId: v.novoAlunoId,
        notaBruta: v.notaBruta,
        materialEsquecido: v.materialEsquecido,
        novaData: null,
        notaFinal: v.notaFinal,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await lote.commit();

    atividadesCriadas++;
  }

  log(`  Atividades: ${atividadesCriadas} importada(s), ${atividadesPuladas} já existia(m) (puladas).`);
}
