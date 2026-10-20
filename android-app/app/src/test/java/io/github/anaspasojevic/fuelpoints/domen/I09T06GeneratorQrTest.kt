package io.github.anaspasojevic.fuelpoints.domen

import com.google.zxing.BinaryBitmap
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.BitMatrix
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import org.junit.Assert.assertEquals
import org.junit.Test

// I09-T06 (a) (QR-01, QR-02, AC-04, §2.6): QR generisan lokalno sadrži TAČNO UID — dekodiranje ZXing-om.
class I09T06GeneratorQrTest {

    private fun dekodiraj(matrica: BitMatrix): String {
        val pikseli = IntArray(matrica.width * matrica.height) { i ->
            if (matrica.get(i % matrica.width, i / matrica.width)) 0xFF000000.toInt() else 0xFFFFFFFF.toInt()
        }
        val izvor = RGBLuminanceSource(matrica.width, matrica.height, pikseli)
        return QRCodeReader().decode(BinaryBitmap(HybridBinarizer(izvor))).text
    }

    @Test
    fun `I09-T06 tipican Firebase UID od 28 znakova`() {
        val uid = "kX9fQ2mT7bWc4rLpA1sD3fG5hJ6k"
        assertEquals(28, uid.length)
        assertEquals(uid, dekodiraj(napraviQr(uid)))
    }

    @Test
    fun `I09-T06 UID od 1 i 128 znakova`() {
        assertEquals("a", dekodiraj(napraviQr("a")))
        val dug = (1..128).map { "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[it % 62] }.joinToString("")
        assertEquals(dug, dekodiraj(napraviQr(dug)))
    }
}
