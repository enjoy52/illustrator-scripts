﻿/*
  ArtboardsFinder.jsx for Adobe Illustrator
  Description: Search and navigate to artboards by name or size
  Date: October, 2022
  Author: Sergey Osokin, email: hi@sergosokin.ru

  Installation: https://github.com/creold/illustrator-scripts#how-to-run-scripts

  Release notes:
  0.1 Initial version
  0.1.1 Minor improvements
  0.1.2 Fixed input activation in Windows OS
  0.1.3 Added size correction in large canvas mode

  Donate (optional):
  If you find this script helpful, you can buy me a coffee
  - via Buymeacoffee https://www.buymeacoffee.com/osokin
  - via DonatePay https://new.donatepay.ru/en/@osokin
  - via Donatty https://donatty.com/sergosokin
  - via YooMoney https://yoomoney.ru/to/410011149615582
  - via QIWI https://qiwi.com/n/OSOKIN

  NOTICE:
  Tested with Adobe Illustrator CC 2018-2022 (Mac), CS6, 2022 (Win).
  This script is provided "as is" without warranty of any kind.
  Free to use, not for sale

  Released under the MIT license
  http://opensource.org/licenses/mit-license.php

  Check other author's scripts: https://github.com/creold
*/

//@target illustrator
app.preferences.setBooleanPreference('ShowExternalJSXWarning', false); // Fix drag and drop a .jsx file
$.localize = true; // Enabling automatic localization

function main() {
  var SCRIPT = {
        name: 'Artboards Finder',
        version: 'v.0.1.3'
      },
      CFG = {
        aiVers: parseFloat(app.version),
        isMac: /mac/i.test($.os),
        isTabRemap: false, // Set to true if you work on PC and the Tab key is remapped
        defZoom: 0.75, // Zoom ratio in document window
        minZoom: 0.1, // Minimal zoom ratio
        width: 280, // Units: px
        rows: 6, // Amount of rows in listbox
        units: getUnits(), // Active document units
        uiOpacity: .97 // UI window opacity. Range 0-1
      },
      SETTINGS = {
        name: SCRIPT.name.replace(/\s/g, '_') + '_data.json',
        folder: Folder.myDocuments + '/Adobe Scripts/'
      },
      LANG = {
        errDoc: { en: 'Error\nOpen a document and try again',
                  ru: 'Ошибка\nОткройте документ и запустите скрипт' },
        method: { en: 'Search method', ru: 'Метод поиска'},
        byName: { en: 'By name', ru: 'По имени'},
        byWidth: { en: 'By width, ' + CFG.units, ru: 'По ширине, ' + CFG.units},
        byHeight: { en: 'By height, ' + CFG.units, ru: 'По высоте, ' + CFG.units},
        byName: { en: 'By name', ru: 'По имени'},
        landscape: { en: 'Landscape', ru: 'Альбомные'},
        portrait: { en: 'Portrait', ru: 'Портретные'},
        square: { en: 'Square', ru: 'Квадратные'},
        input: { en: 'Enter name...', ru: 'Введите имя...'},
        isZoom: { en: 'Center view with zoom ratio (' + CFG.minZoom + '-1)',
                  ru: 'Показать с масштабом (' + CFG.minZoom + '-1)'},
        idx: { en: '#', ru: '№'},
        ab: { en: 'Name', ru: 'Имя'},
        width: { en: 'Width', ru: 'Ширина'},
        height: { en: 'Height', ru: 'Высота'},
        close: { en: 'Close', ru: 'Закрыть'}
      };

  if (!documents.length) {
    alert(LANG.errDoc);
    return;
  }

  // Scale factor for Large Canvas mode
  CFG.sf = activeDocument.scaleFactor ? activeDocument.scaleFactor : 1;
  // Disable Windows Screen Flicker Bug Fix on newer versions
  var winFlickerFix = !CFG.isMac && CFG.aiVers < 26.4;
  var resAbs = []; // Array of found artboards

  // Dialog
  var dialog = new Window('dialog', SCRIPT.name + ' ' + SCRIPT.version);
      dialog.opacity = CFG.uiOpacity;

  // Filters
  var filterPnl = dialog.add('panel', undefined, LANG.method);
      filterPnl.orientation = 'row';
      filterPnl.bounds = [0, 0 , CFG.width, 120];

  var nameRb = addRadio(filterPnl, 0, 0, LANG.byName);
      nameRb.value = true;
  var widthRb = addRadio(filterPnl, 0, 1, LANG.byWidth);
  var heightRb = addRadio(filterPnl, 0, 2, LANG.byHeight);
  var landscapeRb = addRadio(filterPnl, 1, 0, LANG.landscape);
  var portraitRb = addRadio(filterPnl, 1, 1, LANG.portrait);
  var squareRb = addRadio(filterPnl, 1, 2, LANG.square);

  var userInp = dialog.add('edittext', undefined, LANG.input);
      userInp.preferredSize.width = CFG.width;
  if (winFlickerFix) {
    if (!CFG.isTabRemap) simulateKeyPress('TAB', 8);
  } else {
    userInp.active = true;
  }

  // Search results
  var listbox = dialog.add('listbox', [0, 0, CFG.width, 20 + 21 * CFG.rows], undefined,
      {
        numberOfColumns: 4,
        showHeaders: true,
        columnTitles: [
          LANG.idx,
          LANG.ab,
          LANG.width,
          LANG.height
        ],
        multiselect: true
      });

  // Zoom option
  var zoomGroup = dialog.add('group');
      zoomGroup.alignChildren = ['left', 'bottom'];

  var isZoom = zoomGroup.add('checkbox', undefined, LANG.isZoom);

  var zoomInp = zoomGroup.add('edittext', undefined, CFG.defZoom);
      zoomInp.characters = 5;

  // Buttons
  var btns = dialog.add('group');
      btns.alignChildren = ['center', 'center'];

  var close = btns.add('button', undefined, LANG.close, {name: 'cancel'});

  var copyright = dialog.add('statictext', undefined, '\u00A9 Sergey Osokin. Visit Github');
      copyright.justify = 'center';

  loadSettings();
  outputResult();

  userInp.onChanging = outputResult;

  // Select search method
  for (var i = 0; i < filterPnl.children.length; i++) {
    filterPnl.children[i].onClick = function () {
      if (portraitRb.value || landscapeRb.value || squareRb.value) {
        userInp.enabled = false;
      } else {
        userInp.enabled = true;
      }
      outputResult();
    }
  }

  // Select matched item
  listbox.onChange = selectListItem;

  isZoom.onClick = zoomInp.onChange;

  // Changing the zoom ratio
  zoomInp.onChange = function () {
    if (convertToAbsNum(this.text, CFG.defZoom) > 1) this.text = 1;
    if (convertToAbsNum(this.text, CFG.defZoom) < CFG.minZoom) this.text = CFG.minZoom;
    selectListItem();
  }

  close.onClick = function () {
    saveSettings();
    dialog.close();
  }

  copyright.addEventListener('mousedown', function () {
    openURL('https://github.com/creold');
  });

  // Displaying search results for navigation
  function outputResult() {
    resAbs = []; // Clear previous matches
    listbox.removeAll(); // Clear list before search

    for (var i = 0; i < filterPnl.children.length; i++) {
      if (filterPnl.children[i].value) {
        resAbs = getAbsByFilter(i, userInp.text, CFG.units, CFG.sf);
        break;
      }
    }

    if (widthRb.value || landscapeRb.value || squareRb.value) {
      resAbs.sort(function (a, b) {
        return a.width - b.width;
      }).reverse();
    }

    if (heightRb.value || portraitRb.value) {
      resAbs.sort(function (a, b) {
        return a.height - b.height;
      }).reverse();
    }

    // Create listbox rows from search results
    for (var i = 0, len = resAbs.length; i < len; i++) {
      var newRow = listbox.add('item', resAbs[i].idx + 1);
      newRow.subItems[0].text = resAbs[i].ab.name;
      newRow.subItems[1].text = resAbs[i].width;
      newRow.subItems[2].text = resAbs[i].height;
    }
  }

  // Select list items and zoom to them contents
  function selectListItem() {
    var abs = [],
        first;

    // Collect selected rows indexes
    for (var i = 0, len = listbox.children.length; i < len; i++) {
      if (listbox.children[i].selected) {
        abs.push(resAbs[i].ab);
        if (isNaN(first)) first = resAbs[i].idx;
      }
    }

    activeDocument.artboards.setActiveArtboardIndex(first);

    var ratio = convertToAbsNum(zoomInp.text, CFG.defZoom);
    zoom(abs, ratio, isZoom.value);
  }

  // Save input data to file
  function saveSettings() {
    if(!Folder(SETTINGS.folder).exists) Folder(SETTINGS.folder).create();
    var $file = new File(SETTINGS.folder + SETTINGS.name);
    $file.encoding = 'UTF-8';
    $file.open('w');
    var pref = {};
    for (var i = 0; i < filterPnl.children.length; i++) {
      if (filterPnl.children[i].value) pref.filter = i;
    }
    pref.search = userInp.text;
    pref.isZoom = isZoom.value;
    pref.ratio = zoomInp.text;
    var data = pref.toSource();
    $file.write(data);
    $file.close();
  }

  // Load input data from file
  function loadSettings() {
    var $file = File(SETTINGS.folder + SETTINGS.name);
    if ($file.exists) {
      try {
        $file.encoding = 'UTF-8';
        $file.open('r');
        var json = $file.readln();
        var pref = new Function('return ' + json)();
        $file.close();
        if (typeof pref != 'undefined') {
          filterPnl.children[pref.filter].value = true;
          if (pref.filter > 2) userInp.enabled = false;
          userInp.text = pref.search;
          isZoom.value = pref.isZoom;
          zoomInp.text = pref.ratio;
        }
      } catch (e) {}
    }
  }

  dialog.center();
  dialog.show();
}

/**
 * Add radiobutton to the dialog
 * @param {Object} place - Button container
 * @param {number} x - Column
 * @param {number} y - Row
 * @param {string} label - Button caption
 * @return {Object} rb - Radiobutton
 */
function addRadio(place, x, y, label) {
  var rb = place.add('radiobutton', undefined, label),
      stepX = 140,
      stepY = 30,
      x0 = 10,
      y0 = 20;

  x = x0 + stepX * x;
  y = y0 + stepY * y;
  rb.bounds = [x, y, x + 120, y + 20];

  return rb;
}

/**
 * Simulate keyboard keys on Windows OS via VBScript
 * 
 * This function is in response to a known ScriptUI bug on Windows.
 * Basically, on some Windows Ai versions, when a ScriptUI dialog is
 * presented and the active attribute is set to true on a field, Windows
 * will flash the Windows Explorer app quickly and then bring Ai back
 * in focus with the dialog front and center.
 *
 * @param {String} k - Key to simulate
 * @param {Number} n - Number of times to simulate the keypress
 */
function simulateKeyPress(k, n) {
  if (!/win/i.test($.os)) return false;
  if (!n) n = 1;
  try {
    var f = new File(Folder.temp + '/' + 'SimulateKeyPress.vbs');
    var s = 'Set WshShell = WScript.CreateObject("WScript.Shell")\n';
    while (n--) {
      s += 'WshShell.SendKeys "{' + k.toUpperCase() + '}"\n';
    }
    f.open('w');
    f.write(s);
    f.close();
    f.execute();
  } catch(e) {}
}

/**
 * Get input string matches
 * @param {number} key - Search method
 * @param {string} str - Search string
 * @param {string} units - Document units
 * @param {number} sf - Size scale factor
 * @return {Array} out - Array of matches
 */
function getAbsByFilter(key, str, units, sf) {
  var out = [];

  for (var i = 0, len = activeDocument.artboards.length; i < len; i++) {
    var ab = activeDocument.artboards[i],
        abWidth = ab.artboardRect[2] - ab.artboardRect[0],
        abHeight = Math.abs(ab.artboardRect[1] - ab.artboardRect[3]);

    abWidth = sf * convertUnits(abWidth, 'px', units);
    abHeight = sf * convertUnits(abHeight, 'px', units);

    switch (key) {
      case 0:
      default:
        var regexp = new RegExp(str, 'i');
        if (ab.name.match(regexp))
          push(out, i, ab, abWidth, abHeight);
        break;
      case 1:
        if (abWidth.toFixed(2).match(str))
          push(out, i, ab, abWidth, abHeight);
        break;
      case 2:
        if (abHeight.toFixed(2).match(str))
          push(out, i, ab, abWidth, abHeight);
        break;
      case 3:
        if (abWidth > abHeight)
          push(out, i, ab, abWidth, abHeight);
        break;
      case 4:
        if (abWidth < abHeight)
          push(out, i, ab, abWidth, abHeight);
        break;
      case 5:
        if (abWidth.toFixed(4) == abHeight.toFixed(4))
          push(out, i, ab, abWidth, abHeight);
        break;
    }
  }

  return out;
}

/**
 * Add found artboard
 * @param {Array} arr - Array of artboards
 * @param {number} i - index
 * @param {Object} ab - Artboard
 * @param {number} width - Artboard width
 * @param {number} height - Artboard height
 */
function push(arr, i, ab, width, height) {
  arr.push({
    'idx': i,
    'ab': ab,
    'width': 1 * width.toFixed(2),
    'height': 1 * height.toFixed(2)
  });
}

/**
 * Zoom to selected artboards
 * Based on script by John Wundes (http://www.wundes.com)
 * @param {Array} abs - Selected artboards
 * @param {number} ratio - Scale ratio
 * @param {boolean} isZoom - Use scale ratio
 */
function zoom(abs, ratio, isZoom) {
  var doc = activeDocument;
  if (isZoom) doc.views[0].zoom = 1;

  var screenSize = doc.views[0].bounds,
      screenWidth = screenSize[2] - screenSize[0],
      screenHeight = screenSize[1] - screenSize[3],
      screenProportion = screenHeight / screenWidth;

  // Determine position of artboards
  var bnds = calcBounds(abs),
      centerPos = [bnds[0], bnds[1]],
      width = bnds[2] - bnds[0],
      height = bnds[1] - bnds[3];

  centerPos[0] = bnds[0] + width / 2;
  centerPos[1] = bnds[1] - height / 2;
  doc.views[0].centerPoint = centerPos;

  if (isZoom) {
    // Set zoom for height and width
    var zoomRatioW = screenWidth / width,
        zoomRatioH = screenHeight / height;

    // Decide which proportion is larger
    var zR = (width * screenProportion >= height) ? zoomRatioW : zoomRatioH;
    // And scale to that proportion minus a little bit
    doc.views[0].zoom = zR * parseFloat(ratio);
  }

  redraw();
}

/**
 * Get visible bounds of selected artboards
 * @param {Array} abs - Selected artboards
 * @return {Array} Summary artboards bounds
 */
function calcBounds(abs) {
  var initBnds = abs[0].artboardRect,
      x0 = initBnds[0];
      y0 = initBnds[1];
      x1 = initBnds[2];
      y1 = initBnds[3];

  for (var i = 1, len = abs.length; i < len; i++) {
    var currAbRect = abs[i].artboardRect;
    x0 = Math.min(currAbRect[0], x0);
    y0 = Math.max(currAbRect[1], y0);
    x1 = Math.max(currAbRect[2], x1);
    y1 = Math.min(currAbRect[3], y1);
  }

  return [x0, y0, x1, y1];
}

/**
 * Get active document ruler units
 * @return {string} Shortened units
 */
function getUnits() {
  if (!documents.length) return '';
  switch (activeDocument.rulerUnits) {
    case RulerUnits.Pixels: return 'px';
    case RulerUnits.Points: return 'pt';
    case RulerUnits.Picas: return 'pc';
    case RulerUnits.Inches: return 'in';
    case RulerUnits.Millimeters: return 'mm';
    case RulerUnits.Centimeters: return 'cm';
    case RulerUnits.Unknown: // Parse new units only for the saved doc
      var xmp = activeDocument.XMPString;
      // Example: <stDim:unit>Yards</stDim:unit>
      if (/stDim:unit/i.test(xmp)) {
        var units = /<stDim:unit>(.*?)<\/stDim:unit>/g.exec(xmp)[1];
        if (units == 'Meters') return 'm';
        if (units == 'Feet') return 'ft';
        if (units == 'Yards') return 'yd';
      }
      break;
  }
  return 'px'; // Default
}

/**
 * Convert units of measurement
 * @param {string} value - Numeric data
 * @param {string} curUnits - Document units 
 * @param {string} newUnits - Final units
 * @return {number} Converted value 
 */
function convertUnits(value, currUnits, newUnits) {
  return UnitValue(value, currUnits).as(newUnits);
}

/**
 * Convert string to absolute number
 * @param {string} str - Input data
 * @param {number} def - Default value if the string don't contain digits
 * @return {number}
 */
function convertToAbsNum(str, def) {
  if (arguments.length == 1 || !def) def = 1;
  str = str.replace(/,/g, '.').replace(/[^\d.]/g, '');
  str = str.split('.');
  str = str[0] ? str[0] + '.' + str.slice(1).join('') : '';
  if (isNaN(str) || !str.length) return parseFloat(def);
  else return parseFloat(str);
}

/**
* Open link in browser
* @param {string} url - Website adress
*/
function openURL(url) {
  var html = new File(Folder.temp.absoluteURI + '/aisLink.html');
  html.open('w');
  var htmlBody = '<html><head><META HTTP-EQUIV=Refresh CONTENT="0; URL=' + url + '"></head><body> <p></body></html>';
  html.write(htmlBody);
  html.close();
  html.execute();
}

try {
  main();
} catch (e) {}