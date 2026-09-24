require("dotenv").config();

const express = require("express");

const cors = require("cors");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
// =====================================
// CONFIGURACIÓN TELEGRAM
// =====================================

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.log(
    "⚠️ Falta la variable TELEGRAM_BOT_TOKEN"
  );
}

const bot = new TelegramBot(
  TELEGRAM_BOT_TOKEN,
  {
    polling: true
  }
);
// =====================================
// ENVIAR PLANTILLA WHATSAPP
// =====================================

const META_PHONE_NUMBER_ID =
  process.env.META_PHONE_NUMBER_ID;

const META_ACCESS_TOKEN =
  process.env.META_ACCESS_TOKEN;

async function enviarPlantillaWhatsApp(
  telefono,
  variacion,
  valorAnterior,
  valorActual
) {

  try {

    const url =
      `https://graph.facebook.com/v25.0/${META_PHONE_NUMBER_ID}/messages`;

    const respuesta = await axios.post(
      url,
      {
        messaging_product: "whatsapp",

        to: telefono,

        type: "template",

        template: {
          name: "alerta_dolar_variacion",

          language: {
            code: "es"
          },

          components: [
            {
              type: "body",

              parameters: [
                {
                  type: "text",
                  text: variacion.toFixed(2)
                },
                {
                  type: "text",
                  text: valorAnterior.toFixed(5)
                },
                {
                  type: "text",
                  text: valorActual.toFixed(5)
                }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization:
            `Bearer ${META_ACCESS_TOKEN}`,

          "Content-Type":
            "application/json"
        }
      }
    );

    console.log(
      "✅ WhatsApp enviado:",
      telefono
    );

    console.log(
      "ID mensaje:",
      respuesta.data?.messages?.[0]?.id
    );

    return respuesta.data;

  } catch (error) {

    console.log(
      "❌ Error enviando WhatsApp:",
      error.response?.data ||
      error.message
    );

    return null;
  }
}

const { createClient } =

require("@supabase/supabase-js");

// ==========================
// FETCH
// ==========================

const fetch = (...args) =>

import("node-fetch")

.then(({default: fetch}) =>

fetch(...args)
);

// ==========================
// APP
// ==========================

const app = express();
app.use(cors());

app.use(express.json());

app.use(express.static(__dirname));
// ==========================
// SUPABASE
// ==========================

const supabase = createClient(

  "https://tjqlwmtxzwqdjziqukcc.supabase.co",

  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcWx3bXR4endxZGp6aXF1a2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTM3NTMsImV4cCI6MjA5NDI2OTc1M30.8cojvxD4NzULayU5VvhQCfrehiXWeji05UdtCFnIgSA"
);
// ==========================
// BINANCE
// ==========================

async function getBinance(

  fiat = "ARS",

  tradeType = "BUY",

  rows = 3
){

  try{

    const response = await fetch(

      "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",

      {

        method:"POST",

        headers:{

          "Content-Type":"application/json"
        },

        body: JSON.stringify({

          asset:"USDT",

          fiat,

          tradeType,

          page:1,

          rows
        })
      }
    );

    const data =

      await response.json();

    if(!data.data){

      return [];
    }

    return data.data.map(

      x => parseFloat(
        x.adv.price
      )
    );

  }catch(e){

    console.log(e);

    return [];
  }
}

// ==========================
// P2P BOB
// ==========================

async function getP2P_BOB(){

  try{

    const compraData =

      await getBinance(
        "BOB",
        "SELL",
        3
      );

    const ventaData =

      await getBinance(
        "BOB",
        "BUY",
        3
      );

    return {

      compra:
      Math.min(...compraData),

      venta:
      Math.max(...ventaData)
    };

  }catch(e){

    console.log(e);

    return null;
  }
}

// ==========================
// P2P ARS
// ==========================

async function getP2P_ARS(){

  try{

    const compraData =

      await getBinance(
        "ARS",
        "SELL",
        3
      );

    const ventaData =

      await getBinance(
        "ARS",
        "BUY",
        3
      );

    return {

      compra:
      Math.min(...compraData),

      venta:
      Math.max(...ventaData)
    };

  }catch(e){

    console.log(e);

    return null;
  }
}
// =====================================
// bcb
// =====================================
async function getBCB(){

  try{

    const { data } = await axios.get(
      "https://deudaexternapublica.bcb.gob.bo/publico/tipos-cambio/ultimos-indicadores",
      {
        headers:{
          "User-Agent":"Mozilla/5.0"
        }
      }
    );

    const fecha =
      data.match(/FECHA DE LA COTIZACIÓN:[\s\S]*?<strong><u>(.*?)<\/u>/i)?.[1]
      ?.replace(/&eacute;/g,"é") || null;

    const compra =
      data.match(/ESTADOS UNIDOS[\s\S]*?DÓLAR COMPRA[\s\S]*?<td align="right">([\d,]+)<\/td>/i)?.[1]
      ?.replace(",", ".");

    const venta =
      data.match(/ESTADOS UNIDOS[\s\S]*?DÓLAR VENTA[\s\S]*?<td align="right">([\d,]+)<\/td>/i)?.[1]
      ?.replace(",", ".");

    return {
      compra,
      venta,
      fecha
    };

  }catch(e){

    console.log(e);

    return null;
  }

}

// ==========================
// GUARDAR SUPABASE
// ==========================

async function guardarHistorial(

  moneda,

  compra,

  venta
){

  const { error } =

    await supabase

    .from("cotizaciones")

    .insert([{

      moneda,

      compra,

      venta

    }]);

  if(error){

    console.log(error);
  }
}

// ==========================
// OBTENER HISTORIAL
// ==========================



async function obtenerHistorial(
  moneda,
  rango
){

  let dias = 1;

  if(rango === "semana"){
    dias = 7;
  }

  if(rango === "mes"){
    dias = 30;
  }
if(rango === "anio"){
  dias = 365;
}
  const fecha = new Date(
    Date.now() -
    dias * 24 * 60 * 60 * 1000
  ).toISOString();

  // DESCARGAR TODOS LOS REGISTROS
  let todos = [];
  let desde = 0;
  const lote = 1000;

  while(true){

    const { data, error } = await supabase
      .from("cotizaciones")
      .select("*")
      .eq("moneda", moneda)
      .gte("fecha", fecha)
      .order("fecha", {
        ascending: false
      })
      .range(
        desde,
        desde + lote - 1
      );

    if(error){
      console.log(error);
      return [];
    }

    if(!data || data.length === 0){
      break;
    }

    todos.push(...data);

    if(data.length < lote){
      break;
    }

    desde += lote;
  }

  console.log(
    "Moneda:",
    moneda
  );

  console.log(
    "Total descargados:",
    todos.length
  );

  console.log(
    "Más reciente:",
    todos[0]?.fecha
  );

  console.log(
    "Más antiguo:",
    todos[todos.length - 1]?.fecha
  );

  // DÍA → todos los registros
  if(rango === "dia"){
    return todos.reverse();
  }

  // SEMANA → 1 registro por hora
  if(rango === "semana"){

    const porHora = new Map();

    todos.forEach(item => {

      const hora =
        item.fecha.substring(0, 13);

      if(!porHora.has(hora)){
        porHora.set(hora, item);
      }

    });

    const resultado =
      Array.from(
        porHora.values()
      ).reverse();

    console.log(
      "Semana (1 por hora):",
      resultado.length
    );

    return resultado;
  }

  // MES → 1 registro por hora
  if(rango === "mes"){

    const porHora = new Map();

    todos.forEach(item => {

      const hora =
        item.fecha.substring(0, 13);

      if(!porHora.has(hora)){
        porHora.set(hora, item);
      }

    });

    const resultado =
      Array.from(
        porHora.values()
      ).reverse();

    console.log(
      "Mes (1 por hora):",
      resultado.length
    );

    return resultado;
  }


// AÑO → 1 registro por día
if(rango === "anio"){

  const porDia = new Map();

  todos.forEach(item => {

    const dia = item.fecha.substring(0, 10);

    if(!porDia.has(dia)){
      porDia.set(dia, item);
    }

  });

  const resultado =
    Array.from(
      porDia.values()
    ).reverse();

  console.log(
    "Año (1 por día):",
    resultado.length
  );

  return resultado;
}
  return todos.reverse();
}


// =====================================
// ALERTAS TELEGRAM ARS → BOB
// =====================================

async function revisarVariacionTelegramARSBOB() {

  try {

    const { data, error } =
      await supabase
        .from("cotizaciones")
        .select("compra, venta, fecha")
        .eq("moneda", "ars_bob")
        .order("fecha", { ascending: false })
        .limit(2);

    if (error) {

      console.log(
        "❌ Error consultando ARS → BOB para Telegram:",
        error
      );

      return;
    }

    if (!data || data.length < 2) {

      console.log(
        "Todavía no hay suficientes registros para Telegram."
      );

      return;
    }

    const actual = data[0];
    const anterior = data[1];

    const ventaActual = Number(actual.venta);
    const ventaAnterior = Number(anterior.venta);

    if (
      !ventaActual ||
      !ventaAnterior ||
      ventaAnterior <= 0
    ) {

      console.log(
        "Valores ARS → BOB inválidos para Telegram."
      );

      return;
    }

    const variacion =
      (
        (ventaActual - ventaAnterior) /
        ventaAnterior
      ) * 100;

    console.log("=================================");
    console.log("📊 ARS → BOB TELEGRAM");
    console.log("Anterior:", ventaAnterior);
    console.log("Actual:", ventaActual);
    console.log(
      "Variación:",
      variacion.toFixed(2) + "%"
    );
    console.log("=================================");

    const {
      data: suscriptores,
      error: errorSuscriptores
      } = await supabase
      .from("suscriptores_telegram")
      .select(
        "chat_id, telefono, nombre, username, variacion_alerta, valor_referencia, ultima_alerta, intervalo_alerta, suscripcion_activa, fecha_inicio, fecha_vencimiento"
      )
      .eq("activo", true);

    if (errorSuscriptores) {

      console.log(
        "❌ Error consultando suscriptores Telegram:",
        errorSuscriptores
      );

      return;
    }

    if (
      !suscriptores ||
      suscriptores.length === 0
    ) {

      console.log(
        "No hay suscriptores Telegram activos."
      );

      return;
    }

    for (const suscriptor of suscriptores) {
      // =====================================
      // COMPROBAR SUSCRIPCIÓN
      // =====================================

      if (
        !suscriptor.suscripcion_activa ||
        !suscriptor.fecha_vencimiento ||
        new Date(suscriptor.fecha_vencimiento) < new Date()
      ) {

        console.log(
          "⛔ Telegram sin suscripción:",
          suscriptor.chat_id
        );

        continue;
      }



      const limite =
        Number(
          suscriptor.variacion_alerta
        );

      if (limite <= 0) {
        continue;
      }

      let valorReferencia =
        Number(
          suscriptor.valor_referencia
        );

      // =====================================
      // REFERENCIA INICIAL
      // =====================================

      if (
        !Number.isFinite(valorReferencia) ||
        valorReferencia <= 0
      ) {

        const {
          error: errorReferencia
        } = await supabase
          .from("suscriptores_telegram")
          .update({
            valor_referencia: ventaActual,
            ultima_alerta: null
          })
          .eq(
            "chat_id",
            suscriptor.chat_id
          );

        if (errorReferencia) {

          console.log(
            "❌ Error guardando referencia Telegram:",
            errorReferencia
          );

        } else {

          console.log(
            "📌 Referencia inicial Telegram:",
            suscriptor.chat_id,
            ventaActual
          );
        }

        continue;
      }

      // =====================================
      // VARIACIÓN ACUMULADA
      // =====================================

      const variacionAcumulada =
        (
          (ventaActual - valorReferencia) /
          valorReferencia
        ) * 100;

      const variacionAbsoluta =
        Math.abs(
          variacionAcumulada
        );

      console.log(
        "👤 Telegram:",
        suscriptor.chat_id,
        "Referencia:",
        valorReferencia,
        "Actual:",
        ventaActual,
        "Variación:",
        variacionAcumulada.toFixed(4) + "%",
        "Límite:",
        limite + "%"
      );

      if (
        variacionAbsoluta < limite
      ) {
        continue;
      }
      // =====================================
      // INTERVALO DE ALERTA PERSONALIZADO
      // =====================================

      const intervaloMinutos =
        Number(
          suscriptor.intervalo_alerta
        ) || 60;

      if (
        suscriptor.ultima_alerta
      ) {

        const ultimaAlerta =
          new Date(
            suscriptor.ultima_alerta
          );

        const ahora =
          new Date();

        const diferenciaMinutos =
          (
            ahora -
            ultimaAlerta
          ) /
          (1000 * 60);

        if (
          diferenciaMinutos <
          intervaloMinutos
        ) {

          console.log(
            "⏳ Alerta Telegram bloqueada:",
            suscriptor.chat_id,
            "Han pasado:",
            diferenciaMinutos.toFixed(1),
            "minutos",
            "Intervalo:",
            intervaloMinutos,
            "minutos"
          );

          continue;
        }
      }

      // =====================================
      // ENVIAR ALERTA TELEGRAM
      // =====================================

      console.log(
        "🔔 ALERTA TELEGRAM PARA:",
        suscriptor.chat_id
      );

      const mensaje =
        `🚨 ALERTA DÓLAR EN VIVO\n\n` +
        `💱 ARS → BOB\n\n` +
        `📊 Variación: ${variacionAbsoluta.toFixed(2)}%\n` +
        `📌 Referencia: ${valorReferencia.toFixed(5)}\n` +
        `💵 Actual: ${ventaActual.toFixed(5)}\n\n` +
        `Dólar en Vivo Bolivia`;

      let resultado = null;

      try {

        resultado =
          await bot.sendMessage(
            suscriptor.chat_id,
            mensaje
          );

        console.log(
          "✅ Telegram enviado:",
          suscriptor.chat_id
        );

      } catch (error) {

        console.log(
          "❌ Error enviando Telegram:",
          suscriptor.chat_id,
          error.response?.body ||
          error.message
        );
      }

      // =====================================
      // GUARDAR SOLO SI TELEGRAM SE ENVIÓ
      // =====================================

      if (resultado) {

        const {
          error: errorAlerta
        } = await supabase
          .from("suscriptores_telegram")
          .update({
            ultima_alerta:
              new Date().toISOString(),

            valor_referencia:
              ventaActual
          })
          .eq(
            "chat_id",
            suscriptor.chat_id
          );

        if (errorAlerta) {

          console.log(
            "❌ Error guardando alerta Telegram:",
            errorAlerta
          );

        } else {

          console.log(
            "✅ Alerta Telegram guardada:",
            suscriptor.chat_id
          );
        }

      } else {

        console.log(
          "⚠️ Telegram no se envió; no se actualiza la referencia."
        );
      }
    }
  } catch (e) {

    console.log(
      "❌ Error verificando Telegram ARS → BOB:",
      e
    );
  }
}
// ==========================
// VERIFICAR VARIACIÓN ARS → BOB
// ==========================

async function revisarVariacionARSBOB() {

  try {

    const { data, error } = await supabase
      .from("cotizaciones")
      .select("compra, venta, fecha")
      .eq("moneda", "ars_bob")
      .order("fecha", { ascending: false })
      .limit(2);

    if (error) {
      console.log("Error consultando ARS → BOB:", error);
      return;
    }

    if (!data || data.length < 2) {
      console.log("Todavía no hay suficientes registros para comparar.");
      return;
    }

    const actual = data[0];
    const anterior = data[1];

    const ventaActual = Number(actual.venta);
    const ventaAnterior = Number(anterior.venta);

    if (
      !ventaActual ||
      !ventaAnterior ||
      ventaAnterior <= 0
    ) {
      console.log("Valores ARS → BOB inválidos.");
      return;
    }

    const variacion =
      ((ventaActual - ventaAnterior) /
        ventaAnterior) * 100;

    console.log("=================================");
    console.log("📊 ARS → BOB");
    console.log("Anterior:", ventaAnterior);
    console.log("Actual:", ventaActual);
    console.log(
      "Variación:",
      variacion.toFixed(2) + "%"
    );
    console.log("=================================");
    // ==========================
    // REVISAR SUSCRIPTORES
    // ==========================

    const { data: suscriptores, error: errorSuscriptores } =
      await supabase
        .from("suscriptores_whatsapp")
.select("telefono, variacion_alerta, valor_referencia, ultima_alerta")        
        .eq("activo", true);

    if (errorSuscriptores) {
      console.log(
        "Error consultando suscriptores:",
        errorSuscriptores
      );
      return;
    }

    if (!suscriptores || suscriptores.length === 0) {
      console.log("No hay suscriptores activos.");
      return;
    }

    for (const suscriptor of suscriptores) {

      const limite = Number(
        suscriptor.variacion_alerta
      );

      if (limite <= 0) {
        continue;
      }

      let valorReferencia = Number(
        suscriptor.valor_referencia
      );

      // Primer control: establecer referencia sin enviar alerta.
      if (
        !Number.isFinite(valorReferencia) ||
        valorReferencia <= 0
      ) {
        const { error: errorReferencia } =
          await supabase
            .from("suscriptores_whatsapp")
            .update({
              valor_referencia: ventaActual,
              ultima_alerta: null
            })
            .eq(
              "telefono",
              suscriptor.telefono
            );

        if (errorReferencia) {
          console.log(
            "❌ Error guardando valor_referencia:",
            errorReferencia
          );
        } else {
          console.log(
            "📌 Referencia inicial:",
            suscriptor.telefono,
            ventaActual
          );
        }

        continue;
      }

      // Variación acumulada desde la referencia individual.
      const variacionAcumulada =
        ((ventaActual - valorReferencia) /
          valorReferencia) * 100;

      const variacionAbsoluta =
        Math.abs(variacionAcumulada);

      console.log(
        "👤",
        suscriptor.telefono,
        "Referencia:",
        valorReferencia,
        "Actual:",
        ventaActual,
        "Variación acumulada:",
        variacionAcumulada.toFixed(4) + "%",
        "Límite:",
        limite + "%"
      );

      // Todavía no alcanza el límite.
      if (variacionAbsoluta < limite) {
        continue;
      }

      // 	Ya se envió una alerta para esta referencia.
  // ==========================
// MÁXIMO 1 ALERTA POR HORA
// ==========================

if (suscriptor.ultima_alerta) {

  const ultimaAlerta =
    new Date(suscriptor.ultima_alerta);

  const ahora = new Date();

  const diferenciaHoras =
    (ahora - ultimaAlerta) / (1000 * 60 * 60);

 if (diferenciaHoras < 1) {

  console.log(
    "⏳ Alerta bloqueada por límite de 1 hora:",
    suscriptor.telefono,
    "Han pasado:",
    (diferenciaHoras * 60).toFixed(1),
    "minutos"
  );

  continue;
}
}
      console.log(
        "🔔 ALERTA PARA:",
        suscriptor.telefono
      );

      console.log(
        "Límite:",
        limite + "%"
      );

      const resultado =
        await enviarPlantillaWhatsApp(
          suscriptor.telefono,
          variacionAbsoluta,
          valorReferencia,
          ventaActual
        );

      // =================================
      // GUARDAR HORA SOLO SI SE ENVIÓ
      // =================================

      if (resultado) {

        const { error: errorAlerta } =
          await supabase
            .from("suscriptores_whatsapp")
            .update({
              ultima_alerta: new Date().toISOString(),
              valor_referencia: ventaActual
            })
            .eq(
              "telefono",
              suscriptor.telefono
            );

        if (errorAlerta) {

          console.log(
            "❌ Error guardando ultima_alerta:",
            errorAlerta
          );

        } else {

          console.log(
            "✅ ultima_alerta guardada:",
            suscriptor.telefono
          );
        }

      } else {

        console.log(
          "⚠️ WhatsApp no se envió; no se registra ultima_alerta."
        );
      }

    } 

 } catch (e) {

    console.log(
      "Error verificando variación ARS → BOB:",
      e
    );

  }

}

// ==========================
// GUARDAR AUTOMÁTICO
// ==========================

async function actualizarHistorial(){

  try{

    console.log(
      "Guardando..."
    );

    // API ARG

    const r1 = await fetch(

      "https://api.bluelytics.com.ar/v2/latest"
    );

    const d1 = await r1.json();

    // CRIPTO

    const cripto =

      await getP2P_ARS();

    // BOLIVIA

    const p2p =

      await getP2P_BOB();
   // Bcb
    const bcb =

      await getBCB();

    // ARS → BOB

    let ars_bob = {

      compra:null,

      venta:null
    };

    if(

      cripto &&
      p2p

    ){

      ars_bob.compra =

        Number(

          (
            p2p.compra /
            cripto.venta
          ).toFixed(5)
        );

      ars_bob.venta =

        Number(

          (
            p2p.venta /
            cripto.compra
          ).toFixed(5)
        );
    }

    // GUARDAR

    await guardarHistorial(

      "azul",

      d1.blue.value_buy,

      d1.blue.value_sell
    );

    await guardarHistorial(

      "oficial",

      d1.oficial.value_buy,

      d1.oficial.value_sell
    );

    await guardarHistorial(

      "cripto_ars",

      cripto.compra,

      cripto.venta
    );

    await guardarHistorial(

      "p2p_bob",

      p2p.compra,

      p2p.venta
    );

    await guardarHistorial(

      "bcb",

      bcb.compra,

      bcb.venta
    );

    await guardarHistorial(

      "ars_bob",

      ars_bob.compra,

      ars_bob.venta
    );
// VERIFICAR VARIACIÓN WHATSAPP
await revisarVariacionARSBOB();

// VERIFICAR ALERTAS TELEGRAM
await revisarVariacionTelegramARSBOB();

console.log(
  "Guardado OK"
);
  }catch(e){

    console.log(e);
  }
}
// =====================================
// COMANDO /start TELEGRAM
// =====================================

bot.onText(/^\/start$/, async (msg) => {

  try {

    const chatId = msg.chat.id;

    const nombre = [
      msg.from?.first_name,
      msg.from?.last_name
    ]
      .filter(Boolean)
      .join(" ");

    const username =
      msg.from?.username || null;

    const {
      data: existente,
      error: errorBusqueda
    } = await supabase
      .from("suscriptores_telegram")
      .select(
        "chat_id, variacion_alerta, intervalo_alerta"
      )
      .eq("chat_id", chatId)
      .maybeSingle();

    if (errorBusqueda) {

      console.log(
        "❌ Error buscando suscriptor Telegram:",
        errorBusqueda
      );

      await bot.sendMessage(
        chatId,
        "❌ No se pudo activar tu suscripción. Intenta nuevamente."
      );

      return;
    }

    // =====================================
    // NUEVO SUSCRIPTOR
    // =====================================

    if (!existente) {

      const {
        error: errorInsertar
      } = await supabase
        .from("suscriptores_telegram")
        .insert({

          chat_id: chatId,

          nombre:
            nombre || null,

          username,

          variacion_alerta:
            0.20,

          intervalo_alerta:
            60,

          activo:
            true
        });

      if (errorInsertar) {

        console.log(
          "❌ Error registrando Telegram:",
          errorInsertar
        );

        await bot.sendMessage(
          chatId,
          "❌ No se pudo completar el registro."
        );

        return;
      }

      await bot.sendMessage(
        chatId,

        `👋 Hola ${nombre || "amigo"}!\n\n` +
        `✅ Ya estás suscrito a las alertas de Dólar en Vivo Bolivia.\n\n` +
        `📊 Límite actual: 0.20%\n` +
        `⏱️ Intervalo entre alertas: 60 minutos\n\n` +
        `Puedes consultar tu configuración con /estado.`
      );

      console.log(
        "✅ Nuevo suscriptor Telegram:",
        chatId
      );

      return;
    }

    // =====================================
    // SUSCRIPTOR EXISTENTE
    // =====================================

    await supabase
      .from("suscriptores_telegram")
      .update({

        activo:
          true,

        nombre:
          nombre || null,

        username

      })
      .eq(
        "chat_id",
        chatId
      );

    const limite =
      Number(
        existente.variacion_alerta
      ) || 0.20;

    const intervalo =
      Number(
        existente.intervalo_alerta
      ) || 60;

    await bot.sendMessage(
      chatId,

      `👋 Hola ${nombre || "amigo"}!\n\n` +
      `✅ Tu suscripción está activa.\n\n` +
      `📊 Límite actual: ${limite.toFixed(2)}%\n` +
      `⏱️ Intervalo entre alertas: ${intervalo} minutos\n\n` +
      `Puedes consultar tu configuración con /estado.`
    );

    console.log(
      "✅ Suscriptor Telegram reactivado:",
      chatId
    );

  } catch (error) {

    console.log(
      "❌ Error /start:",
      error
    );

  }

});

// =====================================
// COMANDO /estado TELEGRAM
// =====================================

bot.onText(/^\/estado$/, async (msg) => {

  try {

    const chatId = msg.chat.id;

    const {
      data: usuario,
      error
    } = await supabase
      .from("suscriptores_telegram")
      .select(
        "variacion_alerta, intervalo_alerta, valor_referencia, ultima_alerta, activo"
      )
      .eq("chat_id", chatId)
      .maybeSingle();

    if (error) {

      console.log(
        "❌ Error /estado:",
        error
      );

      await bot.sendMessage(
        chatId,
        "❌ No se pudo consultar tu configuración."
      );

      return;
    }

    if (!usuario) {

      await bot.sendMessage(
        chatId,
        "ℹ️ No estás registrado.\n\n" +
        "Envía /start para activar las alertas."
      );

      return;
    }

    const limite =
      Number(
        usuario.variacion_alerta
      ) || 0;

    const intervalo =
      Number(
        usuario.intervalo_alerta
      ) || 60;

    const referencia =
      Number(
        usuario.valor_referencia
      );

    let textoReferencia =
      "Sin establecer";

    if (
      Number.isFinite(referencia) &&
      referencia > 0
    ) {

      textoReferencia =
        referencia.toFixed(5);
    }

    let textoAlerta =
      "Nunca";

    if (usuario.ultima_alerta) {

      textoAlerta =
        new Date(
          usuario.ultima_alerta
        ).toLocaleString(
          "es-BO"
        );
    }

    await bot.sendMessage(
      chatId,

      `📊 ESTADO DE TU SUSCRIPCIÓN\n\n` +
      `🔔 Alertas: ${usuario.activo ? "ACTIVAS" : "INACTIVAS"}\n` +
      `📈 Límite: ${limite.toFixed(2)}%\n` +
      `⏱️ Intervalo: ${intervalo} minutos\n` +
      `📌 Referencia: ${textoReferencia}\n` +
      `🕐 Última alerta: ${textoAlerta}\n\n` +
      `Dólar en Vivo Bolivia`
    );

  } catch (error) {

    console.log(
      "❌ Error /estado:",
      error
    );

  }

});

// =====================================
// COMANDO /ayuda TELEGRAM
// =====================================

bot.onText(/^\/ayuda$/, async (msg) => {

  try {

    const chatId = msg.chat.id;

    await bot.sendMessage(
      chatId,

      `🤖 Dólar en Vivo Bolivia\n\n` +
      `/start - Activar alertas\n` +
      `/estado - Ver tu configuración\n` +
      `/ayuda - Ver estos comandos\n\n` +
      `📊 El límite y el intervalo de alertas son administrados por el sistema.`
    );

  } catch (error) {

    console.log(
      "❌ Error /ayuda:",
      error
    );

  }

});

// =====================================
// ADMINISTRACIÓN TELEGRAM
// =====================================

const crypto = require("crypto");

const sesionesAdmin = new Map();

function generarSesion() {
  return crypto.randomBytes(32).toString("hex");
}

function obtenerCookie(req, nombre) {

  const cookies =
    req.headers.cookie || "";

  const partes =
    cookies.split(";");

  for (const parte of partes) {

    const [clave, ...valor] =
      parte.trim().split("=");

    if (clave === nombre) {

      return decodeURIComponent(
        valor.join("=")
      );
    }
  }

  return null;
}

function adminAutorizado(req) {

  const token =
    obtenerCookie(
      req,
      "telegram_admin"
    );

  return token &&
    sesionesAdmin.has(token);
}

// =====================================
// LOGIN ADMIN
// =====================================

app.post(
  "/admin/api/login",
  (req, res) => {

    const password =
      req.body?.password;

    if (
      !process.env.TELEGRAM_ADMIN_PASSWORD
    ) {

      return res.status(500).json({
        error:
          "Falta TELEGRAM_ADMIN_PASSWORD"
      });
    }

    if (
      password !==
      process.env.TELEGRAM_ADMIN_PASSWORD
    ) {

      return res.status(401).json({
        error:
          "Contraseña incorrecta"
      });
    }

    const token =
      generarSesion();

    sesionesAdmin.set(
      token,
      Date.now()
    );

    res.setHeader(
      "Set-Cookie",
      `telegram_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`
    );

    res.json({
      ok: true
    });
  }
);

// =====================================
// PÁGINA ADMIN
// =====================================

app.get(
  "/admin",
  (req, res) => {

    res.sendFile(
      require("path").join(
        __dirname,
        "admin.html"
      )
    );
  }
);

// =====================================
// CERRAR SESIÓN ADMIN
// =====================================

app.post(
  "/admin/api/logout",
  (req, res) => {

    const token =
      obtenerCookie(
        req,
        "telegram_admin"
      );

    if (token) {
      sesionesAdmin.delete(token);
    }

    res.setHeader(
      "Set-Cookie",
      "telegram_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
    );

    res.json({
      ok: true
    });
  }
);

// =====================================
// VERIFICAR SESIÓN
// =====================================

app.get(
  "/admin/api/me",
  (req, res) => {

    if (!adminAutorizado(req)) {

      return res.status(401).json({
        autorizado: false
      });
    }

    res.json({
      autorizado: true
    });
  }
);
// =====================================
// LISTAR SUSCRIPTORES TELEGRAM
// =====================================

app.get(
  "/admin/api/suscriptores",
  async (req, res) => {

    if (!adminAutorizado(req)) {

      return res.status(401).json({
        error: "No autorizado"
      });
    }

    try {

      const {
        data,
        error
      } = await supabase
        .from("suscriptores_telegram")
        .select(
          "id, chat_id, telefono, nombre, username, variacion_alerta, valor_referencia, ultima_alerta, intervalo_alerta, activo, suscripcion_activa, fecha_inicio, fecha_vencimiento, created_at"
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

      if (error) {

        console.log(
          "❌ Error administrando suscriptores:",
          error
        );

        return res.status(500).json({
          error: error.message
        });
      }

      res.json(
        data || []
      );

    } catch (error) {

      console.log(
        "❌ Error API suscriptores:",
        error
      );

      res.status(500).json({
        error: "Error interno"
      });
    }
  }
);
// =====================================
// MODIFICAR SUSCRIPTOR TELEGRAM
// =====================================

app.put(
  "/admin/api/suscriptores/:id",
  async (req, res) => {

    if (!adminAutorizado(req)) {

      return res.status(401).json({
        error: "No autorizado"
      });
    }

    const id =
      Number(req.params.id);

    const porcentaje =
      Number(
        req.body?.variacion_alerta
      );

    const intervalo =
      Number(
        req.body?.intervalo_alerta
      );

    const activo =
      req.body?.activo;

    if (
      !Number.isFinite(id) ||
      !Number.isFinite(porcentaje) ||
      porcentaje <= 0 ||
      porcentaje > 100
    ) {

      return res.status(400).json({
        error:
          "Porcentaje inválido"
      });
    }

    if (
      !Number.isFinite(intervalo) ||
      intervalo < 1 ||
      intervalo > 1440
    ) {

      return res.status(400).json({
        error:
          "Intervalo inválido. Debe estar entre 1 y 1440 minutos"
      });
    }

    if (
      typeof activo !== "boolean"
    ) {

      return res.status(400).json({
        error:
          "Estado inválido"
      });
    }

    try {

      const {
        error
      } = await supabase
        .from("suscriptores_telegram")
        .update({

          variacion_alerta:
            porcentaje,

          intervalo_alerta:
            intervalo,

          activo
        })
        .eq(
          "id",
          id
        );

      if (error) {

        console.log(
          "❌ Error actualizando suscriptor:",
          error
        );

        return res.status(500).json({
          error: error.message
        });
      }

      res.json({
        ok: true
      });

    } catch (error) {

      console.log(
        "❌ Error API actualizar:",
        error
      );

      res.status(500).json({
        error: "Error interno"
      });
    }
  }
);
// =====================================
// RESTABLECER REFERENCIA TELEGRAM
// =====================================

app.post(
  "/admin/api/suscriptores/:id/referencia",
  async (req, res) => {

    if (!adminAutorizado(req)) {

      return res.status(401).json({
        error: "No autorizado"
      });
    }

    const id =
      Number(req.params.id);

    if (!Number.isFinite(id)) {

      return res.status(400).json({
        error: "ID inválido"
      });
    }

    try {

      const {
        error
      } = await supabase
        .from("suscriptores_telegram")
        .update({

          valor_referencia: null,

          ultima_alerta: null

        })
        .eq(
          "id",
          id
        );

      if (error) {

        console.log(
          "❌ Error reiniciando referencia:",
          error
        );

        return res.status(500).json({
          error: error.message
        });
      }

      res.json({
        ok: true
      });

    } catch (error) {

      console.log(
        "❌ Error API referencia:",
        error
      );

      res.status(500).json({
        error: "Error interno"
      });
    }
  }
);

// =====================================
// ACTIVAR / EXTENDER SUSCRIPCIÓN 30 DÍAS
// =====================================

app.post(
  "/admin/api/suscriptores/:id/suscripcion",
  async (req, res) => {

    if (!adminAutorizado(req)) {

      return res.status(401).json({
        error: "No autorizado"
      });
    }

    const id =
      Number(req.params.id);

    if (!Number.isFinite(id)) {

      return res.status(400).json({
        error: "ID inválido"
      });
    }

    try {

      // Obtener suscripción actual
      const {
        data: usuario,
        error: errorConsulta
      } = await supabase
        .from("suscriptores_telegram")
        .select(
          "id, suscripcion_activa, fecha_inicio, fecha_vencimiento"
        )
        .eq("id", id)
        .single();

      if (errorConsulta) {

        console.log(
          "❌ Error consultando suscripción:",
          errorConsulta
        );

        return res.status(500).json({
          error: errorConsulta.message
        });
      }

      const ahora = new Date();

      let fechaInicio;
      let fechaVencimiento;

      // Si todavía tiene una suscripción vigente,
      // se agregan 30 días al vencimiento actual.
      if (
        usuario.suscripcion_activa &&
        usuario.fecha_vencimiento &&
        new Date(usuario.fecha_vencimiento) > ahora
      ) {

        fechaInicio =
          usuario.fecha_inicio
            ? new Date(usuario.fecha_inicio)
            : ahora;

        fechaVencimiento =
          new Date(usuario.fecha_vencimiento);

        fechaVencimiento.setDate(
          fechaVencimiento.getDate() + 30
        );

      } else {

        // Si está vencida o nunca tuvo suscripción,
        // comienza una nueva desde ahora.
        fechaInicio = ahora;

        fechaVencimiento =
          new Date(ahora);

        fechaVencimiento.setDate(
          fechaVencimiento.getDate() + 30
        );
      }

      const {
        error: errorActualizacion
      } = await supabase
        .from("suscriptores_telegram")
        .update({

          suscripcion_activa: true,

          fecha_inicio:
            fechaInicio.toISOString(),

          fecha_vencimiento:
            fechaVencimiento.toISOString()

        })
        .eq(
          "id",
          id
        );

      if (errorActualizacion) {

        console.log(
          "❌ Error actualizando suscripción:",
          errorActualizacion
        );

        return res.status(500).json({
          error:
            errorActualizacion.message
        });
      }

      console.log(
        "✅ Suscripción activada:",
        id,
        "Vence:",
        fechaVencimiento.toISOString()
      );

      res.json({
        ok: true,
        fecha_inicio:
          fechaInicio.toISOString(),
        fecha_vencimiento:
          fechaVencimiento.toISOString()
      });

    } catch (error) {

      console.log(
        "❌ Error API suscripción:",
        error
      );

      res.status(500).json({
        error: "Error interno"
      });
    }
  }
);
// ==========================
// API
// ==========================

app.get("/dolar", async(req,res)=>{

  try{

    let rango =

      req.query.rango || "dia";

    // ACTUAL

    const r1 = await fetch(

      "https://api.bluelytics.com.ar/v2/latest"
    );

    const d1 = await r1.json();

    const cripto =

      await getP2P_ARS();

    const p2p =

      await getP2P_BOB();
    // =================================
    // bcb
    // =================================



const bcb = await getBCB();
    let ars_bob = {

      compra:
      Number(
        (
          p2p.compra /
          cripto.venta
        ).toFixed(5)
      ),

      venta:
      Number(
        (
          p2p.venta /
          cripto.compra
        ).toFixed(5)
      )
    };

    // HISTORIAL

    const historial = {

      azul:

        await obtenerHistorial(
          "azul",
          rango
        ),

      oficial:

        await obtenerHistorial(
          "oficial",
          rango
        ),

      cripto_ars:

        await obtenerHistorial(
          "cripto_ars",
          rango
        ),

      p2p_bob:

        await obtenerHistorial(
          "p2p_bob",
          rango
        ),
bcb:

        await obtenerHistorial(
          "bcb",
          rango
        ),
      ars_bob:

        await obtenerHistorial(
          "ars_bob",
          rango
        )
    };

console.log(
  "Primera:",
  historial.azul[0]?.fecha
);

console.log(
  "Última:",
  historial.azul[historial.azul.length - 1]?.fecha
);

console.log(
  "Cantidad:",
  historial.azul.length
);
    // RESPUESTA

    res.json({

      actual:{

        azul:{
          valor_compra:
          d1.blue.value_buy,

          valor_venta:
          d1.blue.value_sell
        },

        oficial:{
          valor_compra:
          d1.oficial.value_buy,

          valor_venta:
          d1.oficial.value_sell
        },

        cripto_ars:cripto,

        p2p_bob:p2p,
bcb:bcb,
        ars_bob
      },

      historial
    });

  }catch(e){

    console.log(e);

    res.status(500).json({

      error:"Error"
    });
  }
});

// ==========================
// ACTUALIZAR CADA 5 MIN
// ==========================

actualizarHistorial();

setInterval(

  actualizarHistorial,

  10 * 60 * 1000
);

// ==========================
// SERVER
// ==========================

const PORT =

process.env.PORT || 3000;

app.listen(PORT, ()=>{

  console.log(

    "Servidor iniciado"
  );
});

