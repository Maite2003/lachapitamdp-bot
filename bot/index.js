const wppconnect = require('@wppconnect-team/wppconnect');
const { handleProductSearch, showSchedule, processSmartOrder, sendWelcome, finalizeOrder } = require('./src/flows/steps');
const { detectIntention } = require('./src/services/api');


const STATUS  = {
  MAKING_CART: 'MAKING_CART',
  MENU: 'MENU',
  WAITING_NAME: 'WAITING_NAME',
  WAITING_ADDRESS: 'WAITING_ADDRESS',
  WAITING_DELIVERY: 'WAITING_DELIVERY',
};

const INTENTS = {
  SCHEDULE_REQUEST: "INFO_HORARIOS",
  ADDRESS_REQUEST: "INFO_UBICACION",
  PRICE_REQUEST: "CONSULTA_PRECIO",
  ORDER: "INTENCION_COMPRA",
  FINISH_ORDER: "FINALIZAR_COMPRA",
  CANCEL: "CANCELAR",
  HELLO: "SALUDO",
  OTHER: "OTRO",
};

// WPPConnect
wppconnect.create({
  session: 'lachapita-session',
  headless: true,
  useChrome: false,
  puppeteerOptions: {
    userDataDir: './tokens',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
    ]
  }
})
  .then((client) => {
    console.log('Bot iniciado correctamente 🚀');
    start(client);
  })
  .catch((error) => console.log(error));


const activeSessions = new Map();

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes active then reset

function start(client) {
  client.onMessage((message) => {
    handleMessage(client, message);
  });
}

function updateSessionState(userPhone, newStep) {
  let session = activeSessions.get(userPhone);

  if (!session) {
    session = {
      step: newStep,
      lastInteraction: Date.now(),
      orderData: {}
    };
  } else {
    session.step = newStep;
    session.lastInteraction = Date.now();
  }
  activeSessions.set(userPhone, session);

  console.log(`🔄 Usuario ${userPhone} cambió de estado a: [${newStep}]`);
}

async function statusReminder(client, userPhone, session) {
  await new Promise(r => setTimeout(r, 1000));

  switch (session.step) {
    case STATUS.WAITING_NAME:
      await client.sendText(userPhone, "👇 (Seguimos) ¿Me decías tu nombre?");
      break;
    case STATUS.WAITING_ADDRESS:
      await client.sendText(userPhone, "👇 (Seguimos) ¿Cuál era la dirección de envío?");
      break;
    case STATUS.MAKING_CART:
      await client.sendText(userPhone, "🛒 ¿Querés agregar algo más al carrito o confirmamos?");
      break;
  }
}

async function handleMessage(client, message) {
  const userPhone = message.from;
  const now = Date.now();

  console.log(`Recibi mensaje de ${userPhone}`);

  if (activeSessions.has(userPhone)) {
    const session = activeSessions.get(userPhone);
    const inactive = now - session.lastInteraction;

    if (inactive > SESSION_TIMEOUT) {
      // Reset conv
      console.log(`Sesión expirada para ${userPhone}. Reiniciando.`);
      activeSessions.delete(userPhone);
      handleNew(client, userPhone);
    } else {
      // Update timestamp
      session.lastInteraction = now;
      activeSessions.set(userPhone, session);

      const intent = await detectIntention(message.body)
      console.log(`🧠 IA detectó intención: ${intent}`);

      // Informative questions
      if (intent === INTENTS.ADDRESS_REQUEST || intent === INTENTS.SCHEDULE_REQUEST) {
        await showSchedule(client, userPhone);
        await statusReminder(client, userPhone, session);
        return;
      }
      // exit
      if (intent === INTENTS.CANCEL || (intent === INTENTS.HELLO && session.step !== STATUS.MENU)) {
        await client.sendText(userPhone, "🔄 Operación cancelada. Volvemos al inicio.");
        updateSessionState(userPhone, STATUS.MENU);
        await sendWelcome(client, userPhone);
        return;
      }

      switch(session.step) {
        case STATUS.MENU:
          switch (intent) {
            case INTENTS.OTHER:
              await client.sendText(userPhone, "Perdon, no entiendo lo que queres decir. Intenta escribirlo con otras palabras");
              break;
            case INTENTS.PRICE_REQUEST:
              await handleProductSearch(client, message);
              break;
            case INTENTS.ORDER:
              await client.sendText('¡Dale, genial! 🍻 Para armar tu carrito, escribime en un solo mensaje qué productos necesitás y la cantidad')
          }
          break;

        case STATUS.MAKING_CART:
          switch (intent) {
            case INTENTS.ORDER:
              await processSmartOrder(client, userPhone, session, message.body);
            case INTENTS.FINISH_ORDER:
              await finalizeOrder(client, userPhone, session);
              break;

            case INTENTS.HELLO:
              await sendWelcome(client, userPhone);
              break;

            default:
              await processSmartOrder(client, userPhone, session, message.body);
          }
          break;

        case STATUS.WAITING_NAME:
          const rawName = message.body.trim();
          if (rawName.split(' ').length < 2) {
            await client.sendText(userPhone, "Por favor escribí Nombre y Apellido completo.");
            return;
          }

          const name = rawName.split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');

          session.orderData.cliente_nombre = name;

          await client.sendText(userPhone, `Gracias ${name}. \n¿El pedido es para *Envío* o *Retiro*?`);
          updateSessionState(userPhone, STATUS.WAITING_DELIVERY);
          break;

        case STATUS.WAITING_DELIVERY:
          const resp = message.body.toLowerCase();
          if (resp.includes('envio') || resp.includes('domicilio')) {
            session.orderData.tipo_entrega = 'envio';
            await client.sendText(userPhone, "📍 ¿A qué *dirección* enviamos?");
            updateSessionState(userPhone, STATUS.WAITING_ADDRESS);
          } else if (resp.includes('retiro') || resp.includes('local')) {
            session.orderData.tipo_entrega = 'retiro';
            await finalizeOrder(client, userPhone, session);
            updateSessionState(userPhone, STATUS.MENU);
          } else {
            await client.sendText(userPhone, "Escribí 'Envío' o 'Retiro'.");
          }
          break;

        case STATUS.WAITING_ADDRESS:
          const check = await validateAddress(message.body);
          if (check.valid) {
            session.orderData.direccion = check.formatted_address || message.body;
            await finalizeOrder(client, userPhone, session);
            updateSessionState(userPhone, STATUS.MENU);
          } else {
            await client.sendText(userPhone, `⚠️ Dirección no válida: ${check.reason}`);
          }
          break;
      }
    }
    return;
  }
  handleNew(client, userPhone, now);
  return;
}

async function handleNew(client, userPhone, now) {
  console.log(`Iniciando nueva conversación para ${userPhone}`);

  activeSessions.set(userPhone, {
    step: STATUS.MENU,
    lastInteraction: now,
    orderData: {}
  });

  await sendWelcome(client, userPhone);
}


module.exports = {
  STATUS
}
