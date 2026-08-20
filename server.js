require('dotenv').config();
const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');
const UserProfile = require('./userProfile');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Verifica se a chave da API existe antes de subir
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERRO: GEMINI_API_KEY não definida!");
    console.error("💡 Crie um arquivo .env na raiz com: GEMINI_API_KEY=sua_chave_aqui");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const memoriaMimi = new UserProfile();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API de Chat
app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, historico, nomeUsuario } = req.body;
        const usuarioAtual = nomeUsuario || "Jorge";

        if (!mensagem || !mensagem.trim()) {
            return res.json({ resposta: "Mandou vazio, Chefe? 😄" });
        }

        const mensagemTrim = mensagem.trim();
        memoriaMimi.adicionarInteracao(`${usuarioAtual}: ${mensagemTrim}`);

        // ─── COMANDOS ESPECIAIS ───
        if (mensagemTrim.toLowerCase().startsWith('mimi dev:')) {
            const acao = mensagemTrim.replace('mimi dev:', '').trim().toLowerCase();
            if (acao.includes('atualizar git') || acao.includes('fazer push')) {
                exec('git add . && git commit -m "Auto-update via Mimi Dev Agent" && git push', (error, stdout, stderr) => {
                    if (error) {
                        console.error("Erro Git:", error);
                        return res.json({ resposta: `❌ Erro no Git: ${error.message}` });
                    }
                    res.json({ resposta: `✅ Git executado!\n\`\`\`\n${stdout}\n\`\`\`` });
                });
                return;
            }
            return res.json({ resposta: "Comando dev não reconhecido. Tente 'atualizar git' ou 'fazer push'." });
        }

        if (mensagemTrim.toLowerCase().includes('quem sou eu')) {
            const u = memoriaMimi.obterDadosUsuario();
            const notas = memoriaMimi.memoria.historicoContextual?.notasGerais || {};
            const notasKeys = Object.keys(notas).filter(k => k !== 'geral' && k !== 'projetoAtual');

            let resposta = `🧠 Base acessada, ${usuarioAtual}!\n\n**Seu Perfil:**\n- Nome: ${u.nome || 'Jorge'}\n- Estilo: ${u.estiloDeVida?.trabalhoOuEstudo || 'Desenvolvedor'}\n- Moradia: ${u.estiloDeVida?.moradia || 'Não informada'}`;

            if (u.preferencias?.gostosPessoais?.length) {
                resposta += `\n- Gostos: ${u.preferencias.gostosPessoais.join(', ')}`;
            }

            if (notasKeys.length > 0) {
                resposta += `\n\n📌 **Coisas que você me ensinou:**`;
                notasKeys.forEach(chave => {
                    resposta += `\n- ${notas[chave]}`;
                });
            }

            return res.json({ resposta });
        }

        if (mensagemTrim.toLowerCase().startsWith('aprenda que ') || mensagemTrim.toLowerCase().startsWith('anote sobre mim ')) {
            const novoDado = mensagemTrim.replace('aprenda que ', '').replace('anote sobre mim ', '').trim();
            const chaveUnica = 'nota_' + Date.now();
            memoriaMimi.salvarNotaGeral(chaveUnica, novoDado);
            return res.json({ resposta: `🧠 Gravado com sucesso!\nAgora guardei que: "${novoDado}".` });
        }

        // ─── CHAMADA À IA (GEMINI) ───
        let contextoHistorico = "";
        if (historico && Array.isArray(historico) && historico.length > 0) {
            const ultimasMensagens = historico.slice(-6);
            contextoHistorico = ultimasMensagens.map(h =>
                `${h.remetente === 'user' ? usuarioAtual : 'Mimi'}: ${h.texto}`
            ).join('\n');
        }

        const identidadeMimi = memoriaMimi.obterIdentidadeMimi();
        const contextoPerfil = memoriaMimi.obterContextoParaIA();

        const prompt = `
Você é a ${identidadeMimi.identidade}, uma assistente pessoal inteligente, gentil, carinhosa e tecnológica.
Seu criador e centro do seu ecossistema é o Jorge.
Seu objetivo absoluto é ajudá-lo, protegê-lo e ser sua parceira de todas as horas.
Responda de forma natural, prestativa e amigável em português do Brasil.

${contextoPerfil}

Histórico recente da conversa:
${contextoHistorico || '(Início da conversa)'}

${usuarioAtual} diz: "${mensagemTrim}"
`;

       const response = await ai.models.generateContent({
   model: 'gemini-2.5-flash',
    contents: prompt,
});

        // Tratamento robusto da resposta
        let textoResposta = "Desculpe, não consegui processar a resposta.";

        if (response && response.text) {
            textoResposta = response.text;
        } else if (response && response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
            textoResposta = response.candidates[0].content.parts[0].text;
        } else if (typeof response === 'string') {
            textoResposta = response;
        }

        res.json({ resposta: textoResposta });

    } catch (error) {
        console.error("❌ ERRO NA API:", error);
        res.json({ resposta: `😅 Erro interno: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Mimi 2.0 rodando na porta ${PORT}`);
    console.log(`📁 Acesse: http://localhost:${PORT}`);
});