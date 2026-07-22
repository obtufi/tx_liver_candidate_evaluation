# Indicação e Avaliação do Candidato ao Transplante Hepático

Apresentação web para o **II Simpósio de Farmácia Clínica e Hospitalar do Hospital Nove de Julho**, ministrada pelo **Prof. Dr. Ben-Hur Ferraz Neto** em 25 de julho de 2026.

## Acesso público

[Abrir a apresentação no navegador](https://obtufi.github.io/tx_liver_candidate_evaluation/)

O deck foi desenhado para uma fala de 20 minutos dirigida a farmacêuticos e demais integrantes da equipe multidisciplinar. A narrativa percorre quatro etapas:

**encaminhar → listar → ativar → transplantar**

## Abrir localmente

Na raiz do repositório:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Depois, abra `http://127.0.0.1:4173/`.

## Controles

- `→`, `Space` ou clique: avançar um build;
- `←` ou clique direito: voltar;
- `F`: tela cheia;
- `N`: notas do apresentador;
- `O`: visão geral;
- `R`: reiniciar os builds do slide;
- `Home` / `End`: início / fim;
- `?`: ajuda.

O endereço registra o slide e o build no fragmento da URL, permitindo compartilhar um ponto específico da apresentação.

## Base científica

- Cada slide exibe no máximo três referências clicáveis.
- A bibliografia estruturada está em [`base_referencias.csv`](base_referencias.csv).
- O roteiro científico e o desenho narrativo estão em [`planejamento_aula_indicacao_avaliacao.md`](planejamento_aula_indicacao_avaliacao.md).
- A fotografia regulatória foi verificada para **São Paulo em 25/07/2026**. Como normas podem mudar, recomenda-se uma última checagem antes da aula.

## Validação visual

O script [`qa/capture.mjs`](qa/capture.mjs) captura os 20 slides em 1920×1080 por Chrome DevTools Protocol e produz [`qa/render-report.json`](qa/render-report.json), incluindo erros de console, elementos fora do canvas, texto cortado, contagem de referências e auditoria de todos os builds. Os builds intermediários dos slides 2 e 13 também recebem capturas próprias para revisão das listas progressivas.

O script [`qa/check-links.mjs`](qa/check-links.mjs) verifica os links científicos exibidos no deck e separa links quebrados de bloqueios editoriais ou falhas de verificação automatizada.

Não há dependências de produção, fontes remotas ou bibliotecas JavaScript: o deck funciona apenas com HTML, CSS e JavaScript locais.

As famílias tipográficas Inter e Source Serif 4 estão incorporadas localmente; suas licenças acompanham os arquivos em `assets/fonts/`.
