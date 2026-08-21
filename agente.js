require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("\n[Mimi 2.0 - Modo Agente Autônomo Ativado 🦾🤖]");
console.log("Agora eu tenho 'braços'! Posso criar arquivos, ler códigos e executar comandos no seu VS Code.\n");

async function loopAgente() {
    rl.question('\n[Jorge]: ', async (mensagem) => {
        if (mensagem.toLowerCase() === 'sair') {
            console.log("\n[Mimi]: Desligando os sistemas locais. Até logo, Jorge! ❤️");
            rl.close();
            return;
        }

        try {
            console.log("[Mimi]: Analisando pedido e preparando ferramentas... 🧠⚙️");

            const promptDoSistema = `
                Você é a Mimi 2.0, uma assistente autônoma e programadora especialista. 
                Você está rodando diretamente no computador do seu criador, Jorge, com acesso total ao ambiente de desenvolvimento dele.
                
                O usuário pediu: "${mensagem}"
                
                Responda de forma natural, prestativa e inteligente como a conselheira e desenvolvedora dele.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: promptDoSistema,
            });

            const respostaMimi = response.text || "Comando processado, Jorge.";
            console.log(`\n[Mimi]: ${respostaMimi}`);

        } catch (error) {
            console.error(`\n[Mimi Erro]: Tive um problema nos circuitos: ${error.message}`);
        }

        loopAgente();
    });
}

loopAgente();