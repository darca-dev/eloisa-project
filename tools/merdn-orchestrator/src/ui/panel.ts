/**
 * Panel del Product Owner (FR-17, doc §13, AC-09, T-16).
 *
 * Una sola pantalla, en español, responsive, navegable por teclado y con
 * los detalles técnicos ocultos por defecto. Sin recursos externos: todo
 * el HTML, CSS y JS se sirve desde este proceso local.
 *
 * La Product Owner no necesita saber de Git, archivos, CLI, prompts,
 * pruebas ni agentes para usar el panel.
 */

const STYLES = `
:root {
  color-scheme: light dark;
  --fondo: #ffffff;
  --texto: #16181d;
  --borde: #b9bfcc;
  --acento: #10357a;
  --acento-texto: #ffffff;
  --aviso: #7a3b10;
  --panel: #f4f6fa;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fondo: #101318;
    --texto: #f2f4f8;
    --borde: #4a5162;
    --acento: #9fc2ff;
    --acento-texto: #101318;
    --aviso: #ffcf9c;
    --panel: #191d25;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 1.5rem;
  background: var(--fondo);
  color: var(--texto);
  font-family: system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 1.05rem;
  line-height: 1.55;
}
main { max-width: 60rem; margin: 0 auto; }
h1 { font-size: 1.6rem; margin: 0 0 0.25rem; }
h2 { font-size: 1.25rem; margin: 1.5rem 0 0.5rem; }
p { margin: 0.4rem 0; }
.tarjeta {
  border: 2px solid var(--borde);
  border-radius: 0.6rem;
  padding: 1rem 1.15rem;
  margin: 1rem 0;
  background: var(--panel);
}
label { display: block; font-weight: 600; margin-bottom: 0.35rem; }
textarea, select, input[type="text"] {
  width: 100%;
  padding: 0.65rem;
  font: inherit;
  color: var(--texto);
  background: var(--fondo);
  border: 2px solid var(--borde);
  border-radius: 0.4rem;
}
textarea { min-height: 6rem; resize: vertical; }
.acciones { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.9rem; }
button {
  font: inherit;
  font-weight: 700;
  padding: 0.7rem 1.1rem;
  border-radius: 0.45rem;
  border: 2px solid var(--acento);
  background: var(--fondo);
  color: var(--texto);
  cursor: pointer;
  min-height: 2.9rem;
}
button.principal { background: var(--acento); color: var(--acento-texto); }
button.detener { border-color: var(--aviso); }
button[disabled] { opacity: 0.55; cursor: not-allowed; }
button:focus-visible, textarea:focus-visible, select:focus-visible, summary:focus-visible {
  outline: 3px solid var(--acento);
  outline-offset: 2px;
}
.estado { font-weight: 700; }
.etiqueta-estado {
  display: inline-block;
  border: 2px solid var(--borde);
  border-radius: 0.4rem;
  padding: 0.1rem 0.5rem;
  font-size: 0.95rem;
}
fieldset { border: 2px solid var(--borde); border-radius: 0.5rem; }
legend { font-weight: 700; padding: 0 0.4rem; }
.modo-opciones { display: flex; flex-wrap: wrap; gap: 1rem; }
.modo-opciones label { font-weight: 500; display: flex; align-items: center; gap: 0.4rem; }
details { margin-top: 1rem; }
summary { cursor: pointer; font-weight: 700; padding: 0.4rem 0; }
pre {
  overflow-x: auto;
  background: var(--fondo);
  border: 2px solid var(--borde);
  border-radius: 0.4rem;
  padding: 0.75rem;
  font-size: 0.9rem;
}
ul { margin: 0.3rem 0 0.3rem 1.2rem; padding: 0; }
.oculto { display: none; }
`;

const SCRIPT = `
const $ = (id) => document.getElementById(id);
let runId = null;
let version = null;
// Hash de la versión que la persona vio con VER. APROBAR lo exige.
let hashVisto = null;

async function api(ruta, opciones) {
  const respuesta = await fetch(ruta, opciones);
  const cuerpo = await respuesta.json();
  return cuerpo;
}

function anunciar(texto) {
  $('anuncio').textContent = texto;
}

async function enviarComando(comando, datos) {
  const cuerpo = Object.assign({ comando: comando, runId: runId, version: version }, datos || {});
  const resultado = await api('/api/comando', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (resultado.mensaje) { anunciar(resultado.mensaje); }
  if (resultado.runId) { runId = resultado.runId; }
  await refrescar();
  return resultado;
}

function pintarAcciones(vista) {
  const contenedor = $('acciones');
  contenedor.textContent = '';
  for (const accion of vista.actions) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = accion.label;
    boton.className = accion.kind === 'principal' ? 'principal' : accion.kind === 'detener' ? 'detener' : '';
    boton.addEventListener('click', () => manejarAccion(accion, vista));
    contenedor.appendChild(boton);
  }
}

async function manejarAccion(accion, vista) {
  if (accion.id === 'ver') {
    const resultado = await enviarComando('ver', {});
    if (resultado.detalle && resultado.detalle.hashVisto) {
      hashVisto = resultado.detalle.hashVisto;
      $('revision').textContent = JSON.stringify(resultado.detalle.contenido, null, 2);
      $('zona-revision').classList.remove('oculto');
      $('revision').focus();
    }
    $('detalles').open = true;
    return;
  }
  if (accion.id === 'responder') {
    const decision = vista.pendingDecisions[0];
    const respuesta = $('respuesta').value.trim();
    if (!decision || respuesta.length === 0) {
      anunciar('Escribe tu respuesta antes de enviar.');
      $('respuesta').focus();
      return;
    }
    await enviarComando('responder', { decisionId: decision.id, texto: respuesta });
    $('respuesta').value = '';
    return;
  }
  if (accion.id === 'cambiar') {
    const comentario = $('respuesta').value.trim();
    if (comentario.length === 0) {
      anunciar('Escribe qué quieres cambiar.');
      $('respuesta').focus();
      return;
    }
    await enviarComando('cambiar', { texto: comentario });
    $('respuesta').value = '';
    return;
  }
  if (accion.id === 'aprobar' || accion.id === 'preparar_commit') {
    if (hashVisto === null) {
      anunciar('Antes de aprobar necesitas ver qué se propone. Pulsa VER.');
      return;
    }
    await enviarComando(accion.id, { hashVisto: hashVisto });
    return;
  }
  if (accion.requiresConfirmation === true) {
    await enviarComando(accion.id, { confirmado: true });
    return;
  }
  await enviarComando(accion.id, {});
}

let ultimoEstadoPintado = null;

function pintar(vista) {
  runId = vista.id;
  version = vista.version;
  if (ultimoEstadoPintado !== vista.state) {
    // Otro estado significa otro artefacto: hay que volver a verlo.
    hashVisto = null;
    $('zona-revision').classList.add('oculto');
    ultimoEstadoPintado = vista.state;
  }
  $('titulo-estado').textContent = vista.headline;
  $('explicacion').textContent = vista.explanation;
  $('siguiente').textContent = vista.nextAction;
  $('etiqueta-estado').textContent = 'Estado: ' + vista.state;
  $('etiqueta-modo').textContent = 'Modo: ' + vista.mode;
  for (const entrada of document.querySelectorAll('input[name="modo"]')) {
    entrada.checked = entrada.value === vista.mode;
  }
  $('solicitud-actual').textContent = vista.requestText;

  const zonaDecision = $('zona-decision');
  if (vista.pendingDecisions.length > 0) {
    zonaDecision.classList.remove('oculto');
    $('pregunta').textContent = vista.pendingDecisions[0].question;
  } else if (vista.state === 'ANALISIS' || vista.state === 'ESPERANDO_APROBACION_VISUAL') {
    zonaDecision.classList.remove('oculto');
    $('pregunta').textContent = 'Si quieres pedir cambios, escríbelos aquí.';
  } else {
    zonaDecision.classList.add('oculto');
  }

  const bloqueos = $('bloqueos');
  bloqueos.textContent = '';
  if (vista.blockingGates.length > 0) {
    const lista = document.createElement('ul');
    for (const gate of vista.blockingGates) {
      const item = document.createElement('li');
      item.textContent = gate.message || gate.id;
      lista.appendChild(item);
    }
    bloqueos.appendChild(lista);
  }

  $('json-tecnico').textContent = JSON.stringify(
    { estado: vista.state, modo: vista.mode, tecnico: vista.technical, journal: vista.journal },
    null,
    2,
  );
  pintarAcciones(vista);
}

async function refrescar() {
  if (runId === null) {
    const lista = await api('/api/runs');
    if (lista.runs && lista.runs.length > 0) {
      runId = lista.runs[0].id;
    } else {
      return;
    }
  }
  const vista = await api('/api/estado?runId=' + encodeURIComponent(runId));
  if (vista.error) { anunciar(vista.error); return; }
  $('zona-trabajo').classList.remove('oculto');
  pintar(vista);
}

window.addEventListener('DOMContentLoaded', () => {
  $('form-solicitud').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const texto = $('solicitud').value.trim();
    if (texto.length === 0) {
      anunciar('Escribe qué quieres lograr.');
      return;
    }
    const modo = document.querySelector('input[name="modo"]:checked').value;
    runId = null;
    const resultado = await enviarComando('crear', { texto: texto, modo: modo });
    if (resultado.ok) { $('solicitud').value = ''; }
  });

  for (const entrada of document.querySelectorAll('input[name="modo"]')) {
    entrada.addEventListener('change', async () => {
      if (runId !== null) { await enviarComando('cambiar_modo', { modo: entrada.value }); }
    });
  }

  refrescar();
});
`;

export function renderPanel(): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MERDN Orchestrator — panel local</title>
<style>${STYLES}</style>
</head>
<body>
<main>
  <h1>MERDN Orchestrator</h1>
  <p>Herramienta local. Sólo funciona en esta computadora y no publica nada en Internet.</p>

  <p id="anuncio" role="status" aria-live="polite" class="estado"></p>

  <form id="form-solicitud" class="tarjeta">
    <label for="solicitud">¿Qué quieres lograr?</label>
    <textarea id="solicitud" name="solicitud" required
      placeholder="Ejemplo: quiero que en Alcaldía se vea la población atendida por programa."></textarea>

    <fieldset style="margin-top:1rem">
      <legend>¿Cómo quieres trabajar?</legend>
      <div class="modo-opciones">
        <label><input type="radio" name="modo" value="AUTOMATICO"> Automático</label>
        <label><input type="radio" name="modo" value="ASISTIDO" checked> Asistido</label>
        <label><input type="radio" name="modo" value="MANUAL"> Manual</label>
      </div>
    </fieldset>

    <div class="acciones">
      <button type="submit" class="principal">PREPARAR PROPUESTA</button>
    </div>
  </form>

  <section id="zona-trabajo" class="tarjeta oculto" aria-labelledby="titulo-estado">
    <h2 id="titulo-estado">Sin solicitud activa</h2>
    <p><span class="etiqueta-estado" id="etiqueta-estado"></span>
       <span class="etiqueta-estado" id="etiqueta-modo"></span></p>
    <p id="explicacion"></p>
    <p><strong>Siguiente paso:</strong> <span id="siguiente"></span></p>
    <p><strong>Tu solicitud:</strong> <span id="solicitud-actual"></span></p>

    <div id="bloqueos" role="region" aria-label="Cosas que impiden continuar"></div>

    <div id="zona-revision" class="oculto" role="region" aria-labelledby="titulo-revision">
      <h3 id="titulo-revision">Esto es lo que se propone</h3>
      <pre id="revision" tabindex="0"></pre>
    </div>

    <div id="zona-decision" class="oculto">
      <label for="respuesta" id="pregunta"></label>
      <textarea id="respuesta" name="respuesta"></textarea>
    </div>

    <div class="acciones" id="acciones" role="group" aria-label="Acciones disponibles"></div>

    <details id="detalles">
      <summary>Ver detalles técnicos</summary>
      <pre id="json-tecnico" tabindex="0"></pre>
    </details>
  </section>
</main>
<script>${SCRIPT}</script>
</body>
</html>`;
}
