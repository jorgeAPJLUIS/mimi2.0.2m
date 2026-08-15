const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const UserProfile = require('./userProfile');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa a IA com a chave de ambiente que você configurou no Render
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const memoriaMimi = new UserProfile();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API do Chat
app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, nomeUsuario = 'Jorge' } = req.body;

        if (!mensagem) {
            return res.json({ resposta: "Mandei vazio, Chefe?" });
        }

        // Modo Dev (Comando)
        if (mensagem.toLowerCase().startsWith('mimi dev:')) {
            const acao = mensagem.replace('mimi dev:', '').trim();
            if (acao.includes('atualizar git') || acao.includes('fazer push')) {
                exec('git add . && git commit -m "Auto-update via Mimi Dev Agent" && git push', (error, stdout) => {
                    if (error) return res.json({ resposta: `Erro no Git: ${error.message}` });
                    res.json({ resposta: `Comando executado!\nLog: ${stdout}` });
                });
                return;
            }
        }

        // Consulta de Perfil
        if (mensagem.toLowerCase().includes('quem sou eu')) {
            const u = memoriaMimi.obterDadosUsuario();
            return res.json({ resposta: `Base acessada, Jorge! 🧠\nNome: ${u.nome}\nEstilo: ${u.estiloDeVida?.trabalhoOuEstudo || 'Desenvolvedor'}` });
        }

        // Chamada da IA com modelo 3.5 Flash
        const prompt = `Você é a Mimi 2.0, assistente pessoal do Jorge. Seja natural, gentil e tecnológica. Pergunta: "${mensagem}"`;
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
        });

        const textoResposta = response.text || "Desculpe, Jorge, não consegui processar a resposta.";
        res.json({ resposta: textoResposta });

    } catch (error) {
        res.json({ resposta: `Erro no sistema: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`Mimi 2.0 rodando na porta ${PORT}`);
});