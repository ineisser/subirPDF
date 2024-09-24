// app.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ConvPDFtoText_HL, addTextToCostos_HL } = require('./pdfConv');

// Crear una instancia de Express
const app = express();

// Crear la carpeta "temporal" si no existe
const TEMP_DIR = 'temporal';
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Configurar Multer para almacenar archivos en la carpeta "temporal"
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // Limitar a 10MB para evitar archivos grandes
});

// Middleware de manejo de errores de Multer
function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    // Errores específicos de Multer (como límite de tamaño)
    return res.status(400).json({ error: err.message });
  } else if (err) {
    // Otros errores
    return res.status(500).json({ error: err.message });
  }
  next();
}

// Ruta para recibir el archivo PDF y convertirlo a texto
app.post('/upload', upload.single('pdf'), multerErrorHandler, async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No se ha subido ningún archivo.');
  }

  const filePath = path.join(TEMP_DIR, req.file.filename);

  try {
    const textResult = await ConvPDFtoText_HL(filePath);
    console.log("filePath:", filePath, "----------");
    console.log("req.file.filename :", req.file.filename, "----------");
    console.log(textResult);
    let costos = await addTextToCostos_HL(textResult, req.file.filename);
    console.log("costos", costos);

    // Eliminar archivo temporal
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error al eliminar el archivo temporal', err);
    });

    res.json({
      message: 'Archivo subido y procesado exitosamente.',
      extractedText: textResult,
      costos,
    });
  } catch (error) {
    console.log(error);

    // Eliminar archivo temporal si ocurre un error
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error al eliminar el archivo temporal', err);
    });

    res.status(500).send('Error al procesar el archivo PDF.');
  }
});

// Configurar el puerto del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
