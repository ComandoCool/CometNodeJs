var createServer = require("http").createServer;
var puts = require("sys").puts;
var url = require("url");

// -------------------------------------
// Configuration
// -------------------------------------

var port = 443;
var timeout = 5000; //ms
var bufferSize = 10;

// -------------------------------------
// Utils
// -------------------------------------

function log(msg)
{
    var time = new Date().toString().split(' ')[4];
    puts('('+time+') '+msg);
}

function date()
{
    return new Date().getTime(); // ms
}

// -------------------------------------
// Comet
// -------------------------------------

function Message(time, data)
{
    this.time = time;
    this.data = data;
}

function Buffer()
{
    var messages = [];
    var time = date();
    var callbacks = [];

    this.put = function(data)
    {
        // Nouveau message
        time = date();
        var message = new Message(time, data);

        // Ajout dans la liste
        messages.push(message);

        // Envoie à ceux qui attendent
        while (callbacks.length > 0)
            callbacks.shift().callback([message]);

        // Taille du buffer limitée
        while (messages.length > bufferSize)
            messages.shift();

        // retourne time du dernier message
        return time;
    };

    this.get = function (time, callback)
    {
        var i, message, matching=[];

        // Trouve les nouveaux messages
        for (i=0; i<messages.length; i++)
        {
            message = messages[i];
            if (message.time > time)
            {
                matching.push(message);
            }
        }

        // Y a-t-il de nouveaux messages ?
        if (matching.length > 0)
        {
            // oui, donc on envoie tout de suite ce qu'on a
            callback(matching);
            return 'now';
        }
        else
        {
            // non, on fait patienter
            callbacks.push({
                time: date(),
                callback: callback
            });
            return 'wait';
        }
    };

    this.sync = function()
    {
        return time;
    };

    this.free = function (expire) {
        var remove = callbacks.length === 0 && time < expire;

        while (callbacks.length > 0 && callbacks[0].time < expire)
        {
            callbacks.shift().callback([]);
        }

        return remove;
    };
}

var buffers = [];

function getBuffer(bufferName) {
    var buffer = buffers[bufferName];

    if (buffer)
    {
        // buffer existe, on le retourne
        return buffer;
    }
    else
    {
        // existe pas, on le crée
        log('Nouveau buffer : '+bufferName);
        buffers[bufferName] = new Buffer();
        buffer = buffers[bufferName];
        return buffer;
    }
}

setInterval(function(){
    var expire = date() - timeout;
    for (buffer in buffers)
    {
        // libère les callbacks dépassés
        if (buffers[buffer].free(expire))
        {
            // supprime le buffer sans client
            log('Suppression buffer : '+buffer);
            delete buffers[buffer];
        }
    }
}, 1000);

// -------------------------------------
// HTTP interface
// -------------------------------------

function response(res, code, body, callback)
{
    var type;
    body = JSON.stringify(body);
    if (callback)
    {
        body = callback + '(' + body + ');';
        type = 'application/javascript';
    }
    else
    {
        type = 'text/json';
    }

    res.sendHeader(code, {
        "Content-Type": type,
        "Content-Length": body.length
    });
    res.write(body);
    res.close();
    log('client--');
}

var server = createServer(function (req, res) {
    log('client++');
    var query   = url.parse(req.url, true).query || {method:'sync', channel:1},
        channel = query.channel || 'test',
        method  = query.method || 'sync',
        buffer  = getBuffer(channel),
        callback= query.callback || false,
        time,
        message;

    switch(method)
    {
        case 'get':
            time = query.time || 0;
            buffer.get(time, function(messages){
                time = buffer.sync();
                response(res, 200, {time:time, messages:messages}, callback);
            });
            break;

        case 'put':
            message = query.message || null;
            time = buffer.put(JSON.parse(message));
            response(res, 200, {time:time}, callback);
            break;

        //case 'sync':
        default:
            time = buffer.sync();
            response(res, 200, {time:time}, callback);
            break;
    }
});

server.listen(port);
log('Serveur en route');
