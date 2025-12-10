const wppconnect = require('@wppconnect-team/wppconnect');

const API_URL = 'http://localhost:3000/api/chat';

// WPPConnect
wppconnect.create({
  session: 'lachapita-session',
  headless: true,
  useChrome: true,
  puppeteerOptions: {
    userDataDir: './tokens',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ]
  }
})
  .then((client) => handleMessage(client, message))
  .catch((error) => console.log(error));


const activeSessions = new Map();

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes active then reset

async function handleMessage(client, message) {
  const userPhone = message.from;
  const now = Date.now();

  if (activeSessions.has(userPhone)) {
    const session = activeSessions.get(userPhone);
    const inactive = now - session.lastInteraction;

    if (inactive > SESSION_TIMEOUT) {
      // Reset conv
      console.log(`Sesión expirada para ${userPhone}. Reiniciando.`);
      activeSessions.delete(userPhone);
    } else {
      // Update timestamp
      session.lastInteraction = now;
      activeSessions.set(userPhone, session);
      const step = message.body;

      switch (step) {
        case '1':
          showSchedule();
          break;
        case '2':
          askPrices();
          break;
        case '3':
          makePurchase();
          break;
        default:

      }
      return;
    }
  }

  handleNew(client, userPhone);
}

async function handleNew(client, userPhone) {
  console.log(`Iniciando nueva conversación para ${userPhone}`);

  activeSessions.set(userPhone, {
    step: 'MENU',
    lastInteraction: now,
    orderData: {}
  });

  const config = await getConfig();

  await client.sendText(userPhone, config.bienvenida)
  await client.sendText(userPhone,
    "¡Hola! 👋 Bienvenido a *LaChapitaMDP*. \n\n" +
    "1. 🕒 Horarios\n" +
    "2. 💰 Consultar precio\n" +
    "3. 🛍️ Realizar pedido\n\n" +
    "Escribí el número de la opción (1/2/3):"
  );
}

async function getConfig() {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .single();

  if (error) console.error('Error cargando config:', error);
  return data;
}