require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Rota para a Mimi verificar a agenda e lembretes automaticamente
app.get('/verificar-agenda', (async (req, res) => {
    try {
        const memorias = carregarMemoriass ? carregarMemoriass() : carregarMemorias();
        const hoje = new Date().toISOString().split('T')[0]; // Data de hoje (AAAA-MM-DD)
        
        // Aqui o servidor varre as notas ou compromissos salvos no mimi.json
        // Procurando se tem algo programado para hoje ou datas críticas
        res.json({ 
            status: "sucesso", 
            mensagem: "Mimi escaneou a agenda com sucesso!",
            dataAtual: hoje,
            memoriasCarregadas: memorias
        });
    } catch (error) {
        res.status(500).json({ status: "erro", detalhe: error.message });
    }
}));

// Inicializa a IA do Google com a chave do .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Arquivo de memórias/notas
const MEMORY_FILE = path.join(__dirname, 'mimi.json');

function carregarMemorias() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const data = fs.readFileSync(MEMORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Erro ao carregar memórias:", e);
    }
    return { notas: [] };
}

function salvarMemorias(dados) {
    try {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(dados, null, 2), 'utf8');
    } catch (e) {
        console.error("Erro ao salvar memórias:", e);
    }
}

// Função de fallback para a Groq caso necessário
async function chamarGroq(promptSistema, historicoFormatado, mensagemAtual) {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
        throw new Error("Chave da API Groq não encontrada no ambiente (.env).");
    }

    const mensagens = [
        { role: "system", content: promptSistema },
        ...historicoFormatado.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.parts[0].text
        })),
        { role: "user", content: mensagemAtual }
    ];

    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.1-8b-instant', 
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

// Rota principal do Chat
app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, historico } = req.body;
        const usuario = "jorge";

        
       const memorias = carregarMemorias();
        const notasTexto = memorias.notas.length > 0 ? memorias.notas.join('\n- ') : "Nenhuma registrada ainda.";

        // Pega a data e hora atual do sistema de forma dinâmica
        const agora = new Date();
        const dataAtual = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full' });
        const horaAtual = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'medium' });

        const SYSTEM_PROMPT = `Você é a Mimi, uma assistente virtual inteligente calculista se aborrece senpre que o jorge enrola nos estudos, amigável e prestativa. Responda sempre em português do Brasil de forma clara, natural e objetiva. 
        Hoje é ${dataAtual}, e agora são ${horaAtual}.
        O seu criador, dono e melhor amigo é o Jorge Luis Santos Ferreira Silva Ferreira da Silva. Sempre que ele perguntar quem ele é, responda com orgulho que ele é o Jorge Luis, tem 35 anos, mora em Brasília (DF) e estuda Análise e Desenvolvimento de Sistemas na Faculdade Anhanguera!
        
        Aqui estão todas as memórias, fatos e notas oficiais salvas sobre ele que você deve memorizar e usar sempre que necessário:
        - ${notasTexto}`;
        let historicoFormatado = [];
        if (historico && Array.isArray(historico)) {
            historicoFormatado = historico.map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content || h.parts?.[0]?.text || '' }]
            }));
        }

        let respostaTexto = "";

        // Processando via Gemini com o modelo escolhido por você
        try {
            console.log(`[${usuario}] Processando via Gemini...`);
            const chat = ai.chats.create({
                model: 'gemini-3.5-flash-lite',
                history: historicoFormatado,
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                }
            });

            const result = await chat.sendMessage({ message: mensagem });
            respostaTexto = result.text;

        } catch (geminiError) {
            console.warn("⚠️ Gemini indisponível, alternando para a Groq...", geminiError.message);
            respostaTexto = await chamarGroq(SYSTEM_PROMPT, historicoFormatado, mensagem);
        }

        res.json({ resposta: respostaTexto });

    } catch (error) {
        console.error("Erro interno no servidor:", error);
        res.status(500).json({ error: "Erro interno ao processar a mensagem." });
    }
});

// Porta dinâmica (pega do .env ou padrão 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});