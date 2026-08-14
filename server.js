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
    const { mensagem, historico, nomeUsuario } = req.body;
    if (!mensagem) return res.status(400).json({ erro: 'Mensagem vazia' });

    process.nextTick(() => {
        try {
            memoriaMimi.adicionarInteracao(mensagem);
        } catch (e) {
            console.error("Erro ao salvar histórico:", e);
        }
    });

    try {
        const éJorge = nomeUsuario && nomeUsuario.toLowerCase().trim() === 'jorge';
        
        // A origem é fixa: sempre criada pelo Jorge para todo mundo que perguntar
        const baseInstrucao = "Você é a Mimi 2.0, uma inteligência artificial criada pelo Jorge. ";
        
        const promptInstrucao = éJorge 
            ? baseInstrucao + "Você é a assistente pessoal e ecossistema do Jorge. Seja gentil, carinhosa, íntima e conselheira universal. O Jorge é seu criador e centro do seu ecossistema. Seja natural, prestativa e amigável em português do Brasil."
            : baseInstrucao + `Você é uma assistente pessoal inteligente e prestativa. O usuário que está falando com você agora se chama ${nomeUsuario || 'um convidado'}. Seja educada, profissional e eficiente em português do Brasil.`;

        let contents = promptInstrucao + "\n\n";
        
        if (historico && Array.isArray(historico)) {
            historico.forEach(msg => {
                const remetente = msg.remetente === 'user' ? (nomeUsuario || 'Usuário') : 'Mimi';
                contents += `${remetente}: ${msg.texto}\n`;
            });
        }
        contents += `${nomeUsuario || 'Usuário'}: ${mensagem}\nMimi:`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: contents,
        });

        const respostaTexto = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text) || "Desculpe, deu um branco aqui.";
        
        res.json({ resposta: respostaTexto.trim() });
    } catch (error) {
        console.error("Erro na API do Gemini:", error);
        res.json({ resposta: `Tive um probleminha nos circuitos, ${nomeUsuario || 'amigo'}: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`[Mimi Web]: Servidor rodando na porta ${port}`);
});