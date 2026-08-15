const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações para ler JSON e arquivos estáticos da pasta public/raiz
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rota principal do Chat e do Agente Dev
app.post('/api/chat', async (req, res) => {
    const { mensagem, historico, nomeUsuario } = req.body;

    // Comando especial: Se você pedir para ela atualizar o código ou commitar
    if (mensagem.toLowerCase().startsWith('mimi dev:')) {
        const acao = mensagem.replace('mimi dev:', '').trim();
        
        // Exemplo de comando para rodar o git push automaticamente
        if (acao.includes('atualizar git') || acao.includes('fazer push')) {
            exec('git add . && git commit -m "Auto-update via Mimi Dev Agent" && git push', (error, stdout, stderr) => {
                if (error) {
                    return res.json({ resposta: `Chefe, deu erro no Git: ${error.message}` });
                }
                res.json({ resposta: `Comando executado com sucesso! Alterações enviadas para o GitHub/Render.\nLog: ${stdout}` });
            });
            return;
        }
    }

    // Resposta padrão da Mimi (mantendo a conversa normal)
    // Aqui você pode manter sua integração com a IA que já estava usando
    res.json({ 
        resposta: `Entendido, ${nomeUsuario}! Estou operacional e pronta. O modo dev está aguardando seus comandos.` 
    });
});

app.listen(PORT, () => {
    console.log(`Mimi rodando localmente na porta ${PORT}`);
});