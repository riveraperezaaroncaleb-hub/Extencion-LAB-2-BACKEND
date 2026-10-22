-- =============================================================================
-- PROYECTO: SISTEMA DE CONTROL ESCOLAR Y GESTIÓN ACADÉMICA
-- Materia: Fundamentos de Bases de Datos
-- Nivel: Universitario / Ingeniería de Software
-- Motor objetivo: MySQL 8.0+ / MariaDB 10.5+ / PostgreSQL (ANSI SQL compatible)
-- Descripción: Script completo DDL (Estructura), DML (Poblado de datos de prueba)
--              y DQL (Consultas avanzadas de verificación académica).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. CONFIGURACIÓN INICIAL Y LIMPIEZA DE TABLAS PREVIAS
-- -----------------------------------------------------------------------------
-- Se eliminan en orden inverso de dependencias para evitar violaciones de FK
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

-- -----------------------------------------------------------------------------
-- 1. DEFINICIÓN DE TABLAS (DDL)
-- -----------------------------------------------------------------------------

-- 1.1 Entidad DEPARTAMENTOS
-- Representa las unidades académicas que agrupan a los docentes y carreras.
CREATE TABLE Departamentos (
    id_departamento INT AUTO_INCREMENT PRIMARY KEY,
    nombre_departamento VARCHAR(100) NOT NULL UNIQUE,
    edificio VARCHAR(50) NOT NULL
);

-- 1.2 Entidad DOCENTES
-- Profesores adscritos a un departamento; incluye relación reflexiva para jefaturas.
CREATE TABLE Docentes (
    id_docente INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    especialidad VARCHAR(100) NOT NULL,
    id_departamento INT NOT NULL,
    -- Relación reflexiva: jefe o coordinador de academia
    id_coordinador INT NULL,
    CONSTRAINT fk_docente_departamento 
        FOREIGN KEY (id_departamento) REFERENCES Departamentos(id_departamento)
        ON DELETE RESTRICT,
    CONSTRAINT fk_docente_coordinador 
        FOREIGN KEY (id_coordinador) REFERENCES Docentes(id_docente)
        ON DELETE SET NULL
);

-- 1.3 Entidad CUBICULOSDOCENTES (Relación 1:1 con Docentes)
CREATE TABLE CubiculosDocentes (
    id_cubiculo INT AUTO_INCREMENT PRIMARY KEY,
    id_docente INT NOT NULL UNIQUE, -- Restricción UNIQUE que asegura cardinalidad 1:1
    edificio VARCHAR(20) NOT NULL,
    numero_puerta VARCHAR(10) NOT NULL,
    CONSTRAINT fk_cubiculo_docente 
        FOREIGN KEY (id_docente) REFERENCES Docentes(id_docente)
        ON DELETE CASCADE
);

-- 1.4 Entidad CARRERAS
CREATE TABLE Carreras (
    id_carrera VARCHAR(10) PRIMARY KEY,
    nombre_carrera VARCHAR(100) NOT NULL,
    duracion_semestres INT NOT NULL CHECK (duracion_semestres > 0),
    id_departamento INT NOT NULL,
    CONSTRAINT fk_carrera_departamento 
        FOREIGN KEY (id_departamento) REFERENCES Departamentos(id_departamento)
        ON DELETE RESTRICT
);

-- 1.5 Entidad ESTUDIANTES
CREATE TABLE Estudiantes (
    id_estudiante INT AUTO_INCREMENT PRIMARY KEY,
    curp_dni VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    correo_institucional VARCHAR(100) NOT NULL UNIQUE,
    fecha_nacimiento DATE NOT NULL,
    fecha_ingreso DATE NOT NULL DEFAULT (CURRENT_DATE),
    id_carrera VARCHAR(10) NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'Activo' 
        CHECK (estado IN ('Activo', 'Baja', 'Egresado')),
    CONSTRAINT fk_estudiante_carrera 
        FOREIGN KEY (id_carrera) REFERENCES Carreras(id_carrera)
        ON DELETE RESTRICT
);

-- 1.6 Entidad EXPEDIENTESMEDICOS (Relación 1:1 con Estudiantes)
CREATE TABLE ExpedientesMedicos (
    id_expediente INT AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT NOT NULL UNIQUE, -- Cardinalidad 1:1
    tipo_sangre VARCHAR(5) NOT NULL,
    alergias TEXT NULL,
    contacto_emergencia VARCHAR(100) NOT NULL,
    telefono_emergencia VARCHAR(20) NOT NULL,
    CONSTRAINT fk_expediente_estudiante 
        FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante)
        ON DELETE CASCADE
);

-- 1.7 Entidad MATERIAS (Incluye relación reflexiva de prerrequisitos)
CREATE TABLE Materias (
    id_materia INT AUTO_INCREMENT PRIMARY KEY,
    clave_materia VARCHAR(10) NOT NULL UNIQUE,
    nombre_materia VARCHAR(100) NOT NULL,
    creditos INT NOT NULL CHECK (creditos > 0 AND creditos <= 15),
    semestre_sugerido INT NOT NULL CHECK (semestre_sugerido BETWEEN 1 AND 12),
    -- Relación reflexiva: materia previa obligatoria
    id_materia_prerrequisito INT NULL,
    CONSTRAINT fk_materia_prerrequisito 
        FOREIGN KEY (id_materia_prerrequisito) REFERENCES Materias(id_materia)
        ON DELETE SET NULL
);

-- 1.8 Entidad AULAS
CREATE TABLE Aulas (
    id_aula INT AUTO_INCREMENT PRIMARY KEY,
    codigo_aula VARCHAR(15) NOT NULL UNIQUE,
    edificio VARCHAR(50) NOT NULL,
    capacidad INT NOT NULL CHECK (capacidad > 0),
    tipo_aula VARCHAR(30) NOT NULL DEFAULT 'Teorica' 
        CHECK (tipo_aula IN ('Teorica', 'Laboratorio', 'Auditorio'))
);

-- 1.9 Entidad CURSOS (Apertura de una materia en un periodo escolar)
CREATE TABLE Cursos (
    id_curso INT AUTO_INCREMENT PRIMARY KEY,
    id_materia INT NOT NULL,
    id_profesor INT NOT NULL,
    id_aula INT NULL, -- Opcional inicialmente
    periodo VARCHAR(15) NOT NULL,
    grupo VARCHAR(5) NOT NULL,
    cupo_maximo INT NOT NULL DEFAULT 35 CHECK (cupo_maximo > 0),
    -- Unicidad para evitar duplicar el mismo grupo de una materia en un periodo:
    CONSTRAINT uq_materia_periodo_grupo UNIQUE (id_materia, periodo, grupo),
    CONSTRAINT fk_curso_materia 
        FOREIGN KEY (id_materia) REFERENCES Materias(id_materia)
        ON DELETE RESTRICT,
    CONSTRAINT fk_curso_profesor 
        FOREIGN KEY (id_profesor) REFERENCES Docentes(id_docente)
        ON DELETE RESTRICT,
    CONSTRAINT fk_curso_aula 
        FOREIGN KEY (id_aula) REFERENCES Aulas(id_aula)
        ON DELETE SET NULL
);

-- 1.10 Entidad HORARIOS (Relación 1:N débil dependiente de Cursos)
CREATE TABLE Horarios (
    id_horario INT AUTO_INCREMENT PRIMARY KEY,
    id_curso INT NOT NULL,
    dia_semana VARCHAR(10) NOT NULL 
        CHECK (dia_semana IN ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado')),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    CONSTRAINT chk_rango_horas CHECK (hora_inicio < hora_fin),
    CONSTRAINT fk_horario_curso 
        FOREIGN KEY (id_curso) REFERENCES Cursos(id_curso)
        ON DELETE CASCADE
);

-- 1.11 Entidad MATRICULAS (Tabla Intermedia N:M entre Estudiante y Curso)
CREATE TABLE Matriculas (
    id_estudiante INT NOT NULL,
    id_curso INT NOT NULL,
    fecha_matricula DATE NOT NULL DEFAULT (CURRENT_DATE),
    estado_matricula VARCHAR(15) NOT NULL DEFAULT 'Inscrita' 
        CHECK (estado_matricula IN ('Inscrita', 'Baja', 'Completada')),
    -- Llave primaria compuesta:
    PRIMARY KEY (id_estudiante, id_curso),
    CONSTRAINT fk_mat_estudiante 
        FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante)
        ON DELETE CASCADE,
    CONSTRAINT fk_mat_curso 
        FOREIGN KEY (id_curso) REFERENCES Cursos(id_curso)
        ON DELETE RESTRICT
);

-- 1.12 Entidad CALIFICACIONES
CREATE TABLE Calificaciones (
    id_calificacion INT AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT NOT NULL,
    id_curso INT NOT NULL,
    folio_evaluacion VARCHAR(30) NOT NULL UNIQUE,
    nota DECIMAL(4,2) NOT NULL CHECK (nota >= 0.00 AND nota <= 10.00),
    tipo_evaluacion VARCHAR(20) NOT NULL DEFAULT 'Ordinario' 
        CHECK (tipo_evaluacion IN ('Ordinario', 'Extraordinario', 'Titulo')),
    fecha_registro DATE NOT NULL DEFAULT (CURRENT_DATE),
    -- Garantiza que solo se califique a estudiantes debidamente matriculados en el curso:
    CONSTRAINT fk_calif_matricula 
        FOREIGN KEY (id_estudiante, id_curso) REFERENCES Matriculas(id_estudiante, id_curso)
        ON DELETE CASCADE
);

-- 1.13 Entidad PRESTAMOSBIBLIOTECA (Demuestra Integridad Referencial RESTRICT)
CREATE TABLE PrestamosBiblioteca (
    id_prestamo INT AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT NOT NULL,
    titulo_libro VARCHAR(150) NOT NULL,
    fecha_prestamo DATE NOT NULL DEFAULT (CURRENT_DATE),
    fecha_limite_devolucion DATE NOT NULL,
    devuelto BOOLEAN NOT NULL DEFAULT FALSE,
    -- Impide que la universidad elimine a un estudiante si este tiene préstamos pendientes:
    CONSTRAINT fk_prestamo_estudiante 
        FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante)
        ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- 2. POBLADO DE DATOS DE PRUEBA (DML)
-- -----------------------------------------------------------------------------

-- Departamentos
INSERT INTO Departamentos (nombre_departamento, edificio) VALUES
('Ciencias Computacionales', 'Edificio Alpha'),
('Ciencias Básicas', 'Edificio Gamma'),
('Ingeniería Industrial', 'Edificio Beta');

-- Docentes (Coordinadores primero para resolver la FK reflexiva)
INSERT INTO Docentes (nombre, apellido, correo, especialidad, id_departamento, id_coordinador) VALUES
('Alejandro', 'Morales', 'alejandro.morales@universidad.edu', 'Bases de Datos y Arquitectura', 1, NULL),
('Beatriz', 'Hernández', 'beatriz.hernandez@universidad.edu', 'Matemáticas Discretas', 2, NULL);

-- Docentes subordinados a coordinadores
INSERT INTO Docentes (nombre, apellido, correo, especialidad, id_departamento, id_coordinador) VALUES
('Carlos', 'López', 'carlos.lopez@universidad.edu', 'Sistemas Operativos', 1, 1),
('Diana', 'Torres', 'diana.torres@universidad.edu', 'Cálculo Diferencial e Integral', 2, 2),
('Eduardo', 'Ramírez', 'eduardo.ramirez@universidad.edu', 'Optimizacion de Procesos', 3, NULL);

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

-- Materias (Con jerarquía de prerrequisitos)
-- Materias base sin prerrequisito
INSERT INTO Materias (clave_materia, nombre_materia, creditos, semestre_sugerido, id_materia_prerrequisito) VALUES
('CAL-101', 'Cálculo Diferencial', 8, 1, NULL),
('PRG-101', 'Fundamentos de Programación', 8, 1, NULL),
('EST-101', 'Estadística General', 6, 2, NULL);

-- Materias avanzadas que apuntan a sus prerrequisitos
INSERT INTO Materias (clave_materia, nombre_materia, creditos, semestre_sugerido, id_materia_prerrequisito) VALUES
('CAL-102', 'Cálculo Integral', 8, 2, 1),      -- Requiere Cálculo Diferencial (ID 1)
('BDA-201', 'Bases de Datos Relacionales', 8, 3, 2), -- Requiere Programación (ID 2)
('BDA-202', 'Bases de Datos Avanzadas', 8, 4, 5);    -- Requiere Bases de Datos Relacionales (ID 5)

-- Aulas
INSERT INTO Aulas (codigo_aula, edificio, capacidad, tipo_aula) VALUES
('A-101', 'Edificio Alpha', 40, 'Teorica'),
('LAB-REDES', 'Edificio Alpha', 25, 'Laboratorio'),
('B-201', 'Edificio Beta', 35, 'Teorica');

-- Cursos (Periodo 2026-B)
INSERT INTO Cursos (id_materia, id_profesor, id_aula, periodo, grupo, cupo_maximo) VALUES
(1, 4, 1, '2026-B', 'G1', 35), -- Cálculo Diferencial dictada por Diana Torres en Aula A-101
(2, 3, 2, '2026-B', 'G1', 25), -- Programación dictada por Carlos López en LAB-REDES
(5, 1, 2, '2026-B', 'G1', 25); -- Bases de Datos Relacionales dictada por Alejandro Morales

-- Horarios asignados a Cursos
INSERT INTO Horarios (id_curso, dia_semana, hora_inicio, hora_fin) VALUES
(1, 'Lunes', '07:00:00', '09:00:00'),
(1, 'Miercoles', '07:00:00', '09:00:00'),
(2, 'Martes', '09:00:00', '11:00:00'),
(2, 'Jueves', '09:00:00', '11:00:00'),
(3, 'Lunes', '11:00:00', '13:00:00'),
(3, 'Viernes', '11:00:00', '13:00:00');

-- Matrículas (Estudiantes inscritos en cursos)
INSERT INTO Matriculas (id_estudiante, id_curso, fecha_matricula, estado_matricula) VALUES
(1, 1, '2026-08-18', 'Inscrita'),
(1, 2, '2026-08-18', 'Inscrita'),
(2, 1, '2026-08-19', 'Inscrita'),
(2, 2, '2026-08-19', 'Inscrita'),
(4, 3, '2026-08-20', 'Inscrita');

-- Calificaciones registradas
INSERT INTO Calificaciones (id_estudiante, id_curso, folio_evaluacion, nota, tipo_evaluacion) VALUES
(1, 1, 'FOL-2026-001', 9.50, 'Ordinario'),
(1, 2, 'FOL-2026-002', 8.80, 'Ordinario'),
(2, 1, 'FOL-2026-003', 7.20, 'Ordinario'),
(4, 3, 'FOL-2026-004', 10.00, 'Ordinario');

-- Préstamos en Biblioteca
INSERT INTO PrestamosBiblioteca (id_estudiante, titulo_libro, fecha_prestamo, fecha_limite_devolucion, devuelto) VALUES
(1, 'Fundamentos de Bases de Datos - Silberschatz', '2026-09-01', '2026-09-15', TRUE),
(2, 'Calculus - James Stewart', '2026-09-10', '2026-10-01', FALSE);

-- -----------------------------------------------------------------------------
-- 3. CONSULTAS SQL DEMOSTRATIVAS (DQL)
-- -----------------------------------------------------------------------------

-- CONSULTA 1: Lista detallada de estudiantes con su carrera, curso, docente y aula asignada
-- Demuestra el uso coordinado de múltiples INNER JOIN
SELECT 
    e.id_estudiante AS Matricula,
    CONCAT(e.nombre, ' ', e.apellido) AS Estudiante,
    c.nombre_carrera AS Carrera,
    m.nombre_materia AS Asignatura,
    cur.grupo AS Grupo,
    CONCAT(d.nombre, ' ', d.apellido) AS Docente,
    COALESCE(a.codigo_aula, 'Por definir') AS Aula
FROM Estudiantes e
INNER JOIN Carreras c ON e.id_carrera = c.id_carrera
INNER JOIN Matriculas mat ON e.id_estudiante = mat.id_estudiante
INNER JOIN Cursos cur ON mat.id_curso = cur.id_curso
INNER JOIN Materias m ON cur.id_materia = m.id_materia
INNER JOIN Docentes d ON cur.id_profesor = d.id_docente
LEFT JOIN Aulas a ON cur.id_aula = a.id_aula
ORDER BY c.nombre_carrera, m.nombre_materia, e.apellido;

-- CONSULTA 2: Malla curricular con prerrequisitos académicos
-- Demuestra el funcionamiento de una relación reflexiva con LEFT SELF-JOIN
SELECT 
    m.clave_materia AS Clave,
    m.nombre_materia AS Materia,
    m.semestre_sugerido AS Semestre,
    m.creditos AS Creditos,
    COALESCE(pre.nombre_materia, 'Sin Prerrequisito') AS Requisito_Previo
FROM Materias m
LEFT JOIN Materias pre ON m.id_materia_prerrequisito = pre.id_materia
ORDER BY m.semestre_sugerido, m.clave_materia;

-- CONSULTA 3: Promedio de notas y cantidad de alumnos por curso
-- Demuestra agregaciones matemáticas (AVG, MIN, MAX, COUNT) y agrupamiento GROUP BY
SELECT 
    cur.id_curso,
    m.nombre_materia,
    cur.grupo,
    CONCAT(d.nombre, ' ', d.apellido) AS Docente,
    COUNT(cal.id_calificacion) AS Alumnos_Evaluados,
    ROUND(AVG(cal.nota), 2) AS Promedio_General,
    MIN(cal.nota) AS Calificacion_Minima,
    MAX(cal.nota) AS Calificacion_Maxima
FROM Cursos cur
INNER JOIN Materias m ON cur.id_materia = m.id_materia
INNER JOIN Docentes d ON cur.id_profesor = d.id_docente
LEFT JOIN Calificaciones cal ON cur.id_curso = cal.id_curso
GROUP BY cur.id_curso, m.nombre_materia, cur.grupo, d.nombre, d.apellido;

-- CONSULTA 4: Detección de profesores sin cursos activos asignados en el periodo actual
-- Demuestra el uso de LEFT JOIN con prueba de nulidad (IS NULL)
SELECT 
    d.id_docente,
    CONCAT(d.nombre, ' ', d.apellido) AS Docente,
    dep.nombre_departamento AS Departamento
FROM Docentes d
INNER JOIN Departamentos dep ON d.id_departamento = dep.id_departamento
LEFT JOIN Cursos c ON d.id_docente = c.id_profesor
WHERE c.id_curso IS NULL;

-- CONSULTA 5: Auditoría de Préstamos de Biblioteca y Alumnos con Adeudos
-- Demuestra por qué aplica la restricción ON DELETE RESTRICT
SELECT 
    e.id_estudiante,
    CONCAT(e.nombre, ' ', e.apellido) AS Estudiante,
    pb.titulo_libro,
    pb.fecha_limite_devolucion,
    CASE 
        WHEN pb.devuelto = TRUE THEN 'Devuelto a tiempo'
        ELSE 'PENDIENTE DE DEVOLUCIÓN (Bloquea baja escolar)'
    END AS Estatus_Adeudo
FROM Estudiantes e
INNER JOIN PrestamosBiblioteca pb ON e.id_estudiante = pb.id_estudiante
WHERE pb.devuelto = FALSE;
