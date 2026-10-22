// =============================================================================
// APP.JS - Lógica de Frontend y Conexión con la API RESTful de Node.js
// =============================================================================

const API_BASE = '/api';

// Consultas rápidas predefinidas del documento de investigación
const PRESET_QUERIES = {
  1: `-- 1. Reporte Completo de Alumnos, Carreras, Cursos, Docentes y Aulas
SELECT 
    e.id_estudiante AS Matricula,
    e.nombre || ' ' || e.apellido AS Estudiante,
    c.nombre_carrera AS Carrera,
    m.nombre_materia AS Asignatura,
    cur.grupo AS Grupo,
    d.nombre || ' ' || d.apellido AS Docente,
    COALESCE(a.codigo_aula, 'Por Asignar') AS Aula
FROM Estudiantes e
JOIN Carreras c ON e.id_carrera = c.id_carrera
JOIN Matriculas mat ON e.id_estudiante = mat.id_estudiante
JOIN Cursos cur ON mat.id_curso = cur.id_curso
JOIN Materias m ON cur.id_materia = m.id_materia
JOIN Docentes d ON cur.id_profesor = d.id_docente
LEFT JOIN Aulas a ON cur.id_aula = a.id_aula;`,

  2: `-- 2. Malla Curricular y Prerrequisitos (Relación Reflexiva con SELF-JOIN)
SELECT 
    m.clave_materia AS Clave,
    m.nombre_materia AS Materia,
    m.semestre_sugerido AS Semestre,
    m.creditos AS Creditos,
    COALESCE(pre.nombre_materia, 'Sin Prerrequisito (Nivel Inicial)') AS Requisito_Previo
FROM Materias m
LEFT JOIN Materias pre ON m.id_materia_prerrequisito = pre.id_materia
ORDER BY m.semestre_sugerido, m.clave_materia;`,

  3: `-- 3. Rendimiento y Promedios por Curso (GROUP BY y Agregaciones)
SELECT 
    cur.id_curso AS Curso_ID,
    m.nombre_materia AS Materia,
    cur.grupo AS Grupo,
    d.nombre || ' ' || d.apellido AS Docente,
    COUNT(cal.id_calificacion) AS Alumnos_Evaluados,
    ROUND(AVG(cal.nota), 2) AS Promedio_Nota,
    MIN(cal.nota) AS Minima,
    MAX(cal.nota) AS Maxima
FROM Cursos cur
JOIN Materias m ON cur.id_materia = m.id_materia
JOIN Docentes d ON cur.id_profesor = d.id_docente
LEFT JOIN Calificaciones cal ON cur.id_curso = cal.id_curso
GROUP BY cur.id_curso, m.nombre_materia, cur.grupo, d.nombre, d.apellido;`,

  4: `-- 4. Detección de Docentes sin Cursos Asignados (LEFT JOIN con prueba de nulidad)
SELECT 
    d.id_docente AS ID,
    d.nombre || ' ' || d.apellido AS Docente,
    dep.nombre_departamento AS Departamento,
    d.especialidad AS Especialidad
FROM Docentes d
JOIN Departamentos dep ON d.id_departamento = dep.id_departamento
LEFT JOIN Cursos c ON d.id_docente = c.id_profesor
WHERE c.id_curso IS NULL;`,

  5: `-- 5. Auditoría de Préstamos y Alumnos con Adeudos (ON DELETE RESTRICT)
SELECT 
    e.id_estudiante AS ID,
    e.nombre || ' ' || e.apellido AS Estudiante,
    pb.titulo_libro AS Libro,
    pb.fecha_limite_devolucion AS Limite,
    CASE WHEN pb.devuelto = 1 THEN 'Devuelto' ELSE 'ADEUDO PENDIENTE' END AS Estatus
FROM Estudiantes e
JOIN PrestamosBiblioteca pb ON e.id_estudiante = pb.id_estudiante
WHERE pb.devuelto = 0;`
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupModals();
  setupForms();
  setupSqlLab();
  
  // Carga inicial
  loadDashboard();
  loadEstudiantes();
  loadDocentes();
  loadMaterias();
  loadCursos();
  loadMatriculas();
  loadCalificaciones();
  loadBiblioteca();
  loadDropdowns();

  // Botón reset
  document.getElementById('btn-reset-db').addEventListener('click', resetDatabase);
});

// -----------------------------------------------------------------------------
// NAVEGACIÓN ENTRE PESTAÑAS
// -----------------------------------------------------------------------------
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const headerAction = document.getElementById('btn-header-action');

  const titles = {
    'tab-dashboard': { title: 'Dashboard General', subtitle: 'Monitoreo integral y control del modelo relacional escolar', action: '+ Nuevo Alumno' },
    'tab-estudiantes': { title: 'Gestión de Estudiantes', subtitle: 'Padrón escolar, expedientes médicos (1:1) y seguimiento', action: '+ Registrar Estudiante' },
    'tab-docentes': { title: 'Docentes & Cubículos', subtitle: 'Cuerpo académico, departamentos y cubículos exclusivos (1:1)', action: '+ Registrar Docente' },
    'tab-materias': { title: 'Materia & Prerrequisitos', subtitle: 'Catálogo curricular y relaciones recursivas reflexivas', action: '+ Nueva Materia' },
    'tab-cursos': { title: 'Cursos & Horarios', subtitle: 'Programación de cursos con profesor, aula y cupo máximo', action: '+ Abrir Curso' },
    'tab-matriculas': { title: 'Matrículas & Calificaciones', subtitle: 'Relaciones N:M e historial de aprovechamiento académico', action: '+ Inscribir' },
    'tab-biblioteca': { title: 'Biblioteca Universitaria', subtitle: 'Préstamos y demostración de integridad referencial RESTRICT', action: 'Actualizar' },
    'tab-sql': { title: 'Laboratorio SQL Interactivo', subtitle: 'Consola de ejecución en tiempo real contra la base de datos SQLite', action: '⚡ Ejecutar' }
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');

      // Actualizar botones de navegación
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // Actualizar paneles
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById(tabId);
      if (activePane) activePane.classList.add('active');

      // Actualizar cabecera
      if (titles[tabId]) {
        pageTitle.textContent = titles[tabId].title;
        pageSubtitle.textContent = titles[tabId].subtitle;
        headerAction.textContent = titles[tabId].action;
      }

      // Refrescar datos según la pestaña activa
      if (tabId === 'tab-dashboard') loadDashboard();
      if (tabId === 'tab-estudiantes') loadEstudiantes();
      if (tabId === 'tab-docentes') loadDocentes();
      if (tabId === 'tab-materias') loadMaterias();
      if (tabId === 'tab-cursos') loadCursos();
      if (tabId === 'tab-matriculas') { loadMatriculas(); loadCalificaciones(); }
      if (tabId === 'tab-biblioteca') loadBiblioteca();
    });
  });

  headerAction.addEventListener('click', () => {
    const activeTab = document.querySelector('.nav-item.active').getAttribute('data-tab');
    if (activeTab === 'tab-estudiantes' || activeTab === 'tab-dashboard') {
      openModal('modal-estudiante');
    } else if (activeTab === 'tab-docentes') {
      openModal('modal-docente');
    } else if (activeTab === 'tab-sql') {
      document.getElementById('btn-ejecutar-sql').click();
    } else if (activeTab === 'tab-matriculas') {
      document.getElementById('mat-estudiante').focus();
    }
  });

  document.getElementById('btn-nuevo-estudiante').addEventListener('click', () => openModal('modal-estudiante'));
  document.getElementById('btn-nuevo-docente').addEventListener('click', () => openModal('modal-docente'));
}

// -----------------------------------------------------------------------------
// CARGAS DE DATOS DESDE LA API
// -----------------------------------------------------------------------------

// 1. Dashboard
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/dashboard`);
    const data = await res.json();

    document.getElementById('kpi-estudiantes').textContent = data.totalEstudiantes || 0;
    document.getElementById('kpi-docentes').textContent = data.totalDocentes || 0;
    document.getElementById('kpi-materias').textContent = data.totalMaterias || 0;
    document.getElementById('kpi-cursos').textContent = data.totalCursos || 0;
    document.getElementById('kpi-matriculas').textContent = data.totalMatriculas || 0;
    document.getElementById('kpi-prestamos').textContent = data.prestamosPendientes || 0;

    document.getElementById('dash-promedio').textContent = data.promedioGeneral || '0.0';
    document.getElementById('dash-aprobados').textContent = data.aprobados || 0;
    document.getElementById('dash-reprobados').textContent = data.reprobados || 0;
  } catch (error) {
    showToast('Error al cargar métricas del Dashboard: ' + error.message, 'error');
  }
}

// 2. Estudiantes
let cachedEstudiantes = [];

async function loadEstudiantes() {
  try {
    const res = await fetch(`${API_BASE}/estudiantes`);
    cachedEstudiantes = await res.json();
    renderEstudiantes(cachedEstudiantes);
  } catch (error) {
    showToast('Error al cargar estudiantes', 'error');
  }
}

function renderEstudiantes(estudiantes) {
  const tbody = document.getElementById('tbody-estudiantes');
  tbody.innerHTML = '';

  if (estudiantes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="placeholder-text">No se encontraron estudiantes registrados.</td></tr>`;
    return;
  }

  estudiantes.forEach(est => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${est.id_estudiante}</strong></td>
      <td>
        <div style="font-weight: 600;">${est.nombre} ${est.apellido}</div>
        <small style="color: var(--text-dim); font-size: 11px;">CURP: ${est.curp_dni}</small>
      </td>
      <td>${est.correo_institucional}</td>
      <td><span class="badge blue">${est.nombre_carrera}</span></td>
      <td>
        ${est.tipo_sangre ? `
          <span class="badge purple">🩸 ${est.tipo_sangre}</span>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
            Emergencia: ${est.contacto_emergencia} (${est.telefono_emergencia})
          </div>
        ` : `<span style="color: var(--text-dim); font-size: 11px;">Sin expediente</span>`}
      </td>
      <td><span class="badge green">${est.estado}</span></td>
      <td>
        <button class="btn-danger-sm" onclick="eliminarEstudiante(${est.id_estudiante}, '${est.nombre} ${est.apellido}')">
          Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Búsqueda en vivo de estudiantes
document.getElementById('search-estudiantes').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  const filtered = cachedEstudiantes.filter(est => 
    est.nombre.toLowerCase().includes(q) ||
    est.apellido.toLowerCase().includes(q) ||
    est.correo_institucional.toLowerCase().includes(q) ||
    est.curp_dni.toLowerCase().includes(q) ||
    est.nombre_carrera.toLowerCase().includes(q) ||
    est.id_estudiante.toString().includes(q)
  );
  renderEstudiantes(filtered);
});

// Eliminar estudiante (demostración de integridad referencial)
async function eliminarEstudiante(id, nombre) {
  if (!confirm(`¿Deseas intentar eliminar al estudiante #${id} (${nombre})?`)) return;

  try {
    const res = await fetch(`${API_BASE}/estudiantes/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      alert(`⚠️ BLOQUEADO POR INTEGRIDAD REFERENCIAL:\n\n${data.error}\n\nExplicación: ${data.detail || ''}`);
      showToast(data.error, 'error');
    } else {
      showToast(data.message, 'success');
      loadEstudiantes();
      loadDashboard();
    }
  } catch (error) {
    showToast('Error en la solicitud: ' + error.message, 'error');
  }
}

// 3. Docentes
async function loadDocentes() {
  try {
    const res = await fetch(`${API_BASE}/docentes`);
    const docentes = await res.json();
    const grid = document.getElementById('grid-docentes');
    grid.innerHTML = '';

    docentes.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'card glass docente-card';
      card.innerHTML = `
        <div class="card-title-group">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h4>${doc.nombre} ${doc.apellido}</h4>
            <span class="badge blue">ID #${doc.id_docente}</span>
          </div>
          <span style="color: var(--primary); font-size: 12.5px; font-weight: 500;">${doc.especialidad}</span>
        </div>

        <div class="meta-info">
          <div class="meta-row">
            <span>🏛️ <strong>Depto:</strong> ${doc.nombre_departamento}</span>
          </div>
          <div class="meta-row">
            <span>✉️ ${doc.correo}</span>
          </div>
          <div class="meta-row">
            <span>🚪 <strong>Cubículo (1:1):</strong> ${doc.numero_cubiculo ? `Puerta ${doc.numero_cubiculo} (${doc.edificio_cubiculo})` : 'Sin asignar'}</span>
          </div>
          ${doc.nombre_coordinador ? `
            <div class="meta-row">
              <span>👔 <strong>Coordinador:</strong> Prof. ${doc.nombre_coordinador}</span>
            </div>
          ` : ''}
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (error) {
    showToast('Error al cargar docentes', 'error');
  }
}

// 4. Materias
async function loadMaterias() {
  try {
    const res = await fetch(`${API_BASE}/materias`);
    const materias = await res.json();
    const tbody = document.getElementById('tbody-materias');
    tbody.innerHTML = '';

    materias.forEach(mat => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color: #60a5fa;">${mat.clave_materia}</strong></td>
        <td><strong>${mat.nombre_materia}</strong></td>
        <td>Semestre ${mat.semestre_sugerido}</td>
        <td><span class="badge blue">${mat.creditos} Créditos</span></td>
        <td>
          ${mat.prerrequisito_nombre 
            ? `<span class="badge purple">⚡ Requiere: ${mat.prerrequisito_nombre}</span>` 
            : `<span style="color: var(--text-dim); font-size: 12px;">Sin prerrequisito (Nivel Introductorio)</span>`}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    showToast('Error al cargar materias', 'error');
  }
}

// 5. Cursos
async function loadCursos() {
  try {
    const res = await fetch(`${API_BASE}/cursos`);
    const cursos = await res.json();
    const grid = document.getElementById('grid-cursos');
    grid.innerHTML = '';

    cursos.forEach(c => {
      const card = document.createElement('div');
      card.className = 'card glass curso-card';
      card.innerHTML = `
        <div class="card-title-group">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <h4>${c.nombre_materia}</h4>
            <span class="badge purple">Grupo ${c.grupo}</span>
          </div>
          <span style="color: var(--text-muted); font-size: 12px;">Periodo Oficial: ${c.periodo}</span>
        </div>

        <div class="meta-info">
          <div class="meta-row">
            <span>👨‍🏫 <strong>Titular:</strong> Prof. ${c.docente_nombre} ${c.docente_apellido}</span>
          </div>
          <div class="meta-row">
            <span>🏫 <strong>Aula:</strong> ${c.codigo_aula || 'Por definir'} (${c.tipo_aula || 'Teórica'})</span>
          </div>
          <div class="meta-row">
            <span>⏰ <strong>Horario:</strong> ${c.horarios || 'Pendiente'}</span>
          </div>
          <div class="meta-row">
            <span>👥 <strong>Cupo:</strong> ${c.inscritos} / ${c.cupo_maximo} estudiantes</span>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (error) {
    showToast('Error al cargar cursos', 'error');
  }
}

// 6. Matrículas y Calificaciones
async function loadMatriculas() {
  try {
    const res = await fetch(`${API_BASE}/matriculas`);
    const matriculas = await res.json();

    // Llenar select de calificar
    const selCalMat = document.getElementById('cal-matricula');
    selCalMat.innerHTML = '<option value="">-- Selecciona una inscripción --</option>';

    matriculas.forEach(mat => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ id_estudiante: mat.id_estudiante, id_curso: mat.id_curso });
      opt.textContent = `${mat.estudiante_nombre} ${mat.estudiante_apellido} en ${mat.nombre_materia} (${mat.grupo}) - Nota act: ${mat.calificacion_actual !== null ? mat.calificacion_actual : 'Sin calificar'}`;
      selCalMat.appendChild(opt);
    });
  } catch (error) {
    showToast('Error al cargar lista de matrículas', 'error');
  }
}

async function loadCalificaciones() {
  try {
    const res = await fetch(`${API_BASE}/calificaciones`);
    const califs = await res.json();
    const tbody = document.getElementById('tbody-calificaciones');
    tbody.innerHTML = '';

    califs.forEach(c => {
      const tr = document.createElement('tr');
      const esAprobado = c.nota >= 7.0;
      tr.innerHTML = `
        <td><code style="color: var(--primary);">${c.folio_evaluacion}</code></td>
        <td><strong>${c.estudiante_nombre} ${c.estudiante_apellido}</strong></td>
        <td>${c.nombre_materia} (Gpo ${c.grupo})</td>
        <td>
          <span class="badge ${esAprobado ? 'green' : 'red'}" style="font-size: 13px;">
            ${Number(c.nota).toFixed(2)}
          </span>
        </td>
        <td>${c.tipo_evaluacion}</td>
        <td><small style="color: var(--text-dim);">${c.fecha_registro}</small></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    showToast('Error al cargar historial de calificaciones', 'error');
  }
}

// 7. Biblioteca
async function loadBiblioteca() {
  try {
    const res = await fetch(`${API_BASE}/prestamos`);
    const prestamos = await res.json();
    const tbody = document.getElementById('tbody-prestamos');
    tbody.innerHTML = '';

    prestamos.forEach(p => {
      const tr = document.createElement('tr');
      const devuelto = p.devuelto === 1;
      tr.innerHTML = `
        <td>#${p.id_prestamo}</td>
        <td><strong>${p.titulo_libro}</strong></td>
        <td>${p.estudiante_nombre} ${p.estudiante_apellido} <small>(#${p.id_estudiante})</small></td>
        <td>${p.fecha_limite_devolucion}</td>
        <td>
          <span class="badge ${devuelto ? 'green' : 'red'}">
            ${devuelto ? 'Devuelto' : 'Adeudo Activo (Bloquea Baja)'}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="togglePrestamo(${p.id_prestamo})">
            ${devuelto ? 'Marcar Pendiente' : 'Registrar Devolución'}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    showToast('Error al cargar biblioteca', 'error');
  }
}

async function togglePrestamo(id) {
  try {
    const res = await fetch(`${API_BASE}/prestamos/${id}/toggle`, { method: 'PUT' });
    if (res.ok) {
      showToast('Estatus de préstamo actualizado con éxito', 'success');
      loadBiblioteca();
      loadDashboard();
    }
  } catch (error) {
    showToast('Error al actualizar préstamo: ' + error.message, 'error');
  }
}

// 8. Carga de Dropdowns para Formularios
async function loadDropdowns() {
  try {
    // Carreras
    const resCarreras = await fetch(`${API_BASE}/carreras`);
    const carreras = await resCarreras.json();
    const selCarrera = document.getElementById('est-carrera');
    selCarrera.innerHTML = '';
    carreras.forEach(c => {
      selCarrera.innerHTML += `<option value="${c.id_carrera}">${c.nombre_carrera} (${c.id_carrera})</option>`;
    });

    // Departamentos
    const resDeptos = await fetch(`${API_BASE}/departamentos`);
    const deptos = await resDeptos.json();
    const selDocDep = document.getElementById('doc-dep');
    selDocDep.innerHTML = '';
    deptos.forEach(d => {
      selDocDep.innerHTML += `<option value="${d.id_departamento}">${d.nombre_departamento}</option>`;
    });

    // Docentes para coordinador
    const resDocs = await fetch(`${API_BASE}/docentes`);
    const docs = await resDocs.json();
    const selCoord = document.getElementById('doc-coord');
    selCoord.innerHTML = '<option value="">-- Sin Coordinador (Es Jefe de Área) --</option>';
    docs.forEach(d => {
      selCoord.innerHTML += `<option value="${d.id_docente}">Prof. ${d.nombre} ${d.apellido}</option>`;
    });

    // Estudiantes para matrícula
    const resEsts = await fetch(`${API_BASE}/estudiantes`);
    const ests = await resEsts.json();
    const selMatEst = document.getElementById('mat-estudiante');
    selMatEst.innerHTML = '<option value="">-- Selecciona un estudiante --</option>';
    ests.forEach(e => {
      selMatEst.innerHTML += `<option value="${e.id_estudiante}">${e.nombre} ${e.apellido} (#${e.id_estudiante})</option>`;
    });

    // Cursos para matrícula
    const resCursos = await fetch(`${API_BASE}/cursos`);
    const cur = await resCursos.json();
    const selMatCur = document.getElementById('mat-curso');
    selMatCur.innerHTML = '<option value="">-- Selecciona un curso disponible --</option>';
    cur.forEach(c => {
      selMatCur.innerHTML += `<option value="${c.id_curso}">${c.nombre_materia} - Gpo ${c.grupo} (${c.periodo})</option>`;
    });

  } catch (error) {
    console.error('Error cargando listas desplegables', error);
  }
}

// -----------------------------------------------------------------------------
// ENVÍO DE FORMULARIOS
// -----------------------------------------------------------------------------
function setupForms() {
  // 1. Formulario Nuevo Estudiante
  document.getElementById('form-estudiante').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById('est-nombre').value,
      apellido: document.getElementById('est-apellido').value,
      curp_dni: document.getElementById('est-curp').value,
      correo_institucional: document.getElementById('est-correo').value,
      fecha_nacimiento: document.getElementById('est-fecha').value,
      id_carrera: document.getElementById('est-carrera').value,
      tipo_sangre: document.getElementById('est-sangre').value,
      alergias: document.getElementById('est-alergias').value,
      contacto_emergencia: document.getElementById('est-contacto').value,
      telefono_emergencia: document.getElementById('est-tel').value
    };

    try {
      const res = await fetch(`${API_BASE}/estudiantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error, 'error');
      } else {
        showToast(data.message, 'success');
        closeModal('modal-estudiante');
        e.target.reset();
        loadEstudiantes();
        loadDashboard();
        loadDropdowns();
      }
    } catch (error) {
      showToast('Error al guardar: ' + error.message, 'error');
    }
  });

  // 2. Formulario Nuevo Docente
  document.getElementById('form-docente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById('doc-nombre').value,
      apellido: document.getElementById('doc-apellido').value,
      correo: document.getElementById('doc-correo').value,
      especialidad: document.getElementById('doc-esp').value,
      id_departamento: document.getElementById('doc-dep').value,
      id_coordinador: document.getElementById('doc-coord').value || null,
      cubiculo_edificio: document.getElementById('doc-cub-edif').value,
      cubiculo_puerta: document.getElementById('doc-cub-num').value
    };

    try {
      const res = await fetch(`${API_BASE}/docentes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error, 'error');
      } else {
        showToast(data.message, 'success');
        closeModal('modal-docente');
        e.target.reset();
        loadDocentes();
        loadDashboard();
      }
    } catch (error) {
      showToast('Error al guardar: ' + error.message, 'error');
    }
  });

  // 3. Formulario Matrícula
  document.getElementById('form-matricula').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      id_estudiante: Number(document.getElementById('mat-estudiante').value),
      id_curso: Number(document.getElementById('mat-curso').value)
    };

    try {
      const res = await fetch(`${API_BASE}/matriculas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error, 'error');
      } else {
        showToast(data.message, 'success');
        loadMatriculas();
        loadDashboard();
      }
    } catch (error) {
      showToast('Error en matrícula: ' + error.message, 'error');
    }
  });

  // 4. Formulario Calificación
  document.getElementById('form-calificacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selMat = document.getElementById('cal-matricula').value;
    if (!selMat) return showToast('Por favor selecciona una inscripción', 'error');

    const parsed = JSON.parse(selMat);
    const payload = {
      id_estudiante: parsed.id_estudiante,
      id_curso: parsed.id_curso,
      nota: Number(document.getElementById('cal-nota').value),
      tipo_evaluacion: document.getElementById('cal-tipo').value
    };

    try {
      const res = await fetch(`${API_BASE}/calificaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error, 'error');
      } else {
        showToast(`Calificación asentada con éxito. Folio: ${data.folio}`, 'success');
        document.getElementById('cal-nota').value = '';
        loadCalificaciones();
        loadDashboard();
      }
    } catch (error) {
      showToast('Error al asentar nota: ' + error.message, 'error');
    }
  });
}

// -----------------------------------------------------------------------------
// LABORATORIO SQL EN VIVO
// -----------------------------------------------------------------------------
function setupSqlLab() {
  const editor = document.getElementById('sql-editor');
  const btnRun = document.getElementById('btn-ejecutar-sql');
  const btnClear = document.getElementById('btn-limpiar-sql');
  const resultsContainer = document.getElementById('sql-results');
  const statusBadge = document.getElementById('sql-status');

  // Asignar consultas de muestra
  document.querySelectorAll('.btn-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const qId = btn.getAttribute('data-query');
      if (PRESET_QUERIES[qId]) {
        editor.value = PRESET_QUERIES[qId];
        editor.focus();
      }
    });
  });

  btnClear.addEventListener('click', () => {
    editor.value = '';
    resultsContainer.innerHTML = '<p class="placeholder-text">Consola vacía. Escribe una consulta SELECT.</p>';
    statusBadge.textContent = 'Listo';
    statusBadge.className = 'badge';
  });

  btnRun.addEventListener('click', async () => {
    const sql = editor.value.trim();
    if (!sql) return showToast('Escribe una consulta antes de ejecutar', 'error');

    statusBadge.textContent = 'Ejecutando...';
    statusBadge.className = 'badge blue';

    try {
      const res = await fetch(`${API_BASE}/sql-runner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        statusBadge.textContent = 'Error en Sintaxis';
        statusBadge.className = 'badge red';
        resultsContainer.innerHTML = `
          <div style="padding: 20px; background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); border-radius: var(--radius-md); color: #fca5a5;">
            <strong>Error del Motor SQLite:</strong>
            <pre style="margin-top: 8px; font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap;">${data.error}</pre>
          </div>
        `;
      } else {
        statusBadge.textContent = `${data.rowCount} Fila(s) Obtenida(s)`;
        statusBadge.className = 'badge green';

        if (data.rowCount === 0) {
          resultsContainer.innerHTML = '<p class="placeholder-text">La consulta se ejecutó con éxito pero arrojó 0 resultados.</p>';
          return;
        }

        let tableHtml = `<div class="table-responsive"><table class="data-table"><thead><tr>`;
        data.columns.forEach(col => {
          tableHtml += `<th>${col}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;

        data.rows.forEach(row => {
          tableHtml += `<tr>`;
          data.columns.forEach(col => {
            const val = row[col];
            tableHtml += `<td>${val !== null && val !== undefined ? val : '<em style="color:var(--text-dim)">NULL</em>'}</td>`;
          });
          tableHtml += `</tr>`;
        });
        tableHtml += `</tbody></table></div>`;
        resultsContainer.innerHTML = tableHtml;
      }
    } catch (error) {
      statusBadge.textContent = 'Falla de Conexión';
      statusBadge.className = 'badge red';
      resultsContainer.innerHTML = `<p style="color: var(--danger); padding: 20px;">${error.message}</p>`;
    }
  });
}

// -----------------------------------------------------------------------------
// UTILIDADES: MODALES, TOASTS Y REINICIO
// -----------------------------------------------------------------------------
function setupModals() {
  document.querySelectorAll('.modal-close, [data-close]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = el.getAttribute('data-close');
      if (modalId) closeModal(modalId);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : '⚠️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function resetDatabase() {
  if (!confirm('¿Seguro que deseas restaurar la base de datos a su estado original de demostración?')) return;

  try {
    const res = await fetch(`${API_BASE}/reset-db`, { method: 'POST' });
    const data = await res.json();
    showToast(data.message, 'success');
    loadDashboard();
    loadEstudiantes();
    loadDocentes();
    loadMaterias();
    loadCursos();
    loadMatriculas();
    loadCalificaciones();
    loadBiblioteca();
    loadDropdowns();
  } catch (error) {
    showToast('Error al reiniciar base de datos', 'error');
  }
}
