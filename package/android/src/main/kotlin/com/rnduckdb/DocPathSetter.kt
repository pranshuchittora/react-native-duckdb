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

    @JvmStatic
    fun setAllPaths(docPath: String, dbPath: String, extPath: String) {
        if (didSet) return
        RNDuckDBOnLoad.initializeNative()
        setAllPathsInJNI(docPath, dbPath, extPath)
        didSet = true
    }

    private external fun setDocPathInJNI(docPath: String)
    private external fun setAllPathsInJNI(docPath: String, dbPath: String, extPath: String)
}
