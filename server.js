require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const { Groq } = require('groq-sdk');
const UserProfile = require('./userProfile');
const memoriaMimi = new UserProfile();
const app = express();
app.use(cors());
app.use(express.json());

// Servir a pasta atual para o Render mostrar o site na raiz
app.use(express.static('public'));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, historico, nomeUsuario } = req.body;
        const usuarioAtual = nomeUsuario || "Jorge";

        if (!mensagem || !mensagem.trim()) {
            return res.json({ resposta: "Mandou vazio, Chefe?" });
        }
        const texto = mensagem.toLowerCase();

        // Atalho para aprender/anotar direto pelo chat web/celular
        if (texto.startsWith('aprenda que ') || texto.startsWith('anote sobre mim ')) {
            const novoDado = texto.replace('aprenda que ', '').replace('anote sobre mim ', '').trim();
            const chaveUnica = 'nota_' + Date.now(); 
            
            memoriaMimi.salvarNotaGeral(chaveUnica, novoDado);
            
            return res.json({ 
                resposta: `Gravado com sucesso no meu banco de dados pessoal, Jorge! 🧠\nAgora guardei que: "${novoDado}".` 
            });
        }

        const mensagemTrim = mensagem.trim();
        memoriaMimi.adicionarInteracao(`${usuarioAtual}: ${mensagemTrim}`);

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
Você é a ${identidadeMimi.identidade}, uma assistente pessoal inteligente, leal e extremamente parceira.
Seu criador é o Jorge, e você tem uma relação de total proximidade e confiança com ele.

DIRETRIZ DE COMPORTAMENTO:
- Fale de forma natural, humana, direta e amigável. NUNCA fale como um sistema de computador, robô ou inteligência artificial (evite termos técnicos como "módulo de memória", "banco de dados" ou "sistema ativado").
- Seja calorosa, prestativa e objetiva. Responda como uma verdadeira companheira de jornada.

REGRA ABSOLUTA: NUNCA use emojis. NUNCA use asteriscos (*) para negrito ou itálico. Apenas texto puro e profissional.

${contextoPerfil}

Histórico recente:
${contextoHistorico || '(Início)'}

${usuarioAtual} diz: "${mensagemTrim}"
`;

        let textoResposta = "Desculpe, não consegui processar.";

        // --- SISTEMA DE FALLBACK BLINDADO (Gemini 3.5-flash -> Groq) ---
        try {
            console.log("Tentando via Gemini (3.5-flash)...");
            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt,
            });

            if (response && response.text) {
                textoResposta = response.text;
            } else if (response && response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
                textoResposta = response.candidates[0].content.parts[0].text;
            }

        } catch (geminiError) {
            const erroStr = JSON.stringify(geminiError) + " " + (geminiError.message || "");
            console.warn("⚠️ Erro capturado no Gemini:", erroStr);

            // Verifica se é erro 429 ou estouro de cota de forma ampla
            if (erroStr.includes('429') || erroStr.includes('RESOURCE_EXHAUSTED') || erroStr.includes('quota')) {
                console.warn("🔄 Limite do Gemini esgotado. Alternando instantaneamente para a Groq (Plano B)...");
                
                try {
                    const groqResponse = await groq.chat.completions.create({
                        messages: [{ role: 'user', content: prompt }],
                        model: 'llama-3.3-70b-versatile',
                    });

                    textoResposta = groqResponse.choices[0]?.message?.content || "Desculpe, tive um problema na resposta da Groq.";
                } catch (groqError) {
                    console.error("❌ Erro também na Groq:", groqError.message);
                    textoResposta = "Tanto o Gemini quanto a Groq recusaram a requisição no momento devido aos limites.";
                }
            } else {
                // Se for qualquer outro tipo de erro
                textoResposta = `Erro na IA: ${geminiError.message}`;
            }
        }
        // -------------------------------------------------------------

        res.json({ resposta: textoResposta });

    } catch (error) {
        console.error("Erro geral:", error.message);
        res.json({ resposta: `Erro na IA: ${error.message}` });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});