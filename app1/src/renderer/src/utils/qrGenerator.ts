import QRCode from 'qrcode';

/**
 * Standard QRCode generator creating a boolean matrix
 */
export function generateQRMatrix(text: string): boolean[][] {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const matrix: boolean[][] = [];

    for (let r = 0; r < size; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < size; c++) {
        row.push(data[r * size + c] === 1);
      }
      matrix.push(row);
    }
    return matrix;
  } catch (err) {
    console.error('QRCode generation failed:', err);
    return [];
  }
}
