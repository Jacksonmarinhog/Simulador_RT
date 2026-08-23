# Simulador de Impacto da Reforma Tributária — Pretorian

Isca digital interativa que simula, para Simples Nacional, Lucro Presumido e Lucro Real,
o impacto da Reforma Tributária (LC 214/2025) no preço e na margem de produtos e serviços,
ano a ano entre 2026 e 2033.

## O que faz

- Calcula preço e carga tributária no regime atual vs. com a reforma.
- CBS e IBS calculados **por fora** (LC 214/2025, art. 12, §2º, I), conforme a lei.
- Cobre Simples padrão e Simples híbrido (art. 41, §3º).
- Adaptado para produto e para serviço (ICMS vs. ISS).
- Captura lead (nome, CNPJ, WhatsApp, e-mail) antes de liberar o resultado.
- Identidade visual da Pretorian; um único arquivo HTML, sem dependências externas.

## Como usar

Abra `index.html` em qualquer navegador, ou publique via GitHub Pages (veja abaixo).
Antes de publicar, veja o comentário `fireLeadAlert()` no código — é o ponto para conectar
ao CRM/WhatsApp da equipe comercial.

## Publicar com GitHub Pages (grátis)

1. No repositório, vá em **Settings → Pages**.
2. Em "Source", escolha a branch `main` e a pasta `/ (root)`.
3. Salve. Em ~1 minuto o simulador estará no ar em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
