var myIp = "192.168.0.44"; //nodejs server ip goes here
var tcpServerPort = 55443;
var udpClientPort = 1982;
var multicastIp = '239.255.255.250';

var bulb = {
    rgb:1000000,
    brightness:100,
    name:"Virtual Bulb",
    model:"color",
    location: "yeelight://" + myIp + ":" + tcpServerPort,
    power:"on",
    color_mode:1,
    hue:100,
    sat:30,
    ct:4000,
    fw_ver:48,
    id:0x000000000539
}

//======= UDP listener ===========
var dgram = require('dgram');

var client = dgram.createSocket('udp4');

client.on('listening', function () {
    var address = client.address();
    console.log('UDP Client listening on ' + address.address + ":" + address.port);
    client.setMulticastTTL(128); 
    client.addMembership(multicastIp, myIp);
});

client.on('message', function (msg, remote) {   
    console.log('UPnP Broadcast recieved.');
    console.log('From: ' + remote.address + ':' + remote.port +' \n\n' + msg);
    if (msg.indexOf('M-SEARCH') >= 0) {
        console.log('Sending response:');
        var message = new Buffer("HTTP/1.1 200 OK\r\nCache-Control: max-age=3600\r\nDate: \r\nExt: \r\nLocation: yeelight://"+myIp+":"+tcpServerPort+"\r\nServer: POSIX UPnP/1.0 YGLC/1\r\nid: 0x000000000539\r\nmodel: "+bulb.color+"\r\nfw_ver: "+bulb.fw_ver+"\r\nsupport: get_prop set_default set_power toggle set_bright start_cf stop_cf set_scene cron_add cron_get cron_del set_ct_abx set_rgb set_hsv set_adjust set_music set_name\r\npower: "+bulb.power+"\r\nbright: "+bulb.brightness+"\r\ncolor_mode: "+bulb.color_mode+"\r\nct: "+bulb.ct+"\r\nrgb: "+bulb.rgb+"\r\nhue: 359\r\nsat: 100\r\nname: "+bulb.name+"\r\n");
        client.send(message, 0, message.length, udpClientPort, multicastIp, function () {
            console.log("Sent '" + message + "'");
        });
    }
});

client.bind(udpClientPort);

//====== TCP Server ==========
var connectedClients = [];
var net = require('net');
var server = 
net.createServer(function(sock) {
    console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);
    connectedClients.push(sock);

    sock.on('data', function(data) {
        console.log('DATA from' + sock.remoteAddress + ': ' + data);
        parseRequest(sock,data);
    });

    sock.on('close', function(data) {
        var index = connectedClients.indexOf(sock);
        if (index > -1) {
            connectedClients.splice(index,1);
        }
        console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);
    });

}).listen(tcpServerPort, '0.0.0.0', function() {
    console.log('TCP Server listening on ' + server.address().address + ':' + server.address().port);
});

server.on('error', function (e) {
  if (e.code == 'EADDRINUSE') {
    console.log('Address in use, retrying...');
    setTimeout(function () {
      server.close();
      server.listen(PORT, HOST);
    }, 1000);
  }
});

function notifyConnectedClients(params) {
    connectedClients.forEach(function (sock, index) {
        sock.write(JSON.stringify(params) + "\r\n");
    });
}

function parseRequest(sock,request) {
    requestJson = JSON.parse(request);
    if (requestJson.method == "cron_get") {
        sock.write(JSON.stringify({id:requestJson.id,result:[]}) + "\r\n");
    } else if (requestJson.method == "set_bright") {
        bulb.brightness = requestJson.params[0];
        sock.write(JSON.stringify({id:requestJson.id,result:["ok"]}) + "\r\n");
        notifyConnectedClients({method:"props",params:{bright:bulb.brightness}})
    } else if (requestJson.method == "set_rgb") {
        bulb.rgb = requestJson.params[0];
        sock.write(JSON.stringify({id:requestJson.id,result:["ok"]}) + "\r\n");
        notifyConnectedClients({method:"props",params:{rgb:bulb.rgb}})
    } else if (requestJson.method == "set_power") {
        bulb.power = requestJson.params[0];
        sock.write(JSON.stringify({id:requestJson.id,result:["ok"]}) + "\r\n");
        notifyConnectedClients({method:"props",params:{power:bulb.power}})
    }
}
//============================
