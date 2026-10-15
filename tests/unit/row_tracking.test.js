const assert = require('assert');
const fs = require('fs');
const path = require('path');

const template = fs.readFileSync(
    path.join(__dirname, '../../powerdnsadmin/templates/domain.html'),
    'utf8');
const editClick = template.indexOf('".button_edit{% if quick_edit %}, .row_record{% endif %}"');
const editHandler = template.slice(editClick, template.indexOf('// handle apply changes button', editClick));
assert.ok(editClick !== -1);
assert.equal(editHandler.match(/editZoneRow\(/g).length, 3);
assert.ok(!editHandler.includes('editRow('));
assert.ok(!editHandler.includes('rememberRowBeforeEdit('));

const addHandler = template.slice(
    template.indexOf('".button_add_record"'),
    template.indexOf('//handle cancel button'));
assert.ok(addHandler.includes('editZoneRow('));
assert.ok(addHandler.includes('.row.add('));
assert.ok(addHandler.includes('.node()'));
assert.ok(addHandler.includes('nEditing = nRow'));
assert.ok(!addHandler.includes('fnAddData'));

const rememberStart = template.indexOf('function rememberRowBeforeEdit(table, nRow)');
const rememberSource = template.slice(rememberStart, template.indexOf('function updateUnsavedChanges()', rememberStart));
assert.equal(template.match(/_trackingId = nextTrackingId/g).length, 1);
assert.ok(rememberSource.includes('_trackingId = nextTrackingId'));

const start = template.indexOf('var nextTrackingId = 1;');
const end = template.indexOf('function unsavedChangesWarning(', start);
assert.notStrictEqual(start, -1);
assert.ok(end > start);

function loadTracking() {
    // Run the template functions themselves so the test cannot drift from the page.
    return new Function(`
        var unsavedChanges = false;
        var warnings = [];
        function unsavedChangesWarning(value) { warnings.push(value); }
        ${template.slice(start, end)}
        return {
            rememberRowBeforeEdit: rememberRowBeforeEdit,
            markSavedRow: markSavedRow,
            trackRowDeletion: trackRowDeletion,
            warnings: function () { return warnings.slice(); },
            dirtyIds: function () { return Array.from(dirtyRows); },
            hasDeleted: function () { return hasDeletedLoadedRows; }
        };
    `)();
}

function tableWith(data) {
    return {row: function () { return {data: function () { return data; }}; }};
}

function loadedRow(name) {
    return [name, 'A', 'Active', 300, '192.0.2.1', '', '', '1', name + '.example'];
}

function addedRow(name) {
    return [name, 'A', 'Active', 300, '192.0.2.1', '', '', '0', ''];
}

// saveZoneRow writes the new field values into the same array.
function saveInPlace(row, name) {
    row[0] = name;
    return row;
}

const api = loadTracking();

var mail = loadedRow('mail');
api.rememberRowBeforeEdit(tableWith(mail), 0);
var mailId = mail._trackingId;
saveInPlace(mail, 'mail');
api.markSavedRow(tableWith(mail), 0);
assert.deepStrictEqual(api.dirtyIds(), []);
assert.strictEqual(mail._trackingId, mailId);
assert.strictEqual(api.warnings().at(-1), false);

saveInPlace(mail, 'smtp');
api.rememberRowBeforeEdit(tableWith(mail), 4);
api.markSavedRow(tableWith(mail), 4);
assert.deepStrictEqual(api.dirtyIds(), [mailId]);
assert.strictEqual(mail._trackingId, mailId);

saveInPlace(mail, 'mail');
api.rememberRowBeforeEdit(tableWith(mail), 3);
api.markSavedRow(tableWith(mail), 3);
assert.deepStrictEqual(api.dirtyIds(), []);

var firstNew = addedRow('a');
var secondNew = addedRow('b');
api.rememberRowBeforeEdit(tableWith(firstNew), 0);
api.rememberRowBeforeEdit(tableWith(secondNew), 0);
assert.notStrictEqual(firstNew._trackingId, secondNew._trackingId);
saveInPlace(firstNew, 'a');
saveInPlace(secondNew, 'b');
api.markSavedRow(tableWith(firstNew), 0);
api.markSavedRow(tableWith(secondNew), 0);
assert.strictEqual(api.dirtyIds().length, 2);

// Delete the earlier new row first. Its tracking id must not be confused
// with the row that DataTables would move into that position.
api.trackRowDeletion(tableWith(firstNew), 0);
api.trackRowDeletion(tableWith(secondNew), 0);
assert.deepStrictEqual(api.dirtyIds(), []);
assert.strictEqual(api.hasDeleted(), false);
assert.strictEqual(api.warnings().at(-1), false);

var www = loadedRow('www');
var other = loadedRow('other');
api.rememberRowBeforeEdit(tableWith(www), 0);
saveInPlace(www, 'www2');
api.markSavedRow(tableWith(www), 2);
api.trackRowDeletion(tableWith(other), 0);
assert.deepStrictEqual(api.dirtyIds(), [www._trackingId]);
assert.strictEqual(api.hasDeleted(), true);

api.trackRowDeletion(tableWith(www), 1);
assert.deepStrictEqual(api.dirtyIds(), []);
assert.strictEqual(api.hasDeleted(), true);
assert.strictEqual(api.warnings().at(-1), true);

// A later save rewrites column 7 from "0" to "1". That is only a sort key,
// so the row must remain a session-added row.
const added = loadTracking();
var created = addedRow('new');
added.rememberRowBeforeEdit(tableWith(created), 0);
added.markSavedRow(tableWith(created), 0);
created[7] = '1';
saveInPlace(created, 'renamed');
added.rememberRowBeforeEdit(tableWith(created), 0);
added.markSavedRow(tableWith(created), 0);
saveInPlace(created, 'new');
added.rememberRowBeforeEdit(tableWith(created), 0);
added.markSavedRow(tableWith(created), 0);
assert.deepStrictEqual(added.dirtyIds(), [created._trackingId]);
assert.strictEqual(added.hasDeleted(), false);

added.trackRowDeletion(tableWith(created), 0);
assert.deepStrictEqual(added.dirtyIds(), []);
assert.strictEqual(added.hasDeleted(), false);
assert.strictEqual(added.warnings().at(-1), false);
