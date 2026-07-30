const express = require("express");

const cors = require("cors");
const axios = require("axios");
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

    console.log(
      "Guardado OK"
    );

  }catch(e){

    console.log(e);
  }
}

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
