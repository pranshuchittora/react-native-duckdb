package com.rnduckdb

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri

class RNDuckDBInitProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        val ctx = context ?: return false
        DocPathSetter.setDocPath(ctx.filesDir.absolutePath)
        return true
    }

    override fun query(uri: Uri, proj: Array<String>?, sel: String?, args: Array<String>?, sort: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, sel: String?, args: Array<String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, sel: String?, args: Array<String>?): Int = 0
}
