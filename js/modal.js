// ============================================================
// Utilitário genérico de modal
// ============================================================

const modalFundo = document.getElementById("modal-fundo");
const modalCaixa = document.getElementById("modal-caixa");

function abrirModal(htmlConteudo) {
  modalCaixa.innerHTML = htmlConteudo;
  modalFundo.classList.remove("escondido");
}

function fecharModal() {
  modalFundo.classList.add("escondido");
  modalCaixa.innerHTML = "";
}

modalFundo.addEventListener("click", (e) => {
  if (e.target === modalFundo) fecharModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalFundo.classList.contains("escondido")) {
    fecharModal();
  }
});
