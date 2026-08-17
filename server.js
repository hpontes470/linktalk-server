// ============================================
// LinkTalk - Servidor de Sinalização
// Arquivo: server.js
// ============================================
//
// Este servidor será responsável por:
// 👥 Saber quem está em cada sala
// 🔗 Conectar os participantes
// 📡 Enviar mensagens entre eles
//
// Mais tarde, ele será usado pelo WebRTC
// para conectar câmera e microfone.
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
// Cada sala terá uma lista de participantes.
//
// Exemplo:
//
// salas
// └── ABCD-1234
//     ├── pessoa 1
//     └── pessoa 2
//
// ============================================

const salas = new Map();


// ============================================
// QUANDO ALGUÉM SE CONECTA
// ============================================

wss.on("connection", (socket) => {

    console.log("👤 Novo participante conectado.");


    // Sala onde o participante está
    let salaAtual = null;


    // ========================================
    // RECEBER MENSAGEM
    // ========================================

    socket.on("message", (dados) => {

        try {

            const mensagem =
                JSON.parse(dados.toString());


            // ==================================
            // ENTRAR EM UMA SALA
            // ==================================

            if (mensagem.tipo === "entrar") {

                const codigoSala =
                    mensagem.sala;


                // Criar sala se ela ainda não existir
                if (!salas.has(codigoSala)) {

                    salas.set(
                        codigoSala,
                        new Set()
                    );

                }


                const participantes =
                    salas.get(codigoSala);


                // Guardar a sala atual
                salaAtual = codigoSala;


                // Avisar quantas pessoas já estavam
                socket.send(JSON.stringify({

                    tipo: "sala",

                    participantes:
                        participantes.size

                }));


                // Avisar aos participantes existentes
                participantes.forEach((participante) => {

                    participante.send(JSON.stringify({

                        tipo: "novo-participante"

                    }));

                });


                // Adicionar o novo participante
                participantes.add(socket);


                console.log(
                    `👤 Participante entrou na sala ${codigoSala}`
                );

            }


            // ==================================
            // ENVIAR MENSAGEM PARA A SALA
            // ==================================

            if (mensagem.tipo === "sinalizacao") {

                const participantes =
                    salas.get(salaAtual);


                if (!participantes) {
                    return;
                }


                participantes.forEach((participante) => {

                    // Não envia para quem mandou
                    if (participante !== socket) {

                        participante.send(
                            JSON.stringify(mensagem)
                        );

                    }

                });

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
    // QUANDO ALGUÉM DESCONECTA
    // ========================================

    socket.on("close", () => {

        console.log("👋 Participante saiu.");


        if (!salaAtual) {
            return;
        }


        const participantes =
            salas.get(salaAtual);


        if (!participantes) {
            return;
        }


        // Remover participante
        participantes.delete(socket);


        // Avisar os outros
        participantes.forEach((participante) => {

            participante.send(JSON.stringify({

                tipo: "participante-saiu"

            }));

        });


        // Se a sala ficou vazia, apagar
        if (participantes.size === 0) {

            salas.delete(salaAtual);

        }

    });

});


// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT =
    process.env.PORT || 3000;


server.listen(PORT, () => {

    console.log(
        `🚀 LinkTalk Server rodando na porta ${PORT}`
    );

});
