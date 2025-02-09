import { FastifyInstance } from "fastify";
import { FastifyServer } from "./server";
import server from ".";
import EncryptionService from "./services/encryption_key_service";

export default class Router {
    httpServer: FastifyInstance;
    multicastAddress: String;
    multicastPort: Number;
    simmetricKey: String;



    constructor(server: FastifyInstance, multicastAddress: String, multicastPort: Number, simmetricKey: String) {
        this.httpServer = server;
        this.multicastAddress = multicastAddress;
        this.multicastPort = multicastPort;
        this.simmetricKey = simmetricKey;
    }

    setupRoutes() {
        this.joinLeilaoRoute();
    }

    joinLeilaoRoute() {
        this.httpServer.post<{
            Body: { message: string, user_id: string };
        }>('/join', async (request, reply) => {
            const { message, user_id } = request.body;

            try {
                var encryptionService = new EncryptionService();
                var decryptedMessage = await encryptionService.decryptMessage(message, user_id);

                if (decryptedMessage == null || decryptedMessage.trim() == "") {
                    throw new Error('Erro ao descriptografar mensagem');
                }
                reply.status(200).send({
                    multicastAddress: this.multicastAddress,
                    multicastPort: this.multicastPort,
                    simmetricKey: this.simmetricKey,
                });
                server.broadcastAuctionStatus();
            } catch (error) {
                reply.status(400).send({ error: 'Erro ao descriptografar mensagem' });
            }
        });
    }
}