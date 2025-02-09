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
            Body: { signature: string, user_id: string };
        }>('/join', async (request, reply) => {
            const { signature, user_id } = request.body;

            try {
                var encryptionService = new EncryptionService();
                var isMessageValid = await encryptionService.isMessageValid(signature, user_id);

                if (!isMessageValid) {
                    throw new Error('Erro ao descriptografar mensagem');
                }

                // Encrypt the symmetric key
                var encryptedSimmetricKey = await encryptionService.encryptMessageWithPublicKey(this.simmetricKey, user_id);

                reply.status(201).send({
                    multicastAddress: this.multicastAddress,
                    multicastPort: this.multicastPort,
                    envelope: encryptedSimmetricKey,
                });
                server.broadcastAuctionStatus();
            } catch (error) {
                if(error instanceof Error){

                    reply.status(400).send({ error: `Erro ao descriptografar mensagem: ${error}\n${error.stack}` });
                } else {
                    reply.status(400).send({ 
                        error: 'Erro desconhecido ao descriptografar mensagem'
                    });
                }
            }
        });
    }
}