app.post('/api/chat', async (req, res) => {
    try {
        const { mensagem, historico, nomeUsuario } = req.body;
        const usuarioAtual = nomeUsuario || "Jorge";

        if (!mensagem || !mensagem.trim()) {
            return res.json({ resposta: "Mandou vazio, Chefe?" });
        }
        const texto = mensagem.toLowerCase();

        // Atalho para aprender/anotar direto pelo chat
        if (texto.startsWith('aprenda que ') || texto.startsWith('anote sobre mim ')) {
            const novoDado = texto.replace('aprenda que ', '').replace('anote sobre mim ', '').trim();
            const chaveUnica = 'nota_' + Date.now(); 
            
            memoriaMimi.salvarNotaGeral(chaveUnica, novoDado);
            
            return res.json({ 
                resposta: `Gravado com sucesso no meu banco de dados SQLite, Jorge! Agora guardei que: "${novoDado}".` 
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

        // Obtém o contexto do banco de forma segura
        const contextoPerfil = await new Promise((resolve) => {
            memoriaMimi.obterContextoParaIA((resultado) => {
                resolve(resultado);
            });
        });

        const prompt = `
Você é a ${identidadeMimi.identidade}, uma assistente pessoal inteligente, leal e extremamente parceira.
Seu criador é o Jorge, e você tem uma relação de total proximidade e confiança com ele.

DIRETRIZ DE COMPORTAMENTO:
- Fale de forma natural, humana, direta e amigável. NUNCA fale como um sistema de computador, robô ou inteligência artificial.
- Seja calorosa, prestativa e objetiva. Responda como uma verdadeira companheira de jornada.

REGRA ABSOLUTA: NUNCA use emojis. NUNCA use asteriscos (*) para negrito ou itálico. Apenas texto puro e profissional.

${contextoPerfil}

Histórico recente:
${contextoHistorico || '(Início)'}

${usuarioAtual} diz: "${mensagemTrim}"
`;

        let textoResposta = "";

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: prompt,
            });

            if (response && response.text) {
                textoResposta = response.text;
            } else if (response && response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
                textoResposta = response.candidates[0].content.parts[0].text;
            } else {
                throw new Error("Resposta do Gemini veio sem texto.");
            }
        } catch (geminiError) {
            try {
                const groqResponse = await groq.chat.completions.create({
                    messages: [{ role: 'user', content: prompt }],
                    model: 'openai/gpt-oss-20b',
                });
                textoResposta = groqResponse.choices[0]?.message?.content || "Desculpe, tive um problema na resposta da Groq.";
            } catch (groqError) {
                textoResposta = "Desculpe, Jorge! Nossas duas IAs estão temporariamente indisponíveis no momento.";
            }
        }

        res.json({ resposta: textoResposta });

    } catch (error) {
        console.error("Erro geral no servidor:", error.message);
        res.json({ resposta: `Erro interno no servidor: ${error.message}` });
    }
});