# Instruções permanentes

- Responda sempre no chat em português do Brasil (PT-BR), independentemente do idioma usado na mensagem do usuário.
- Todo ajuste de interface deve se adaptar automaticamente a qualquer tamanho de tela, principalmente celulares: verificar sempre também em larguras de celular (ex.: 360px e 390px) e tablet (768px) antes de publicar — nada cortado, sobreposto ou fora da tela.
- Nunca deixar tarefa em segundo plano sem fim: rodar a suíte com limite de tempo (`timeout 900 npm test ...`), sem laços de "vigia" que esperam por texto em arquivo, e todo script de teste deve encerrar o processo explicitamente ao terminar (`process.exit`).
