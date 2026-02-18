package com.rnduckdb

import com.margelo.nitro.rnduckdb.RNDuckDBOnLoad

object DocPathSetter {
    private var didSet = false

    @JvmStatic
    fun setDocPath(path: String) {
        if (didSet) return
        RNDuckDBOnLoad.initializeNative()
        setDocPathInJNI(path)
        didSet = true
    }

    private external fun setDocPathInJNI(docPath: String)
}
