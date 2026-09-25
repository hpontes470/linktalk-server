// ============================================
// LinkTalk Server
// WebSocket + Salas + Convites
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

    response.end(
        "LinkTalk Server funcionando! 🚀"
    );
});


// ============================================
// WEBSOCKET
// ============================================

const wss =
    new WebSocket.Server({
        server
    });


// ============================================
// SALAS
// ============================================

// código da sala → participantes
const salas =
    new Map();


// ============================================
// USUÁRIOS CONECTADOS
// ============================================

// ID → informações do usuário
//
// Exemplo:
//
// usuarios.get("abc123")
//
// {
//     socket: ...,
//     nome: "Henrique",
//     sala: "K7P2QX"
// }

const usuarios =
    new Map();


// ============================================
// GERAR ID
// ============================================

function gerarId() {

    return Math.random()
        .toString(36)
        .substring(2, 10);
}


// ============================================
// ENVIAR MENSAGEM
// ============================================

function enviar(
    socket,
    dados
) {

    if (
        socket &&
        socket.readyState ===
            WebSocket.OPEN
    ) {

        socket.send(
            JSON.stringify(dados)
        );
    }
}


// ============================================
// ENVIAR LISTA DE USUÁRIOS ONLINE
// ============================================

function enviarUsuariosOnline() {

    const lista = [];


    usuarios.forEach(
        (usuario, id) => {

            lista.push({

                id: id,

                nome:
                    usuario.nome,

                // Mostra se está em uma sala
                emSala:
                    usuario.sala !== null

            });

        }
    );


    // Envia a lista para todos
    usuarios.forEach(
        (usuario) => {

            enviar(
                usuario.socket,
                {

                    tipo:
                        "usuarios-online",

                    usuarios:
                        lista

                }
            );

        }
    );
}


// ============================================
// NOVA CONEXÃO
// ============================================

wss.on(
    "connection",
    (socket) => {

        const id =
            gerarId();


        // ========================================
        // INFORMAÇÕES DO USUÁRIO
        // ========================================

        let nomeParticipante =
            "Participante";

        let salaAtual =
            null;


        // ========================================
        // REGISTRAR USUÁRIO
        // ========================================

        usuarios.set(
            id,
            {

                socket:
                    socket,

                nome:
                    nomeParticipante,

                sala:
                    null

            }
        );


        console.log(
            `👤 Nova conexão: ${id}`
        );


        // ========================================
        // ENVIAR ID PARA O CLIENTE
        // ========================================

        enviar(
            socket,
            {

                tipo:
                    "conectado",

                id:
                    id

            }
        );


        // ========================================
        // ATUALIZAR USUÁRIOS ONLINE
        // ========================================

        enviarUsuariosOnline();


        // ========================================
        // RECEBER MENSAGENS
        // ========================================

        socket.on(
            "message",
            (dados) => {

                try {

                    const mensagem =
                        JSON.parse(
                            dados.toString()
                        );


                    // ==================================
                    // REGISTRAR NOME
                    // ==================================

                    if (
                        mensagem.tipo ===
                        "registrar-nome"
                    ) {

                        if (
                            typeof mensagem.nome ===
                                "string" &&
                            mensagem.nome.trim() !== ""
                        ) {

                            nomeParticipante =
                                mensagem.nome
                                    .trim()
                                    .substring(
                                        0,
                                        30
                                    );
                        }


                        const usuario =
                            usuarios.get(id);


                        if (usuario) {

                            usuario.nome =
                                nomeParticipante;
                        }


                        console.log(
                            `👤 ${id} agora é ${nomeParticipante}`
                        );


                        enviarUsuariosOnline();


                        return;
                    }


                    // ==================================
                    // ENTRAR NA SALA
                    // ==================================

                    if (
                        mensagem.tipo ===
                        "entrar"
                    ) {

                        const codigoSala =
                            mensagem.sala;


                        if (!codigoSala) {

                            enviar(
                                socket,
                                {

                                    tipo:
                                        "erro",

                                    mensagem:
                                        "Código da sala inválido."

                                }
                            );

                            return;
                        }


                        // ==================================
                        // PEGAR NOME
                        // ==================================

                        if (
                            typeof mensagem.nome ===
                                "string" &&
                            mensagem.nome.trim() !== ""
                        ) {

                            nomeParticipante =
                                mensagem.nome
                                    .trim()
                                    .substring(
                                        0,
                                        30
                                    );
                        }


                        // Atualizar usuário
                        const usuario =
                            usuarios.get(id);


                        if (usuario) {

                            usuario.nome =
                                nomeParticipante;

                            usuario.sala =
                                codigoSala;
                        }


                        // ==================================
                        // CRIAR SALA
                        // ==================================

                        if (
                            !salas.has(
                                codigoSala
                            )
                        ) {

                            salas.set(
                                codigoSala,
                                new Map()
                            );
                        }


                        const participantes =
                            salas.get(
                                codigoSala
                            );


                        // ==================================
                        // VERIFICAR LIMITE
                        // ==================================

                        if (
                            participantes.size >=
                            MAX_PARTICIPANTES
                        ) {

                            enviar(
                                socket,
                                {

                                    tipo:
                                        "sala-cheia",

                                    limite:
                                        MAX_PARTICIPANTES

                                }
                            );


                            console.log(
                                `🚫 Sala ${codigoSala} cheia.`
                            );


                            socket.close();

                            return;
                        }


                        salaAtual =
                            codigoSala;


                        // ==================================
                        // PARTICIPANTES EXISTENTES
                        // ==================================

                        const participantesExistentes =
                            Array.from(
                                participantes.entries()
                            ).map(
                                (
                                    [
                                        participanteId,
                                        participante
                                    ]
                                ) => ({

                                    id:
                                        participanteId,

                                    nome:
                                        participante.nome

                                })
                            );


                        // ==================================
                        // AVISAR QUEM ENTROU
                        // ==================================

                        enviar(
                            socket,
                            {

                                tipo:
                                    "sala",

                                id:
                                    id,

                                participantes:
                                    participantesExistentes,

                                quantidade:
                                    participantes.size,

                                limite:
                                    MAX_PARTICIPANTES

                            }
                        );


                        // ==================================
                        // ADICIONAR À SALA
                        // ==================================

                        participantes.set(
                            id,
                            {

                                socket:
                                    socket,

                                nome:
                                    nomeParticipante

                            }
                        );


                        // ==================================
                        // AVISAR OS OUTROS
                        // ==================================

                        participantes.forEach(
                            (
                                participante,
                                participanteId
                            ) => {

                                if (
                                    participanteId !==
                                    id
                                ) {

                                    enviar(
                                        participante.socket,
                                        {

                                            tipo:
                                                "novo-participante",

                                            id:
                                                id,

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


                        // Atualizar usuários online
                        enviarUsuariosOnline();


                        return;
                    }


                    // ==================================
                    // SISTEMA DE CONVITE
                    // ==================================

                    if (
                        mensagem.tipo ===
                        "convite"
                    ) {

                        const destino =
                            mensagem.destino;


                        if (!destino) {

                            enviar(
                                socket,
                                {

                                    tipo:
                                        "erro",

                                    mensagem:
                                        "Usuário de destino não informado."

                                }
                            );

                            return;
                        }


                        // ==================================
                        // PROCURAR USUÁRIO
                        // ==================================

                        const usuarioDestino =
                            usuarios.get(
                                destino
                            );


                        if (
                            !usuarioDestino
                        ) {

                            enviar(
                                socket,
                                {

                                    tipo:
                                        "erro",

                                    mensagem:
                                        "Esse usuário não está online."

                                }
                            );

                            return;
                        }


                        // ==================================
                        // VERIFICAR SE O CONVIDADOR
                        // ESTÁ EM UMA SALA
                        // ==================================

                        if (!salaAtual) {

                            enviar(
                                socket,
                                {

                                    tipo:
                                        "erro",

                                    mensagem:
                                        "Você precisa estar em uma sala para convidar alguém."

                                }
                            );

                            return;
                        }


                        // ==================================
                        // ENVIAR CONVITE
                        // ==================================

                        enviar(
                            usuarioDestino.socket,
                            {

                                tipo:
                                    "convite",

                                de:
                                    id,

                                nome:
                                    nomeParticipante,

                                sala:
                                    salaAtual

                            }
                        );


                        console.log(
                            `🔔 ${nomeParticipante} convidou ${usuarioDestino.nome} para ${salaAtual}`
                        );


                        // ==================================
                        // CONFIRMAR PARA QUEM ENVIOU
                        // ==================================

                        enviar(
                            socket,
                            {

                                tipo:
                                    "convite-enviado",

                                nome:
                                    usuarioDestino.nome

                            }
                        );


                        return;
                    }


                    // ==================================
                    // RESPOSTA AO CONVITE
                    // ==================================

                    if (
                        mensagem.tipo ===
                        "resposta-convite"
                    ) {

                        const destino =
                            mensagem.destino;


                        const usuarioDestino =
                            usuarios.get(
                                destino
                            );


                        if (
                            !usuarioDestino
                        ) {

                            return;
                        }


                        enviar(
                            usuarioDestino.socket,
                            {

                                tipo:
                                    "resposta-convite",

                                de:
                                    id,

                                nome:
                                    nomeParticipante,

                                aceitou:
                                    mensagem.aceitou ===
                                    true

                            }
                        );


                        console.log(
                            `🔔 ${nomeParticipante}: ` +
                            `${
                                mensagem.aceitou === true
                                    ? "aceitou"
                                    : "recusou"
                            } o convite`
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
                            salas.get(
                                salaAtual
                            );


                        if (!participantes) {
                            return;
                        }


                        const destino =
                            mensagem.destino;


                        const sinal =
                            mensagem.sinal;


                        // ==================================
                        // DESTINO ESPECÍFICO
                        // ==================================

                        if (destino) {

                            const participante =
                                participantes.get(
                                    destino
                                );


                            if (
                                participante
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


                            return;
                        }


                        // ==================================
                        // TODOS
                        // ==================================

                        participantes.forEach(
                            (
                                participante,
                                participanteId
                            ) => {

                                if (
                                    participanteId !==
                                        id &&
                                    participante.socket
                                        .readyState ===
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

                    console.log(
                        erro
                    );
                }
            }
        );


        // ========================================
        // DESCONECTOU
        // ========================================

        socket.on(
            "close",
            () => {

                console.log(
                    `👋 ${id} desconectou.`
                );


                // ==================================
                // REMOVER DA SALA
                // ==================================

                if (salaAtual) {

                    const participantes =
                        salas.get(
                            salaAtual
                        );


                    if (
                        participantes
                    ) {

                        participantes.delete(
                            id
                        );


                        // Avisar os outros
                        participantes.forEach(
                            (participante) => {

                                enviar(
                                    participante.socket,
                                    {

                                        tipo:
                                            "participante-saiu",

                                        id:
                                            id

                                    }
                                );

                            }
                        );


                        // Apagar sala vazia
                        if (
                            participantes.size ===
                            0
                        ) {

                            salas.delete(
                                salaAtual
                            );


                            console.log(
                                `🗑️ Sala ${salaAtual} apagada.`
                            );

                        } else {

                            console.log(
                                `👥 Restam ${participantes.size} pessoas na sala.`
                            );
                        }
                    }
                }


                // ==================================
                // REMOVER USUÁRIO ONLINE
                // ==================================

                usuarios.delete(
                    id
                );


                // Atualizar lista
                enviarUsuariosOnline();

            }
        );

    }
);


// ============================================
// ERRO DO WEBSOCKET
// ============================================

wss.on(
    "error",
    (erro) => {

        console.log(
            "❌ Erro no WebSocket:"
        );

        console.log(
            erro
        );
    }
);


// ============================================
// INICIAR SERVIDOR
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

        console.log(
            `🔔 Sistema de convites ativado!`
        );

        console.log(
            `👤 Sistema de usuários online ativado!`
        );
    }
);
