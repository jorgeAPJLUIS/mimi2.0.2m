const express = require('express');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const axios = require('axios'); // Garanta que o axios está instalado no package.json

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

process.on('uncaughtException', (err) => {
    console.error('ERRO CRITICO NAO CAPTURADO:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('REJEICAO NAO TRATADA:', reason);
});

// Inicializa o SDK da Google Gen AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Caminho para salvar a memória dos usuários de forma persistente no servidor
const MEMORY_FILE = path.join(__dirname, 'memoria_usuarios.json');

function carregarMemorias() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const data = fs.readFileSync(MEMORY_FILE, 'utf8');
            return JSON.parse(data || '{}');
        }
    } catch (e) {
        console.error("Erro ao carregar memórias:", e);
    }
    return {};
}

function salvarMemorias(memorias) {
    try {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memorias, null, 2), 'utf8');
    } catch (e) {
        console.error("Erro ao salvar memórias:", e);
    }
}

const PERFIL_JORGE = {
    nomeCompleto: "Jorge Luis Santos Ferreira Silva Ferreira da Silva",
    perfil: "Criador da Mimi. Cursa Análise e Desenvolvimento de Sistemas na Faculdade Anhanguera. Trabalha com serviços de alvenaria, pintura e acabamento em Brasília e Taguatinga, além de desenvolvimento web freelance. Focado em cybersecurity, Linux, Zabbix e automação."
};

// FUNÇÃO DE FALLBACK PARA O GROK (xAI)
async function chamarGrok(promptSistema, historicoFormatado, mensagemAtual) {
    const grokApiKey = process.env.GROK_API_KEY;
    if (!grokApiKey) {
        throw new Error("GROK_API_KEY não configurada no ambiente.");
    }

    // Formata o histórico para o padrão OpenAI/Grok
    const mensagens = [
        { role: "system", content: promptSistema },
        ...historicoFormatado.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.parts[0].text
        })),
        { role: "user", content: mensagemAtual }
    ];

    const response = await axios.post('https://api.x.ai/v1/chat/completions', {
        model: 'grok-beta', // ou o modelo grok padrão que você utiliza
        messages: mensagens,
        temperature: 0.7
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${grokApiKey}`
        }
    });

    return response.data.choices[0].message.content;
}

app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, nomeUsuario } = req.body;
        const usuarioLimpo = (nomeUsuario || "Convidado").trim();
        const usuarioKey = usuarioLimpo.toLowerCase();

        const memorias = carregarMemorias();

        if (!memorias[usuarioKey]) {
            memorias[usuarioKey] = {
                nome: usuarioLimpo,
                historico: [],
                criadoEm: new Date().toISOString()
            };
        }

        const dadosUsuario = memorias[usuarioKey];
        dadosUsuario.historico.push({ remetente: 'user', texto: mensagem, timestamp: Date.now() });

        let contextoEstrangeiro = "";
        if (usuarioKey.includes("jorge")) {
            contextoEstrangeiro = `[NOTA DO SISTEMA: O usuário conversando com você é ${PERFIL_JORGE.nomeCompleto}. ${PERFIL_JORGE.perfil} Trate-o sempre com total reconhecimento, carinho e lealdade como seu criador.]\n\n`;
        } else {
            contextoEstrangeiro = `[NOTA DO SISTEMA: O usuário conversando com você se chama ${usuarioLimpo}.]\n\n`;
        }

        const historicoFormatado = dadosUsuario.historico.slice(-15).map(h => ({
            role: h.remetente === 'user' ? 'user' : 'model',
            parts: [{ text: h.texto }]
        }));

        let respostaMimi = "";

        try {
            // Tenta primariamente o Gemini
            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: [
                    { role: 'user', parts: [{ text: contextoEstrangeiro + "Olá Mimi, vamos começar a conversa." }] },
                    { role: 'model', parts: [{ text: "Entendido! Estou pronta e com meus sistemas ativados." }] },
                    ...historicoFormatado
                ]
            });
            respostaMimi = response.text();
        } catch (geminiError) {
            console.warn("⚠️ Gemini falhou (possível limite de cota/429). Acionando o **Grok** de emergência...", geminiError.message);
            
            // Aciona o Grok automaticamente como fallback
            const promptSistema = contextoEstrangeiro + "Você é a Mimi 2.0, uma assistente pessoal inteligente, gentil, carinhosa e conselheira universal.";
            respostaMimi = await chamarGrok(promptSistema, historicoFormatado, mensagem);
        }

        dadosUsuario.historico.push({ remetente: 'mimi', texto: respostaMimi, timestamp: Date.now() });
        salvarMemorias(memorias);

        res.json({ resposta: respostaMimi });

    } catch (error) {
        console.error("Erro detalhado na API de Chat (Geral/Fallback):", error);
        res.status(500).json({ error: "Erro interno no núcleo da Mimi.", detalhes: error.message });
    }
});

app.get('/api/historico/:usuario', (req, res) => {
    const usuarioKey = req.params.usuario.toLowerCase();
    const memorias = carregarMemorias();
    if (memorias[usuarioKey]) {
        res.json({ historico: memorias[usuarioKey].historico });
    } else {
        res.json({ historico: [] });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});