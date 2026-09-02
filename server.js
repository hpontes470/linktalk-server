// ============================================
// LinkTalk - Servidor de Sinalização
// Até 10 participantes por sala
// ============================================

const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const MAX_PARTICIPANTES = 10;

// ============================================
// SERVIDOR HTTP
// ============================================

const server = http.createServer((request, response) => {
    response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    response.end("LinkTalk Server funcionando! 🚀");
});

// ============================================
// WEBSOCKET
// ============================================

const wss = new WebSocket.Server({
    server: server
});

// ============================================
// SALAS
// ============================================

// Estrutura:
//
// salas = {
//     "ABC123": Map {
//         "id123": {
//             socket: WebSocket,
//             nome: "Henrique"
//         }
//     }
// }

const salas = new Map();

// ============================================
// GERAR ID DO PARTICIPANTE
// ============================================

function gerarId() {
    return Math.random()
        .toString(36)
        .substring(2, 10);
}

// ============================================
// ENVIAR MENSAGEM
// ============================================

function enviar(socket, dados) {
    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {
        socket.send(JSON.stringify(dados));
    }
}

// ============================================
// NOVA CONEXÃO
// ============================================

wss.on("connection", (socket) => {

    const id = gerarId();

    let salaAtual = null;

    let nomeParticipante = "Participante";

    console.log(`👤 Nova conexão: ${id}`);

    // ========================================
    // RECEBER MENSAGENS
    // ========================================

    socket.on("message", (dados) => {

        try {

            const mensagem = JSON.parse(
                dados.toString()
            );

            // ====================================
            // ENTRAR NA SALA
            // ====================================

            if (mensagem.tipo === "entrar") {

                const codigoSala = mensagem.sala;

                // Verifica sala
                if (!codigoSala) {

                    enviar(socket, {
                        tipo: "erro",
                        mensagem: "Código da sala inválido."
                    });

                    return;
                }

                // ==================================
                // PEGAR NOME
                // ==================================

                if (
                    typeof mensagem.nome === "string" &&
                    mensagem.nome.trim() !== ""
                ) {

                    nomeParticipante =
                        mensagem.nome
                            .trim()
                            .substring(0, 30);

                } else {

                    nomeParticipante =
                        "Participante";
                }

                // ==================================
                // CRIAR SALA SE NÃO EXISTIR
                // ==================================

                if (!salas.has(codigoSala)) {

                    salas.set(
                        codigoSala,
                        new Map()
                    );
                }

                const participantes =
                    salas.get(codigoSala);

                // ==================================
                // VERIFICAR LIMITE
                // ==================================

                if (
                    participantes.size >=
                    MAX_PARTICIPANTES
                ) {

                    enviar(socket, {
                        tipo: "sala-cheia",
                        limite: MAX_PARTICIPANTES
                    });

                    console.log(
                        `🚫 Sala ${codigoSala} cheia.`
                    );

                    socket.close();

                    return;
                }

                // ==================================
                // DEFINIR SALA ATUAL
                // ==================================

                salaAtual = codigoSala;

                // ==================================
                // LISTA DOS PARTICIPANTES EXISTENTES
                // ==================================

                const participantesExistentes =
                    Array.from(
                        participantes.entries()
                    ).map(
                        ([participanteId, participante]) => {

                            return {
                                id: participanteId,
                                nome: participante.nome
                            };

                        }
                    );

                // ==================================
                // AVISAR QUEM ESTÁ ENTRANDO
                // SOBRE QUEM JÁ ESTÁ NA SALA
                // ==================================

                enviar(socket, {

                    tipo: "sala",

                    id: id,

                    participantes:
                        participantesExistentes,

                    quantidade:
                        participantes.size,

                    limite:
                        MAX_PARTICIPANTES
                });

                // ==================================
                // ADICIONAR PARTICIPANTE
                // ==================================

                participantes.set(id, {

                    socket: socket,

                    nome: nomeParticipante
                });

                // ==================================
                // AVISAR OS OUTROS PARTICIPANTES
                // ==================================
                //
                // "novo-participante" agora também
                // envia o nome.
                //

                participantes.forEach(
                    (participante, participanteId) => {

                        if (
                            participanteId !== id
                        ) {

                            enviar(
                                participante.socket,
                                {
                                    tipo:
                                        "novo-participante",

                                    id: id,

                                    nome:
                                        nomeParticipante
                                }
                            );
                        }

                    }
                );

                console.log(
                    `🏠 ${id} (${nomeParticipante}) entrou em ${codigoSala}`
                );

                console.log(
                    `👥 Pessoas na sala: ${participantes.size}`
                );

                return;
            }

            // ====================================
            // SINALIZAÇÃO WEBRTC
            // ====================================

            if (mensagem.tipo === "sinalizacao") {

                if (!salaAtual) {
                    return;
                }

                const participantes =
                    salas.get(salaAtual);

                if (!participantes) {
                    return;
                }

                const destino =
                    mensagem.destino;

                const sinal =
                    mensagem.sinal;

                // ==================================
                // ENVIO PARA UM PARTICIPANTE
                // ==================================

                if (destino) {

                    const participante =
                        participantes.get(destino);

                    if (participante) {

                        enviar(
                            participante.socket,
                            {
                                tipo:
                                    "sinalizacao",

                                origem:
                                    id,

                                sinal:
                                    sinal
                            }
                        );
                    }

                    return;
                }

                // ==================================
                // ENVIO PARA TODOS
                // ==================================

                participantes.forEach(
                    (participante, participanteId) => {

                        if (
                            participanteId !== id &&
                            participante.socket.readyState ===
                            WebSocket.OPEN
                        ) {

                            enviar(
                                participante.socket,
                                {
                                    tipo:
                                        "sinalizacao",

                                    origem:
                                        id,

                                    sinal:
                                        sinal
                                }
                            );
                        }

                    }
                );

                return;
            }

        } catch (erro) {

            console.log(
                "❌ Erro ao processar mensagem:"
            );

            console.log(erro);
        }

    });

    // ========================================
    // PARTICIPANTE DESCONECTOU
    // ========================================

    socket.on("close", () => {

        console.log(
            `👋 ${id} desconectou.`
        );

        if (!salaAtual) {
            return;
        }

        const participantes =
            salas.get(salaAtual);

        if (!participantes) {
            return;
        }

        // ==================================
        // REMOVER PARTICIPANTE
        // ==================================

        participantes.delete(id);

        // ==================================
        // AVISAR OS OUTROS
        // ==================================

        participantes.forEach(
            (participante) => {

                enviar(
                    participante.socket,
                    {
                        tipo:
                            "participante-saiu",

                        id: id
                    }
                );

            }
        );

        // ==================================
        // APAGAR SALA VAZIA
        // ==================================

        if (participantes.size === 0) {

            salas.delete(salaAtual);

            console.log(
                `🗑️ Sala ${salaAtual} apagada.`
            );

        } else {

            console.log(
                `👥 Restam ${participantes.size} pessoas na sala.`
            );
        }

    });

});

// ============================================
// ERROS DO WEBSOCKET
// ============================================

wss.on("error", (erro) => {

    console.log(
        "❌ Erro no WebSocket:"
    );

    console.log(erro);

});

// ============================================
// INICIAR SERVIDOR
// ============================================

server.listen(PORT, () => {

    console.log(
        `🚀 LinkTalk Server rodando na porta ${PORT}`
    );

    console.log(
        `👥 Limite por sala: ${MAX_PARTICIPANTES}`
    );

});
