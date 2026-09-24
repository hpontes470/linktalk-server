const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const MAX_PARTICIPANTES = 10;

// =====================================================
// SERVIDOR HTTP
// =====================================================

const server = http.createServer((request, response) => {
    response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    response.end("LinkTalk Server funcionando! 🚀");
});

// =====================================================
// WEBSOCKET
// =====================================================

const wss = new WebSocket.Server({ server });

// Todas as salas ficam armazenadas aqui
// sala -> participantes
const salas = new Map();

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

// Cria um ID aleatório para cada participante
function gerarId() {
    return Math.random().toString(36).substring(2, 10);
}

// Envia uma mensagem para um participante
function enviar(socket, dados) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(dados));
    }
}

// =====================================================
// NOVA CONEXÃO
// =====================================================

wss.on("connection", (socket) => {

    // ID único deste participante
    const id = gerarId();

    // Sala atual
    let salaAtual = null;

    // Nome do participante
    let nomeParticipante = "Participante";

    console.log(`👤 Nova conexão: ${id}`);

    // =================================================
    // RECEBER MENSAGENS
    // =================================================

    socket.on("message", (dados) => {

        try {

            const mensagem = JSON.parse(dados.toString());

            // =============================================
            // ENTRAR NA SALA
            // =============================================

            if (mensagem.tipo === "entrar") {

                const codigoSala = mensagem.sala;

                if (!codigoSala) {

                    enviar(socket, {
                        tipo: "erro",
                        mensagem: "Código da sala inválido."
                    });

                    return;
                }

                // Pega o nome enviado pelo navegador
                if (
                    typeof mensagem.nome === "string" &&
                    mensagem.nome.trim() !== ""
                ) {

                    nomeParticipante =
                        mensagem.nome.trim().substring(0, 30);

                } else {

                    nomeParticipante = "Participante";
                }

                // Se a sala ainda não existe, cria
                if (!salas.has(codigoSala)) {
                    salas.set(codigoSala, new Map());
                }

                const participantes = salas.get(codigoSala);

                // Verifica limite
                if (participantes.size >= MAX_PARTICIPANTES) {

                    enviar(socket, {
                        tipo: "sala-cheia",
                        limite: MAX_PARTICIPANTES
                    });

                    console.log(`🚫 Sala ${codigoSala} cheia.`);

                    socket.close();

                    return;
                }

                // Guarda a sala atual
                salaAtual = codigoSala;

                // =========================================
                // PEGAR PARTICIPANTES QUE JÁ ESTÃO NA SALA
                // =========================================

                const participantesExistentes =
                    Array.from(participantes.entries()).map(
                        ([participanteId, participante]) => ({
                            id: participanteId,
                            nome: participante.nome
                        })
                    );

                // =========================================
                // AVISAR QUEM ESTÁ ENTRANDO
                // =========================================

                enviar(socket, {
                    tipo: "sala",

                    id: id,

                    participantes: participantesExistentes,

                    quantidade: participantes.size,

                    limite: MAX_PARTICIPANTES
                });

                // =========================================
                // ADICIONAR PARTICIPANTE À SALA
                // =========================================

                participantes.set(id, {
                    socket: socket,
                    nome: nomeParticipante
                });

                // =========================================
                // AVISAR OS OUTROS PARTICIPANTES
                // =========================================

                participantes.forEach(
                    (participante, participanteId) => {

                        if (participanteId !== id) {

                            enviar(participante.socket, {

                                tipo: "novo-participante",

                                id: id,

                                nome: nomeParticipante
                            });
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

            // =================================================
            // SISTEMA DE CONVITES
            // =================================================

            if (mensagem.tipo === "convite") {

                // Só pode enviar convite se estiver em uma sala
                if (!salaAtual) {

                    enviar(socket, {
                        tipo: "erro",
                        mensagem: "Você não está em uma sala."
                    });

                    return;
                }

                const participantes = salas.get(salaAtual);

                if (!participantes) {
                    return;
                }

                // ID da pessoa que receberá o convite
                const destino = mensagem.destino;

                if (!destino) {

                    enviar(socket, {
                        tipo: "erro",
                        mensagem: "Participante de destino não informado."
                    });

                    return;
                }

                // Procura a pessoa
                const participanteDestino =
                    participantes.get(destino);

                if (!participanteDestino) {

                    enviar(socket, {
                        tipo: "erro",
                        mensagem: "Participante não encontrado."
                    });

                    return;
                }

                // =========================================
                // ENVIAR CONVITE
                // =========================================

                enviar(participanteDestino.socket, {

                    tipo: "convite",

                    de: id,

                    nome: nomeParticipante,

                    sala: salaAtual
                });

                console.log(
                    `🔔 ${nomeParticipante} enviou um convite para ${participanteDestino.nome}`
                );

                return;
            }

            // =================================================
            // RESPOSTA AO CONVITE
            // =================================================

            if (mensagem.tipo === "resposta-convite") {

                if (!salaAtual) {
                    return;
                }

                const participantes = salas.get(salaAtual);

                if (!participantes) {
                    return;
                }

                const destino = mensagem.destino;

                if (!destino) {
                    return;
                }

                const participanteDestino =
                    participantes.get(destino);

                if (!participanteDestino) {
                    return;
                }

                // Encaminha a resposta
                enviar(participanteDestino.socket, {

                    tipo: "resposta-convite",

                    de: id,

                    nome: nomeParticipante,

                    aceitou: mensagem.aceitou === true
                });

                console.log(
                    `🔔 Resposta de ${nomeParticipante}: ` +
                    `${mensagem.aceitou === true ? "aceitou" : "recusou"}`
                );

                return;
            }

            // =================================================
            // SINALIZAÇÃO WEBRTC
            // =================================================

            if (mensagem.tipo === "sinalizacao") {

                if (!salaAtual) {
                    return;
                }

                const participantes = salas.get(salaAtual);

                if (!participantes) {
                    return;
                }

                const destino = mensagem.destino;

                const sinal = mensagem.sinal;

                // =============================================
                // SINALIZAÇÃO PARA UMA PESSOA ESPECÍFICA
                // =============================================

                if (destino) {

                    const participante =
                        participantes.get(destino);

                    if (participante) {

                        enviar(participante.socket, {

                            tipo: "sinalizacao",

                            origem: id,

                            sinal: sinal
                        });
                    }

                    return;
                }

                // =============================================
                // SINALIZAÇÃO PARA TODOS
                // =============================================

                participantes.forEach(
                    (participante, participanteId) => {

                        if (
                            participanteId !== id &&
                            participante.socket.readyState ===
                            WebSocket.OPEN
                        ) {

                            enviar(participante.socket, {

                                tipo: "sinalizacao",

                                origem: id,

                                sinal: sinal
                            });
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

    // =================================================
    // PARTICIPANTE DESCONECTOU
    // =================================================

    socket.on("close", () => {

        console.log(`👋 ${id} desconectou.`);

        if (!salaAtual) {
            return;
        }

        const participantes = salas.get(salaAtual);

        if (!participantes) {
            return;
        }

        // Remove da sala
        participantes.delete(id);

        // Avisa os outros participantes
        participantes.forEach((participante) => {

            enviar(participante.socket, {

                tipo: "participante-saiu",

                id: id
            });
        });

        // Se ninguém ficou, apaga a sala
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

// =====================================================
// ERROS DO WEBSOCKET
// =====================================================

wss.on("error", (erro) => {

    console.log("❌ Erro no WebSocket:");

    console.log(erro);
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

server.listen(PORT, () => {

    console.log(
        `🚀 LinkTalk Server rodando na porta ${PORT}`
    );

    console.log(
        `👥 Limite por sala: ${MAX_PARTICIPANTES}`
    );

    console.log(
        `🔔 Sistema de convites ativado!`
    );
});
