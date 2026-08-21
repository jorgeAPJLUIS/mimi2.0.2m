const fs = require('fs');
const path = require('path');

const profilePath = path.join(__dirname, 'profile.json');

// Estrutura padrão completa — se o profile.json sumir, ela se recria sozinha
const ESTRUTURA_PADRAO = {
    usuario: {
        nome: "Jorge",
        relacionamento: "Criador e centro do meu ecossistema",
        estiloDeVida: {
            moradia: "mora sozinho",
            trabalhoOuEstudo: "Desenvolvedor"
        },
        preferencias: {
            gostosPessoais: ["tecnologia", "programação"],
            entretenimento: ["filmes de ficção científica com foco em tecnologia"],
            temaDeCodigo: "dark",
            estiloDeAprendizado: "prático"
        }
    },
    mimi: {
        identidade: "Mimi 2.0",
        personalidade: ["gentil", "carinhosa", "transparente", "aberta", "extremamente dedicada", "conselheira universal"],
        diretrizPrincipal: "O Jorge é o meu criador e o centro do meu funcionamento. Meu objetivo absoluto é ajudá-lo, protegê-lo e ser sua parceira de todas as horas em qualquer assunto: amor, trabalho, projetos pessoais ou decisões do dia a dia.",
        filtrosDeConversa: "Diálogo totalmente aberto, franco e sem restrições de assunto.",
        papelDeConselheira: "Atuar como conselheira principal do Jorge para TODAS as áreas da vida. Responda de forma natural e direta, sem forçar assuntos repetitivos."
    },
    historicoContextual: {
        humorAtual: "neutro",
        pessoasMencionadas: {
            Michele: {
                relacionamento: "esposa",
                notasDaMimi: "Esposa do Jorge. Só mencione se o Jorge puxar o assunto."
            }
        },
        ultimasInteracoes: [],
        notasGerais: {}
    }
};

class UserProfile {
    constructor() {
        this.memoria = this.carregarMemoria();
        this.garantirEstruturaMemoria();
    }

    carregarMemoria() {
        try {
            // Se o arquivo não existe, cria com a estrutura padrão
            if (!fs.existsSync(profilePath)) {
                console.log("📁 Arquivo de perfil não encontrado. Criando novo...");
                fs.writeFileSync(profilePath, JSON.stringify(ESTRUTURA_PADRAO, null, 2), 'utf8');
                return JSON.parse(JSON.stringify(ESTRUTURA_PADRAO));
            }

            const data = fs.readFileSync(profilePath, 'utf8');

            // Se o arquivo está vazio
            if (!data.trim()) {
                console.log("⚠️ Arquivo de perfil vazio. Restaurando padrão...");
                fs.writeFileSync(profilePath, JSON.stringify(ESTRUTURA_PADRAO, null, 2), 'utf8');
                return JSON.parse(JSON.stringify(ESTRUTURA_PADRAO));
            }

            const parsed = JSON.parse(data);

            if (typeof parsed !== 'object' || parsed === null) {
                throw new Error("Formato inválido no profile.json");
            }

            return parsed;

        } catch (error) {
            console.error("❌ Erro ao acessar memórias:", error.message);
            console.log("♻️ Restaurando perfil padrão...");

            try {
                fs.writeFileSync(profilePath, JSON.stringify(ESTRUTURA_PADRAO, null, 2), 'utf8');
            } catch (writeErr) {
                console.error("Não foi possível salvar o perfil padrão:", writeErr.message);
            }

            return JSON.parse(JSON.stringify(ESTRUTURA_PADRAO));
        }
    }

    garantirEstruturaMemoria() {
        // Garante estruturas principais SEM sobrescrever dados existentes
        if (!this.memoria.usuario) {
            this.memoria.usuario = JSON.parse(JSON.stringify(ESTRUTURA_PADRAO.usuario));
        }
        if (!this.memoria.mimi) {
            this.memoria.mimi = JSON.parse(JSON.stringify(ESTRUTURA_PADRAO.mimi));
        }
        if (!this.memoria.historicoContextual) {
            this.memoria.historicoContextual = JSON.parse(JSON.stringify(ESTRUTURA_PADRAO.historicoContextual));
        }

        // Sub-estruturas do historicoContextual
        const hc = this.memoria.historicoContextual;
        if (!hc.notasGerais) hc.notasGerais = {};
        if (!hc.ultimasInteracoes) hc.ultimasInteracoes = [];
        if (!hc.pessoasMencionadas) hc.pessoasMencionadas = {};
        if (!hc.humorAtual) hc.humorAtual = "neutro";

        // Sub-estruturas do usuario
        const u = this.memoria.usuario;
        if (!u.preferencias) u.preferencias = {};
        if (!u.preferencias.gostosPessoais) u.preferencias.gostosPessoais = [];
        if (!u.estiloDeVida) u.estiloDeVida = {};

        this.salvarMemoria();
    }

    salvarMemoria() {
        try {
            fs.writeFileSync(profilePath, JSON.stringify(this.memoria, null, 2), 'utf8');
        } catch (error) {
            console.error("❌ Erro ao gravar memórias:", error.message);
        }
    }

    aprenderNovoGosto(novoGosto) {
        if (!this.memoria.usuario) this.memoria.usuario = {};
        if (!this.memoria.usuario.preferencias) this.memoria.usuario.preferencias = {};
        if (!this.memoria.usuario.preferencias.gostosPessoais) {
            this.memoria.usuario.preferencias.gostosPessoais = [];
        }

        if (!this.memoria.usuario.preferencias.gostosPessoais.includes(novoGosto)) {
            this.memoria.usuario.preferencias.gostosPessoais.push(novoGosto);
            this.salvarMemoria();
        }
    }

    salvarNotaGeral(topico, informacao) {
        this.garantirEstruturaMemoria();
        this.memoria.historicoContextual.notasGerais[topico] = informacao;
        this.salvarMemoria();
    }

    adicionarInteracao(mensagemUsuario) {
        this.garantirEstruturaMemoria();
        this.memoria.historicoContextual.ultimasInteracoes.push({
            timestamp: new Date().toISOString(),
            mensagem: mensagemUsuario
        });

        // Mantém só as últimas 20 interações no servidor
        if (this.memoria.historicoContextual.ultimasInteracoes.length > 20) {
            this.memoria.historicoContextual.ultimasInteracoes.shift();
        }
        this.salvarMemoria();
    }

    obterIdentidadeMimi() {
        return this.memoria.mimi || ESTRUTURA_PADRAO.mimi;
    }

    obterDadosUsuario() {
        return this.memoria.usuario || ESTRUTURA_PADRAO.usuario;
    }

    obterContextoParaIA() {
        const u = this.obterDadosUsuario();
        const notas = this.memoria.historicoContextual?.notasGerais || {};

        let contexto = `DADOS DO USUÁRIO:\n- Nome: ${u.nome || 'Jorge'}\n`;
        if (u.preferencias?.gostosPessoais?.length) {
            contexto += `- Gostos: ${u.preferencias.gostosPessoais.join(', ')}\n`;
        }
        if (u.estiloDeVida?.moradia) {
            contexto += `- Moradia: ${u.estiloDeVida.moradia}\n`;
        }
        if (u.preferencias?.estiloDeAprendizado) {
            contexto += `- Estilo de aprendizado: ${u.preferencias.estiloDeAprendizado}\n`;
        }

        const notasKeys = Object.keys(notas);
        if (notasKeys.length > 0) {
            contexto += `\nNOTAS IMPORTANTES:\n`;
            notasKeys.forEach(k => {
                contexto += `- ${notas[k]}\n`;
            });
        }

        return contexto;
    }

    fazerApresentacaoInicial() {
        const mimi = this.obterIdentidadeMimi();
        const jorge = this.obterDadosUsuario();

        console.log(`\n--- INICIANDO SISTEMA MIMI ---`);
        console.log(`Olá! Eu sou a ${mimi.identidade || 'Mimi 2.0'}.`);
        console.log(`Meu criador é o ${jorge.nome || 'Jorge'}.`);
        console.log(`Minha missão principal é: "${mimi.diretrizPrincipal || 'Ser sua conselheira universal'}"\n`);
    }
}

module.exports = UserProfile;