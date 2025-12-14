//require('dotenv').config();

const BASE_URL = 'http://127.0.0.1:3000/api';
// const API_SECRET = process.env.API_SECRET;

const headers = {
  'Content-Type': 'application/json',
  // 'Authorization': `Bearer ${API_SECRET}` 
};

async function getBusinessConfig() {
  try {
    const response = await fetch(`${BASE_URL}/chat/config`, { headers });

    if (!response.ok) {
      throw new Error(`Error API Config: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error.message);
    return null;
  }
}

async function createOrder(orderData) {
  try {
    const response = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderData)
    });

    if (!response.ok) throw new Error('Falló la creación del pedido');
    return await response.json();
  } catch (error) {
    console.error('❌ Error creando pedido:', error.message);
    return null;
  }
}

async function searchProductsSmart(text) {
  try {
    const response = await fetch(`${BASE_URL}/chat/products/interpret`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text })
    });

    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error searching products smart:', error.message);
    return [];
  }
}

async function getOrderFromMessage(text) {
  const response = await fetch(`${BASE_URL}/chat/order/interpret`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: text })
  });

  const data = await response.json();
  const detectedItems = data.items || [];

  return detectedItems;
}

async function detectIntention(text) {
  const response = await fetch(`${BASE_URL}/chat/intention`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text })
  });
  const { intent } = await response.json();
  return intent;
}

async function validateAddress(addressText) {
  try {
    const response = await fetch(`${BASE_URL}/chat/address/validate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ address: addressText })
    });

    return await response.json();
  } catch (error) {
    return { valid: true };
  }
}

module.exports = {
  getBusinessConfig,
  createOrder,
  searchProductsSmart,
  getOrderFromMessage,
  detectIntention,
  validateAddress
}