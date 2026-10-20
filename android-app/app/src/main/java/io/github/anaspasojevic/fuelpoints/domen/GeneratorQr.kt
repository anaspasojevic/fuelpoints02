package io.github.anaspasojevic.fuelpoints.domen

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

// QR-01, QR-02, AC-04, §2.6: QR se generiše lokalno; sadržaj je tačno ono što se preda (UID), bez prefiksa i drugih podataka.
fun napraviQr(sadrzaj: String, velicina: Int = 512): BitMatrix = QRCodeWriter().encode(
    sadrzaj,
    BarcodeFormat.QR_CODE,
    velicina,
    velicina,
    mapOf(
        EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
        EncodeHintType.MARGIN to 1,
        EncodeHintType.CHARACTER_SET to "UTF-8",
    ),
)
