// =============================================================================
// SERVER.JS - Servidor Backend con Node.js, Express y SQLite
// Expone API RESTful y sirve el Frontend estático
// =============================================================================

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { db, resetDatabase } = require('./db.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------------------------------------------------------
// ENDPOINTS DE LA API
// -----------------------------------------------------------------------------

// 1. Dashboard: Resumen General
app.get('/api/dashboard', (req, res) => {
  try {
    const totalEstudiantes = db.prepare('SELECT COUNT(*) as count FROM Estudiantes').get().count;
    const totalDocentes = db.prepare('SELECT COUNT(*) as count FROM Docentes').get().count;
    const totalMaterias = db.prepare('SELECT COUNT(*) as count FROM Materias').get().count;
    const totalCursos = db.prepare('SELECT COUNT(*) as count FROM Cursos').get().count;
    const totalMatriculas = db.prepare('SELECT COUNT(*) as count FROM Matriculas').get().count;
    const prestamosPendientes = db.prepare('SELECT COUNT(*) as count FROM PrestamosBiblioteca WHERE devuelto = 0').get().count;

    const statsNotas = db.prepare(`
      SELECT 
        ROUND(AVG(nota), 2) as promedio_general,
        COUNT(CASE WHEN nota >= 7.0 THEN 1 END) as aprobados,
        COUNT(CASE WHEN nota < 7.0 THEN 1 END) as reprobados
      FROM Calificaciones
    `).get();

    res.json({
      totalEstudiantes,
      totalDocentes,
      totalMaterias,
      totalCursos,
      totalMatriculas,
      prestamosPendientes,
      promedioGeneral: statsNotas.promedio_general || 0,
      aprobados: statsNotas.aprobados || 0,
      reprobados: statsNotas.reprobados || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Estudiantes
app.get('/api/estudiantes', (req, res) => {
  try {
    const query = `
      SELECT 
        e.id_estudiante,
        e.curp_dni,
        e.nombre,
        e.apellido,
        e.correo_institucional,
        e.fecha_nacimiento,
        e.fecha_ingreso,
        e.estado,
        e.id_carrera,
        c.nombre_carrera,
        exp.tipo_sangre,
        exp.alergias,
        exp.contacto_emergencia,
        exp.telefono_emergencia
      FROM Estudiantes e
      INNER JOIN Carreras c ON e.id_carrera = c.id_carrera
      LEFT JOIN ExpedientesMedicos exp ON e.id_estudiante = exp.id_estudiante
      ORDER BY e.id_estudiante DESC
    `;
    const estudiantes = db.prepare(query).all();
    res.json(estudiantes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/estudiantes', (req, res) => {
  const { curp_dni, nombre, apellido, correo_institucional, fecha_nacimiento, id_carrera, tipo_sangre, alergias, contacto_emergencia, telefono_emergencia } = req.body;
  if (!curp_dni || !nombre || !apellido || !correo_institucional || !fecha_nacimiento || !id_carrera) {
    return res.status(400).json({ error: 'Todos los campos obligatorios del estudiante deben ser proporcionados.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');
    const stmtEst = db.prepare(`
      INSERT INTO Estudiantes (curp_dni, nombre, apellido, correo_institucional, fecha_nacimiento, id_carrera)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const resultEst = stmtEst.run(curp_dni, nombre, apellido, correo_institucional, fecha_nacimiento, id_carrera);
    const newStudentId = resultEst.lastInsertRowid;

    if (tipo_sangre && contacto_emergencia && telefono_emergencia) {
      const stmtExp = db.prepare(`
        INSERT INTO ExpedientesMedicos (id_estudiante, tipo_sangre, alergias, contacto_emergencia, telefono_emergencia)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmtExp.run(newStudentId, tipo_sangre, alergias || 'Ninguna', contacto_emergencia, telefono_emergencia);
    }
    db.exec('COMMIT;');
    res.status(201).json({ id_estudiante: Number(newStudentId), message: 'Estudiante y expediente registrados correctamente.' });
  } catch (error) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: 'Error al registrar: ' + error.message });
  }
});

app.delete('/api/estudiantes/:id', (req, res) => {
  const id = Number(req.params.id);
  try {
    const stmt = db.prepare('DELETE FROM Estudiantes WHERE id_estudiante = ?');
    const info = stmt.run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Estudiante no encontrado.' });
    }
    res.json({ message: 'Estudiante eliminado con éxito (y su expediente en cascada).' });
  } catch (error) {
    // Demuestra el bloqueo por ON DELETE RESTRICT
    res.status(400).json({
      error: 'Operación bloqueada por Integridad Referencial (ON DELETE RESTRICT): ' + error.message,
      detail: 'El estudiante tiene libros en préstamo no devueltos o dependencias que prohíben su eliminación.'
    });
  }
});

// 3. Carreras & Departamentos
app.get('/api/carreras', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM Carreras ORDER BY nombre_carrera').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/departamentos', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM Departamentos ORDER BY nombre_departamento').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Docentes
app.get('/api/docentes', (req, res) => {
  try {
    const query = `
      SELECT 
        d.id_docente,
        d.nombre,
        d.apellido,
        d.correo,
        d.especialidad,
        d.id_departamento,
        dep.nombre_departamento,
        dep.edificio as edificio_departamento,
        cub.edificio as edificio_cubiculo,
        cub.numero_puerta as numero_cubiculo,
        coord.nombre as nombre_coordinador
      FROM Docentes d
      INNER JOIN Departamentos dep ON d.id_departamento = dep.id_departamento
      LEFT JOIN CubiculosDocentes cub ON d.id_docente = cub.id_docente
      LEFT JOIN Docentes coord ON d.id_coordinador = coord.id_docente
      ORDER BY d.id_docente
    `;
    const rows = db.prepare(query).all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/docentes', (req, res) => {
  const { nombre, apellido, correo, especialidad, id_departamento, id_coordinador, cubiculo_edificio, cubiculo_puerta } = req.body;
  if (!nombre || !apellido || !correo || !especialidad || !id_departamento) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el docente.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');
    const stmt = db.prepare(`
      INSERT INTO Docentes (nombre, apellido, correo, especialidad, id_departamento, id_coordinador)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const resDoc = stmt.run(nombre, apellido, correo, especialidad, id_departamento, id_coordinador || null);
    const newDocId = resDoc.lastInsertRowid;

    if (cubiculo_edificio && cubiculo_puerta) {
      db.prepare(`
        INSERT INTO CubiculosDocentes (id_docente, edificio, numero_puerta)
        VALUES (?, ?, ?)
      `).run(newDocId, cubiculo_edificio, cubiculo_puerta);
    }

    db.exec('COMMIT;');
    res.status(201).json({ id_docente: Number(newDocId), message: 'Docente registrado correctamente.' });
  } catch (error) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: error.message });
  }
});

// 5. Materias (Relación Reflexiva)
app.get('/api/materias', (req, res) => {
  try {
    const query = `
      SELECT 
        m.id_materia,
        m.clave_materia,
        m.nombre_materia,
        m.creditos,
        m.semestre_sugerido,
        m.id_materia_prerrequisito,
        pre.nombre_materia as prerrequisito_nombre
      FROM Materias m
      LEFT JOIN Materias pre ON m.id_materia_prerrequisito = pre.id_materia
      ORDER BY m.semestre_sugerido, m.clave_materia
    `;
    const rows = db.prepare(query).all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materias', (req, res) => {
  const { clave_materia, nombre_materia, creditos, semestre_sugerido, id_materia_prerrequisito } = req.body;
  if (!clave_materia || !nombre_materia || !creditos || !semestre_sugerido) {
    return res.status(400).json({ error: 'Faltan datos de la materia.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO Materias (clave_materia, nombre_materia, creditos, semestre_sugerido, id_materia_prerrequisito)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(clave_materia, nombre_materia, creditos, semestre_sugerido, id_materia_prerrequisito || null);
    res.status(201).json({ id_materia: Number(info.lastInsertRowid), message: 'Materia creada exitosamente.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 6. Aulas
app.get('/api/aulas', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM Aulas ORDER BY codigo_aula').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Cursos
app.get('/api/cursos', (req, res) => {
  try {
    const query = `
      SELECT 
        c.id_curso,
        c.periodo,
        c.grupo,
        c.cupo_maximo,
        m.id_materia,
        m.nombre_materia,
        m.clave_materia,
        d.id_docente,
        d.nombre as docente_nombre,
        d.apellido as docente_apellido,
        a.id_aula,
        a.codigo_aula,
        a.tipo_aula,
        (SELECT COUNT(*) FROM Matriculas mat WHERE mat.id_curso = c.id_curso) as inscritos,
        (
          SELECT GROUP_CONCAT(h.dia_semana || ' ' || h.hora_inicio || '-' || h.hora_fin, ', ')
          FROM Horarios h WHERE h.id_curso = c.id_curso
        ) as horarios
      FROM Cursos c
      INNER JOIN Materias m ON c.id_materia = m.id_materia
      INNER JOIN Docentes d ON c.id_profesor = d.id_docente
      LEFT JOIN Aulas a ON c.id_aula = a.id_aula
      ORDER BY c.periodo DESC, m.nombre_materia
    `;
    const rows = db.prepare(query).all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cursos', (req, res) => {
  const { id_materia, id_profesor, id_aula, periodo, grupo, cupo_maximo, dia_semana, hora_inicio, hora_fin } = req.body;
  if (!id_materia || !id_profesor || !periodo || !grupo) {
    return res.status(400).json({ error: 'Campos requeridos faltantes para el curso.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');
    const stmtCurso = db.prepare(`
      INSERT INTO Cursos (id_materia, id_profesor, id_aula, periodo, grupo, cupo_maximo)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const resCurso = stmtCurso.run(id_materia, id_profesor, id_aula || null, periodo, grupo, cupo_maximo || 35);
    const newCourseId = resCurso.lastInsertRowid;

    if (dia_semana && hora_inicio && hora_fin) {
      db.prepare(`
        INSERT INTO Horarios (id_curso, dia_semana, hora_inicio, hora_fin)
        VALUES (?, ?, ?, ?)
      `).run(newCourseId, dia_semana, hora_inicio, hora_fin);
    }

    db.exec('COMMIT;');
    res.status(201).json({ id_curso: Number(newCourseId), message: 'Curso y horario creados exitosamente.' });
  } catch (error) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: error.message });
  }
});

// 8. Matrículas (N:M)
app.get('/api/matriculas', (req, res) => {
  try {
    const query = `
      SELECT 
        mat.id_estudiante,
        mat.id_curso,
        mat.fecha_matricula,
        mat.estado_matricula,
        e.nombre as estudiante_nombre,
        e.apellido as estudiante_apellido,
        e.correo_institucional,
        m.nombre_materia,
        c.grupo,
        c.periodo,
        cal.nota as calificacion_actual
      FROM Matriculas mat
      INNER JOIN Estudiantes e ON mat.id_estudiante = e.id_estudiante
      INNER JOIN Cursos c ON mat.id_curso = c.id_curso
      INNER JOIN Materias m ON c.id_materia = m.id_materia
      LEFT JOIN Calificaciones cal ON mat.id_estudiante = cal.id_estudiante AND mat.id_curso = cal.id_curso
      ORDER BY mat.fecha_matricula DESC
    `;
    const rows = db.prepare(query).all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/matriculas', (req, res) => {
  const { id_estudiante, id_curso } = req.body;
  if (!id_estudiante || !id_curso) {
    return res.status(400).json({ error: 'Debes especificar id_estudiante e id_curso.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO Matriculas (id_estudiante, id_curso)
      VALUES (?, ?)
    `);
    stmt.run(id_estudiante, id_curso);
    res.status(201).json({ message: 'Matrícula completada exitosamente.' });
  } catch (error) {
    res.status(400).json({ error: 'No se pudo matricular: ' + error.message });
  }
});

// 9. Calificaciones
app.get('/api/calificaciones', (req, res) => {
  try {
    const query = `
      SELECT 
        cal.id_calificacion,
        cal.folio_evaluacion,
        cal.nota,
        cal.tipo_evaluacion,
        cal.fecha_registro,
        e.id_estudiante,
        e.nombre as estudiante_nombre,
        e.apellido as estudiante_apellido,
        m.nombre_materia,
        c.grupo,
        c.periodo
      FROM Calificaciones cal
      INNER JOIN Estudiantes e ON cal.id_estudiante = e.id_estudiante
      INNER JOIN Cursos c ON cal.id_curso = c.id_curso
      INNER JOIN Materias m ON c.id_materia = m.id_materia
      ORDER BY cal.fecha_registro DESC
    `;
    const rows = db.prepare(query).all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calificaciones', (req, res) => {
  const { id_estudiante, id_curso, nota, tipo_evaluacion } = req.body;
  if (!id_estudiante || !id_curso || nota === undefined) {
    return res.status(400).json({ error: 'Faltan campos para registrar calificación.' });
  }

  const numNota = Number(nota);
  if (isNaN(numNota) || numNota < 0 || numNota > 10) {
    return res.status(400).json({ error: 'Restricción CHECK violada: La nota debe estar entre 0.00 y 10.00.' });
  }

  const folio = 'FOL-' + Date.now().toString().slice(-6);

  try {
    const stmt = db.prepare(`
      INSERT INTO Calificaciones (id_estudiante, id_curso, folio_evaluacion, nota, tipo_evaluacion)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(id_estudiante, id_curso, folio, numNota, tipo_evaluacion || 'Ordinario');
    res.status(201).json({ id_calificacion: Number(info.lastInsertRowid), folio, message: 'Calificación guardada.' });
  } catch (error) {
    res.status(400).json({ error: 'Error: ' + error.message });
  }
});

// 10. Biblioteca
app.get('/api/prestamos', (req, res) => {
  try {
    const query = `
      SELECT 
        p.id_prestamo,
        p.titulo_libro,
        p.fecha_prestamo,
        p.fecha_limite_devolucion,
        p.devuelto,
        e.id_estudiante,
        e.nombre as estudiante_nombre,
        e.apellido as estudiante_apellido,
        e.correo_institucional
      FROM PrestamosBiblioteca p
      INNER JOIN Estudiantes e ON p.id_estudiante = e.id_estudiante
      ORDER BY p.devuelto ASC, p.fecha_limite_devolucion ASC
    `;
    const rows = db.prepare(query).all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/prestamos/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  try {
    const current = db.prepare('SELECT devuelto FROM PrestamosBiblioteca WHERE id_prestamo = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Préstamo no encontrado' });
    const nuevoEstado = current.devuelto === 1 ? 0 : 1;
    db.prepare('UPDATE PrestamosBiblioteca SET devuelto = ? WHERE id_prestamo = ?').run(nuevoEstado, id);
    res.json({ id_prestamo: id, devuelto: nuevoEstado });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Ejecutor SQL Interactivo (Laboratorio SQL)
app.post('/api/sql-runner', (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'Debe proporcionar una consulta SQL.' });
  }

  const trimmed = sql.trim();
  // Permitimos consultas SELECT en el laboratorio para exploración segura
  if (!trimmed.toLowerCase().startsWith('select')) {
    return res.status(400).json({ error: 'Por seguridad en este laboratorio interactivo solo se admiten consultas de lectura (SELECT).' });
  }

  try {
    const rows = db.prepare(trimmed).all();
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    res.json({
      success: true,
      rowCount: rows.length,
      columns,
      rows
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 12. Reiniciar Base de Datos
app.post('/api/reset-db', (req, res) => {
  try {
    resetDatabase();
    res.json({ message: 'Base de datos restaurada al estado demo inicial con éxito.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// ARRANQUE DEL SERVIDOR
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🎓 Servidor de Control Escolar Activo`);
  console.log(`🌐 Acceso Web: http://localhost:${PORT}`);
  console.log(`⚡ API REST: http://localhost:${PORT}/api/dashboard`);
  console.log(`===================================================`);
});
