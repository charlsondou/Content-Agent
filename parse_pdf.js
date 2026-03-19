const fs = require('fs');
const PDFParser = require('pdf2json');

// 取得命令列參數作為輸入與輸出路徑，若無則使用預設值
const inputPdfPath = process.argv[2] || './input.pdf';
const outputMdPath = process.argv[3] || './output.md';

const pdfParser = new PDFParser(this, 1);

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError));
pdfParser.on('pdfParser_dataReady', pdfData => {
    try {
        fs.writeFileSync(outputMdPath, pdfParser.getRawTextContent());
        console.log(`Successfully extracted text to ${outputMdPath}.`);
    } catch (err) {
        console.error(`Error writing to ${outputMdPath}:`, err.message);
    }
});

try {
    console.log(`Loading PDF from ${inputPdfPath}...`);
    pdfParser.loadPDF(inputPdfPath);
} catch (err) {
    console.error(`Error loading PDF from ${inputPdfPath}:`, err.message);
}
