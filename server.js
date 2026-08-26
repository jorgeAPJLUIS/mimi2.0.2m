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
consthistoricosUsuarios = {};

// Prompt de sistema da Mimi
const SYSTEM_PROMPT = `Você é a Mimi, uma assistente virtual inteligente, amigável e prestativa. Responda sempre em português do Brasil de forma clara, natural e objetiva.`;

// Função de Fallback para o Grok/Groq
async function chamarGrok(promptSistema, historicoFormatado, mensagemAtual) {
    const grokApiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.XAI_API_KEY; 
    
    if (!grokApiKey) {
        console.warn("⚠️ Aviso: Chave da API do Grok/Groq não encontrada no ambiente do Render.");
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

    const response = await axios.post('https://api.x.ai/v1/chat/completions', {
        model: 'grok-beta', 
        messages: mensagens,
        temperature: 0.7
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${grokApiKey.trim()}`
        }
    });

    return response.data.choices[0].message.content;
}

// Rota para buscar o histórico do usuário
app.get('/api/historico/:nome', (req, res) => {
    const nome = decodeURIComponent(req.params.nome);
    const historico = historicoseUsuarios[nome] || [];
    res.json({ historico });
});

// Rota principal de chat
app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, nomeUsuario } = req.body;
        const usuario = nomeUsuario || 'Convidado';

        if (!mensagem) {
            return res.status(400).json({ error: 'A mensagem não pode estar vazia.' });
        }

        // Recupera ou inicializa o histórico do usuário específico
        if (!historicoseUsuarios[usuario]) {
            historicoseUsuarios[usuario] = [];
        }
        const historicoAtual = historicoseUsuarios[usuario];

        // Converte o histórico para o formato aceito pelo SDK do Gemini
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
            console.warn("⚠️ Gemini falhou. Acionando o Grok de emergência...", geminiError);
            respostaTexto = await chamarGrok(SYSTEM_PROMPT, historicoFormatado, mensagem);
            respostaTexto += "\n\n*(⚠️ Resposta gerada via sistema de emergência/fallback)*";
        }

        // Salva as mensagens no histórico do usuário
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