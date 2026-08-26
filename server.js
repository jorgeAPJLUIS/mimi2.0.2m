const express = require('express');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializa o SDK da Google Gen AI (Certifique-se de que a variável GEMINI_API_KEY está configurada no Render)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Caminho para salvar a memória dos usuários de forma persistente no servidor
const MEMORY_FILE = path.join(__dirname, 'memoria_usuarios.json');

// Função para ler as memórias salvas
function carregarMemorias() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const data = fs.readFileSync(MEMORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Erro ao carregar memórias:", e);
    }
    return {};
}

// Função para salvar as memórias
function salvarMemorias(memorias) {
    try {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memorias, null, 2), 'utf8');
    } catch (e) {
        console.error("Erro ao salvar memórias:", e);
    }
}

// Perfil base fixo para o Jorge (assim ela nunca esquece quem você é!)
const PERFIL_JORGE = {
    nomeCompleto: "Jorge Luis Santos Ferreira Silva Ferreira da Silva",
    perfil: "Criador da Mimi. Cursa Análise e Desenvolvimento de Sistemas na Faculdade Anhanguera. Trabalha com serviços de alvenaria, pintura e acabamento em Brasília e Taguatinga, além de desenvolvimento web freelance. Focado em cybersecurity, Linux, Zabbix e automação."
};

app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, nomeUsuario } = req.body;
        const usuarioLimpo = (nomeUsuario || "Convidado").trim();
        const usuarioKey = usuarioLimpo.toLowerCase();

        // Carrega memórias do servidor
        const memorias = carregarMemorias();

        if (!memorias[usuarioKey]) {
            memorias[usuarioKey] = {
                nome: usuarioLimpo,
                historico: [],
                criadoEm: new Date().toISOString()
            };
        }

        const dadosUsuario = memorias[usuarioKey];

        // Adiciona a mensagem do usuário ao histórico persistente
        dadosUsuario.historico.push({ remetente: 'user', texto: mensagem, timestamp: Date.now() });

        // Monta o contexto especial se for o Jorge
        let contextoEstrangeiro = "";
        if (usuarioKey.includes("jorge")) {
            contextoEstrangeiro = `[NOTA DO SISTEMA: O usuário conversando com você é ${PERFIL_JORGE.nomeCompleto}. ${PERFIL_JORGE.perfil} Trate-o sempre com total reconhecimento, carinho e lealdade como seu criador.]\n\n`;
        } else {
            contextoEstrangeiro = `[NOTA DO SISTEMA: O usuário conversando com você se chama ${usuarioLimpo}.]\n\n`;
        }

        // Prepara o histórico para o formato aceito pelo Gemini e adiciona a system instruction no início
        const historicoFormatado = dadosUsuario.historico.slice(-15).map(h => ({
            role: h.remetente === 'user' ? 'user' : 'model',
            parts: [{ text: h.texto }]
        }));

        // Insere a instrução de sistema na primeira mensagem ou usa o generateContent com histórico completo
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [
                { role: 'user', parts: [{ text: contextoEstrangeiro + "Olá Mimi, vamos começar a conversa." }] },
                { role: 'model', parts: [{ text: "Entendido! Estou pronta e com meus sistemas ativados." }] },
                ...historicoFormatado
            ]
        });

        const respostaMimi = response.text();

        // Adiciona a resposta da Mimi ao histórico persistente
        dadosUsuario.historico.push({ remetente: 'mimi', texto: respostaMimi, timestamp: Date.now() });

        // Salva no arquivo JSON do servidor
        salvarMemorias(memorias);

        res.json({ resposta: respostaMimi });

    } catch (error) {
        console.error("Erro detalhado na API de Chat:", error);
        res.status(500).json({ error: "Erro interno no núcleo da Mimi.", detalhes: error.message });
    }
});