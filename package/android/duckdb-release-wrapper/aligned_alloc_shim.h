// Shim for aligned_alloc on Android API < 28.
// Android Bionic only added aligned_alloc in API 28, but usearch (bundled in
// duckdb-vss) calls it directly. This header is force-included via
// -include aligned_alloc_shim.h in CMakeLists.txt when VSS extension is enabled.
// posix_memalign has been available since Android API 16.
#ifndef ALIGNED_ALLOC_SHIM_H
#define ALIGNED_ALLOC_SHIM_H

#if defined(__ANDROID__) && __ANDROID_API__ < 28
#include <stdlib.h>

#ifdef __cplusplus
extern "C" {
#endif

static inline void* aligned_alloc(size_t alignment, size_t size) {
    void* ptr = NULL;
    if (posix_memalign(&ptr, alignment, size) != 0) {
        return NULL;
    }
    return ptr;
}

#ifdef __cplusplus
}
#endif

#endif // __ANDROID__ && __ANDROID_API__ < 28
#endif // ALIGNED_ALLOC_SHIM_H
