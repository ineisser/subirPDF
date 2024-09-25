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
  limits: { fileSize: 10 * 1024 * 1024 } // Limitar a 10MB por archivo
});

// Middleware de manejo de errores de Multer
function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(500).json({ error: err.message });
  }
  next();
}

// Ruta para recibir múltiples archivos PDF y convertirlos a texto
app.post('/upload', upload.array('pdfs', 10), multerErrorHandler, async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No se han subido archivos.');
  }

  const results = [];

  // Procesar cada archivo PDF
  try {
    for (const file of req.files) {
      const filePath = path.join(TEMP_DIR, file.filename);
      const textResult = await ConvPDFtoText_HL(filePath);
      const costos = await addTextToCostos_HL(textResult, file.filename);

      // Agregar el resultado al array
      results.push({ filename: file.filename, extractedText: textResult, costos });

      // Eliminar archivo temporal
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error al eliminar el archivo temporal', err);
      });
    }

    // Enviar todos los resultados
    res.json({
      message: 'Archivos subidos y procesados exitosamente.',
      results
    });
  } catch (error) {
    console.log(error);

    // Eliminar archivos temporales si ocurre un error
    req.files.forEach((file) => {
      const filePath = path.join(TEMP_DIR, file.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error al eliminar el archivo temporal', err);
      });
    });

    res.status(500).send('Error al procesar los archivos PDF.');
  }
});

// Configurar el puerto del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
