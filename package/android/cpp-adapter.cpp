#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include "HybridDuckDB.hpp"
#include "RNDuckDBOnLoad.hpp"

using namespace margelo::nitro::rnduckdb;

static void initDocPath(JNIEnv* env) {
    // Get application context via ActivityThread.currentApplication()
    jclass activityThread = env->FindClass("android/app/ActivityThread");
    if (!activityThread) { env->ExceptionClear(); return; }

    jmethodID currentApp = env->GetStaticMethodID(
        activityThread, "currentApplication", "()Landroid/app/Application;");
    if (!currentApp) { env->ExceptionClear(); return; }

    jobject app = env->CallStaticObjectMethod(activityThread, currentApp);
    if (!app) { env->ExceptionClear(); return; }

    // Call context.getFilesDir()
    jclass contextClass = env->GetObjectClass(app);
    jmethodID getFilesDir = env->GetMethodID(contextClass, "getFilesDir", "()Ljava/io/File;");
    jobject filesDir = env->CallObjectMethod(app, getFilesDir);
    if (!filesDir) { env->ExceptionClear(); return; }

    // Call file.getAbsolutePath()
    jclass fileClass = env->GetObjectClass(filesDir);
    jmethodID getAbsPath = env->GetMethodID(fileClass, "getAbsolutePath", "()Ljava/lang/String;");
    auto pathStr = (jstring)env->CallObjectMethod(filesDir, getAbsPath);

    const char* nativePath = env->GetStringUTFChars(pathStr, nullptr);
    HybridDuckDB::docPath = std::string(nativePath);
    env->ReleaseStringUTFChars(pathStr, nativePath);

    env->DeleteLocalRef(pathStr);
    env->DeleteLocalRef(filesDir);
    env->DeleteLocalRef(fileClass);
    env->DeleteLocalRef(contextClass);
    env->DeleteLocalRef(app);
    env->DeleteLocalRef(activityThread);
}

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    jint result = margelo::nitro::rnduckdb::initialize(vm);
    JNIEnv* env;
    if (vm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) == JNI_OK) {
        initDocPath(env);
    }
    return result;
}

extern "C"
JNIEXPORT void JNICALL
Java_com_rnduckdb_DocPathSetter_setDocPathInJNI(JNIEnv *env, jclass clazz,
                                                 jstring doc_path) {
  const char *nativeString = env->GetStringUTFChars(doc_path, nullptr);
  HybridDuckDB::docPath = std::string(nativeString);
  env->ReleaseStringUTFChars(doc_path, nativeString);
}
