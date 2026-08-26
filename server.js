// ============================================
// LinkTalk - Servidor de Sinalização
// Até 10 participantes por sala
// ============================================

const http = require("http");
const WebSocket = require("ws");


// ============================================
// CONFIGURAÇÕES
// ============================================

const PORT = process.env.PORT || 3000;
const MAX_PARTICIPANTES = 10;


// ============================================
// SERVIDOR HTTP
// ============================================

const server = http.createServer((request, response) => {

    response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    response.end(
        "LinkTalk Server funcionando! 🚀"
    );

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
// Map:
//
// salas
//   └── ABCD-1234
//       ├── id1 -> socket
//       ├── id2 -> socket
//       └── id3 -> socket
//
// ============================================

const salas = new Map();


// ============================================
// GERAR ID
// ============================================

function gerarId() {

    return Math.random()
        .toString(36)
        .substring(2, 10);

}


// ============================================
// ENVIAR JSON
// ============================================

function enviar(socket, dados) {

    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify(dados)
        );

    }

}


// ============================================
// NOVA CONEXÃO
// ============================================

wss.on("connection", (socket) => {

    const id = gerarId();

    let salaAtual = null;

    console.log(
        `👤 Nova conexão: ${id}`
    );


    // ========================================
    // RECEBER MENSAGEM
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

                    enviar(socket, {

                        tipo: "erro",

                        mensagem:
                            "Código da sala inválido."

                    });

                    return;

                }


                // --------------------------------
                // CRIAR SALA
                // --------------------------------

                if (!salas.has(codigoSala)) {

                    salas.set(
                        codigoSala,
                        new Map()
                    );

                }


                const participantes =
                    salas.get(codigoSala);


                // --------------------------------
                // VERIFICAR LIMITE
                // --------------------------------

                if (
                    participantes.size >=
                    MAX_PARTICIPANTES
                ) {

                    enviar(socket, {

                        tipo: "sala-cheia",

                        limite:
                            MAX_PARTICIPANTES

                    });

                    console.log(
                        `🚫 Sala ${codigoSala} cheia.`
                    );

                    socket.close();

                    return;

                }


                // --------------------------------
                // GUARDAR SALA
                // --------------------------------

                salaAtual =
                    codigoSala;


                // --------------------------------
                // PEGAR IDS EXISTENTES
                // --------------------------------

                const idsExistentes =
                    Array.from(
                        participantes.keys()
                    );


                // --------------------------------
                // AVISAR O NOVO PARTICIPANTE
                // --------------------------------

                enviar(socket, {

                    tipo: "sala",

                    id: id,

                    participantes:
                        idsExistentes,

                    quantidade:
                        participantes.size,

                    limite:
                        MAX_PARTICIPANTES

                });


                // --------------------------------
                // ADICIONAR À SALA
                // --------------------------------

                participantes.set(
                    id,
                    socket
                );


                // --------------------------------
                // AVISAR OS OUTROS
                // --------------------------------

                participantes.forEach(
                    (participante, participanteId) => {

                        if (
                            participanteId !== id
                        ) {

                            enviar(
                                participante,
                                {

                                    tipo:
                                        "novo-participante",

                                    id: id

                                }
                            );

                        }

                    }
                );


                console.log(
                    `🏠 ${id} entrou em ${codigoSala}`
                );

                console.log(
                    `👥 Pessoas na sala: ${participantes.size}`
                );

                return;

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


                const sinal =
                    mensagem.sinal;


                // --------------------------------
                // DESTINO ESPECÍFICO
                // --------------------------------

                if (destino) {

                    const participante =
                        participantes.get(
                            destino
                        );


                    if (participante) {

                        enviar(
                            participante,
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


                // --------------------------------
                // SEM DESTINO
                // Envia para todos
                // --------------------------------

                participantes.forEach(
                    (participante, participanteId) => {

                        if (
                            participanteId !== id
                        ) {

                            enviar(
                                participante,
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

        }

        catch (erro) {

            console.log(
                "❌ Erro ao processar mensagem:"
            );

            console.log(erro);

        }

    });


    // ========================================
    // DESCONECTOU
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


        // --------------------------------
        // REMOVER
        // --------------------------------

        participantes.delete(id);


        // --------------------------------
        // AVISAR OS OUTROS
        // --------------------------------

        participantes.forEach(
            (participante) => {

                enviar(
                    participante,
                    {

                        tipo:
                            "participante-saiu",

                        id: id

                    }
                );

            }
        );


        // --------------------------------
        // APAGAR SALA VAZIA
        // --------------------------------

        if (
            participantes.size === 0
        ) {

            salas.delete(
                salaAtual
            );

            console.log(
                `🗑️ Sala ${salaAtual} apagada.`
            );

        }

        else {

            console.log(
                `👥 Restam ${participantes.size} pessoas na sala.`
            );

        }

    });

});


// ============================================
// ERROS DO SERVIDOR
// ============================================

wss.on("error", (erro) => {

    console.log(
        "❌ Erro no WebSocket:"
    );

    console.log(erro);

});


// ============================================
// INICIAR
// ============================================

server.listen(
    PORT,
    () => {

        console.log(
            `🚀 LinkTalk Server rodando na porta ${PORT}`
        );

        console.log(
            `👥 Limite por sala: ${MAX_PARTICIPANTES}`
        );

    }
);
