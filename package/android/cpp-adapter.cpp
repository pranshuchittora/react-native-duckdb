#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include "HybridDuckDB.hpp"
#include "RNDuckDBOnLoad.hpp"

using namespace margelo::nitro::rnduckdb;

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    return margelo::nitro::rnduckdb::initialize(vm);
}

extern "C"
JNIEXPORT void JNICALL
Java_com_rnduckdb_DocPathSetter_setDocPathInJNI(JNIEnv *env, jclass clazz,
                                                 jstring doc_path) {
  const char *nativeString = env->GetStringUTFChars(doc_path, nullptr);
  HybridDuckDB::docPath = std::string(nativeString);
  env->ReleaseStringUTFChars(doc_path, nativeString);
}
