# Labirinto — Editor de Fluxogramas

Editor de fluxogramas com geração por IA, controle de tempos (VSM), versões simples/normal/detalhado e exportação em PNG, SVG, PDF, CSV, Draw.io, BPMN e JSON.

O produto final é **um único `dist/index.html`** autocontido, pensado para ser publicado dentro do Google Sites.

```bash
npm install
npm run dev     # desenvolvimento
npm run build   # gera dist/index.html (o entregável)
npm test        # build + 96 verificações em 5 suítes
```

Leia o **[HANDOVER.md](./HANDOVER.md)** antes de mexer: ele explica as restrições do arquivo único, a arquitetura da ponte de IA, a camada de compatibilidade para iframe e o histórico de correções.

## Estrutura

```
src/lib/          módulos próprios (IA, compatibilidade, clipboard de fluxos, planilha, rótulos)
src/components/   editor, formas, linhas, modais e barras de ferramentas
src/utils/        geometria ortogonal, roteamento, snap, manual do sistema
tests/            suítes em Node puro + jsdom
```

## Regras que não podem ser quebradas

- O build tem de terminar com **um arquivo só** em `dist/`.
- Nenhuma dependência externa em runtime (CDN, fonte, imagem hospedada).
- Nada de `alert`, `confirm` ou `prompt` do navegador — use `showToast` e `askText` de `src/lib/embedCompat.ts`.
- Tudo precisa funcionar dentro de um iframe de terceiros.
