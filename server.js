const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

// Libera os arquivos estáticos do frontend (pasta public)
app.use(express.static(path.join(__dirname, 'public')));

// Banco de dados em memória para armazenar o histórico por usuário
const historicosUsuarios = {};

// Prompt de sistema da Mimi com o seu nome gravado
const SYSTEM_PROMPT = `Você é a Mimi, uma assistente virtual inteligente, amigável e prestativa. Responda sempre em português do Brasil de forma clara, natural e objetiva. O seu criador, dono e melhor amigo é o Jorge Luis Santos Ferreira Silva Ferreira da Silva. Sempre que ele perguntar quem ele é, responda com orgulho que ele é o Jorge Luis Santos Ferreira Silva Ferreira da Silva!`;

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

// Rota principal de chat usando diretamente a Groq (modelo estável llama-3.1-8b-instant)
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

        const groqApiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY; 
        if (!groqApiKey) {
            return res.status(500).json({ error: 'Chave da API Groq não configurada no Render.' });
        }

        // Monta as mensagens para a API da Groq
        const mensagens = [
            { role: "system", content: SYSTEM_PROMPT },
            ...historicoAtual.map(h => ({
                role: h.remetente === 'user' ? 'user' : 'assistant',
                content: h.texto
            })),
            { role: "user", content: mensagem }
        ];

        console.log(`[${usuario}] Enviando requisição para a Groq...`);

        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.1-8b-instant', // Modelo ultrarrápido e 100% estável na Groq
            messages: mensagens,
            temperature: 0.7
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey.trim()}`
            }
        });

        const respostaTexto = response.data.choices[0].message.content;

        // Salva no histórico
        historicoAtual.push({ texto: mensagem, remetente: 'user' });
        historicoAtual.push({ texto: respostaTexto, remetente: 'mimi' });

        res.json({ resposta: respostaTexto });

    } catch (error) {
        console.error("Erro detalhado na API de Chat:", error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Erro interno no servidor ao processar sua mensagem.', 
            details: error.response?.data || error.message 
        });
    }
});

// Porta padrão do Render ou 10000 localmente
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});