// ============================================
// LinkTalk - Servidor de Sinalização
// Vários participantes + WebRTC
// ============================================

const http = require("http");
const WebSocket = require("ws");


// ============================================
// SERVIDOR HTTP
// ============================================

const server = http.createServer((request, response) => {

    response.writeHead(200, {
        "Content-Type": "text/plain"
    });

    response.end("LinkTalk Server funcionando! 🚀");

});


// ============================================
// SERVIDOR WEBSOCKET
// ============================================

const wss = new WebSocket.Server({
    server: server
});


// ============================================
// SALAS
// ============================================
//
// Cada sala possui vários participantes.
//
// sala
// └── ABCD-1234
//     ├── participante 1
//     ├── participante 2
//     ├── participante 3
//     └── participante 4
//
// ============================================

const salas = new Map();
// ========================================
// LIMITE DE PARTICIPANTES
// ========================================

const MAX_PARTICIPANTES = 10;

// ============================================
// GERAR ID DO PARTICIPANTE
// ============================================

function gerarId() {

    return Math.random()
        .toString(36)
        .substring(2, 10);

}


// ============================================
// NOVA CONEXÃO
// ============================================

wss.on("connection", (socket) => {

    console.log(
        "👤 Novo participante conectado."
    );


    // ID único desta pessoa
    const id = gerarId();


    // Sala atual
    let salaAtual = null;


    // ========================================
    // RECEBER MENSAGENS
    // ========================================

    socket.on("message", (dados) => {

        try {

            const mensagem =
                JSON.parse(
                    dados.toString()
                );


            // ==================================
            // ENTRAR NA SALA
            // ==================================

            if (mensagem.tipo === "entrar") {

                const codigoSala =
                    mensagem.sala;


                if (!codigoSala) {

                    return;

               // ========================================
// VERIFICAR LIMITE DA SALA
// ========================================

if (participantes.size >= MAX_PARTICIPANTES) {

    socket.send(JSON.stringify({

        tipo: "sala-cheia",

        limite: MAX_PARTICIPANTES

    }));

    console.log(
        `🚫 Sala ${codigoSala} está cheia.`
    );

    socket.close();

    return;
}


                // Criar sala
                if (!salas.has(codigoSala)) {

                    salas.set(
                        codigoSala,
                        new Map()
                    );

                }


                const participantes =
                    salas.get(codigoSala);


                salaAtual =
                    codigoSala;


                // ==================================
                // AVISAR QUEM JÁ ESTAVA NA SALA
                // ==================================

                const participantesExistentes =
                    Array.from(
                        participantes.keys()
                    );


                socket.send(
                    JSON.stringify({

                        tipo: "sala",

                        id: id,

                        participantes:
                            participantesExistentes

                    })
                );


                // ==================================
                // AVISAR OS OUTROS
                // ==================================

                participantes.forEach(
                    (participante) => {

                        participante.send(
                            JSON.stringify({

                                tipo:
                                    "novo-participante",

                                id:
                                    id

                            })
                        );

                    }
                );


                // ==================================
                // ADICIONAR PARTICIPANTE
                // ==================================

                participantes.set(
                    id,
                    socket
                );


                console.log(
                    `👤 ${id} entrou na sala ${codigoSala}`
                );

            }


            // ==================================
            // SINALIZAÇÃO WEBRTC
            // ==================================

            if (
                mensagem.tipo ===
                "sinalizacao"
            ) {

                const participantes =
                    salas.get(salaAtual);


                if (!participantes) {

                    return;

                }


                const destino =
                    mensagem.destino;


                // ==================================
                // ENVIAR PARA UMA PESSOA ESPECÍFICA
                // ==================================

                if (destino) {

                    const participante =
                        participantes.get(
                            destino
                        );


                    if (
                        participante &&
                        participante.readyState ===
                        WebSocket.OPEN
                    ) {

                        participante.send(
                            JSON.stringify({

                                tipo:
                                    "sinalizacao",

                                origem:
                                    id,

                                sinal:
                                    mensagem.sinal

                            })
                        );

                    }


                    return;

                }


                // ==================================
                // COMPATIBILIDADE
                // Enviar para todos os outros
                // ==================================

                participantes.forEach(
                    (participante, participanteId) => {

                        if (
                            participanteId !== id &&
                            participante.readyState ===
                            WebSocket.OPEN
                        ) {

                            participante.send(
                                JSON.stringify({

                                    tipo:
                                        "sinalizacao",

                                    origem:
                                        id,

                                    sinal:
                                        mensagem.sinal

                                })
                            );

                        }

                    }
                );

            }

        }

        catch (erro) {

            console.log(
                "❌ Erro ao processar mensagem:",
                erro
            );

        }

    });


    // ========================================
    // DESCONECTOU
    // ========================================

    socket.on("close", () => {

        console.log(
            `👋 ${id} saiu.`
        );


        if (!salaAtual) {

            return;

        }


        const participantes =
            salas.get(salaAtual);


        if (!participantes) {

            return;

        }


        // Remover
        participantes.delete(id);


        // ==================================
        // AVISAR OS OUTROS
        // ==================================

        participantes.forEach(
            (participante) => {

                if (
                    participante.readyState ===
                    WebSocket.OPEN
                ) {

                    participante.send(
                        JSON.stringify({

                            tipo:
                                "participante-saiu",

                            id:
                                id

                        })
                    );

                }

            }
        );


        // ==================================
        // APAGAR SALA VAZIA
        // ==================================

        if (
            participantes.size === 0
        ) {

            salas.delete(
                salaAtual
            );

        }

    });

});


// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT =
    process.env.PORT || 3000;


server.listen(
    PORT,
    () => {

        console.log(
            `🚀 LinkTalk Server rodando na porta ${PORT}`
        );

    }
);
