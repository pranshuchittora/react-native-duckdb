#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include "HybridDuckDB.hpp"
#include "RNDuckDBOnLoad.hpp"

using namespace margelo::nitro::rnduckdb;

static std::string getAbsolutePathFromFile(JNIEnv* env, jobject file) {
    if (!file) return "";
    jclass fileClass = env->GetObjectClass(file);
    jmethodID getAbsPath = env->GetMethodID(fileClass, "getAbsolutePath", "()Ljava/lang/String;");
    auto pathStr = (jstring)env->CallObjectMethod(file, getAbsPath);
    const char* nativePath = env->GetStringUTFChars(pathStr, nullptr);
    std::string result(nativePath);
    env->ReleaseStringUTFChars(pathStr, nativePath);
    env->DeleteLocalRef(pathStr);
    env->DeleteLocalRef(fileClass);
    return result;
}

static void initDocPath(JNIEnv* env) {
    // Get application context via ActivityThread.currentApplication()
    jclass activityThread = env->FindClass("android/app/ActivityThread");
    if (!activityThread) { env->ExceptionClear(); return; }

    jmethodID currentApp = env->GetStaticMethodID(
        activityThread, "currentApplication", "()Landroid/app/Application;");
    if (!currentApp) { env->ExceptionClear(); return; }

    jobject app = env->CallStaticObjectMethod(activityThread, currentApp);
    if (!app) { env->ExceptionClear(); return; }

    jclass contextClass = env->GetObjectClass(app);

    // getFilesDir()
    jmethodID getFilesDir = env->GetMethodID(contextClass, "getFilesDir", "()Ljava/io/File;");
    jobject filesDir = env->CallObjectMethod(app, getFilesDir);
    std::string filesPath = getAbsolutePathFromFile(env, filesDir);

    HybridDuckDB::docPath = filesPath;
    HybridDuckDB::documentsDir = filesPath;
    HybridDuckDB::libraryDir = filesPath;

    // getDatabasePath("x") → get parent to find the databases directory
    // Note: getDatabasePath("") crashes on Android (charAt(0) on empty string)
    jmethodID getDbPath = env->GetMethodID(contextClass, "getDatabasePath", "(Ljava/lang/String;)Ljava/io/File;");
    jstring dummyName = env->NewStringUTF("x");
    jobject dbPathFile = env->CallObjectMethod(app, getDbPath, dummyName);
    if (dbPathFile) {
        jclass fileClass = env->GetObjectClass(dbPathFile);
        jmethodID getParent = env->GetMethodID(fileClass, "getParent", "()Ljava/lang/String;");
        auto parentStr = (jstring)env->CallObjectMethod(dbPathFile, getParent);
        if (parentStr) {
            const char* parentNative = env->GetStringUTFChars(parentStr, nullptr);
            HybridDuckDB::databaseDir = std::string(parentNative);
            env->ReleaseStringUTFChars(parentStr, parentNative);
            env->DeleteLocalRef(parentStr);
        }
        env->DeleteLocalRef(fileClass);
        env->DeleteLocalRef(dbPathFile);
    }
    env->DeleteLocalRef(dummyName);

    // getExternalFilesDir(null) — may return null
    jmethodID getExtDir = env->GetMethodID(contextClass, "getExternalFilesDir", "(Ljava/lang/String;)Ljava/io/File;");
    jobject extDir = env->CallObjectMethod(app, getExtDir, (jobject)nullptr);
    HybridDuckDB::externalDir = getAbsolutePathFromFile(env, extDir);

    if (filesDir) env->DeleteLocalRef(filesDir);
    if (extDir) env->DeleteLocalRef(extDir);
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
  std::string path(nativeString);
  HybridDuckDB::docPath = path;
  HybridDuckDB::documentsDir = path;
  HybridDuckDB::libraryDir = path;
  env->ReleaseStringUTFChars(doc_path, nativeString);
}

extern "C"
JNIEXPORT void JNICALL
Java_com_rnduckdb_DocPathSetter_setAllPathsInJNI(JNIEnv *env, jclass clazz,
                                                  jstring doc_path, jstring db_path, jstring ext_path) {
  const char *docStr = env->GetStringUTFChars(doc_path, nullptr);
  std::string docPathVal(docStr);
  HybridDuckDB::docPath = docPathVal;
  HybridDuckDB::documentsDir = docPathVal;
  HybridDuckDB::libraryDir = docPathVal;
  env->ReleaseStringUTFChars(doc_path, docStr);

  const char *dbStr = env->GetStringUTFChars(db_path, nullptr);
  HybridDuckDB::databaseDir = std::string(dbStr);
  env->ReleaseStringUTFChars(db_path, dbStr);

  const char *extStr = env->GetStringUTFChars(ext_path, nullptr);
  HybridDuckDB::externalDir = std::string(extStr);
  env->ReleaseStringUTFChars(ext_path, extStr);
}
