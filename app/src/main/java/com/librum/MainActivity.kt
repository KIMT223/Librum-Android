/*
 * Librum - Lightweight local Markdown Wiki for Android
 *
 * Copyright (C) 2026 KIMT223
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

package com.librum

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.File

class MainActivity : Activity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true

        webView.webViewClient = object : WebViewClient() {

            override fun shouldOverrideUrlLoading(
                view: WebView,
                url: String
            ): Boolean {

                if (
                    url.startsWith("http://") ||
                    url.startsWith("https://")
                ) {
                    try {
                        startActivity(
                            Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse(url)
                            )
                        )
                    } catch (_: Exception) {
                    }

                    return true
                }

                return false
            }
        }

        webView.addJavascriptInterface(
            StorageBridge(),
            "AndroidStorage"
        )

        setContentView(webView)

        webView.loadUrl(
            "file:///android_asset/index.html"
        )
    }


    inner class StorageBridge {

        private val root =
            File(filesDir, "wiki")


        private fun safeFile(path: String): File {

            val clean =
                path
                    .replace('\\', '/')
                    .trimStart('/')

            require(
                clean.isNotEmpty() &&
                !clean.contains("..")
            ) {
                "Invalid path"
            }

            val file =
                File(root, clean)

            val rootPath =
                root
                    .canonicalFile
                    .toPath()

            val filePath =
                file
                    .canonicalFile
                    .toPath()

            require(
                filePath.startsWith(rootPath)
            ) {
                "Invalid path"
            }

            return file
        }


        @JavascriptInterface
        fun read(path: String): String? {

            return try {

                val file =
                    safeFile(path)

                if (file.isFile) {

                    file.readText(
                        Charsets.UTF_8
                    )

                } else {

                    null
                }

            } catch (_: Exception) {

                null
            }
        }


        @JavascriptInterface
        fun write(
            path: String,
            content: String
        ) {

            try {

                val file =
                    safeFile(path)

                file.parentFile?.mkdirs()

                file.writeText(
                    content,
                    Charsets.UTF_8
                )

            } catch (_: Exception) {

                // JS 层有 localStorage fallback
            }
        }


        @JavascriptInterface
        fun remove(path: String) {

            try {

                safeFile(path).delete()

            } catch (_: Exception) {
            }
        }
    }


    override fun onDestroy() {

        webView.removeJavascriptInterface(
            "AndroidStorage"
        )

        webView.destroy()

        super.onDestroy()
    }
}