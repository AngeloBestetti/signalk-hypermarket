const id = 'signalk-hypermarket';
const nats = require('nats');

module.exports = function(app) {
  var plugin = {
    unsubscribes: [],
  };

  plugin.id = id;
  plugin.name = 'SignalK - Hypermarket NATS';
  plugin.description =
    'Plugin utilizado para enviar a telemetria para o eMarine';

  plugin.schema = {
    title: 'SignalK - Hypermarket NATS',
    type: 'object',
    required: ['port'],
    properties: {
      sendToRemote: {
        type: 'boolean',
        title: 'Envia dados para o Hypermarket',
        default: false,
      },
      remoteHost: {
        type: 'string',
        title: 'Hypermarket Cluster URL, default: nats://<localhost>:4222',
        description:
          'Hypermarket Cluster URL',
        default: 'nats://sa-01.hypermarket.io',
      },
      username: {
        type: "string",
        title: "Hypermarket Username"
      },
      password: {
        type: "string",
        title: "Hypermarket Password"
      },
      mmsi: {
        type: "string",
        title: "mmsi vessel",
        description: "mmsi vessel",
      },
      paths: {
        type: 'array',
        title: 'SignalK self paths para envio',
        default: [{ path: 'navigation.position', interval: 60 }],
        items: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              title: 'Path',
            },
            interval: {
              type: 'number',
              title:
                'Intervalo minimo para envio',
            },
          },
        },
      },
    },
  };


  plugin.onStop = [];

  plugin.start = async function(options) {
    plugin.onStop = [];
    if (options.sendToRemote) {
        const nc = await nats.connect({servers: options.remoteHost, user: options.username, pass: options.password});
      startSending(options, nc, plugin.onStop);
      plugin.onStop.push(_ => nc.drain());
    }
  };

  plugin.stop = function() {
    plugin.onStop.forEach(f => f());
  };

  function startSending(options, nc, onStop) {
    options.paths.forEach(pathInterval => {
      onStop.push(
        app.streambundle
          .getSelfBus(pathInterval.path)
          .debounceImmediate(pathInterval.interval * 1000)
          .onValue(normalizedPathValue =>
            nc.publish('signalk.' + options.mmsi + '.' + 'telemetria' + '.' + pathInterval.path,
              JSON.stringify({
                context: 'vessels.' + app.selfId,
                updates: [
                  {
                    timestamp: normalizedPathValue.timestamp,
                    $source: normalizedPathValue.$source,
                    values: [
                      {
                        path: pathInterval.path,
                        value: normalizedPathValue.value,
                      },
                    ],
                  },
                ],
              })
            )
          )
      );
    });
  }
  return plugin;
};
