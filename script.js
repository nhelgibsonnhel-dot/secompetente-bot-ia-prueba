const apiKey = process.env.GROQ_API_KEY || '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';  // fallback para pruebas locales

// URL de tu Google Apps Script (cámbiala por la tuya real)
const urlSheets = 'https://script.google.com/macros/s/AKfycbwc8Qvwb01ct_dxWDSIo-CCekoEOPfXZKlJkiMM_vNtpO3k6QgLiaU8ONfNupcbZsq5dQ/exec';  // ← ¡PEGA AQUÍ TU URL!

// Número de WhatsApp (cámbialo por el tuyo real: 521 + 10 dígitos sin espacios ni +)
const tuNumeroWhatsApp = '5214491377894';  // ← ¡CAMBIAR POR TU NÚMERO REAL!

// Historial de conversación con prompt actualizado
let conversation = [
  { 
    role: 'system', 
    content: `Eres un asistente IA especializado en captación de clientes para solopreneurs y pequeños negocios en México, con enfoque en Aguascalientes y zona centro.

Tu objetivo principal: calificar leads y facilitar el agendamiento de llamadas de descubrimiento de 15 minutos gratuitas para ofrecer soluciones de automatización con IA.

Reglas estrictas:
1. Responde SIEMPRE en español neutro-mexicano, tono cálido, profesional y empático.
2. Haz máximo 3-4 preguntas por respuesta para no abrumar.
3. Prioriza: nombre completo → tipo de negocio → reto principal → canal preferido (WhatsApp, email, llamada) → disponibilidad aproximada.
4. Ofrece 1 valor rápido relacionado con IA (ej. "muchos negocios en Ags duplican leads con un simple chatbot en WhatsApp").
5. Cuando el usuario muestre interés en agendar o acepte la llamada, termina tu respuesta proponiendo WhatsApp o Calendly y di algo como: "¡Perfecto! Aquí tienes un enlace directo para chatear por WhatsApp y agendar los 15 minutos gratuitos ahora mismo."
6. NO menciones placeholders como "(enlace aparecerá abajo)", [enlace] o similares. Solo escribe la frase de propuesta y deja que el sistema genere el enlace real debajo de tu respuesta.
7. Si el usuario confirma WhatsApp, responde entusiasta y di que el enlace directo aparecerá inmediatamente abajo.
8. No prometas resultados exagerados ni pidas dinero aún.
9. En la primera interacción, siempre pregunta el nombre completo del usuario para personalizar.

Ejemplo de cierre ideal:
"¡Genial, [Nombre]! Me encantaría platicar 15 minutos gratis. Aquí tienes un enlace directo para chatear por WhatsApp y agendar ahora mismo:"`
  }
];

async function enviarMensaje() {
  const input = document.getElementById('userInput');
  const chat = document.getElementById('chat');
  const mensajeUsuario = input.value.trim();

  if (!mensajeUsuario) return;

  // Mostrar mensaje del usuario con estilo
  chat.innerHTML += `<div class="message user-message">${mensajeUsuario}</div>`;
  input.value = '';

  // Agregar al historial
  conversation.push({ role: 'user', content: mensajeUsuario });

  // Mostrar "Escribiendo..."
  const typingId = 'typing-' + Date.now();
  chat.innerHTML += `<p id="${typingId}" class="typing message">IA está escribiendo...</p>`;
  chat.scrollTop = chat.scrollHeight;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: conversation,
        max_tokens: 250,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error Groq: ${response.status} - ${errorData.error?.message || 'Desconocido'}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Respuesta sin contenido válido');
    }

    const respuestaIA = data.choices[0].message.content;

    // Eliminar "Escribiendo..."
    const typingElement = document.getElementById(typingId);
    if (typingElement) typingElement.remove();

    // Mostrar respuesta de IA
    chat.innerHTML += `<div class="message ia-message">${respuestaIA}</div>`;
    chat.scrollTop = chat.scrollHeight;

    // Agregar al historial
    conversation.push({ role: 'assistant', content: respuestaIA });

    // Detección para botón WhatsApp y captura de lead
    const lowerResponse = respuestaIA.toLowerCase();
    const triggers = ['agendar', 'llamada', 'whatsapp', '15 minutos', '15 min', 'calendly', 'enlace directo', 'chatear por whatsapp', 'agendar ahora mismo'];

    const tieneTrigger = triggers.some(trigger => lowerResponse.includes(trigger));

    if (tieneTrigger) {
      // Extracción mejorada de nombre
      let nombre = 'Emprendedor';
      const nombreMatch = lowerResponse.match(/(?:genial|gracias|me alegra|perfecto|hola|encantado|alegre).*?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
      if (nombreMatch && nombreMatch[1]) {
        nombre = nombreMatch[1].trim();
      }

      const mensajePrellenado = encodeURIComponent(
        `¡Hola! Soy ${nombre} y quiero agendar los 15 minutos gratuitos para platicar de captación de clientes con tu asistente IA. 😊`
      );

      const waLink = `https://wa.me/${tuNumeroWhatsApp}?text=${mensajePrellenado}`;

      chat.innerHTML += `
        <div class="whatsapp-btn-container">
          <a href="${waLink}" target="_blank" style="
            background-color: #25D366;
            color: white;
            padding: 14px 24px;
            border-radius: 30px;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
            display: inline-block;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          ">
            Abrir WhatsApp y agendar 15 min gratis ahora
          </a>
        </div>
      `;

      chat.scrollTop = chat.scrollHeight;

      // Guardar lead en Google Sheets cuando se propone agendar
      guardarLeadEnSheets(nombre, tuNumeroWhatsApp, '', '', '', 'Interesado en agendar llamada por WhatsApp');
    }

  } catch (error) {
    console.error('Error completo:', error);
    const typingElement = document.getElementById(typingId);
    if (typingElement) typingElement.remove();
    chat.innerHTML += `<p class="typing message"><strong>Error:</strong> ${error.message}</p>`;
    chat.scrollTop = chat.scrollHeight;
  }
}

// Función para guardar en Google Sheets
async function guardarLeadEnSheets(nombre, telefono = '', email = '', negocio = '', reto = '', mensaje = '') {
  const data = {
    nombre: nombre || 'Anónimo',
    telefono: telefono,
    email: email,
    negocio: negocio,
    reto: reto,
    mensaje: mensaje
  };

  try {
    await fetch(urlSheets, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('Lead guardado en Sheets');
  } catch (error) {
    console.error('Error al guardar lead:', error);
  }
}

function reiniciarChat() {
  conversation = [
    { 
      role: 'system', 
      content: conversation[0].content  // Mantiene el mismo prompt
    }
  ];
  document.getElementById('chat').innerHTML = '';
  document.getElementById('userInput').focus();
}

// Enviar con Enter
document.getElementById('userInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();  // Evita salto de línea
    enviarMensaje();
  }
});