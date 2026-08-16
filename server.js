const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const UserProfile = require('./userProfile');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const memoriaMimi = new UserProfile();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, historico, nomeUsuario } = req.body;
        const usuarioAtual = nomeUsuario || "Convidado";

        if (!mensagem) return res.json({ resposta: "Mandei vazio, Chefe?" });

        // Salva interação no perfil (memória local do servidor)
        memoriaMimi.adicionarInteracao(`${usuarioAtual}: ${mensagem}`);

        // Monta o contexto para a IA (Histórico + Nome do Usuário)
        let contextoHistorico = "";
        if (historico && historico.length > 0) {
            contextoHistorico = historico.map(h => `${h.remetente === 'user' ? usuarioAtual : 'Mimi'}: ${h.texto}`).join('\n');
        }

        const prompt = `
            Você é a Mimi 2.0, assistente pessoal do Jorge. 
            Diretriz: Você está falando com ${usuarioAtual}.
            
            Histórico recente:
            ${contextoHistorico}
            
            ${usuarioAtual} diz: "${mensagem}"
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
        });

        const textoResposta = response.text || "Desculpe, não consegui processar a resposta.";
        res.json({ resposta: textoResposta });

    } catch (error) {
        res.status(500).json({ resposta: `Erro no sistema: ${error.message}` });
    }
});

app.listen(PORT, () => console.log(`Mimi rodando na porta ${PORT}`));