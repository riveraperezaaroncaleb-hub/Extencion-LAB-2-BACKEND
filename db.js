// =============================================================================
// DB.JS - Capa de Persistencia Relacional con SQLite (node:sqlite)
// Implementa todas las tablas, llaves, restricciones e integridad referencial
// =============================================================================

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'escuela.sqlite');
const db = new DatabaseSync(DB_PATH);

// Activar soporte de Llaves Foráneas e Integridad Referencial en SQLite
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Inicializa y crea el esquema relacional normalizado en 3FN si no existe.
 */
function initSchema() {
  db.exec(`
    -- 1. DEPARTAMENTOS
    CREATE TABLE IF NOT EXISTS Departamentos (
      id_departamento INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre_departamento TEXT NOT NULL UNIQUE,
      edificio TEXT NOT NULL
    );

    -- 2. DOCENTES (con relación reflexiva id_coordinador)
    CREATE TABLE IF NOT EXISTS Docentes (
      id_docente INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE,
      especialidad TEXT NOT NULL,
      id_departamento INTEGER NOT NULL,
      id_coordinador INTEGER NULL,
      FOREIGN KEY (id_departamento) REFERENCES Departamentos(id_departamento) ON DELETE RESTRICT,
      FOREIGN KEY (id_coordinador) REFERENCES Docentes(id_docente) ON DELETE SET NULL
    );

    -- 3. CUBICULOS (Relación 1:1 con Docentes)
    CREATE TABLE IF NOT EXISTS CubiculosDocentes (
      id_cubiculo INTEGER PRIMARY KEY AUTOINCREMENT,
      id_docente INTEGER NOT NULL UNIQUE,
      edificio TEXT NOT NULL,
      numero_puerta TEXT NOT NULL,
      FOREIGN KEY (id_docente) REFERENCES Docentes(id_docente) ON DELETE CASCADE
    );

    -- 4. CARRERAS
    CREATE TABLE IF NOT EXISTS Carreras (
      id_carrera TEXT PRIMARY KEY,
      nombre_carrera TEXT NOT NULL,
      duracion_semestres INTEGER NOT NULL CHECK (duracion_semestres > 0),
      id_departamento INTEGER NOT NULL,
      FOREIGN KEY (id_departamento) REFERENCES Departamentos(id_departamento) ON DELETE RESTRICT
    );

    -- 5. ESTUDIANTES
    CREATE TABLE IF NOT EXISTS Estudiantes (
      id_estudiante INTEGER PRIMARY KEY AUTOINCREMENT,
      curp_dni TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      correo_institucional TEXT NOT NULL UNIQUE,
      fecha_nacimiento TEXT NOT NULL,
      fecha_ingreso TEXT NOT NULL DEFAULT (DATE('now')),
      id_carrera TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Baja', 'Egresado')),
      FOREIGN KEY (id_carrera) REFERENCES Carreras(id_carrera) ON DELETE RESTRICT
    );

    -- 6. EXPEDIENTES MEDICOS (Relación 1:1)
    CREATE TABLE IF NOT EXISTS ExpedientesMedicos (
      id_expediente INTEGER PRIMARY KEY AUTOINCREMENT,
      id_estudiante INTEGER NOT NULL UNIQUE,
      tipo_sangre TEXT NOT NULL,
      alergias TEXT NULL,
      contacto_emergencia TEXT NOT NULL,
      telefono_emergencia TEXT NOT NULL,
      FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante) ON DELETE CASCADE
    );

    -- 7. MATERIAS (con relación reflexiva de prerrequisitos)
    CREATE TABLE IF NOT EXISTS Materias (
      id_materia INTEGER PRIMARY KEY AUTOINCREMENT,
      clave_materia TEXT NOT NULL UNIQUE,
      nombre_materia TEXT NOT NULL,
      creditos INTEGER NOT NULL CHECK (creditos > 0 AND creditos <= 15),
      semestre_sugerido INTEGER NOT NULL CHECK (semestre_sugerido BETWEEN 1 AND 12),
      id_materia_prerrequisito INTEGER NULL,
      FOREIGN KEY (id_materia_prerrequisito) REFERENCES Materias(id_materia) ON DELETE SET NULL
    );

    -- 8. AULAS
    CREATE TABLE IF NOT EXISTS Aulas (
      id_aula INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_aula TEXT NOT NULL UNIQUE,
      edificio TEXT NOT NULL,
      capacidad INTEGER NOT NULL CHECK (capacidad > 0),
      tipo_aula TEXT NOT NULL DEFAULT 'Teorica' CHECK (tipo_aula IN ('Teorica', 'Laboratorio', 'Auditorio'))
    );

    -- 9. CURSOS
    CREATE TABLE IF NOT EXISTS Cursos (
      id_curso INTEGER PRIMARY KEY AUTOINCREMENT,
      id_materia INTEGER NOT NULL,
      id_profesor INTEGER NOT NULL,
      id_aula INTEGER NULL,
      periodo TEXT NOT NULL,
      grupo TEXT NOT NULL,
      cupo_maximo INTEGER NOT NULL DEFAULT 35 CHECK (cupo_maximo > 0),
      UNIQUE (id_materia, periodo, grupo),
      FOREIGN KEY (id_materia) REFERENCES Materias(id_materia) ON DELETE RESTRICT,
      FOREIGN KEY (id_profesor) REFERENCES Docentes(id_docente) ON DELETE RESTRICT,
      FOREIGN KEY (id_aula) REFERENCES Aulas(id_aula) ON DELETE SET NULL
    );

    -- 10. HORARIOS (1:N con Cursos)
    CREATE TABLE IF NOT EXISTS Horarios (
      id_horario INTEGER PRIMARY KEY AUTOINCREMENT,
      id_curso INTEGER NOT NULL,
      dia_semana TEXT NOT NULL CHECK (dia_semana IN ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado')),
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      FOREIGN KEY (id_curso) REFERENCES Cursos(id_curso) ON DELETE CASCADE
    );

    -- 11. MATRICULAS (Relación N:M con Llave Compuesta)
    CREATE TABLE IF NOT EXISTS Matriculas (
      id_estudiante INTEGER NOT NULL,
      id_curso INTEGER NOT NULL,
      fecha_matricula TEXT NOT NULL DEFAULT (DATE('now')),
      estado_matricula TEXT NOT NULL DEFAULT 'Inscrita' CHECK (estado_matricula IN ('Inscrita', 'Baja', 'Completada')),
      PRIMARY KEY (id_estudiante, id_curso),
      FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante) ON DELETE CASCADE,
      FOREIGN KEY (id_curso) REFERENCES Cursos(id_curso) ON DELETE RESTRICT
    );

    -- 12. CALIFICACIONES
    CREATE TABLE IF NOT EXISTS Calificaciones (
      id_calificacion INTEGER PRIMARY KEY AUTOINCREMENT,
      id_estudiante INTEGER NOT NULL,
      id_curso INTEGER NOT NULL,
      folio_evaluacion TEXT NOT NULL UNIQUE,
      nota REAL NOT NULL CHECK (nota >= 0.00 AND nota <= 10.00),
      tipo_evaluacion TEXT NOT NULL DEFAULT 'Ordinario' CHECK (tipo_evaluacion IN ('Ordinario', 'Extraordinario', 'Titulo')),
      fecha_registro TEXT NOT NULL DEFAULT (DATE('now')),
      FOREIGN KEY (id_estudiante, id_curso) REFERENCES Matriculas(id_estudiante, id_curso) ON DELETE CASCADE
    );

    -- 13. PRESTAMOS BIBLIOTECA (Demuestra ON DELETE RESTRICT)
    CREATE TABLE IF NOT EXISTS PrestamosBiblioteca (
      id_prestamo INTEGER PRIMARY KEY AUTOINCREMENT,
      id_estudiante INTEGER NOT NULL,
      titulo_libro TEXT NOT NULL,
      fecha_prestamo TEXT NOT NULL DEFAULT (DATE('now')),
      fecha_limite_devolucion TEXT NOT NULL,
      devuelto INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante) ON DELETE RESTRICT
    );
  `);
}

/**
 * Llena la base de datos con datos semilla si las tablas están vacías.
 */
function seedData() {
  const check = db.prepare('SELECT COUNT(*) as total FROM Departamentos').get();
  if (check && check.total > 0) return;

  db.exec(`
    -- Departamentos
    INSERT INTO Departamentos (nombre_departamento, edificio) VALUES
    ('Ciencias Computacionales', 'Edificio Alpha'),
    ('Ciencias Básicas', 'Edificio Gamma'),
    ('Ingeniería Industrial', 'Edificio Beta');

    -- Docentes (Coordinadores primero)
    INSERT INTO Docentes (nombre, apellido, correo, especialidad, id_departamento, id_coordinador) VALUES
    ('Alejandro', 'Morales', 'alejandro.morales@universidad.edu', 'Bases de Datos y Arquitectura', 1, NULL),
    ('Beatriz', 'Hernández', 'beatriz.hernandez@universidad.edu', 'Matemáticas Discretas', 2, NULL);

    -- Docentes subordinados
    INSERT INTO Docentes (nombre, apellido, correo, especialidad, id_departamento, id_coordinador) VALUES
    ('Carlos', 'López', 'carlos.lopez@universidad.edu', 'Sistemas Operativos', 1, 1),
    ('Diana', 'Torres', 'diana.torres@universidad.edu', 'Cálculo Diferencial e Integral', 2, 2),
    ('Eduardo', 'Ramírez', 'eduardo.ramirez@universidad.edu', 'Optimización de Procesos', 3, NULL);

    -- Cubículos (1:1)
    INSERT INTO CubiculosDocentes (id_docente, edificio, numero_puerta) VALUES
    (1, 'Alpha', 'C-101'),
    (2, 'Gamma', 'C-204'),
    (3, 'Alpha', 'C-102');

    -- Carreras
    INSERT INTO Carreras (id_carrera, nombre_carrera, duracion_semestres, id_departamento) VALUES
    ('ISC', 'Ingeniería en Sistemas Computacionales', 9, 1),
    ('IND', 'Ingeniería Industrial', 9, 3);

    -- Estudiantes
    INSERT INTO Estudiantes (curp_dni, nombre, apellido, correo_institucional, fecha_nacimiento, fecha_ingreso, id_carrera) VALUES
    ('CURP200501VALM', 'Valeria', 'Méndez', 'valeria.mendez@universidad.edu', '2005-04-12', '2026-08-15', 'ISC'),
    ('CURP200502SANT', 'Santiago', 'Lara', 'santiago.lara@universidad.edu', '2005-09-20', '2026-08-15', 'ISC'),
    ('CURP200403CAMG', 'Camila', 'García', 'camila.garcia@universidad.edu', '2004-11-05', '2025-08-15', 'IND'),
    ('CURP200404MATE', 'Mateo', 'Navarro', 'mateo.navarro@universidad.edu', '2004-02-18', '2025-08-15', 'ISC');

    -- Expedientes Médicos (1:1)
    INSERT INTO ExpedientesMedicos (id_estudiante, tipo_sangre, alergias, contacto_emergencia, telefono_emergencia) VALUES
    (1, 'O+', 'Penicilina', 'Lucía Méndez (Madre)', '555-123-4567'),
    (2, 'A+', 'Ninguna', 'Roberto Lara (Padre)', '555-987-6543'),
    (3, 'B-', 'Polvo y Polen', 'Elena García (Madre)', '555-555-8888');

    -- Materias (con jerarquía reflexiva)
    INSERT INTO Materias (clave_materia, nombre_materia, creditos, semestre_sugerido, id_materia_prerrequisito) VALUES
    ('CAL-101', 'Cálculo Diferencial', 8, 1, NULL),
    ('PRG-101', 'Fundamentos de Programación', 8, 1, NULL),
    ('EST-101', 'Estadística General', 6, 2, NULL),
    ('CAL-102', 'Cálculo Integral', 8, 2, 1),
    ('BDA-201', 'Bases de Datos Relacionales', 8, 3, 2),
    ('BDA-202', 'Bases de Datos Avanzadas', 8, 4, 5);

    -- Aulas
    INSERT INTO Aulas (codigo_aula, edificio, capacidad, tipo_aula) VALUES
    ('A-101', 'Edificio Alpha', 40, 'Teorica'),
    ('LAB-REDES', 'Edificio Alpha', 25, 'Laboratorio'),
    ('B-201', 'Edificio Beta', 35, 'Teorica');

    -- Cursos
    INSERT INTO Cursos (id_materia, id_profesor, id_aula, periodo, grupo, cupo_maximo) VALUES
    (1, 4, 1, '2026-B', 'G1', 35),
    (2, 3, 2, '2026-B', 'G1', 25),
    (5, 1, 2, '2026-B', 'G1', 25);

    -- Horarios
    INSERT INTO Horarios (id_curso, dia_semana, hora_inicio, hora_fin) VALUES
    (1, 'Lunes', '07:00', '09:00'),
    (1, 'Miercoles', '07:00', '09:00'),
    (2, 'Martes', '09:00', '11:00'),
    (2, 'Jueves', '09:00', '11:00'),
    (3, 'Lunes', '11:00', '13:00'),
    (3, 'Viernes', '11:00', '13:00');

    -- Matrículas
    INSERT INTO Matriculas (id_estudiante, id_curso, fecha_matricula, estado_matricula) VALUES
    (1, 1, '2026-08-18', 'Inscrita'),
    (1, 2, '2026-08-18', 'Inscrita'),
    (2, 1, '2026-08-19', 'Inscrita'),
    (2, 2, '2026-08-19', 'Inscrita'),
    (4, 3, '2026-08-20', 'Inscrita');

    -- Calificaciones
    INSERT INTO Calificaciones (id_estudiante, id_curso, folio_evaluacion, nota, tipo_evaluacion) VALUES
    (1, 1, 'FOL-2026-001', 9.50, 'Ordinario'),
    (1, 2, 'FOL-2026-002', 8.80, 'Ordinario'),
    (2, 1, 'FOL-2026-003', 7.20, 'Ordinario'),
    (4, 3, 'FOL-2026-004', 10.00, 'Ordinario');

    -- Préstamos en Biblioteca
    INSERT INTO PrestamosBiblioteca (id_estudiante, titulo_libro, fecha_prestamo, fecha_limite_devolucion, devuelto) VALUES
    (1, 'Fundamentos de Bases de Datos - Silberschatz', '2026-09-01', '2026-09-15', 1),
    (2, 'Calculus - James Stewart', '2026-09-10', '2026-10-01', 0);
  `);
}

/**
 * Reinicia la base de datos eliminando tablas y volviendo a poblar los datos semilla.
 */
function resetDatabase() {
  db.exec(`
    DROP TABLE IF EXISTS PrestamosBiblioteca;
    DROP TABLE IF EXISTS Calificaciones;
    DROP TABLE IF EXISTS Matriculas;
    DROP TABLE IF EXISTS Horarios;
    DROP TABLE IF EXISTS Cursos;
    DROP TABLE IF EXISTS Aulas;
    DROP TABLE IF EXISTS Materias;
    DROP TABLE IF EXISTS ExpedientesMedicos;
    DROP TABLE IF EXISTS Estudiantes;
    DROP TABLE IF EXISTS Carreras;
    DROP TABLE IF EXISTS CubiculosDocentes;
    DROP TABLE IF EXISTS Docentes;
    DROP TABLE IF EXISTS Departamentos;
  `);
  initSchema();
  seedData();
}

// Inicializar al cargar
initSchema();
seedData();

module.exports = {
  db,
  resetDatabase
};
