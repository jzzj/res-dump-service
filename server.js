var path = "/__res-dump-service__";
var eventStream = createEventStream(10 * 1000);
function reqHandler(req, res){
  if (req.url.replace(/\?.*?$/, '') !== path) return false;
  eventStream.handler(req, res);
  return true;
}

function createEventStream(heartbeat) {
  var clientId = 0;
  var clients = {};
  function everyClient(fn) {
    Object.keys(clients).forEach(function(id) {
      fn(clients[id]);
    });
  }
  setInterval(function heartbeatTick() {
    everyClient(function(client) {
      client.write("data: \uD83D\uDC93\n\n");
    });
  }, heartbeat).unref();
  return {
    handler: function(req, res) {
      req.socket.setKeepAlive(true);
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/event-stream;charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      });
      res.write('\n');
      var id = clientId++;
      clients[id] = res;
      req.on("close", function(){
        delete clients[id];
      });
    },
    publish: function(payload) {
      everyClient(function(client) {
        client.write("data: " + JSON.stringify(payload) + "\n\n");
      });
    }
  };
}

module.exports = {
  publish: eventStream.publish,
  handler: reqHandler
}