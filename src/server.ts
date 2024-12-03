import Fastify, { FastifyInstance } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';

import dgram from 'dgram';
import crypto from 'crypto';
import LeilaoItem from './models/leilao_item';
import User from './models/user';
import { MulticastAction } from './models/multicast_action';
import { connectClient } from './client';
import Router from './routes';


export class FastifyServer {
    private httpServer: FastifyInstance;
    private socketServer: dgram.Socket;
    private client: dgram.Socket;
    private multicastAddress = '239.255.255.250';
    private multicastPort = 27010;
    private itemLeilaoAtual?: LeilaoItem;
    private users: User[] = [];
    private chaveSimetrica: Buffer;

    constructor() {
        this.chaveSimetrica = crypto.randomBytes(32);
        this.httpServer = Fastify({
            logger: true,
        });
        this.client = dgram.createSocket('udp4');
        this.itemLeilaoAtual = {
            id: crypto.randomUUID(),
            nome: 'Cadeira de escritório',
            lanceInicial: 100.0,
            incrementoMinimoLance: 10.0,
            endTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        }

        this.socketServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    }

    async initialize() {
        // Configurar plugins Fastify
        await this.httpServer.register(fastifyCors, {
            origin: true,
        });

        await this.httpServer.register(fastifyWebsocket);

        // Configurar rotas
        new Router(this.httpServer, this.multicastAddress, this.multicastPort).setupRoutes();

        // Configurar socket multicast
        this.setupMulticast();

        // Iniciar servidor
        try {
            const port = process.env.PORT != null ? parseInt(process.env.PORT, 10) : 3000;
            await this.httpServer.listen({ port: port, host: '0.0.0.0' });
            console.log('Servidor rodando na porta 3000');
        } catch (err) {
            this.httpServer.log.error(err);
            process.exit(1);
        }
    }

    async setupMulticast() {
        // this.socketServer.on('listening', () => {
        //     var address = this.socketServer.address();
        //     console.log('UDP Client listening on ' + address.address + ":" + address.port);
        //     this.socketServer.setBroadcast(true)
        //     this.socketServer.setMulticastTTL(128);
        //     this.socketServer.addMembership(this.multicastAddress);
        // });

        this.socketServer.on('listening', () => {
            var address = this.socketServer.address();
            console.log('UDP Client listening on ' + address.address + ":" + address.port);
            this.socketServer.setBroadcast(true)
            this.socketServer.setMulticastTTL(128);
            this.socketServer.addMembership(this.multicastAddress);
        });

        this.socketServer.on('error', (err) => {
            console.log('UDP error: ' + err);
            this.socketServer.close();
        });

        this.socketServer.on('connect', function () {
            console.log('Client has connected');
        });

        this.socketServer.on('close', function () {
            console.log('Client has disconnected');
        });

        this.socketServer.on("message", (msg, rinfo) => {
            console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);

            const message = JSON.parse(msg.toString()) as MulticastAction;

            if (message.action === 'JOIN') {
                const user = message.data;
                this.users.push(user);
                this.broadcastAuctionStatus();
            }
            else if (message.action === 'BID') {
                const data = message.data;

                const bid = data.amount;
                const userId = data.userId;
                this.processBid(bid, userId);
            }
        });

        this.client.bind(() => {
            this.client.setBroadcast(true)
            this.client.setMulticastTTL(128);
            this.client.addMembership(this.multicastAddress);
        });

        this.socketServer.bind(this.multicastPort, '0.0.0.0');
    }

    private processBid(bid: number, userId: string) {
        if (this.itemLeilaoAtual) {
            if (this.itemLeilaoAtual.lanceAtual && bid >= this.itemLeilaoAtual.lanceAtual + this.itemLeilaoAtual.incrementoMinimoLance) {
                console.log(`New bid registered: ${bid} by ${userId}`);
                var user = this.users.find(u => u.id === userId);
                console.log(user);
                if (user) {
                    console.log("Colocando lance");
                    this.itemLeilaoAtual.lanceAtual = bid;
                    this.itemLeilaoAtual.ofertanteAtual = user;
                    console.log("Lance: " + this.itemLeilaoAtual.lanceAtual);
                    console.log("Ofertante: " + this.itemLeilaoAtual.ofertanteAtual);
                }
            } else if (!this.itemLeilaoAtual.lanceAtual && bid >= this.itemLeilaoAtual.lanceInicial + this.itemLeilaoAtual.incrementoMinimoLance) {
                console.log(`New bid registered: ${bid} by ${userId}`);
                var user = this.users.find(u => u.id === userId);
                if (user) {
                    this.itemLeilaoAtual.lanceAtual = bid;
                    this.itemLeilaoAtual.ofertanteAtual = user;
                }
            } else {
                console.log(`Bid too low: ${bid}`);
            }
        } else {
            console.log(`Auction not active: ${bid}`);
        }

        this.broadcastAuctionStatus();
    }

    broadcastAuctionStatus() {
        const status = this.itemLeilaoAtual ? {
            action: 'AUCTION_STATUS',
            data: this.itemLeilaoAtual,
            active: true
        } : {
            action: 'AUCTION_STATUS',
            data: null,
            active: false
        };

        const message = JSON.stringify(status);
        this.client.send(message, 0, message.length + 1, this.multicastPort, this.multicastAddress, (err) => {
            if (err) {
                console.error(`Error broadcasting auction status: ${err}`);
            } else {
                console.log('Auction status broadcasted successfully');
            }
        });
    }
}