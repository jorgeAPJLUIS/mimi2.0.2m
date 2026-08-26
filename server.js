const express = require('express');
const cors = require('cors');
const axios = require('axios'); // Garantido o uso do axios para o fallback
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());
app.use(cors());

// Inicializa a API do Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Prompt de sistema da Mimi
const SYSTEM_PROMPT = `Você é a Mimi, uma assistente virtual inteligente, amigável e prestativa. Responda sempre em português do Brasil de forma clara, natural e objetiva.`;

// FUNÇÃO DE FALLBACK PARA O GROK/GROQ (Ajustada para o nome que está no Render)
async function chamarGrok(promptSistema, historicoFormatado, mensagemAtual) {
    // Procura a chave usando o nome exato que está no painel do Render (GROQ_API_KEY)
    const grokApiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.XAI_API_KEY; 
    
    if (!grokApiKey) {
        console.warn("⚠️ Aviso: Chave da API do Grok/Groq não encontrada no ambiente do Render.");
        throw new Error("O sistema de IA está temporariamente indisponível (limite de cota atingido e fallback indisponível).");
    }

    // Formata o histórico para o padrão OpenAI / xAI
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
            'Authorization': `Bearer ${grokApiKey.trim()}` // Remove espaços acidentais
        }
    });

    return response.data.choices[0].message.content;
}

// ROTA PRINCIPAL DE CHAT COM SISTEMA DE FALLBACK AUTOMÁTICO
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'A mensagem não pode estar vazia.' });
        }

        // Formata o histórico recebido para o padrão do Gemini
        const historicoFormatado = history ? history.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
        })) : [];

        let respostaTexto = "";

        try {
            // Tenta usar o Gemini primeiro
            console.log("Tentando processar com o Gemini...");
            const chat = ai.chats.create({
                model: 'gemini-3.5-flash',
                history: historicoFormatado,
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                }
            });

            const result = await chat.sendMessage({ message });
            respostaTexto = result.text;

        } catch (geminiError) {
            console.warn("⚠️ Gemini falhou (possível limite de cota/429 ou instabilidade). Acionando o Grok de emergência...", geminiError);
            
            // Se o Gemini falhar, ativa o fallback automático para o Grok
            respostaTexto = await chamarGrok(SYSTEM_PROMPT, historicoFormatado, message);
            respostaTexto += "\n\n*(⚠️ Resposta gerada via sistema de emergência/fallback)*";
        }

        res.json({ reply: respostaTexto });

    } catch (error) {
        console.error("Erro detalhado na API de Chat (Geral/Fallback):", error);
        res.status(500).json({ 
            error: 'Erro interno no servidor ao processar sua mensagem.', 
            details: error.message 
        });
    }
});

// Porta padrão do Render ou 10000 localmente (GARANTINDO A PORTA CORRETA)
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});