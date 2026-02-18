package com.rnduckdb

import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.rnduckdb.RNDuckDBOnLoad

object DocPathSetter {
    @JvmStatic
    fun setDocPath(context: ReactApplicationContext) {
        RNDuckDBOnLoad.initializeNative()
        val path = context.filesDir.absolutePath
        setDocPathInJNI(path)
    }

    private external fun setDocPathInJNI(docPath: String)
}
