const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const schedule = require("node-schedule");

// Inicializar el cliente de WhatsApp con webVersionCache
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
});

// Configuración
const CONFIG = {
  groupName: "WINTER ARC (yo)", // Nombre de tu grupo
  sendTime: "0 8 * * *", // Cron: todos los días a las 8:00 AM (minuto, hora, día, mes, día semana)
};

// Array de frases motivadoras
const frases = [
  '💪 *Winter Arc Day ${day}*\n\n"El dolor que sientes hoy será la fuerza que sientas mañana."\n\n¡A romperla hoy!',
  '🔥 *Winter Arc Day ${day}*\n\n"No se trata de tener tiempo. Se trata de hacer tiempo."\n\n¡Vamos con todo!',
  '⚡ *Winter Arc Day ${day}*\n\n"La disciplina es hacer lo que odias, pero hacerlo como si amaras hacerlo."\n\n¡Imparable!',
  '🎯 *Winter Arc Day ${day}*\n\n"Tu único límite eres tú mismo."\n\n¡A conquistar el día!',
  '💎 *Winter Arc Day ${day}*\n\n"Los ganadores no son los que nunca fallan, sino los que nunca se rinden."\n\n¡Sigue adelante!',
  '🚀 *Winter Arc Day ${day}*\n\n"El éxito es la suma de pequeños esfuerzos repetidos día tras día."\n\n¡Constancia es la clave!',
  '⭐ *Winter Arc Day ${day}*\n\n"No cuentes los días, haz que los días cuenten."\n\n¡Hoy es TU día!',
];

// Obtener frase del día
function getFraseDelDia() {
  const startDate = new Date("2025-01-01"); // Fecha de inicio del Winter Arc
  const today = new Date();
  const diffTime = Math.abs(today - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const fraseIndex = diffDays % frases.length;
  return frases[fraseIndex].replace("${day}", diffDays);
}

// Evento: Generar QR
client.on("qr", (qr) => {
  console.log("📱 Escanea este código QR con WhatsApp:");
  qrcode.generate(qr, { small: true });
});

// Evento: Cliente listo
client.on("ready", async () => {
  console.log("✅ Bot de WhatsApp conectado!");

  // Buscar el grupo
  const chats = await client.getChats();
  const grupo = chats.find(
    (chat) => chat.isGroup && chat.name.includes(CONFIG.groupName)
  );

  if (grupo) {
    console.log(`✅ Grupo encontrado: ${grupo.name}`);
    console.log(`📅 Programado para enviar mensajes: ${CONFIG.sendTime}`);

    // Programar envío diario
    schedule.scheduleJob(CONFIG.sendTime, async () => {
      try {
        const mensaje = getFraseDelDia();
        await grupo.sendMessage(mensaje);
        console.log(`✅ Mensaje enviado a las ${new Date().toLocaleString()}`);
      } catch (error) {
        console.error("❌ Error al enviar mensaje:", error);
      }
    });

    // Opcional: Enviar mensaje de prueba inmediato
    // await grupo.sendMessage('🤖 Bot activado! Los mensajes diarios comenzarán mañana.');
  } else {
    console.log("❌ Grupo no encontrado. Verifica el nombre del grupo.");
    console.log("Grupos disponibles:");
    chats.filter((c) => c.isGroup).forEach((c) => console.log(`  - ${c.name}`));
  }
});

// Evento: Autenticación
client.on("authenticated", () => {
  console.log("🔐 Autenticación exitosa");
});

// Evento: Fallo de autenticación
client.on("auth_failure", (msg) => {
  console.error("❌ Fallo en la autenticación", msg);
});

// Evento: Desconexión
client.on("disconnected", (reason) => {
  console.log("⚠️ Cliente desconectado:", reason);
});

// Inicializar cliente
console.log("🚀 Iniciando bot de WhatsApp...");
client.initialize();
