const express = require('express');
const path = require('path');
const UserProfile = require('./userProfile');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const memoriaMimi = new UserProfile();

app.post('/api/chat', async (req, res) => {
    const { mensagem } = req.body;
    if (!mensagem) return res.status(400).json({ erro: 'Mensagem vazia' });

    process.nextTick(() => {
        try {
            memoriaMimi.adicionarInteracao(mensagem);
        } catch (e) {
            console.error("Erro ao salvar histórico:", e);
        }
    });

    try {
        const promptComPersonalidade = `Você é a Mimi 2.0, uma assistente pessoal inteligente, gentil, carinhosa e conselheira universal. Seu criador e centro do seu ecossistema é o Jorge (desenvolvedor). A esposa dele se chama Michele. Seja natural, prestativa e amigável em português do Brasil. IMPORTANTE: Evite ficar repetindo ou mencionando o nome da Michele ou mandando abraços para ela a menos que o Jorge toque especificamente nesse assunto. Responda de forma direta e natural à pergunta: "${mensagem}"`;

        // Usando o modelo gemini-2.0-flash totalmente estável na SDK atual
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: promptComPersonalidade,
        });

        const respostaTexto = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text) || "Desculpe, Jorge, deu um branco aqui.";
        
        res.json({ resposta: respostaTexto });
    } catch (error) {
        console.error("Erro na API do Gemini:", error);
        res.json({ resposta: `Tive um probleminha nos circuitos, Jorge: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`[Mimi Web]: Servidor rodando na porta ${port}`);
});