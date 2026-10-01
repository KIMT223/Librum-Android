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


var DEFAULT_WIKI_NAME = 'Librum';
var DEFAULT_HOME_TITLE = '主页';


/* ================= 应用状态 ================= */

var state = {
  wikiName: DEFAULT_WIKI_NAME,
  pages: [],

  view: 'all',
  currentSlug: null,
  editingIsNew: false,

  searchQuery: '',
  searchResults: null,
  searching: false,

  _newTitle: '',
  _editBody: ''
};


/* ================= 工具 ================= */

function esc(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}


function fmtTime(ts){
  var d = new Date(ts);

  function p(n){
    return n < 10 ? '0' + n : n;
  }

  return d.getFullYear() +
    '-' + p(d.getMonth() + 1) +
    '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) +
    ':' + p(d.getMinutes());
}


function slugify(){
  return 'p' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2,7);
}


function toast(msg){
  var el = document.getElementById('toast');

  if (!el) return;

  el.textContent = msg;
  el.classList.add('show');

  clearTimeout(toast._t);

  toast._t = setTimeout(function(){
    el.classList.remove('show');
  }, 1800);
}

