const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class UserProfile {
    constructor() {
        const dbPath = path.resolve(__dirname, 'mimi.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Erro ao conectar ao SQLite:', err.message);
            } else {
                console.log('Banco de dados SQLite conectado com sucesso.');
                this.inicializarTabelas();
            }
        });
    }

    inicializarTabelas() {
        this.db.run(`CREATE TABLE IF NOT EXISTS notas (
            chave TEXT PRIMARY KEY,
            valor TEXT
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS interacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            texto TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }

    salvarNotaGeral(chave, valor) {
        this.db.run(`INSERT OR REPLACE INTO notas (chave, valor) VALUES (?, ?)`, [chave, valor], (err) => {
            if (err) console.error('Erro ao salvar nota:', err.message);
        });
    }

    adicionarInteracao(interacao) {
        this.db.run(`INSERT INTO interacoes (texto) VALUES (?)`, [interacao], (err) => {
            if (err) console.error('Erro ao salvar interação:', err.message);
        });
    }

    obterIdentidadeMimi() {
        return {
            identidade: "Mimi"
        };
    }

    obterContextoParaIA(callback) {
        // Como o SQLite é assíncrono, buscamos as notas do banco para montar o contexto
        this.db.all(`SELECT valor FROM notas`, [], (err, rows) => {
            if (err || !rows || rows.length === 0) {
                return callback("Notas e memórias salvas: Nenhuma registrada ainda.");
            }
            const notasTexto = rows.map(r => `- ${r.valor}`).join('\n');
            callback(`Notas e memórias salvas sobre o Jorge e projetos:\n${notasTexto}`);
        });
    }
}

module.exports = UserProfile;