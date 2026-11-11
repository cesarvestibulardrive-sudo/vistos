# Vistos

Plataforma web em nuvem, multiusuário, para a gestão de processos escolares: registro de vistos das atividades, chamada, ocorrências, seminários e relatório de notas.

Projeto Integrador em Computação II (PJI240) – Engenharia de Computação – Univesp, Polo Dracena, Grupo 17 (2026). Comunidade externa: Colégio Objetivo de Pacaembu.

Aplicação em funcionamento: https://visto-2d3a5.web.app/

## Módulos

- **Turmas**: escolas, turmas, disciplinas e alunos.
- **Visto**: registro da entrega de atividades (100, 75, 50, 25 ou NF), com material esquecido e nova data.
- **Chamada**: frequência por data (Presente, Falta, Justificada).
- **Ocorrências**: registro por aluno ou em grupo e relatório atitudinal em PDF.
- **Seminário**: grupos sorteados, critérios e avaliação.
- **Relatório**: pesos, notas finais, frequência, boletim em PDF e exportação em CSV.
- **Admin**: escolas, usuários, papéis e escolas permitidas (perfil webmaster).

## Perfis

Professor, coordenação, direção e webmaster. As permissões são aplicadas pelas regras de segurança do banco de dados (`firestore.rules`).

## Tecnologias

HTML, CSS e JavaScript; Firebase Authentication (conta Google), Cloud Firestore e Firebase Hosting; aplicativo web progressivo (PWA); jsPDF para PDF.

## Estrutura

- `index.html`: página principal
- `js/`: módulos da aplicação
- `css/`: estilos
- `firestore.rules`: regras de segurança do banco
- `firebase.json`, `manifest.json`, `sw.js`: hospedagem e PWA

## Executar localmente

Sirva a pasta com um servidor estático, por exemplo `python3 -m http.server 8000`, e abra `http://localhost:8000`. O acesso depende do projeto Firebase configurado em `js/firebase-config.js` e de e-mails cadastrados na coleção `usuarios`.

## Autoria

Grupo 17 – Univesp, Polo Dracena. Desenvolvido por César Lopes Pereira do Amaral, com a participação dos demais integrantes do grupo.
