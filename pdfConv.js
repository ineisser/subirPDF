// pdfConverter.js
const fs = require('fs');
const pdf = require('pdf-parse');

// Función para convertir PDF a texto con formateo específico
async function ConvPDFtoText_HL(pdfPath) {
    let dataBuffer = fs.readFileSync(pdfPath);
    try {
        let data = await pdf(dataBuffer);
        let text = data.text;

        // Agregar espacio entre letras y números
        text = text.replace(/([a-zA-Z]+)(\d+)/g, '$1 $2');
        text = text.replace(/(\d+)([a-zA-Z]+)/g, '$1 $2');

        // Formatear números y otros patrones
        text = text.split('\n').map(line => {
            return line.replace(/(USD \d+)(\d{3})(\d{3})/g, '$1 $2 $3');
        }).join('\n');
        text = text.split('\n').map(line => {
            return line.replace(/(USD \d+)(\d{2})(\d{2})/g, '$1 $2 $3');
        }).join('\n');
        text = text.split('\n').map(line => {
            return line.replace(/(Curr.\d+)(\d{2})(\d{2})/g, '$1 $2 $3');
        }).join('\n');

        let textF = [];
        let Quiebre = "";
        let lineas = text.split('\n');
        lineas.forEach((line, i) => {
            let tx = "";
            if (line.indexOf("Marine Fuel Recovery included in container charges:") >= 0) {
                let [nom, , v1, , v2, , v3] = line.replace(/ USD/g, '').replace(/,/g, ':').replace(/: /g, ':').split(':');
                let valores = "USD " + v1 + ' ' + v3 + ' ' + v2;
                tx = "* " + nom + "=" + valores;
            } else if (line.indexOf('USD') >= 0) {
                tx = "* " + lineas[i - 1] + '|' + Quiebre + "=" + line.replace(/(USD \d+)(\d{2})(\d{2})/g, '$1 $2 $3');
            } else if (line.indexOf("Quotation Document") >= 0) {
                tx = "* Emision=" + convertDateLarge(lineas[i - 1]);
            } else if (line.indexOf("Valid from") >= 0) {
                tx = "* " + line + "=" + convertDate(lineas[i + 1]);
            } else if (line.indexOf("Valid to") >= 0) {
                tx = "* " + line + "=" + convertDate(lineas[i + 1]);
            } else if (line.indexOf("From") >= 0) {
                tx = "* " + line + "=" + lineas[i + 1];
            } else if (line.indexOf("Curr.20") >= 0) {
                let NewQuiebre = line.replace('Curr.20', '|').split('|')[0];
                Quiebre = NewQuiebre;
            } else if (line.trim() === "To") {
                tx = "* " + line + "=" + lineas[i + 1];
            } else if (line.indexOf("Estimated Transportation Days") >= 0) {
                tx = "* " + line + "=" + lineas[i + 1];
            } else if (line.indexOf("Offer expires on:") >= 0) {
                let [nom, fecexp] = line.split(":");
                tx = "* " + nom + "=" + convertDateLarge(fecexp.trim());
            }
            if (tx !== "") textF.push(tx);
        });

        return textF.join('\n');
    } catch (error) {
        console.error('Error al convertir PDF a texto:', error);
        throw error;
    }
}

// Funciones auxiliares para formatear fechas
function convertDateLarge(dateStr) {
    const months = {
        January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
        July: '07', August: '08', September: '09', October: '10', November: '11', December: '12'
    };
    const cleanedDateStr = dateStr.replace(/(\d+)\s?(st|nd|rd|th)/g, '$1');
    const [month, day, year] = cleanedDateStr.split(' ');
    const monthNum = months[month];
    const dayNum = day.padStart(2, '0');
    return `${year}-${monthNum}-${dayNum}`;
};


function convertDate(dateStr) {
    const months = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04',
        May: '05', Jun: '06', Jul: '07', Aug: '08',
        Sep: '09', Sept: '09', Oct: '10', Nov: '11', Dec: '12',
    };

    const dateString = dateStr.trim();
    const [day, month, year] = dateString.split(' ');
    const monthNum = months[month];
    const fullYear = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
    return `${fullYear}-${monthNum}-${day.padStart(2, '0')}`;
};

async function addTextToCostos_HL(text, nombrePDF) {
    let costos = [];
    let cabecera = {}, detalles = [];
    let lineas = text.split('\n');
    lineas.forEach((line) => {
      let [nom, text] = line.split("=");
      if (line.indexOf('USD') >= 0) {
          console.log("nom",nom);
  
        let [concepto, grupo] = nom.replace('* ', '').split('|');
        let cols = text.replace('USD ', '').replace(/-/g, ' -').split(' ');
        detalles.push({ concepto, cols, grupo });
      } else if (line.indexOf("Emision") >= 0) {
        cabecera['Emision'] = text;
      } else if (line.indexOf("Valid from") >= 0) {
        cabecera['ValidoDesde'] = text;
      } else if (line.indexOf("Valid to") >= 0) {
        cabecera['ValidoHasta'] = text;
      } else if (line.indexOf("From=") >= 0) {
        cabecera['POL'] = text;
      } else if (line.indexOf("To=") >= 0) {
        cabecera['POD'] = text;
      } else if (line.indexOf("Estimated Transportation Days") >= 0) {
        cabecera['TransitoDias'] = text;
      } else if (line.indexOf("Offer expires on") >= 0) {
        cabecera['Vigencia'] = text;
      }
    });
    // console.log(cabecera);
    // console.log(detalles);
    let typecontenedores = ['20', '40', '40HC'];
    for (i = 0; i <= 2; i++) {
      let rcosto = { ...cabecera, TypeContenedor: typecontenedores[i], nombrePDF }
      let tmpruta = nombrePDF.split('.')[0].split('_');
      rcosto.ruta = tmpruta[2] + "_" + tmpruta[3];
      rcosto.Cotizacion = tmpruta[1];
      rcosto.Linea = "Hapag Lloyd";
      rcosto.detalles = [];
      detalles.forEach(({ concepto, cols, grupo }) => {
        let costo = isNaN(cols[i]) ? cols[i] : (+cols[i]);
        rcosto.detalles.push({ concepto, costo, grupo });
        console.log(concepto, costo, grupo);
      })
      costos.push(rcosto);
      // console.log(rcosto.detalles);
      // console.log("---detalles---");
    };
    return costos;
  }

module.exports = { ConvPDFtoText_HL,addTextToCostos_HL};
