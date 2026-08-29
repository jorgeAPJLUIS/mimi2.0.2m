const axios = require('axios');
const { exec } = require('child_process');

// Coloque aqui o link exato do seu projeto no Render
const SERVER_URL = 'https://mimi2-0.onrender.com'; 
const INTERVALO_VERIFICACAO = 4000; // Checa a cada 4 segundos

console.log("🤖 Mimi Bridge Local (Windows 10) iniciada. Pronta para abrir tudo e controlar suas músicas no seu PC!");

async function verificarComandos() {
    try {
        const response = await axios.get(`${SERVER_URL}/api/bridge/obter-comando`);
        const { id, acao, parametro } = response.data;

        if (acao) {
            console.log(`⚡ Ordem recebida: ${acao} (${parametro || ''})`);
            let shellCommand = '';

            // Mapeamento completo para o Windows 10 (Programas, Sistema e Mídia)
            switch (acao) {
                case 'abrir_vscode':
                    shellCommand = 'code';
                    break;
                case 'abrir_bloco_notas':
                    shellCommand = 'notepad';
                    break;
                case 'abrir_navegador':
                    shellCommand = parametro ? `start chrome "${parametro}"` : 'start chrome';
                    break;
                case 'abrir_youtube':
                    shellCommand = 'start chrome "https://www.youtube.com"';
                    break;
                case 'abrir_spotify':
                    shellCommand = 'start spotify';
                    break;
                case 'proxima_faixa':
                    // Simula tecla de mídia: Próxima Faixa (Next Track)
                    shellCommand = 'powershell -Command "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]176)"';
                    break;
                case 'tocar_pausar':
                    // Simula tecla de mídia: Play / Pause
                    shellCommand = 'powershell -Command "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]179)"';
                    break;
                case 'abrir_area_trabalho':
                    shellCommand = 'explorer shell:Desktop';
                    break;
                case 'abrir_terminal':
                    shellCommand = 'start cmd';
                    break;
                case 'abrir_programa_generico':
                    shellCommand = `start ${parametro}`;
                    break;
                default:
                    shellCommand = acao; // Executa direto se for um comando do Windows
                    break;
            }

            exec(shellCommand, (error, stdout, stderr) => {
                let resultado = "Comando executado com sucesso no PC!";
                if (error) {
                    resultado = `Erro ao executar: ${error.message}`;
                    console.error(resultado);
                } else {
                    console.log("Ação executada na tela do Windows com sucesso!");
                }
                
                // Devolve a resposta para o servidor
                axios.post(`${SERVER_URL}/api/bridge/resposta`, { id, resultado });
            });
        }
    } catch (e) {
        // Silencia erros de conexão caso o PC oscile a internet
    }
}

setInterval(verificarComandos, INTERVALO_VERIFICACAO);