// ============================================
// LinkTalk - Servidor de Sinalização
// Até 10 participantes por sala
// ============================================

const http = require("http");
const WebSocket = require("ws");


// ============================================
// CONFIGURAÇÕES
// ============================================

const MAX_PARTICIPANTES = 10;


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
// Cada sala possui:
//
// sala
// └── código
//     ├── ID → conexão
//     ├── ID → conexão
//     └── ...
//
// ============================================

const salas = new Map();


// ============================================
// GERAR ID ÚNICO
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


    // ID dessa pessoa
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


                // Verificar código
                if (!codigoSala) {

                    socket.send(JSON.stringify({

                        tipo: "erro",

                        mensagem:
                            "Código da sala inválido."

                    }));

                    return;

                }


                // ==================================
                // CRIAR SALA
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

                    console.log(
                        `🚫 Sala ${codigoSala} está cheia.`
                    );


                    socket.send(
                        JSON.stringify({

                            tipo: "sala-cheia",

                            limite:
                                MAX_PARTICIPANTES

                        })
                    );


                    socket.close();

                    return;

                }


                // ==================================
                // GUARDAR SALA ATUAL
                // ==================================

                salaAtual =
                    codigoSala;


                // ==================================
                // PEGAR IDS EXISTENTES
                // ==================================

                const participantesExistentes =
                    Array.from(
                        participantes.keys()
                    );


                // ==================================
                // AVISAR QUEM ESTÁ ENTRANDO
                // ==================================
                //
                // A pessoa recebe a lista de
                // quem já estava na sala.
                //
                // Depois o room.js cria uma
                // conexão com cada um.
                //

                socket.send(
                    JSON.stringify({

                        tipo: "sala",

                        id: id,

                        participantes:
                            participantesExistentes

                    })
                );


                // ==================================
                // AVISAR QUEM JÁ ESTAVA
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
                                        "novo-participante",

                                    id:
                                        id

                                })
                            );

                        }

                    }
                );


                // ==================================
                // ADICIONAR À SALA
                // ==================================

                participantes.set(
                    id,
                    socket
                );


                console.log(
                    `👤 ${id} entrou na sala ${codigoSala}`
                );

                console.log(
                    `👥 Participantes: ${participantes.size}/${MAX_PARTICIPANTES}`
                );

            }


            // ==================================
            // SINALIZAÇÃO WEBRTC
            // ==================================

            if (
                mensagem.tipo ===
                "sinalizacao"
            ) {

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
                    (
                        participante,
                        participanteId
                    ) => {

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


        // ==================================
        // REMOVER PARTICIPANTE
        // ==================================

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


        console.log(
            `👥 Sala ${salaAtual}: ${participantes.size}/${MAX_PARTICIPANTES}`
        );

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
