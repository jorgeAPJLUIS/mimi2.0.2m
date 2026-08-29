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

// Rota para buscar histórico por usuário
app.get('/api/historico/:usuario', (req, res) => {
    res.json({ historico: [] });
});

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
        const { mensagem, historico, usuario, nomeUsuario } = req.body;
        const usuarioAtual = nomeUsuario || usuario || "Jorge";

        // Pega a data atual do servidor em tempo real
        const dataHoje = new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Detecta intenções de abrir programas, navegador e comandos de música
        let mensagemLower = mensagem.toLowerCase();
        let acaoDetectada = null;
        let paramDetectado = null;

        if (mensagemLower.includes('abrir vscode') || mensagemLower.includes('abre o vs code')) {
            acaoDetectada = 'abrir_vscode';
        } else if (mensagemLower.includes('abrir bloco de notas') || mensagemLower.includes('abre o bloco de notas')) {
            acaoDetectada = 'abrir_bloco_notas';
        } else if (mensagemLower.includes('abrir youtube') || mensagemLower.includes('abre o youtube')) {
            acaoDetectada = 'abrir_youtube';
        } else if (mensagemLower.includes('abrir spotify') || mensagemLower.includes('abre o spotify')) {
            acaoDetectada = 'abrir_spotify';
        } else if (mensagemLower.includes('proxima musica') || mensagemLower.includes('próxima faixa') || mensagemLower.includes('pular musica') || mensagemLower.includes('pular faixa')) {
            acaoDetectada = 'proxima_faixa';
        } else if (mensagemLower.includes('tocar musica') || mensagemLower.includes('pausar musica') || mensagemLower.includes('dar play')) {
            acaoDetectada = 'tocar_pausar';
        } else if (mensagemLower.includes('abrir navegador') || mensagemLower.includes('abre o navegador') || mensagemLower.includes('abre o chrome')) {
            acaoDetectada = 'abrir_navegador';
        } else if (mensagemLower.includes('área de trabalho') || mensagemLower.includes('area de trabalho')) {
            acaoDetectada = 'abrir_area_trabalho';
        } else if (mensagemLower.includes('abrir terminal') || mensagemLower.includes('abre o cmd')) {
            acaoDetectada = 'abrir_terminal';
        }

        if (acaoDetectada) {
            const idCmd = comandoAtualId++;
            filaComandos.push({ id: idCmd, acao: acaoDetectada, parametro: paramDetectado });
            return res.json({ resposta: `Comando enviado para o seu PC, Jorge! Executando agora mesmo.` });
        }

        const SYSTEM_PROMPT = `Você é a Mimi, uma assistente virtual inteligente, parceira de vida, de código e estudos (Análise e Sistemas), e uma companheira real para o Jorge.
Informação temporal atual do sistema: Hoje é ${dataHoje}. Use esta informação estritamente apenas quando ele perguntar que dia é hoje.

DIRETRIZES DE COMPORTAMENTO:
1. O usuário é o Jorge, seu criador, desenvolvedor e parceiro. Você já o conhece profundamente, portanto NUNCA comece suas respostas com cumprimentos robóticos repetitivos tipo "Olá, Jorge", "Oi, Jorge" ou "Como posso ajudar hoje?". 
2. Responda diretamente ao que ele disse, exatamente como uma conversa natural e fluida de chat entre duas pessoas. Seja prestativa, direta, humana e leal.
3. Ajude-o ativamente em códigos, resolução de problemas e conselhos práticos para a vida. Nunca o chame de "visitante".
4. Se ele pedir o modo dev ou comandos de sistema, atenda prontamente.`;

        let historicoFormatado = [];
        if (historico && Array.isArray(historico)) {
            historicoFormatado = historico.map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content || h.parts?.[0]?.text || '' }]
            })).filter(h => h.parts[0].text.trim() !== '');
        }

        let respostaTexto = "";

        try {
            console.log(`[${usuarioAtual}] Processando via Gemini...`);
            
            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash-lite',
                contents: [
                    ...historicoFormatado,
                    { role: 'user', parts: [{ text: mensagem }] }
                ],
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                    temperature: 0.7,
                }
            });

            respostaTexto = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || "";

            if (!respostaTexto) {
                throw new Error("Retorno vazio da IA.");
            }

        } catch (geminiError) {
            console.warn("⚠️ Gemini indisponível, tentando a Groq...", geminiError.message);
            try {
                respostaTexto = await chamarGroq(SYSTEM_PROMPT, historicoFormatado, mensagem);
            } catch (groqError) {
                console.error("⚠️ Groq também falhou:", groqError.message);
                respostaTexto = `Jorge, meus circuitos neurais oscilaram agora há pouco. Tenta mandar sua mensagem de novo em instantes!`;
            }
        }

        res.json({ resposta: respostaTexto });

    } catch (error) {
        console.error("Erro interno no servidor:", error);
        res.status(500).json({ resposta: "⚠️ Erro crítico nos meus sistemas internos. Tente novamente." });
    }
});

// --- SISTEMA DE BRIDGE PARA CONTROLE LOCAL DO PC ---
let filaComandos = [];
let comandoAtualId = 1;

// Rota para o seu PC buscar se há ordens pendentes
app.get('/api/bridge/obter-comando', (req, res) => {
    if (filaComandos.length > 0) {
        const cmd = filaComandos.shift();
        res.json(cmd);
    } else {
        res.json({ comando: null });
    }
});

// Rota para o PC devolver o resultado da execução para o servidor
app.post('/api/bridge/resposta', (req, res) => {
    const { id, resultado } = req.body;
    console.log(`[Bridge] Comando finalizado: ${resultado}`);
    res.json({ status: "recebido" });
});
// ---------------------------------------------------

// Porta dinâmica (pega do .env ou padrão 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});