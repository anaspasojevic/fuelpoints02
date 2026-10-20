import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "io.github.anaspasojevic.fuelpoints"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.anaspasojevic.fuelpoints"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Firebase se inicijalizuje u kodu, bez google-services.json (O-39). Vrijednosti važe za demo projekat
        // i emulator, koji ključ ne provjerava; nisu tajne.
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"demo-fuelpoints\"")
        buildConfigField("String", "FIREBASE_APPLICATION_ID", "\"1:000000000000:android:0000000000000000\"")
        buildConfigField("String", "FIREBASE_API_KEY", "\"demo-api-key\"")
        // Aktuelna verzija uslova korišćenja (AUTH-10, O-11).
        buildConfigField("String", "VERZIJA_USLOVA", "\"1.0\"")
    }

    buildTypes {
        debug {
            // Lokalni Firebase Emulator Suite i Backend; 10.0.2.2 je loopback računara viđen sa Android emulatora (O-39, O-40).
            buildConfigField("boolean", "KORISTI_EMULATOR", "true")
            buildConfigField("String", "EMULATOR_HOST", "\"10.0.2.2\"")
            buildConfigField("int", "PORT_AUTH", "9099")
            buildConfigField("int", "PORT_FIRESTORE", "8080")
            buildConfigField("String", "BACKEND_BAZNI_URL", "\"http://10.0.2.2:3000/api/v1/\"")
        }
        release {
            // Konfiguracija pravog projekta dolazi iz lokalnog fajla van repozitorijuma (O-2, i09/P-7).
            buildConfigField("boolean", "KORISTI_EMULATOR", "false")
            buildConfigField("String", "EMULATOR_HOST", "\"\"")
            buildConfigField("int", "PORT_AUTH", "0")
            buildConfigField("int", "PORT_FIRESTORE", "0")
            buildConfigField("String", "BACKEND_BAZNI_URL", "\"\"")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_11)
    }
}

dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.okhttp)
    implementation(libs.zxing.core)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}
