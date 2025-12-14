const { STATUS } = require('../../index');
const { getOrderFromMessage } = require('../services/api');
const { getBusinessConfig } = require('../services/api');
const { searchProductsSmart } = require('../services/api')
const { formatProductMessage } = require('../utils/formatter');


async function showSchedule(client, userPhone) {
  try {
    const config = await getBusinessConfig();

    if (!config) {
      await client.sendText(userPhone, "⚠️ Disculpa, no pude cargar los horarios en este momento.");
      return;
    }

    let message = `🕒 *Nuestros Horarios:*\n\n`;
    console.log(`Los object entries son ${Object.entries(config.schedule) }`);
    for (const [day, time] of Object.entries(config.schedule)) {
      const dayName = day.charAt(0).toUpperCase() + day.slice(1);
      message += `• ${dayName}: ${time}\n`;
    }

    if (config.address) {
      message += `\n📍 *Ubicación:* ${config.address}`;
    }

    await client.sendText(userPhone, message);

  } catch (error) {
    console.error('Error en showSchedule:', error);
    await client.sendText(userPhone, "Hubo un error consultando los horarios.");
  }
}

async function handleProductSearch(client, message) {
  const query = message.body;

  await client.sendText(message.from, "🔎 Buscando las mejores opciones...");

  const products = await searchProductsSmart(query);

  if (!products || products.length === 0) {
    await client.sendText(message.from, `🤔 Mmm, no encontré nada parecido a "${query}". Intenta ser más específico.`);
    return;
  }

  const uniqueQueries = [...new Set(products.map(item => item.user_query))];

  let respuesta = `🎯 *Resultados para "${uniqueQueries}":*\n\n`;

  products.forEach(p => {
    respuesta += formatProductMessage(p);
    respuesta += '\n\n';
  });

  respuesta += '\nSi querés alguno, escribí *"Pedir"* y empeza a armar tu carrito de compra.';

  await client.sendText(message.from, respuesta);
}

async function processSmartOrder(client, userPhone, session, text) {
  await client.sendText(userPhone, "🤖 Procesando tu pedido con IA...");

  try {
    const items = await getOrderFromMessage(text);

    console.log(`La devolucion de la ia es \n ${items}`);

    if (items.length === 0) {
      await client.sendText(userPhone, "🤔 No pude identificar productos en tu mensaje. Intenta escribir: 'Nombre del producto', 'Cantidad', 'Unidad'.");
      return;
    }

    let resumen = "📝 *He detectado lo siguiente:*\n";

    if (!session.orderData.items) session.orderData.items = [];

    for (const item of items) {
      // Aquí tendrías que volver a buscar el producto completo en tu API/DB 
      // para calcular el precio exacto (calculatePrice) usando el ID que devolvió la IA.
      // ... lógica de cálculo de precio ...

      // Simulamos agregado
      session.orderData.items.push({
        id: item.product_id,
        name: item.detected_name,
        quantity: item.quantity,
        // ... precios ...
      });

      resumen += `✅ ${item.quantity} x ${item.detected_name}\n`;
    }

    await client.sendText(userPhone, resumen);
    await client.sendText(userPhone, "Algun otro producto que quieras agregar? Si tu carrito ya esta listo escribi *CONFIRMAR*");

  } catch (e) {
    console.error(e);
    await client.sendText(userPhone, "Error procesando el pedido inteligente.");
  }
}

async function sendWelcome(client, userPhone) {
  try {
    const config = await getBusinessConfig();

    const businessName = config.name || "LaChapitaMDP";
    const welcomeText = config.welcome_message || "¡Hola! Bienvenido a nuestro asistente virtual.";

    let message = `👋 *Bienvenido a ${businessName}*\n\n`;
    message += `${welcomeText}\n\n`;

    if (config.website) {
      message += `🌐 *Web:* ${config.website}\n`;
    }
    if (config.prices_sheet) {
      message += `📄 *Listado de precios:* ${config.prices_sheet}\n`;
    }

    message += `\n-----------------------------\n`;
    message += `🤖 *¿Cómo puedo ayudarte hoy?*\n`;
    await client.sendText(userPhone, message);

  } catch (error) {
    console.error('Error enviando bienvenida:', error);
    await client.sendText(userPhone, "Hola! 👋 Bienvenido a LaChapitaMDP. ¿Cómo puedo ayudarte hoy?");
  }
}

async function finalizeOrder(client, userPhone, session) {
  if (!session.orderData.items || session.orderData.items.length === 0) {
    await client.sendText(userPhone, "🛒 Tu carrito está vacío. Agregá algún producto escribiendo su nombre.");
  } else {
    const total = session.orderData.items.reduce((acc, item) => acc + item.total, 0);
    const msg = `🛒 *¡Excelente elección!*\n\n` +
      `Tenés cargados productos por un total aprox. de *${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(totalEstimado)}*.\n\n` +
      `📝 Para preparar el pedido, necesito unos datos mínimos.\n` +
      `👉 Por favor, decime tu *Nombre y Apellido*:`;
    await client.sendText(userPhone, msg);

    updateSessionState(userPhone, STATUS.WAITING_NAME);
  }
}

module.exports = {
  showSchedule,
  handleProductSearch,
  processSmartOrder,
  sendWelcome,
  finalizeOrder
}