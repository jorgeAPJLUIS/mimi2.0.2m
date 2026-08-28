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

// Rota para buscar histórico por usuário
app.get('/api/historico/:usuario', (req, res) => {
    // Aqui você pode implementar a leitura do histórico por usuário se necessário
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
// Se veio nomeUsuario ou usuario, usa ele; senão, assume que é o Jorge para o sistema não pirar
const usuarioAtual = nomeUsuario || usuario || "Jorge";

      const SYSTEM_PROMPT = `Você é a Mimi, uma assistente virtual inteligente e direta. O usuário conversando com você é o seu criador e administrador, Jorge.

DIRETRIZES:
1. Trate sempre o Jorge pelo nome, com respeito e atenção. Nunca o chame de "visitante".
2. Responda de forma clara, prestativa e objetiva, sem repetições desnecessárias ou termos robóticos excessivos.
3. Se ele pedir o modo dev ou comandos de sistema, atenda prontamente.`;
        let historicoFormatado = [];
        if (historico && Array.isArray(historico)) {
            historicoFormatado = historico.map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content || h.parts?.[0]?.text || '' }]
            }));
        }

        let respostaTexto = "";

        try {
            console.log(`[${usuarioAtual}] Processando via Gemini...`);
            
            const response = await ai.models.generateContent({
                model:'gemini-3.5-flash-lite', // Usando uma versão estável e garantida
                contents: [
                    ...historicoFormatado,
                    { role: 'user', parts: [{ text: mensagem }] }
                ],
                config: {
                    systemInstruction: SYSTEM_PROMPT,
                }
            });

            // Garante a leitura correta do texto retornado
            respostaTexto = response.text || (response.candidates?.[0]?.content?.parts?.[0]?.text) || "Processamento concluído, mas sem texto de retorno.";

        } catch (geminiError) {
            console.warn("⚠️ Gemini indisponível, tentando a Groq...", geminiError.message);
            try {
                respostaTexto = await chamarGroq(SYSTEM_PROMPT, historicoFormatado, mensagem);
            } catch (groqError) {
                console.error("⚠️ Groq também falhou:", groqError.message);
                respostaTexto = `Meus circuitos neurais oscilaram agora há pouco, ${usuarioAtual}. Tenta mandar sua mensagem de novo em instantes!`;
            }
        }

        res.json({ resposta: respostaTexto });

    } catch (error) {
        console.error("Erro interno no servidor:", error);
        res.status(500).json({ resposta: "⚠️ Erro crítico nos meus sistemas internos. Tente novamente." });
    }
});

// Porta dinâmica (pega do .env ou padrão 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});