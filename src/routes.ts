import { FastifyInstance } from "fastify";
import { FastifyServer } from "./server";
import server from ".";

export default class Router {
    httpServer: FastifyInstance;
    multicastAddress: String;
    multicastPort: Number;

    

    constructor(server: FastifyInstance, multicastAddress: String, multicastPort: Number) {
        this.httpServer = server;
        this.multicastAddress = multicastAddress;
        this.multicastPort = multicastPort;
    }

    setupRoutes(){
        this.joinLeilaoRoute();
    }

    joinLeilaoRoute() {
        this.httpServer.post<{
            Body: { name: string; }
        }>('/join', async (request, reply) => {
            // const { name } = request.body;
            // const userId = crypto.randomUUID();

            
            reply.status(200).send({
                multicastAddress: this.multicastAddress,
                multicastPort: this.multicastPort,
            });
            server.broadcastAuctionStatus();
        });
    }
}