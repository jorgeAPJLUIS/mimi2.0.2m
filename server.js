const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const UserProfile = require('./userProfile');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const memoriaMimi = new UserProfile();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, historico, nomeUsuario } = req.body;
        const usuarioAtual = nomeUsuario || "Jorge";

        if (!mensagem) {
            return res.json({ resposta: "Mandei vazio, Chefe?" });
        }

        memoriaMimi.adicionarInteracao(`${usuarioAtual}: ${mensagem}`);

        if (mensagem.toLowerCase().startsWith('mimi dev:')) {
            const acao = mensagem.replace('mimi dev:', '').trim();
            if (acao.includes('atualizar git') || acao.includes('fazer push')) {
                exec('git add . && git commit -m "Auto-update via Mimi Dev Agent" && git push', (error, stdout) => {
                    if (error) return res.json({ resposta: `Erro no Git: ${error.message}` });
                    res.json({ resposta: `Comando executado!\nLog: ${stdout}` });
                });
                return;
            }
        }

        if (mensagem.toLowerCase().includes('quem sou eu')) {
            const u = memoriaMimi.obterDadosUsuario();
            return res.json({ resposta: `Base acessada, ${usuarioAtual}! 🧠\nNome: ${u.nome}\nEstilo: ${u.estiloDeVida?.trabalhoOuEstudo || 'Desenvolvedor'}` });
        }

        let contextoHistorico = "";
        if (historico && Array.isArray(historico) && historico.length > 0) {
            const ultimasMensagens = historico.slice(-4); // Pega apenas as últimas 4 para garantir leveza máxima
            contextoHistorico = ultimasMensagens.map(h => 
                `${h.remetente === 'user' ? usuarioAtual : 'Mimi'}: ${h.texto}`
            ).join('\n');
        }

        const identidadeMimi = memoriaMimi.obterIdentidadeMimi();

        const prompt = `
            Você é a ${identidadeMimi.identidade}, uma assistente pessoal inteligente, gentil e tecnológica. 
            Você está conversando agora com: ${usuarioAtual}.
            
            Histórico recente:
            ${contextoHistorico}
            
            ${usuarioAtual} diz: "${mensagem}"
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
        });

        const textoResposta = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text) || "Desculpe, não consegui processar a resposta.";
        
        res.json({ resposta: textoResposta });

    } catch (error) {
        console.error("ERRO REAL DA API:", error.message);
        res.json({ resposta: `Erro interno na IA: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`Mimi 2.0 rodando na porta ${PORT}`);
});