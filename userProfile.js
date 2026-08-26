const fs = require('fs');
const path = require('path');

class UserProfile {
    constructor() {
        this.filePath = path.resolve(__dirname, 'mimi.json');
        this.inicializarArquivo();
    }

    inicializarArquivo() {
        if (!fs.existsSync(this.filePath)) {
            const dadosIniciais = {
                notas: {},
                interacoes: []
            };
            fs.writeFileSync(this.filePath, JSON.stringify(dadosIniciais, null, 2), 'utf8');
        }
    }

    lerDados() {
        try {
            if (!fs.existsSync(this.filePath)) {
                return { notas: {}, interacoes: [] };
            }
            const conteudo = fs.readFileSync(this.filePath, 'utf8');
            return JSON.parse(conteudo);
        } catch (error) {
            console.error('Erro ao ler mimi.json:', error);
            return { notas: {}, interacoes: [] };
        }
    }

    salvarDados(dados) {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(dados, null, 2), 'utf8');
        } catch (error) {
            console.error('Erro ao salvar mimi.json:', error);
        }
    }

    salvarNotaGeral(chave, valor) {
        const dados = this.lerDados();
        dados.notas[chave] = valor;
        this.salvarDados(dados);
    }

    adicionarInteracao(interacao) {
        const dados = this.lerDados();
        dados.interacoes.push({
            texto: interacao,
            timestamp: new Date().toISOString()
        });
        // Mantém apenas as últimas 100 interações para não inchar o arquivo
        if (dados.interacoes.length > 100) {
            dados.interacoes = dados.interacoes.slice(-100);
        }
        this.salvarDados(dados);
    }

    obterIdentidadeMimi() {
        return {
            identidade: "Mimi"
        };
    }

    // Como agora é síncrono via JSON, podemos retornar diretamente no callback
    obterContextoParaIA(callback) {
        const dados = this.lerDados();
        const chaves = Object.keys(dados.notas);
        
        if (chaves.length === 0) {
            return callback("Notas e memórias salvas: Nenhuma registrada ainda.");
        }

        const notasTexto = chaves.map(chave => `- ${dados.notas[chave]}`).join('\n');
        callback(`Notas e memórias salvas sobre o Jorge e projetos:\n${notasTexto}`);
    }
}

module.exports = UserProfile;