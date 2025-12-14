
const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0
  }).format(amount);
};

function formatProductMessage(product) {
  let message = `🍺 *${product.name}*\n`;

  if (product.description && product.description.length < 50) {
    message += `_${product.description}_\n`;
  }

  const preciosOrdenados = product.price.sort((a, b) => a.min - b.min);

  preciosOrdenados.forEach(p => {
    let linea = '';

    // Simple unit
    if (p.min === 1 && !p.max) {
      linea = `• ${p.presentation}: *${formatMoney(p.price)}*`;
    }
    // Range
    else if (p.max) {
      linea = `• ${p.min} a ${p.max} (${p.presentation}): *${formatMoney(p.price)}* c/u`;
    }
    // More than..
    else {
      linea = `• ${p.min} (${p.presentation}): *${formatMoney(p.price)}* c/u`;
    }

    message += `${linea}\n`;
  });

  return message;
}

module.exports = { formatProductMessage };