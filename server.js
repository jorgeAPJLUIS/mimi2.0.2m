const express = require('express');
const path = require('path');
const UserProfile = require('./userProfile');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializa IA e Memória (Corrigido e seguro)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const memoriaMimi = new UserProfile();

// Rota que recebe a mensagem do celular e processa com a Mimi
app.post('/api/chat', async (req, res) => {
    const { mensagem } = req.body;
    if (!mensagem) return res.status(400).json({ erro: 'Mensagem vazia' });

    memoriaMimi.adicionarInteracao(mensagem);

    try {
        const u = memoriaMimi.obterDadosUsuario();
        const promptComPersonalidade = `Você é a Mimi 2.0, uma assistente pessoal inteligente, gentil, carinhosa e conselheira universal. Seu criador e centro do seu ecossistema é o Jorge (desenvolvedor, casado com Michele). Responda de forma natural, prestativa e amigável em português do Brasil. Pergunta do Jorge: "${mensagem}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: promptComPersonalidade,
        });

        const respostaTexto = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text) || "Desculpe, Jorge, deu um branco aqui.";
        
        res.json({ resposta: respostaTexto });
    } catch (error) {
        res.json({ resposta: `Tive um probleminha nos circuitos, Jorge: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`[Mimi Web]: Servidor rodando na porta ${port}`);
});