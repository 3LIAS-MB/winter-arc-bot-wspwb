const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const schedule = require("node-schedule");
const fs = require("fs");
const path = require("path");

// ==================== CONFIGURACIÓN ====================
const CONFIG = {
  groupName: "WINTER-ARC-25",
  startDate: new Date("2025-01-01"),
  driveLink: "https://drive.google.com/tu-carpeta-de-recursos", // CAMBIA ESTO
  schedules: {
    morningMotivation: "0 6 * * *", // 6:00 AM
    waterReminder: "0 12 * * *", // 12:00 PM
    dinnerReminder: "0 18 * * *", // 6:00 PM
    sleepReminder: "0 22 * * *", // 10:00 PM
    dailyPhrase: "0 8 * * *", // 8:00 AM
  },
};

// ==================== ALMACENAMIENTO DE DATOS ====================
const DATA_FILE = path.join(__dirname, "winter_arc_data.json");

let data = {
  users: {},
};

let targetGroup = null; // Guardar referencia al grupo

// Cargar datos existentes
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      console.log("📂 Datos cargados exitosamente");
    }
  } catch (error) {
    console.error("❌ Error cargando datos:", error);
  }
}

// Guardar datos
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log("💾 Datos guardados");
  } catch (error) {
    console.error("❌ Error guardando datos:", error);
  }
}

// Inicializar usuario si no existe
function initUser(userId) {
  if (!data.users[userId]) {
    data.users[userId] = {
      checkins: [],
      habits: { gym: 0, agua: 0, lectura: 0, dieta: 0, sueno: [] },
      bestStreak: 0,
      currentStreak: 0,
    };
    console.log(`👤 Nuevo usuario inicializado: ${userId}`);
  }
}

// ==================== FRASES MOTIVACIONALES ====================
const frases = {
  lunes: [
    '💪 *Winter Arc Day ${day} - LUNES*\n\n"La disciplina es el puente entre metas y logros."\n\n¡A CONQUISTAR ESTA SEMANA!',
    '🔥 *Winter Arc Day ${day} - LUNES*\n\n"No se trata de empezar fuerte, se trata de terminar más fuerte."\n\n¡VAMOS CON TODO!',
  ],
  miercoles: [
    '⚡ *Winter Arc Day ${day} - MIÉRCOLES*\n\n"Mitad de semana. Los débiles descansan, los fuertes aceleran."\n\n¡NO AFLOJAMOS!',
    '💎 *Winter Arc Day ${day} - MIÉRCOLES*\n\n"El dolor es temporal, el orgullo es para siempre."\n\n¡SIGUE ADELANTE!',
  ],
  viernes: [
    '🎯 *Winter Arc Day ${day} - VIERNES*\n\n"El fin de semana NO es excusa. Los campeones no tienen días libres."\n\n¡TERMINA FUERTE!',
    '🚀 *Winter Arc Day ${day} - VIERNES*\n\n"Mientras otros festejan, tú construyes tu imperio."\n\n¡A POR EL FIN DE SEMANA!',
  ],
  domingo: [
    '🌅 *Winter Arc Day ${day} - DOMINGO*\n\n"Reflexiona. Planea. Prepárate. El lunes empieza hoy."\n\n¡MENTALIDAD DE CAMPEÓN!',
    '⭐ *Winter Arc Day ${day} - DOMINGO*\n\n"El descanso es parte del proceso, pero la preparación nunca para."\n\n¡LISTA PARA LA SEMANA!',
  ],
  default: [
    '💪 *Winter Arc Day ${day}*\n\n"El dolor que sientes hoy será la fuerza que sientas mañana."\n\n¡A romperla hoy!',
    '🔥 *Winter Arc Day ${day}*\n\n"No se trata de tener tiempo. Se trata de hacer tiempo."\n\n¡Vamos con todo!',
    '⚡ *Winter Arc Day ${day}*\n\n"La disciplina es hacer lo que odias, pero hacerlo como si amaras hacerlo."\n\n¡Imparable!',
  ],
};

// ==================== UTILIDADES ====================
function getDayNumber() {
  const today = new Date();
  const diffTime = Math.abs(today - CONFIG.startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getFraseDelDia() {
  const day = getDayNumber();
  const dayOfWeek = new Date().getDay();
  let frasesArray;

  if (dayOfWeek === 1) frasesArray = frases.lunes;
  else if (dayOfWeek === 3) frasesArray = frases.miercoles;
  else if (dayOfWeek === 5) frasesArray = frases.viernes;
  else if (dayOfWeek === 0) frasesArray = frases.domingo;
  else frasesArray = frases.default;

  const fraseIndex = day % frasesArray.length;
  return frasesArray[fraseIndex].replace("${day}", day);
}

function getCurrentStreak(checkins) {
  if (checkins.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();

  for (let i = 0; i < 365; i++) {
    const dateStr = currentDate.toDateString();
    if (checkins.includes(dateStr)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

function getCompletionRate(checkins) {
  const totalDays = getDayNumber();
  return ((checkins.length / totalDays) * 100).toFixed(1);
}

// ==================== CLIENTE DE WHATSAPP ====================
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
  timeout: 0,

  // webVersionCache: {
  //   type: "remote",
  //   remotePath:
  //     "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  // },
});

// ==================== EVENTOS ====================
client.on("qr", (qr) => {
  console.log("[LOG] Evento: qr");
  console.log("📱 Escanea este código QR con WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("[LOG] Evento: authenticated");
  console.log("🔐 Autenticación exitosa");
});

client.on("auth_failure", (msg) => {
  console.log("[LOG] Evento: auth_failure");
  console.error("❌ Fallo en la autenticación", msg);
});

client.on("ready", async () => {
  console.log("[LOG] Evento: ready");
  console.log("✅ Bot de WhatsApp conectado!");
  loadData();

  const chats = await client.getChats();
  console.log("[LOG] Obteniendo lista de grupos disponibles...");
  const gruposDisponibles = chats.filter((c) => c.isGroup);
  if (gruposDisponibles.length === 0) {
    console.log("[LOG] No se encontraron grupos en tu cuenta de WhatsApp.");
  } else {
    console.log("📋 Lista de grupos disponibles:");
    gruposDisponibles.forEach((g) => console.log(`  - ${g.name}`));
    console.log("[LOG] Fin de la lista de grupos disponibles.");
  }

  const grupo = gruposDisponibles.find(
    (chat) =>
      chat.name.trim().toLowerCase() === CONFIG.groupName.trim().toLowerCase()
  );

  if (!grupo) {
    console.log(
      "❌ Grupo no encontrado. Verifica el nombre exacto en la lista anterior y actualiza CONFIG.groupName."
    );
    return;
  }

  targetGroup = grupo; // Guardar referencia
  console.log(`✅ Grupo encontrado: ${grupo.name}`);
  console.log(`📋 ID del grupo: ${grupo.id._serialized}`);

  // ==================== PROGRAMACIÓN DE MENSAJES ====================

  // Frase motivacional diaria (8 AM)
  schedule.scheduleJob(CONFIG.schedules.dailyPhrase, async () => {
    try {
      await targetGroup.sendMessage(getFraseDelDia());
      console.log("✅ Frase del día enviada");
    } catch (error) {
      console.error("❌ Error enviando frase:", error);
    }
  });

  // Buenos días (6 AM)
  schedule.scheduleJob(CONFIG.schedules.morningMotivation, async () => {
    try {
      await targetGroup.sendMessage(
        "☀️ *BUENOS DÍAS GUERREROS!*\n\nHora de levantarse y entrenar. El día empieza AHORA. 💪\n\n¿Quién será el primero en hacer !checkin hoy?"
      );
      console.log("✅ Mensaje de buenos días enviado");
    } catch (error) {
      console.error("❌ Error enviando buenos días:", error);
    }
  });

  // Recordatorio de agua (12 PM)
  schedule.scheduleJob(CONFIG.schedules.waterReminder, async () => {
    try {
      await targetGroup.sendMessage(
        "💧 *CHECKPOINT DE HIDRATACIÓN*\n\n¿Llevas al menos 1 litro de agua?\n\nRecuerda: Tu cuerpo es 70% agua. ¡Hidrátate! 🚰"
      );
      console.log("✅ Recordatorio de agua enviado");
    } catch (error) {
      console.error("❌ Error enviando recordatorio:", error);
    }
  });

  // Recordatorio de cena (6 PM)
  schedule.scheduleJob(CONFIG.schedules.dinnerReminder, async () => {
    try {
      await targetGroup.sendMessage(
        "🍗 *HORA DE LA CENA*\n\n¿Ya planeaste tu cena saludable?\n\nLa nutrición es 70% del éxito. ¡No la arruines ahora! 🥗"
      );
      console.log("✅ Recordatorio de cena enviado");
    } catch (error) {
      console.error("❌ Error enviando recordatorio:", error);
    }
  });

  // Recordatorio de sueño (10 PM)
  schedule.scheduleJob(CONFIG.schedules.sleepReminder, async () => {
    try {
      await targetGroup.sendMessage(
        "😴 *ALERTA DE RECOVERY*\n\nEn 1 hora deberías estar durmiendo.\n\nRecuerda: El músculo crece mientras duermes. Recovery is key! 🛌"
      );
      console.log("✅ Recordatorio de sueño enviado");
    } catch (error) {
      console.error("❌ Error enviando recordatorio:", error);
    }
  });

  console.log("✅ Todos los recordatorios programados");
});

// ==================== MANEJO DE COMANDOS (FUERA DEL READY) ====================
client.on("message", async (message) => {
  try {
    // Debug: Log de todos los mensajes
    console.log(`📩 Mensaje recibido de: ${message.from}`);
    console.log(`📝 Contenido: ${message.body}`);

    // Verificar si el grupo está configurado
    if (!targetGroup) {
      console.log("⚠️ Grupo aún no configurado, esperando...");
      return;
    }

    // Verificar si el mensaje es del grupo correcto
    if (message.from !== targetGroup.id._serialized) {
      console.log(
        `⚠️ Mensaje no es del grupo target. From: ${message.from}, Target: ${targetGroup.id._serialized}`
      );
      return;
    }

    console.log("✅ Mensaje del grupo correcto, procesando comando...");

    const msg = message.body.toLowerCase().trim();
    // Obtener el ID del usuario correctamente, tanto si eres tú como si es otro
    let userId;
    console.log(`[DEBUG] message.author: ${message.author}`);
    console.log(`[DEBUG] message.fromMe: ${message.fromMe}`);
    if (message.author) {
      userId = message.author; // Mensaje de otro usuario en grupo
      console.log(`[DEBUG] userId (author): ${userId}`);
    } else if (message.fromMe) {
      userId = (await message.getContact()).id._serialized; // Mensaje propio
      console.log(`[DEBUG] userId (fromMe): ${userId}`);
    } else {
      userId = message.from; // Mensaje privado o fallback
      console.log(`[DEBUG] userId (from): ${userId}`);
    }
    const contact = await message.getContact();
    const userName = contact.pushname || contact.name || "Usuario";

    console.log(`👤 Usuario: ${userName} (${userId})`);
    console.log(`🔍 Comando detectado: ${msg}`);

    initUser(userId);

    // !checkin
    if (msg === "!checkin") {
      console.log("🔄 Procesando !checkin...");
      const today = new Date().toDateString();
      if (data.users[userId].checkins.includes(today)) {
        await message.reply("✅ Ya hiciste check-in hoy. ¡Sigue así!");
        return;
      }

      data.users[userId].checkins.push(today);
      const streak = getCurrentStreak(data.users[userId].checkins);
      data.users[userId].currentStreak = streak;

      if (streak > data.users[userId].bestStreak) {
        data.users[userId].bestStreak = streak;
      }

      saveData();

      const completionRate = getCompletionRate(data.users[userId].checkins);
      await message.reply(
        `🔥 *CHECK-IN REGISTRADO*\n\n✅ Racha actual: *${streak} días*\n📊 Tasa de cumplimiento: *${completionRate}%*\n\n¡Imparable! 💪`
      );
      console.log("✅ Check-in procesado correctamente");
    }

    // !skip
    else if (msg.startsWith("!skip")) {
      console.log("🔄 Procesando !skip...");
      const razon = message.body.slice(5).trim() || "Sin razón especificada";
      await message.reply(
        `⚠️ Día marcado como skip.\nRazón: "${razon}"\n\nRecuerda: La consistencia es clave. ¡Mañana volvemos más fuerte! 💪`
      );
    }

    // !gym
    else if (msg === "!gym") {
      console.log("🔄 Procesando !gym...");
      data.users[userId].habits.gym++;
      saveData();
      await message.reply(
        `💪 *ENTRENAMIENTO REGISTRADO*\n\nTotal de entrenamientos: *${data.users[userId].habits.gym}*\n\n¡Beast mode activado! 🔥`
      );
    }

    // !agua
    else if (msg === "!agua") {
      console.log("🔄 Procesando !agua...");
      data.users[userId].habits.agua++;
      saveData();
      await message.reply(
        `💧 *HIDRATACIÓN REGISTRADA*\n\nDías con buena hidratación: *${data.users[userId].habits.agua}*\n\n¡Sigue así! 🚰`
      );
    }

    // !lectura
    else if (msg === "!lectura") {
      console.log("🔄 Procesando !lectura...");
      data.users[userId].habits.lectura++;
      saveData();
      await message.reply(
        `📚 *LECTURA REGISTRADA*\n\nDías de lectura: *${data.users[userId].habits.lectura}*\n\n¡La mente también se entrena! 🧠`
      );
    }

    // !dieta
    else if (msg === "!dieta") {
      console.log("🔄 Procesando !dieta...");
      data.users[userId].habits.dieta++;
      saveData();
      await message.reply(
        `🥗 *DIETA LIMPIA REGISTRADA*\n\nDías con buena nutrición: *${data.users[userId].habits.dieta}*\n\n¡Abs are made in the kitchen! 🍗`
      );
    }

    // !sueño [horas]
    else if (msg.startsWith("!sueño") || msg.startsWith("!sueno")) {
      console.log("🔄 Procesando !sueño...");
      const horas = parseFloat(message.body.split(" ")[1]) || 0;
      if (horas > 0) {
        data.users[userId].habits.sueno.push(horas);
        const promedio = (
          data.users[userId].habits.sueno.reduce((a, b) => a + b, 0) /
          data.users[userId].habits.sueno.length
        ).toFixed(1);
        saveData();
        await message.reply(
          `😴 *SUEÑO REGISTRADO*\n\nHoras: *${horas}h*\nPromedio: *${promedio}h*\n\n${
            horas >= 7
              ? "¡Excelente recovery! 🌙"
              : "⚠️ Intenta dormir más, recovery is key!"
          }`
        );
      } else {
        await message.reply("⚠️ Uso: !sueño [horas]\nEjemplo: !sueño 8");
      }
    }

    // !stats o !yo
    else if (msg === "!stats" || msg === "!yo") {
      console.log("🔄 Procesando !stats...");
      const dayNum = getDayNumber();
      const totalCheckins = data.users[userId].checkins.length;
      const currentStreak = getCurrentStreak(data.users[userId].checkins);
      const completionRate = getCompletionRate(data.users[userId].checkins);
      const habits = data.users[userId].habits;

      const promedioSueno =
        habits.sueno.length > 0
          ? (
              habits.sueno.reduce((a, b) => a + b, 0) / habits.sueno.length
            ).toFixed(1)
          : "N/A";

      const statsMsg =
        `📊 *TU WINTER ARC - Día ${dayNum}*\n\n` +
        `✅ Check-ins: *${totalCheckins}/${dayNum}* (${completionRate}%)\n` +
        `🔥 Racha actual: *${currentStreak} días*\n` +
        `🏆 Mejor racha: *${data.users[userId].bestStreak} días*\n\n` +
        `*HÁBITOS CUMPLIDOS:*\n` +
        `💪 Gym: ${habits.gym} veces\n` +
        `💧 Agua: ${habits.agua} días\n` +
        `📚 Lectura: ${habits.lectura} días\n` +
        `🥗 Dieta: ${habits.dieta} días\n` +
        `😴 Sueño promedio: ${promedioSueno}h\n\n` +
        `${
          completionRate >= 80
            ? "🔥 ¡ERES UNA MÁQUINA!"
            : "💪 ¡Sigue mejorando!"
        }`;

      await message.reply(statsMsg);
    }

    // !confession
    else if (msg.startsWith("!confession")) {
      console.log("🔄 Procesando !confession...");
      const confesion = message.body.slice(11).trim();
      if (confesion) {
        await targetGroup.sendMessage(
          `🔒 *CONFESIÓN ANÓNIMA*\n\n"${confesion}"\n\n_Recuerda: Todos tenemos luchas. Aquí nos apoyamos._ 💙`
        );
      } else {
        await message.reply(
          "⚠️ Uso: !confession [tu mensaje]\nEjemplo: !confession Hoy quise comer comida chatarra"
        );
      }
    }

    // !help
    else if (msg.startsWith("!help") && msg !== "!help") {
      console.log("🔄 Procesando !help...");
      const pedido = message.body.slice(5).trim();
      await targetGroup.sendMessage(
        `🆘 *PEDIDO DE AYUDA*\n\n@${
          userId.split("@")[0]
        } necesita apoyo:\n\n"${pedido}"\n\n¿Quién puede ayudar? 🤝`
      );
    }

    // !win
    else if (msg.startsWith("!win")) {
      console.log("🔄 Procesando !win...");
      const victoria = message.body.slice(4).trim();
      if (victoria) {
        await targetGroup.sendMessage(
          `🎉 *VICTORIA DE HOY*\n\n${userName} comparte:\n\n"${victoria}"\n\n¡Celebramos tus logros! 🏆`
        );
      }
    }

    // !frase
    else if (msg === "!frase") {
      console.log("🔄 Procesando !frase...");
      await targetGroup.sendMessage(getFraseDelDia());
    }

    // !info
    else if (msg === "!info") {
      console.log("🔄 Procesando !info...");
      const participants = targetGroup.participants.length;
      const admins = targetGroup.participants.filter((p) => p.isAdmin).length;
      const dayNum = getDayNumber();

      await message.reply(
        `📋 *INFO DEL GRUPO*\n\n` +
          `👥 Participantes: ${participants}\n` +
          `👑 Admins: ${admins}\n` +
          `📅 Winter Arc Día: ${dayNum}\n` +
          `🎯 Inicio: ${CONFIG.startDate.toLocaleDateString()}\n` +
          `📚 Recursos: ${CONFIG.driveLink}`
      );
    }

    // !horarios
    else if (msg === "!horarios") {
      console.log("🔄 Procesando !horarios...");
      await message.reply(
        `⏰ *HORARIOS DE RECORDATORIOS*\n\n` +
          `🌅 Buenos días: 6:00 AM\n` +
          `💬 Frase del día: 8:00 AM\n` +
          `💧 Agua: 12:00 PM\n` +
          `🍗 Cena: 6:00 PM\n` +
          `😴 Sueño: 10:00 PM`
      );
    }

    // !recursos o !drive
    else if (msg === "!recursos" || msg === "!drive") {
      console.log("🔄 Procesando !recursos...");
      await message.reply(
        `📚 *BIBLIOTECA DE RECURSOS*\n\n` +
          `Accede a todos los recursos aquí:\n${CONFIG.driveLink}\n\n` +
          `Encontrarás:\n` +
          `💪 Rutinas de entrenamiento\n` +
          `🥗 Recetas saludables\n` +
          `🎧 Podcasts recomendados\n` +
          `📖 Libros de desarrollo personal`
      );
    }

    // !ayuda
    else if (msg === "!ayuda") {
      console.log("🔄 Procesando !ayuda...");
      const helpMsg =
        `🤖 *COMANDOS DISPONIBLES*\n\n` +
        `*HÁBITOS:*\n` +
        `• !checkin - Check-in diario\n` +
        `• !skip [razón] - Marcar día perdido\n` +
        `• !gym - Registrar entrenamiento\n` +
        `• !agua - Registrar hidratación\n` +
        `• !lectura - Registrar lectura\n` +
        `• !dieta - Registrar dieta limpia\n` +
        `• !sueño [horas] - Registrar sueño\n\n` +
        `*ESTADÍSTICAS:*\n` +
        `• !stats o !yo - Tus estadísticas\n\n` +
        `*APOYO:*\n` +
        `• !confession [texto] - Confesión anónima\n` +
        `• !help [texto] - Pedir ayuda\n` +
        `• !win [texto] - Compartir victoria\n\n` +
        `*INFO:*\n` +
        `• !frase - Frase del día\n` +
        `• !info - Info del grupo\n` +
        `• !horarios - Ver horarios\n` +
        `• !recursos - Acceder al Drive\n` +
        `• !ayuda - Este mensaje`;

      await message.reply(helpMsg);
    }
  } catch (error) {
    console.error("❌ Error procesando mensaje:", error);
  }
});

client.on("auth_failure", (msg) => {
  console.error("❌ Fallo en la autenticación", msg);
});

client.on("disconnected", (reason) => {
  console.log("[LOG] Evento: disconnected");
  console.log("⚠️ Cliente desconectado:", reason);
});

// ==================== INICIALIZACIÓN ====================
console.log("🚀 Iniciando bot de WhatsApp Winter Arc...");
console.log("🔍 Modo DEBUG activado - Verás todos los mensajes en consola");
client.initialize();
