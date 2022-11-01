
//@target illustrator
app.preferences.setBooleanPreference('ShowExternalJSXWarning', false); // Fix drag and drop a .jsx file
$.localize = true; // Enabling automatic localization

var folder = Folder.selectDialog();
if (folder) {
    var files = folder.getFiles("*.pdf")
    for (var i = 0; i < files.length; i++) {
        app.open(files[i]);
        var doc = app.activeDocument;
        app.executeMenuCommand('doc-color-cmyk');
        doc.close(SaveOptions.SAVECHANGES);
    }
}
