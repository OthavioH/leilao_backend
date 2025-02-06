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
import Leilao from './models/leilao';


export class FastifyServer {
    private httpServer: FastifyInstance;
    private socketServer: dgram.Socket;
    private multicastAddress = '239.255.255.250';
    private multicastPort = 0;
    private leilao: Leilao;
    private itemLeilaoAtual?: LeilaoItem;
    private chaveSimetrica: Buffer;
    private leilaoEndTime: Date;
    private router: Router | undefined;

    constructor() {
        this.chaveSimetrica = crypto.randomBytes(32);
        this.httpServer = Fastify({
            logger: true,
        });
        this.itemLeilaoAtual = {
            id: crypto.randomUUID(),
            nome: 'Cadeira de escritório',
            imagem: 'https://abramais.vteximg.com.br/arquivos/ids/209496/cadeira-de-escritorio-franca-preto-diagonal.jpg?v=637967857589630000'
        }
        this.leilaoEndTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        this.leilao = {
            id: crypto.randomUUID(),
            item: this.itemLeilaoAtual,
            lanceInicial: 100.0,
            incrementoMinimoLance: 10.0,
            endTime: this.leilaoEndTime,
            users: [],
        }

        this.socketServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        // Starts the timer for the auction
        this.startAuctionTimer();
    }

    startAuctionTimer() {
        const interval = setInterval(() => {
            if (this.leilaoEndTime <= new Date()) {
                console.log('Leilão encerrado');
                clearInterval(interval);
                this.itemLeilaoAtual = undefined;
                this.broadcastAuctionStatus();
            }
        }, this.leilao.endTime.getTime() - Date.now());
    }

    async initialize() {
        // Configurar plugins Fastify
        await this.httpServer.register(fastifyCors, {
            origin: true,
        });

        await this.httpServer.register(fastifyWebsocket);

        // Configurar rotas
        this.router = new Router(this.httpServer, this.multicastAddress, this.multicastPort);
        this.router.setupRoutes();

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
        this.socketServer.on('listening', () => {
            var address = this.socketServer.address();
            this.multicastPort = address.port;
            if(this.router != null){
                this.router.multicastPort = address.port;
            }
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
                this.leilao.users.push(user);
                this.broadcastAuctionStatus();
            } else if (message.action === 'LEAVE') {
                const user = message.data;
                this.leilao.users = this.leilao.users.filter(u => u.id !== user.id);
                this.broadcastAuctionStatus();
            }
            else if (message.action === 'BID') {
                const data = message.data;

                const bid = data.amount;
                const userId = data.userId;
                this.processBid(bid, userId);
            }
        });

        this.socketServer.bind(0, '0.0.0.0');
    }

    private processBid(bid: number, userId: string) {
        if (this.leilao.lanceAtual && bid >= this.leilao.lanceAtual + this.leilao.incrementoMinimoLance) {
            console.log(`New bid registered: ${bid} by ${userId}`);
            var user = this.leilao.users.find(u => u.id === userId);
            console.log(user);
            if (user) {
                console.log("Colocando lance");
                this.leilao.lanceAtual = bid;
                this.leilao.ofertanteAtual = user;
                console.log("Lance: " + this.leilao.lanceAtual);
                console.log("Ofertante: " + this.leilao.ofertanteAtual);
            }
        } else if (!this.leilao.lanceAtual && bid >= this.leilao.lanceInicial + this.leilao.incrementoMinimoLance) {
            console.log(`New bid registered: ${bid} by ${userId}`);
            var user = this.leilao.users.find(u => u.id === userId);
            if (user) {
                this.leilao.lanceAtual = bid;
                this.leilao.ofertanteAtual = user;
            }
        } else {
            console.log(`Bid too low: ${bid}`);
        }

        this.broadcastAuctionStatus();
    }

    broadcastAuctionStatus() {
        const status = this.leilao ? {
            action: 'AUCTION_STATUS',
            data: {
                leilao: this.leilao,
            },
            active: true
        } : {
            action: 'AUCTION_STATUS',
            data: null,
            active: false
        };

        const message = JSON.stringify(status);
        this.socketServer.send(message, 0, message.length + 1, this.multicastPort, this.multicastAddress, (err) => {
            if (err) {
                console.error(`Error broadcasting auction status: ${err}`);
            } else {
                console.log('Auction status broadcasted successfully');
            }
        });
    }
}