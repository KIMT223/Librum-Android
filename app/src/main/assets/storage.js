/*
 * Librum - Lightweight local Markdown Wiki
 *
 * Copyright (C) 2026 Librum Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation, either version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

"use strict";

/* ================= 存储层：Android 原生桥接，浏览器回退 localStorage ================= */

var Store = {
  hasNative: function(){
    return !!(
      window.AndroidStorage &&
      typeof window.AndroidStorage.read === 'function' &&
      typeof window.AndroidStorage.write === 'function' &&
      typeof window.AndroidStorage.remove === 'function'
    );
  },

  read: function(path){
    if (this.hasNative()){
      try {
        return Promise.resolve(window.AndroidStorage.read(path));
      } catch(e) {}
    }

    return Promise.resolve(
      localStorage.getItem('mdwiki:' + path)
    );
  },

  write: function(path, content){
    if (this.hasNative()){
      try {
        var ok = window.AndroidStorage.write(path, content);

        /*
         * Kotlin 当前版本 write() 没有返回值，
         * 所以这里只要没有抛异常，就认为写入成功。
         */
        return Promise.resolve(ok);
      } catch(e) {}
    }

    localStorage.setItem('mdwiki:' + path, content);
    return Promise.resolve();
  },

  remove: function(path){
    if (this.hasNative()){
      try {
        window.AndroidStorage.remove(path);
        return Promise.resolve();
      } catch(e) {}
    }

    localStorage.removeItem('mdwiki:' + path);
    return Promise.resolve();
  }
};


var SETTINGS_PATH = 'settings.json';
var INDEX_PATH = 'index.json';

function pagePath(slug){
  return 'pages/' + slug + '.md';
}

