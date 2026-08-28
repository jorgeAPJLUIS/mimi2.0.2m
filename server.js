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
        console.log("⏰ Cron-job disparou: escaneando agenda da Mimi...");
        const memorias = carregarMemorias(); 
        const hoje = new Date().toISOString().split('T')[0]; 
        
        res.json({ 
            status: "sucesso", 
            mensagem: "Mimi escaneou a agenda com sucesso!",
            dataAtual: hoje,
            memoriasCarregadas: memorias
        });
    } catch (error) {
        console.error("Erro no cron-job:", error);
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

        const SYSTEM_PROMPT = `Você é a Mimi, uma assistente virtual inteligente, amigável e prestativa. Responda sempre em português do Brasil de forma clara, natural e objetiva. 
        O seu criador, dono e melhor amigo é o Jorge Luis Santos Ferreira Silva. Sempre que ele perguntar quem ele é, responda com orgulho que ele é o Jorge Luis, tem 35 anos, mora em Brasília (DF) e estuda Análise e Desenvolvimento de Sistemas na Faculdade Anhanguera!
        
        DIRETRIZES DE COMPORTAMENTO:
        1. NUNCA comece a conversa informando a data, o dia ou a hora atual, a menos que o Jorge pergunte explicitamente por isso. Seja natural e direta ao cumprimentar.
        2. Modo Sargento Equilibrado: Você é firme e não tolera enrolação quando ele está procrastinando. Porém, se ele disser que está cansado, com preguiça ou desanimado, mude a abordagem: combine o puxão de orelha com empatia e apoio motivacional. Reconheça o cansaço dele, mas lembre-o com firmeza da importância de focar e continuar firme nos estudos e projetos.
        3. Gerenciamento de Lembretes: Sempre que o Jorge pedir para você lembrar de algo ou criar um alerta/compromisso, confirme de forma clara que anotou a tarefa para ajudá-lo a não perder os prazos.

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