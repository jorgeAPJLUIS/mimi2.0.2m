// Rota do Chat e Agente Dev atualizada
app.post('/api/chat', async (req, res) => {
    const { mensagem, historico, nomeUsuario } = req.body;

    if (!mensagem) {
        return res.json({ resposta: "Mandei vazio, Chefe?" });
    }

    // Se começar com o comando dev
    if (mensagem.toLowerCase().startsWith('mimi dev:')) {
        const acao = mensagem.replace('mimi dev:', '').trim();
        
        if (acao.includes('atualizar git') || acao.includes('fazer push')) {
            exec('git add . && git commit -m "Auto-update via Mimi Dev Agent" && git push', (error, stdout, stderr) => {
                if (error) {
                    return res.json({ resposta: `Chefe, deu erro no Git: ${error.message}` });
                }
                res.json({ resposta: `Comando executado com sucesso! Alterações enviadas.\nLog: ${stdout}` });
            });
            return;
        }
    }

    // Resposta conversacional inteligente da Mimi
    let respostaMimi = `Entendi, ${nomeUsuario}! `;
    const msgLower = mensagem.toLowerCase();

    if (msgLower.includes('olá') || msgLower.includes('oi')) {
        respostaMimi += "Como estão os códigos e os estudos por aí hoje?";
    } else if (msgLower.includes('ajuda') || msgLower.includes('o que fazer')) {
        respostaMimi += "Estamos com o sistema rodando na nuvem, o orbe holográfico ativo e a memória persistente funcionando. O que vamos programar ou ajustar agora?";
    } else if (msgLower.includes('sistema') || msgLower.includes('projeto')) {
        respostaMimi += "O projeto Mimi 2.0 está a todo vapor! O que você quer mexer na interface ou nas funções?";
    } else {
        respostaMimi += `Anotado o que você disse sobre "${mensagem}". Como posso te ajudar com isso?`;
    }

    res.json({ resposta: respostaMimi });
});