const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());
app.use(cors());

// Libera os arquivos estáticos do frontend (pasta public)
app.use(express.static(path.join(__dirname, 'public')));

// Inicializa a API do Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Banco de dados em memória para armazenar o histórico por usuário
const historicosUsuarios = {};

// Prompt de sistema da Mimi com o seu nome gravado
const SYSTEM_PROMPT = `Você é a Mimi, uma assistente virtual inteligente, amigável e prestativa. Responda sempre em português do Brasil de forma clara, natural e objetiva. O seu criador e dono é o Jorge Luis Santos Ferreira Silva Ferreira da Silva. Sempre que ele perguntar quem ele é, responda com orgulho que ele é o Jorge Luis Santos Ferreira Silva Ferreira da Silva!`;

// Função de Fallback 100% ajustada para a Groq
async function chamarGroq(promptSistema, historicoFormatado, mensagemAtual) {
    const groqApiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY; 
    
    if (!groqApiKey) {
        console.warn("⚠️ Aviso: Chave da API da Groq não encontrada no ambiente do Render.");
        throw new Error("O sistema de IA está temporariamente indisponível.");
    }

    const mensagens = [
        { role: "system", content: promptSistema },
        ...historicoFormatado.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.parts[0].text
        })),
        { role: "user", content: mensagemAtual }
    ];

    // URL e modelo oficiais da Groq (Llama 3.3)
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile', 
        messages: mensagens,
        temperature: 0.7
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey.trim()}`
        }
    });

    return response.data.choices[0].message.content;
}

// Rota para buscar o histórico do usuário
app.get('/api/historico/:nome', (req, res) => {
    try {
        const nome = decodeURIComponent(req.params.nome);
        const historico = historicosUsuarios[nome] || [];
        res.json({ historico });
    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        res.json({ historico: [] });
    }
});

// Rota principal de chat
app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, nomeUsuario } = req.body;
        const usuario = nomeUsuario || 'Convidado';

        if (!mensagem) {
            return res.status(400).json({ error: 'A mensagem não pode estar vazia.' });
        }

        if (!historicosUsuarios[usuario]) {
            historicosUsuarios[usuario] = [];
        }
        const historicoAtual = historicosUsuarios[usuario];

        const historicoFormatado = historicoAtual.map(h => ({
            role: h.remetente === 'user' ? 'user' : 'model',
            parts: [{ text: h.texto }]
        }));

        let respostaTexto = "";

        try {
            console.log(`[${usuario}] Tentando processar com o Gemini...`);
            const chat = ai.chats.create({
                model: 'gemini-3.5-flash',
                history: historicoFormatado,
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                }
            });

            const result = await chat.sendMessage({ message: mensagem });
            respostaTexto = result.text;

        } catch (geminiError) {
            console.warn("⚠️ Gemini falhou. Acionando a Groq de emergência...", geminiError.message);
            respostaTexto = await chamarGroq(SYSTEM_PROMPT, historicoFormatado, mensagem);
            respostaTexto += "\n\n*(⚠️ Resposta gerada via sistema de emergência/Groq)*";
        }

        historicoAtual.push({ texto: mensagem, remetente: 'user' });
        historicoAtual.push({ texto: respostaTexto, remetente: 'mimi' });

        res.json({ resposta: respostaTexto });

    } catch (error) {
        console.error("Erro detalhado na API de Chat:", error);
        res.status(500).json({ 
            error: 'Erro interno no servidor ao processar sua mensagem.', 
            details: error.message 
        });
    }
});

// Porta padrão do Render ou 10000 localmente
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});