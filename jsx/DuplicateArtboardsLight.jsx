/*
  Duplicate_Artboards_Light.jsx for Adobe Illustrator
  Description: Script for copying the selected Artboard with his artwork
  Requirements: Adobe Illustrator CS6 and later
  Date: October, 2020
  Author: Sergey Osokin, email: hi@sergosokin.ru

  Installation: https://github.com/creold/illustrator-scripts#how-to-run-scripts

  Release notes:
  0.1 Initial version
  0.2 Fixed: bounds checking of the Illustrator canvas; position of the first copy
  0.2.1 Fixed script didn't run if the layers were locked
  0.2.2 Performance optimization
  0.3 Fixed copying all objects into one layer
  0.4 Added more units (yards, meters, etc.) support if the document is saved

  Donate (optional):
  If you find this script helpful, you can buy me a coffee
  - via DonatePay https://new.donatepay.ru/en/@osokin
  - via Donatty https://donatty.com/sergosokin
  - via YooMoney https://yoomoney.ru/to/410011149615582
  - via QIWI https://qiwi.com/n/OSOKIN
  - via PayPal (temporarily unavailable) http://www.paypal.me/osokin/usd

  NOTICE:
  Tested with Adobe Illustrator CC 2018-2021 (Mac), 2021 (Win).
  This script is provided "as is" without warranty of any kind.
  Free to use, not for sale.

  Released under the MIT license.
  http://opensource.org/licenses/mit-license.php

  Check other author's scripts: https://github.com/creold
*/

//@target illustrator
app.preferences.setBooleanPreference('ShowExternalJSXWarning', false); // Fix drag and drop a .jsx file
app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
$.localize = true; // Enabling automatic localization

function main() {
  var SCRIPT = {
        name: 'Duplicate Atboards Light',
        version: 'v.0.4'
      },
      CFG = {
        aiVers: parseInt(app.version),
        units: getUnits(), // Active document units
        copies: 0, // Default amount of copies
        spacing: 20, // Default spacing between copies (doc units)
        minSpacing: 0, // The spacing can't be < 0
        tmpLyr: 'FOR_AB_COORD',
        suffix: ' ', // Default suffix for copies names
        limit: 2500, // The amount of objects, when the script can run slowly
        abs: 10, // When the number of copies >, full-screen mode is enabled
        cnvs: 16383, // Illustrator canvas max size, px
        lKey: '%isLocked',
        hKey: '%isHidden',
        uiField: [0, 0, 60, 30],
        uiTitle: [0, 0, 120, 30],
        uiOpacity: .97 // UI window opacity. Range 0-1
      },
      SETTINGS = {
        name: SCRIPT.name.replace(/\s/g, '_') + '_data.json',
        folder: Folder.myDocuments + '/Adobe Scripts/'
      },
      LANG = {
        errDoc: { en: 'Error\nOpen a document and try again',
                  ru: 'Ошибка\nОткройте документ и запустите скрипт' },
        errVers: { en: 'Error\nSorry, script only works in Illustrator CS6 and later',
                  ru: 'Ошибка\nСкрипт работает в Illustrator CS6 и выше' },
        warning: { en: 'The document has over ' + CFG.limit + ' objects. The script can run slowly',
                  ru: 'В документе свыше ' + CFG.limit + ' объектов. Скрипт может работать медленно' },
        ab: { en: 'Select artboard', ru: 'Выберите артборд' },
        copies: { en: 'Copies (max ', ru: 'Копии (до ' },
        spacing: { en: 'Spacing', ru: 'Расстояние' },
        cancel: { en: 'Cancel', ru: 'Отмена' },
        ok: { en: 'Ok', ru: 'Готово' }
      };

  if (CFG.aiVers < 16) {
    alert(LANG.errVers);
    return;
  }

  if (!documents.length) {
    alert(LANG.errDoc);
    return;
  }

  var doc = activeDocument,
      maxCopies = ((CFG.aiVers >= 22) ? 1000 : 100) - doc.artboards.length, // Artboards limit
      currAbIdx = doc.artboards.getActiveArtboardIndex(),
      absArr = [],
      copies = spacing = 0;

  // Collect artboards names for dropdown menu
  for (var i = 0, aLen = doc.artboards.length; i < aLen; i++) {
    absArr.push((i + 1) + ': ' + doc.artboards[i].name);
  }

  // Main Window
  var dialog = new Window('dialog', SCRIPT.name + ' ' + SCRIPT.version);
      dialog.orientation = 'column';
      dialog.alignChildren = ['fill', 'center'];
      dialog.opacity = CFG.uiOpacity;

  // Input fields
  var abGroup = dialog.add('group');
      abGroup.orientation = 'column';
      abGroup.alignChildren = ['fill', 'top'];
      abGroup.add('statictext', undefined, LANG.ab);
  var abIdx = abGroup.add('dropdownlist', CFG.uiTitle, absArr);
      abIdx.selection = currAbIdx;

  var fieldGroup = dialog.add('group');
      fieldGroup.orientation = 'row';
      fieldGroup.alignChildren = ['fill', 'center'];

  var titlesGroup = fieldGroup.add('group');
      titlesGroup.orientation = 'column';
  var copiesTitle = titlesGroup.add('statictext', CFG.uiTitle, LANG.copies);
      titlesGroup.add('statictext', CFG.uiTitle, LANG.spacing + ', ' + CFG.units);

  var inputsGroup = fieldGroup.add('group');
      inputsGroup.orientation = 'column';
  var copiesVal = inputsGroup.add('edittext', CFG.uiField, CFG.copies);
  var spacingVal = inputsGroup.add('edittext', CFG.uiField, CFG.spacing);

  if (doc.pageItems.length > CFG.limit) {
    var warning = dialog.add('statictext', undefined, LANG.warning, { multiline: true });
  }

  // Buttons
  var btnsGroup = dialog.add('group');
      btnsGroup.orientation = 'row';
      btnsGroup.alignChildren = ['fill', 'center'];
  var cancel = btnsGroup.add('button', undefined, LANG.cancel, { name: 'cancel' });
  var ok = btnsGroup.add('button', undefined, LANG.ok,  { name: 'ok' });

  var copyright = dialog.add('statictext', undefined, '\u00A9 Sergey Osokin. Visit Github');
      copyright.justify = 'center';

  loadSettings();

  spacing = convertUnits( convertToAbsNum(spacingVal.text, CFG.minSpacing), CFG.units, 'px' );
  currAbIdx = doc.artboards.getActiveArtboardIndex();

  var abCoord = getArtboardCoordinates(currAbIdx, CFG.tmpLyr);
  var overCnvsSize = isOverCnvsBounds(abCoord, maxCopies, spacing, CFG.cnvs);

  copiesTitle.text = LANG.copies + overCnvsSize.copies + ')';
  if (convertToAbsNum(copiesVal.text, CFG.copies) > overCnvsSize.copies) {
    copiesVal.text = overCnvsSize.copies;
  }

  shiftInputNumValue(copiesVal, CFG.copies);
  shiftInputNumValue(spacingVal, CFG.minSpacing);

  // Change listeners
  spacingVal.onChange = function () {
    recalcCopies();
    this.text = convertToAbsNum(this.text, CFG.spacing);
  }

  copiesVal.onChange = function () {
    recalcCopies();
    this.text = convertToAbsNum(this.text, CFG.copies);
  }

  copiesVal.onChanging = spacingVal.onChanging = recalcCopies;

  abIdx.onChange = function() {
    doc.artboards.setActiveArtboardIndex(abIdx.selection.index);
    redraw();
    recalcCopies();
  }

  copyright.addEventListener('mousedown', function () {
    openURL('https://github.com/creold');
  });

  cancel.onClick = dialog.close;

  // Remove temp layer
  dialog.onClose = function() {
    try {
      doc.layers.getByName(CFG.tmpLyr).remove();
    } catch (e) {}
  }

  ok.onClick = okClick;

  function okClick() {
    copies = copiesVal.text = Math.round( convertToAbsNum(copiesVal.text, CFG.copies) );
    spacing = spacingVal.text = convertToAbsNum(spacingVal.text, CFG.spacing);
    spacing = convertUnits(spacing, CFG.units, 'px');

    var userView = doc.views[0].screenMode;
    if (copies == 0) {
      dialog.close();
    } else if (copies > CFG.abs) {
      doc.views[0].screenMode = ScreenMode.FULLSCREEN;
    }

    selection = null;
    redraw();
    unlockLayers(doc.layers);
    removeNote(doc.layers, CFG.lKey, CFG.hKey); // Сlear Note after previous run
    saveItemsState(doc.layers, CFG.lKey, CFG.hKey);

    // Copy Artwork
    doc.selectObjectsOnActiveArtboard();
    var abItems = selection;
    try {
      for (var i = 0; i < copies; i++) {
        suffix = CFG.suffix + fillZero((i + 1), copies.toString().length);
        duplicateArtboard(currAbIdx, abItems, spacing, suffix, i);
      }
    } catch (e) {}

    // Restore locked & hidden pageItems
    restoreItemsState(doc.layers, CFG.lKey, CFG.hKey);
    selection = null;
    doc.views[0].screenMode = userView;
    saveSettings();
    app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;

    dialog.close();
  }

  dialog.center();
  dialog.show();

  /**
   * Recalculate the maximum amount of copies at a given spacing
   */
  function recalcCopies() {
    spacing = convertUnits( convertToAbsNum(spacingVal.text, CFG.minSpacing), CFG.units, 'px' );
    currAbIdx = doc.artboards.getActiveArtboardIndex();
    abCoord = getArtboardCoordinates(currAbIdx, CFG.tmpLyr);
    overCnvsSize = isOverCnvsBounds(abCoord, maxCopies, spacing, CFG.cnvs);
    copiesTitle.text = LANG.copies + overCnvsSize.copies + ')';
    if (convertToAbsNum(copiesVal.text, CFG.copies) > overCnvsSize.copies) {
      copiesVal.text = overCnvsSize.copies;
    }
    if (convertToAbsNum(copiesVal.text, CFG.copies) < 0) {
      copiesVal.text = 0;
    }
  }

  /**
   * Use Up / Down arrow keys (+ Shift) for change value
   * @param {object} item - input text field
   * @param {number} min - minimal input value
   */
  function shiftInputNumValue(item, min) {
    item.addEventListener('keydown', function (kd) {
      var step;
      ScriptUI.environment.keyboardState['shiftKey'] ? step = 10 : step = 1;
      if (kd.keyName == 'Down') {
        this.text = convertToAbsNum(this.text, min) - step;
        if (this.text * 1 < min) this.text = min;
        recalcCopies();
        kd.preventDefault();
      }
      if (kd.keyName == 'Up') {
        this.text = convertToAbsNum(this.text, min) + step;
        recalcCopies();
        kd.preventDefault();
      }
    });
  }

  /**
   * Save input data to file
   */
  function saveSettings() {
    if(!Folder(SETTINGS.folder).exists) Folder(SETTINGS.folder).create();
    var $file = new File(SETTINGS.folder + SETTINGS.name);
    $file.encoding = 'UTF-8';
    $file.open('w');
    var pref = {};
    pref.copies = copiesVal.text;
    pref.spacing = spacingVal.text;
    var data = pref.toSource();
    $file.write(data);
    $file.close();
  }

  /**
   * Load input data from file
   */
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
          copiesVal.text = pref.copies;
          spacingVal.text = pref.spacing;
        }
      } catch (e) {}
    }
  }
}

/**
 * Unlock all Layers & Sublayers
 * @param {Object} _layers - Layers collection
 */
function unlockLayers(_layers) {
  for (var i = 0, len = _layers.length; i < len; i++) {
    if (_layers[i].locked) _layers[i].locked = false;
    if (_layers[i].layers.length) unlockLayers(_layers[i].layers);
  }
}

/**
 * Remove keyword from Note in Attributes panel
 * @param {Object} _layers - Layers collection
 * @param {string} lKey - Keyword for locked items
 * @param {string} hKey - Keyword for hidden items
 */
function removeNote(_layers, lKey, hKey) {
  var regexp = new RegExp(lKey + '|' + hKey, 'gi');
  for (var i = 0, len = _layers.length; i < len; i++) {
    var currLayer = _layers[i],
        allItems = [];
    if (currLayer.layers.length > 0) {
      removeNote(currLayer.layers, lKey, hKey);
    }
    try {
      getItems(currLayer.pageItems, allItems);
      for (var j = 0, iLen = allItems.length; j < iLen; j++) {
        var currItem = allItems[j];
        currItem.note = currItem.note.replace(regexp, '');
      }
    } catch (e) {}
  }
}

/**
 * Save information about locked & hidden pageItems & layers
 * @param {Object} _layers - Layers collection
 * @param {string} lKey - Keyword for locked items
 * @param {string} hKey - Keyword for hidden items
 */
function saveItemsState(_layers, lKey, hKey) {
  var allItems = [];
  for (var i = 0, len = _layers.length; i < len; i++) {
    var currLayer = _layers[i];
    if (currLayer.layers.length > 0) {
      saveItemsState(currLayer.layers, lKey, hKey);
    }
    getItems(currLayer.pageItems, allItems);
    for (var j = 0, iLen = allItems.length; j < iLen; j++) {
      var currItem = allItems[j];
      if (currItem.locked) {
        currItem.locked = false;
        currItem.note += lKey;
      }
      if (currItem.hidden) {
        currItem.hidden = false;
        currItem.note += hKey;
      }
    }
  }
  redraw();
}

/**
 * Restoring locked & hidden pageItems & layers
 * @param {Object} _layers - Layers collection
 * @param {string} lKey - Keyword for locked items
 * @param {string} hKey - Keyword for hidden items
 */
function restoreItemsState(_layers, lKey, hKey) {
  var allItems = [],
      regexp = new RegExp(lKey + '|' + hKey, 'gi');
  for (var i = 0, len = _layers.length; i < len; i++) {
    var currLayer = _layers[i];
    if (currLayer.layers.length > 0) {
      restoreItemsState(currLayer.layers, lKey, hKey);
    }
    getItems(currLayer.pageItems, allItems);
    for (var j = 0, iLen = allItems.length; j < iLen; j++) {
      var currItem = allItems[j];
      if (currItem.note.match(lKey) != null) {
        currItem.note = currItem.note.replace(regexp, '');
        currItem.locked = true;
      }
      if (currItem.note.match(hKey) != null) {
        currItem.note = currItem.note.replace(regexp, '');
        currItem.hidden = true;
      }
    }
  }
}

/**
 * Collect items
 * @param {(Object|Array)} obj - Items collection
 * @param {Array} arr - Output array with childrens
 */
function getItems(obj, arr) {
  for (var i = 0, len = obj.length; i < len; i++) {
    var currItem = obj[i];
    try {
      switch (currItem.typename) {
        case 'GroupItem':
          arr.push(currItem);
          getItems(currItem.pageItems, arr);
          break;
        default:
          arr.push(currItem);
          break;
      }
    } catch (e) {}
  }
}

/**
 * Add zero to the file name before the indexes are less then size
 * @param {number} number - Copy number
 * @param {number} size - Length of the amount of copies
 * @return {string} Copy number with pre-filled zeros
 */
function fillZero(number, size) {
  var str = '000000000' + number;
  return str.slice(str.length - size);
}

/**
 * Trick with temp pathItem to get the absolute coordinate of the artboard. Thanks to @moodyallen
 * @param {number} abIdx - Current artboard index
 * @return {Object} Absolute coordinates of the artboard
 */
function getArtboardCoordinates(abIdx, lyrName) {
  var doc = activeDocument,
      thisAbRect = doc.artboards[abIdx].artboardRect, // The selected artboard size
      tmpLayer;

  try {
    tmpLayer = doc.layers.getByName(lyrName);
  } catch (e) {
    tmpLayer = doc.layers.add();
    tmpLayer.name = lyrName;
  }

  var fakePath = tmpLayer.pathItems.add();
  var cnvsDelta = 1 + ((fakePath.position[0] * 2 - 16384) - (fakePath.position[1] * 2 + 16384)) / 2;
  var cnvsTempPath = tmpLayer.pathItems.rectangle(fakePath.position[0] - cnvsDelta, fakePath.position[1] + cnvsDelta, 300, 300);
  cnvsTempPath.filled = false;
  cnvsTempPath.stroked  = false;

  // Create a rectangle with the same size as the artboard
  var top = thisAbRect[1],
      left = thisAbRect[0],
      width = thisAbRect[2] - thisAbRect[0],
      height = thisAbRect[1] - thisAbRect[3];

  var abTempPath = tmpLayer.pathItems.rectangle(top, left, width, height);
  abTempPath.stroked  = false;
  abTempPath.filled = false;

  // Use the X, Y coordinates of cnvsTempPath and abTempPath to get the absolute coordinate
  var absLeft = Math.floor(abTempPath.position[0] - cnvsTempPath.position[0]),
      absTop = Math.floor(cnvsTempPath.position[1] - abTempPath.position[1]),
      absBottom = absTop + height,
      absRight = absLeft + width;

  fakePath.remove();
  abTempPath.remove();
  cnvsTempPath.remove();
  redraw();

  return { 'left': absLeft, 'right': absRight, 'top': absTop, 'bottom': absBottom };
}

/**
 * Find out if the amount of copies over the canvas width
 * @param {Object} coord - Coordinates of the selected artboard
 * @param {number} copies - Amount of copies
 * @param {number} spacing - Distance between copies
 * @return {Object} Information about the extreme possible artboard
 */
function isOverCnvsBounds(coord, copies, spacing, max) {
  var lastAbRight = coord.right + (spacing + coord.right - coord.left) * copies,
      tempEdge = lastAbRight;

  // Get a safe amount of copies
  for (var i = copies; i >= 0; i--) {
    if (tempEdge <= max) break;
    tempEdge = tempEdge - (spacing + coord.right - coord.left);
  }

  return { 'answer': lastAbRight > max, 'copies': i };
}

/**
 * Duplicate the selected artboard. Based on the idea of @Silly-V
 * @param {number} thisAbIdx - Current artboard index
 * @param {Object} items - Collection of items on the artboard
 * @param {number} spacing - Distance between copies
 * @param {string} suffix - Copy name suffix
 * @param {number} counter - Current copy number
 */
function duplicateArtboard(thisAbIdx, items, spacing, suffix, counter) {
  var doc = activeDocument,
      thisAb = doc.artboards[thisAbIdx],
      thisAbRect = thisAb.artboardRect,
      idx = doc.artboards.length - 1,
      lastAb = doc.artboards[idx],
      lastAbRect = lastAb.artboardRect,
      abWidth = thisAbRect[2] - thisAbRect[0];

	var newAb = doc.artboards.add(thisAbRect);
  if (counter === 0) {
    newAb.artboardRect = [
      thisAbRect[2] + spacing,
      thisAbRect[1],
      thisAbRect[2] + spacing + abWidth,
      thisAbRect[3]
    ];
  } else {
    newAb.artboardRect = [
      lastAbRect[2] + spacing,
      lastAbRect[1],
      lastAbRect[2] + spacing + abWidth,
      lastAbRect[3]
    ];
  }
	newAb.name = thisAb.name + suffix;

  var docCoordSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM,
      abCoordSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM,
      isDocCoords = app.coordinateSystem == docCoordSystem,
      dupArr = getDuplicates(items);

  // Move copied items to the new artboard
  for (var i = 0, dLen = dupArr.length; i < dLen; i++) {
    var pos = isDocCoords ? dupArr[i].position : doc.convertCoordinate(dupArr[i].position, docCoordSystem, abCoordSystem);
    dupArr[i].position = [pos[0] + (abWidth + spacing) * (counter + 1), pos[1]];
  }
}

/**
 * Duplicate all items
 * @param {Object} collection - Selected items on active artboard
 * @return {Array} arr - Duplicated items
 */
function getDuplicates(collection) {
  var arr = [];
  for (var i = 0, len = collection.length; i < len; i++) {
    arr.push(collection[i].duplicate());
  }
  return arr;
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