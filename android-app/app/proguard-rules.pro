# R8 pravila za release (i11/K4, NFR-07, ODLUKE i09/K-3).
# Firebase Auth SDK loguje e-mail (Log.i) i UID (Log.d); -assumenosideeffects uklanja pozive Log.v/d/i
# iz cijelog koda, uključujući biblioteke. Log.w i Log.e ostaju (greške su dijagnostički vidljive).
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
