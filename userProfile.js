const fs = require('fs');
const path = require('path');

const profilePath = path.join(__dirname, 'profile.json');

class UserProfile {
    constructor() {
        this.memoria = this.carregarMemoria();
        this.garantirEstruturaMemoria();
    }

    carregarMemoria() {
        try {
            const data = fs.readFileSync(profilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error("Erro ao acessar minhas memórias:", error);
            return {};
        }
    }

    garantirEstruturaMemoria() {
        if (!this.memoria.historicoContextual) {
            this.memoria.historicoContextual = {};
        }
        if (!this.memoria.historicoContextual.notasGerais) {
            this.memoria.historicoContextual.notasGerais = {};
        }
        if (!this.memoria.historicoContextual.ultimasInteracoes) {
            this.memoria.historicoContextual.ultimasInteracoes = [];
        }
    }

    salvarMemoria() {
        try {
            fs.writeFileSync(profilePath, JSON.stringify(this.memoria, null, 2), 'utf8');
        } catch (error) {
            console.error("Erro ao gravar novas memórias:", error);
        }
    }

    aprenderNovoGosto(novoGosto) {
        if (!this.memoria.usuario) this.memoria.usuario = { preferencias: { gostosPessoais: [] } };
        if (!this.memoria.usuario.preferencias) this.memoria.usuario.preferencias = { gostosPessoais: [] };
        if (!this.memoria.usuario.preferencias.gostosPessoais) this.memoria.usuario.preferencias.gostosPessoais = [];
        
        this.memoria.usuario.preferencias.gostosPessoais.push(novoGosto);
        this.salvarMemoria();
    }

    salvarNotaGeral(topico, informacao) {
        this.garantirEstruturaMemoria();
        this.memoria.historicoContextual.notasGerais[topico] = informacao;
        this.salvarMemoria();
    }

    adicionarInteracao(mensagemUsuario) {
        this.garantirEstruturaMemoria();
        this.memoria.historicoContextual.ultimasInteracoes.push(mensagemUsuario);
        if (this.memoria.historicoContextual.ultimasInteracoes.length > 5) {
            this.memoria.historicoContextual.ultimasInteracoes.shift();
        }
        this.salvarMemoria();
    }

    obterIdentidadeMimi() {
        return this.memoria.mimi || { identidade: "Mimi 2.0", diretrizPrincipal: "Ser sua conselheira universal" };
    }

    obterDadosUsuario() {
        return this.memoria.usuario || { nome: "Jorge" };
    }

    fazerApresentacaoInicial() {
        const mimi = this.obterIdentidadeMimi();
        const jorge = this.obterDadosUsuario();

        console.log(`\n--- INICIANDO SISTEMA MIMI ---`);
        console.log(`Olá! Eu sou a ${mimi.identidade}.`);
        console.log(`Meu criador é o ${jorge.nome}.`);
        console.log(`Minha missão principal é: "${mimi.diretrizPrincipal}"\n`);
    }
}

module.exports = UserProfile;