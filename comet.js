// -------------------------------------
// Comet
// -------------------------------------

(function(){
    var time = 0, // ms
        lastGet = 0, // time ms
        url,
        channel,
        callback,
        type, // json=ajax / jsonp=script
        timeout = 10000; // ms

    function init(_url, _channel, _callback)
    {
        url = _url;
        channel = _channel;
        callback = _callback;
        var parts = /^(\w+:)?\/\/([^\/?#]+)/.exec(url);
        type = (parts && parts[2] == location.host) ?
                'json' : 'jsonp';

        serverCall({method:'sync', channel:channel}, function(data) {
            time = data.time;
            loop();
            console.log('COMET: init '+time);
        });

        setTimeout(function(){setInterval(watchdog, 1000);}, 1000);
    }
    function send(msg, callback)
    {
        msg = $.json.encode(msg);
        serverCall({method: 'put', channel:channel, message: msg}, function(data) {
            callback(data.time);
        });
    }
    function loop()
    {
        lastGet = date();
        serverCall({method: 'get', channel:channel, time: time}, function(data) {
            console.log('COMET: '+$.json.encode(data));
            time = data.time;
            var messages = data.messages;
            for (var i=0; i<messages.length; i++)
            {
                callback(messages[i].data, messages[i].time);
            }
            loop();
        });
    }
    function date()
    {
        return new Date().getTime();
    }
    function serverCall(args, callback)
    {
        $.get(url, args, callback, type);
    }
    function watchdog()
    {
        var expire = date() - timeout;
        if (lastGet < expire)
        {
            loop();
        }
    }

    $.comet = {};
    $.comet.init = init;
    $.comet.send = send;
})();
