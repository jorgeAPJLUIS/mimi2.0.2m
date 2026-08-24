require('dotenv').config();
const readline = require('readline');
const UserProfile = require('./userProfile');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

// Inicializa a IA com a sua chave
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY  });

const memoriaMimi = new UserProfile();
memoriaMimi.fazerApresentacaoInicial();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const mimi = memoriaMimi.obterIdentidadeMimi();
const jorge = memoriaMimi.obterDadosUsuario();

console.log(`\n[${mimi.identidade}]: Olá, ${jorge.nome}! Como posso te ajudar e cuidar de você hoje? (Digite "sair" para encerrar)`);

// FUNÇÃO PRINCIPAL DE PROCESSAMENTO COM IA + COMANDOS LOCAIS
async function processarMensagem(mensagem) {
    const texto = mensagem.toLowerCase();
    memoriaMimi.adicionarInteracao(mensagem);

    // 0. CONSULTAR O PRÓPRIO PERFIL (Perfil do Jorge)
    if (texto.includes('quem sou eu') || texto.includes('o que você sabe sobre mim') || texto.includes('meu perfil') || texto.includes('teu perfil') || texto.includes('seu perfil')) {
        const u = memoriaMimi.obterDadosUsuario();
        const notasExtras = memoriaMimi.memoria.historicoContextual.notasGerais || {};
        
        let respostaPerfil = `Base de dados acessada, Jorge! 🧠💾\n\n- Nome: ${u.nome}\n- Idade: ${u.idade || 'Não informada'}\n- Onde mora: ${u.ondeMora || 'Brasil'}\n- Trabalho/Estilo de vida: ${u.estiloDeVida?.trabalhoOuEstudo || 'Desenvolvedor'}\n- Gostos principais: ${u.preferencias?.gostosPessoais?.join(', ') || 'Tecnologia'}\n- Esposa: ${u.relacionamentos?.esposa?.nome || 'Michele'}`;
        
        const chavesNotas = Object.keys(notasExtras).filter(k => k !== 'geral' && k !== 'projetoAtual');
        if (chavesNotas.length > 0) {
            respostaPerfil += `\n\n📌 **Coisas que você me ensinou:**`;
            chavesNotas.forEach(chave => {
                respostaPerfil += `\n- ${notasExtras[chave]}`;
            });
        }

        return respostaPerfil;
    }

    // 0.1. QUEM É A MIMI
    else if (texto.includes('quem é você') || texto.includes('quem e vc') || texto.includes('qual é o seu nome')) {
        return `Eu sou a ${mimi.identidade}, sua assistente pessoal e conselheira universal! Meu criador e o centro do meu ecossistema é você, Jorge. ❤️`;
    }

    // 0.2. ENSINAR / ATUALIZAR ALGO NO PERFIL
    else if (texto.startsWith('aprenda que ') || texto.startsWith('anote sobre mim ')) {
        const novoDado = texto.replace('aprenda que ', '').replace('anote sobre mim ', '').trim();
        const chaveUnica = 'nota_' + Date.now(); 
        
        memoriaMimi.salvarNotaGeral(chaveUnica, novoDado);
        
        return `Gravado com sucesso no meu banco de dados pessoal, Jorge! 🧠\nAgora guardei que: "${novoDado}".`;
    }

    // 1. AUTOMAÇÃO: Criar Pastas
    else if (texto.startsWith('criar pasta ') || texto.startsWith('crie uma pasta chamada ')) {
        const nomePasta = texto.replace('criar pasta ', '').replace('crie uma pasta chamada ', '').trim();
        const caminhoPasta = path.join(process.cwd(), nomePasta);

        try {
            if (!fs.existsSync(caminhoPasta)) {
                fs.mkdirSync(caminhoPasta);
                return `Pasta "${nomePasta}" criada com sucesso aqui na raiz do projeto, Jorge! 📂`;
            } else {
                return `A pasta "${nomePasta}" já existe, Jorge.`;
            }
        } catch (error) {
            return `Erro ao criar a pasta: ${error.message}`;
        }
    }

    // 2. AUTOMAÇÃO: Criar Arquivos
    else if (texto.startsWith('crie um arquivo ') || texto.startsWith('criar arquivo ')) {
        let partes = mensagem.split(' com o código ');
        if (partes.length < 2) {
            partes = mensagem.split(' com o texto ');
        }

        const comandoArquivo = partes[0].toLowerCase();
        const nomeArquivo = comandoArquivo.replace('crie um arquivo ', '').replace('criar arquivo ', '').trim();
        const conteudoCodigo = partes[1] ? partes[1].trim() : '// Código gerado pela Mimi\nconsole.log("Olá, mundo!");';

        try {
            fs.writeFileSync(nomeArquivo, conteudoCodigo, 'utf8');
            return `Arquivo "${nomeArquivo}" criado e editado com sucesso! Já coloquei o seu conteúdo lá dentro. 📝💻`;
        } catch (error) {
            return `Erro ao criar o arquivo: ${error.message}`;
        }
    }

    // 3. Abrir Programas
    else if (texto.startsWith('abra o ') || texto.startsWith('abrir ')) {
        const programa = texto.replace('abra o ', '').replace('abrir ', '').trim();
        let comando = '';
        if (programa === 'vs code' || programa === 'vscode') {
            comando = 'code .';
        } else if (programa === 'chrome') {
            comando = 'start chrome';
        } else if (programa === 'calculadora') {
            comando = 'calc';
        } else {
            return `Eu ainda não sei abrir o "${programa}", Jorge.`;
        }

        exec(comando, (err) => {
            if (err) console.log(`Erro: ${err}`);
        });
        return `Abrindo o ${programa} para você agora mesmo!`;
    }

    // 4. SE NÃO FOR COMANDO LOCAL, DELEGA PARA A IA REAL (Gemini)
    else {
        try {
            console.log(`\n[${mimi.identidade}]: Pensando com IA... 🤖`);
            
            const promptComPersonalidade = `Você é a Mimi 2.0, uma assistente pessoal inteligente, gentil, carinhosa e conselheira universal. Seu criador e centro do seu ecossistema é o Jorge (desenvolvedor, entusiasta de tecnologia). Responda de forma natural, prestativa e amigável em português do Brasil. Pergunta do Jorge: "${mensagem}"`;

            const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash', // Nome correto do modelo atual
    contents: promptComPersonalidade,
});

            // Tratamento seguro do retorno da API
            const textoResposta = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text) || "Desculpe, Jorge, não consegui processar a resposta direito.";
            return textoResposta;

        } catch (error) {
            return `Tive um pequeno problema ao consultar meus circuitos de IA, Jorge: ${error.message}`;
        }
    }
}

function iniciarChat() {
    rl.question('\n[Você]: ', async (mensagem) => {
        if (mensagem.toLowerCase() === 'sair') {
            console.log(`\n[${mimi.identidade}]: Estarei sempre aqui quando precisar. Até logo, meu criador! ❤️\n`);
            rl.close();
            return;
        }

        const respostaDaMimi = await processarMensagem(mensagem);
        console.log(`\n[${mimi.identidade}]: ${respostaDaMimi}`);

        iniciarChat();
    });
}

iniciarChat();