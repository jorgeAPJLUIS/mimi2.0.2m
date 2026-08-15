const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Garante que a raiz sirva diretamente o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Arquivos estáticos (caso tenha mais coisas)
app.use(express.static(path.join(__dirname)));

// Rota principal do Chat e do Agente Dev
app.post('/api/chat', async (req, res) => {
    const { mensagem, historico, nomeUsuario } = req.body;

    if (mensagem && mensagem.toLowerCase().startsWith('mimi dev:')) {
        const acao = mensagem.replace('mimi dev:', '').trim();
        
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

    res.json({ 
        resposta: `Entendido, ${nomeUsuario}! Estou operacional e pronta. O modo dev está aguardando seus comandos.` 
    });
});

app.listen(PORT, () => {
    console.log(`Mimi rodando localmente na porta ${PORT}`);
});