import dgram from 'dgram';

export const connectClient = async () => {
    var PORT = 27010;
    var MCAST_ADDR = "230.185.192.108"; //same mcast address as Server
    var HOST = 'localhost'; //this is your own IP
    var client = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    client.on('listening', function () {
        var address = client.address();
        console.log('UDP Client listening on ' + address.address + ":" + address.port);
        client.setBroadcast(true)
        client.setMulticastTTL(128);
        client.addMembership(MCAST_ADDR);
    });

    client.on('error', function (err) {
        console.log('UDP error: ' + err);
        client.close();
    });

    client.on('connect', function () {
        console.log('Client has connected');
    });

    client.on('close', function () {
        console.log('Client has disconnected');
    });

    client.on('message', function (message, remote) {
        console.log('MCast Msg: From: ' + remote.address + ':' + remote.port + ' - ' + message);
    });

    client.bind(PORT, HOST);
}