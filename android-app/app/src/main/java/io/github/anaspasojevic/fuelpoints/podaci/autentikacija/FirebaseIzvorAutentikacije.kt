package io.github.anaspasojevic.fuelpoints.podaci.autentikacija

import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.auth.userProfileChangeRequest
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.tasks.await
import java.io.IOException

class FirebaseIzvorAutentikacije(private val auth: FirebaseAuth) : IzvorAutentikacije {

    override fun trenutniUid(): String? = auth.currentUser?.uid

    override fun imeIzProfila(): String? = auth.currentUser?.displayName

    override fun posmatrajSesiju(): Flow<String?> = callbackFlow {
        val slusalac = FirebaseAuth.AuthStateListener { trySend(it.currentUser?.uid) }
        auth.addAuthStateListener(slusalac)
        awaitClose { auth.removeAuthStateListener(slusalac) }
    }.distinctUntilChanged()

    override suspend fun prijavi(email: String, lozinka: String) =
        izvrsi { auth.signInWithEmailAndPassword(email, lozinka).await() }

    override suspend fun registruj(email: String, lozinka: String) =
        izvrsi { auth.createUserWithEmailAndPassword(email, lozinka).await() }

    override suspend fun postaviIme(displayName: String): IshodAutentikacije {
        val korisnik = auth.currentUser ?: return IshodAutentikacije.NepoznataGreska
        return izvrsi { korisnik.updateProfile(userProfileChangeRequest { this.displayName = displayName }).await() }
    }

    override suspend fun posaljiReset(email: String) =
        izvrsi { auth.sendPasswordResetEmail(email).await() }

    override fun email(): String? = auth.currentUser?.email

    override fun odjavi() = auth.signOut()

    override suspend fun potvrdiLozinku(lozinka: String): IshodAutentikacije {
        val korisnik = auth.currentUser ?: return IshodAutentikacije.NepoznataGreska
        val email = korisnik.email ?: return IshodAutentikacije.NepoznataGreska
        return izvrsi { korisnik.reauthenticate(EmailAuthProvider.getCredential(email, lozinka)).await() }
    }

    override suspend fun promijeniLozinku(novaLozinka: String): IshodAutentikacije {
        val korisnik = auth.currentUser ?: return IshodAutentikacije.NepoznataGreska
        return izvrsi { korisnik.updatePassword(novaLozinka).await() }
    }

    override suspend fun dobaviToken(osvjezi: Boolean): String? {
        val korisnik = auth.currentUser ?: return null
        return try {
            // osvjezi = false: SDK sam osvježava token pred istek.
            korisnik.getIdToken(osvjezi).await().token
        } catch (_: FirebaseNetworkException) {
            throw IOException()
        } catch (_: Exception) {
            null
        }
    }

    private suspend fun izvrsi(akcija: suspend () -> Unit): IshodAutentikacije = try {
        akcija()
        IshodAutentikacije.Uspjeh
    } catch (izuzetak: Exception) {
        mapiraj(izuzetak)
    }

    // Redoslijed je bitan: FirebaseAuthWeakPasswordException je podklasa FirebaseAuthInvalidCredentialsException.
    private fun mapiraj(izuzetak: Exception): IshodAutentikacije = when (izuzetak) {
        is FirebaseNetworkException -> IshodAutentikacije.MreznaGreska
        is FirebaseAuthWeakPasswordException -> IshodAutentikacije.SlabaLozinka
        is FirebaseAuthUserCollisionException -> IshodAutentikacije.EmailZauzet
        is FirebaseAuthInvalidUserException ->
            if (izuzetak.errorCode == "ERROR_USER_DISABLED") IshodAutentikacije.OnemogucenKorisnik
            else IshodAutentikacije.NepostojeciKorisnik
        is FirebaseAuthInvalidCredentialsException ->
            if (izuzetak.errorCode == "ERROR_INVALID_EMAIL") IshodAutentikacije.NeispravanEmail
            else IshodAutentikacije.NeispravnaLozinka
        is FirebaseTooManyRequestsException -> IshodAutentikacije.PrevisePokusaja
        else -> IshodAutentikacije.NepoznataGreska
    }
}
