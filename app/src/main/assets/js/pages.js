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

/* ================= 数据操作 ================= */

function loadAll(){

  return Promise.all([
    Store.read(SETTINGS_PATH),
    Store.read(INDEX_PATH)
  ]).then(function(res){

    try {

      var s = JSON.parse(res[0]);

      if (s && s.wikiName){
        state.wikiName = s.wikiName;
      }

    } catch(e){}


    try {

      var idx = JSON.parse(res[1]);

      if (Array.isArray(idx)){
        state.pages = idx;
      }

    } catch(e){}

  });

}


function saveSettings(){

  return Store.write(
    SETTINGS_PATH,
    JSON.stringify({
      wikiName: state.wikiName
    })
  );

}


function saveIndex(){

  return Store.write(
    INDEX_PATH,
    JSON.stringify(state.pages)
  );

}


function createPage(title, body){

  var slug = slugify();

  var now = Date.now();

  var t =
    (title || '').trim() ||
    '未命名页面';


  state.pages.unshift({
    slug: slug,
    title: t,
    createdAt: now,
    updatedAt: now
  });


  return Promise.all([
    Store.write(
      pagePath(slug),
      body || ''
    ),

    saveIndex()

  ]).then(function(){

    return slug;

  });

}


function updatePage(slug, title, body){

  var p = state.pages.find(function(x){
    return x.slug === slug;
  });


  if (p){

    p.title =
      (title || '').trim() ||
      '未命名页面';

    p.updatedAt = Date.now();

  }


  return Promise.all([
    Store.write(
      pagePath(slug),
      body || ''
    ),

    saveIndex()

  ]);

}


function deletePage(slug){

  state.pages = state.pages.filter(
    function(x){
      return x.slug !== slug;
    }
  );


  return Promise.all([
    Store.remove(pagePath(slug)),
    saveIndex()
  ]);

}


function pageMeta(slug){

  return state.pages.find(function(x){
    return x.slug === slug;
  });

}


function pageByTitle(title){

  var t =
    String(title || '')
      .trim()
      .toLowerCase();


  return state.pages.find(function(x){

    return String(x.title || '')
      .trim()
      .toLowerCase() === t;

  });

}


function sortedPages(){

  return state.pages.slice().sort(
    function(a,b){
      return b.updatedAt - a.updatedAt;
    }
  );

}


/* ================= 视图切换 ================= */

