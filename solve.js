// A fast drop-in replacement for csv-reader 1.0.0, make.fun's reference program for the
// csv-reader-speed-01 bounty. run(input) returns exactly the reference's answer for every
// input — {columns, rows, errors} under the same broken-row policy — but where the reference
// reads one character at a time and builds each field character by character, this parser
// scans whole spans between special characters with indexOf and slices fields out of the
// text, so the identical answer costs a fraction of the CPU time.
//
// The policy, as implemented here:
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - a CR outside quotes that is not part of a CRLF is dropped (error stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled: ""
//     inside it is one quote, and each CRLF or lone CR inside it is read as one LF; what
//     follows the closing quote, up to the next comma or line break, is appended as it
//     stands (error quote_junk, when anything was appended); a quote that never closes is
//     a literal character and the text after it is read again as unquoted text (error
//     unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings, never
//     trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the records
//     after it (every record when header is false), each padded with "" (error short_row,
//     with fields: its count) or cut (error long_row, with extra: the cut fields) to the
//     first record's width;
//   - each error is {code, line, row}: line the 1-based line its record starts on (every
//     LF, CRLF and lone CR inside a quoted field counted), row its record's index in rows
//     (null for the header), in the order met, a field's quote_junk when the field ends and
//     a record's short_row or long_row when the record ends.

// How a field ended: at a comma (the record goes on), at a line break or at the end of the
// text (the record ends).
const COMMA = 0;
const BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input {text, header}: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the
  // header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended, and how many characters the last
  // readUnquoted kept (the quote_junk test needs the count).
  let fValue = '';
  let fEnded = END;
  let fAdded = 0;

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR not
  // followed by LF is dropped (stray_cr). Sets fValue, fEnded and fAdded.
  function readUnquoted(value) {
    let seg = pos; // the start of the span not yet copied onto value
    let added = 0;
    for (;;) {
      let ic = text.indexOf(',', pos);
      if (ic < 0) ic = n;
      let il = text.indexOf('\n', pos);
      if (il < 0) il = n;
      let ir = text.indexOf('\r', pos);
      if (ir < 0) ir = n;
      let j = ic < il ? ic : il;
      if (ir < j) j = ir;
      if (j >= n) {
        fValue = value + text.slice(seg, n);
        fAdded = added + (n - seg);
        fEnded = END;
        pos = n;
        return;
      }
      const code = text.charCodeAt(j);
      if (code === 44) { // ','
        fValue = value + text.slice(seg, j);
        fAdded = added + (j - seg);
        fEnded = COMMA;
        pos = j + 1;
        return;
      }
      if (code === 10) { // LF
        fValue = value + text.slice(seg, j);
        fAdded = added + (j - seg);
        fEnded = BREAK;
        pos = j + 1;
        line += 1;
        return;
      }
      // CR: part of a CRLF it ends the field; a lone CR is dropped and the scan goes on.
      if (text.charCodeAt(j + 1) === 10) {
        fValue = value + text.slice(seg, j);
        fAdded = added + (j - seg);
        fEnded = BREAK;
        pos = j + 2;
        line += 1;
        return;
      }
      value += text.slice(seg, j);
      added += j - seg;
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      pos = j + 1;
      seg = pos;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue and fEnded.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let seg = pos; // the start of the span that can be copied verbatim
    let value = '';
    let closed = false;
    for (;;) {
      let iq = text.indexOf('"', pos);
      if (iq < 0) iq = n;
      let ir = text.indexOf('\r', pos);
      if (ir < 0) ir = n;
      let il = text.indexOf('\n', pos);
      if (il < 0) il = n;
      let j = iq < ir ? iq : ir;
      if (il < j) j = il;
      if (j >= n) break;
      const code = text.charCodeAt(j);
      if (code === 34) { // '"'
        if (text.charCodeAt(j + 1) === 34) { // a doubled quote: one literal quote
          value += text.slice(seg, j) + '"';
          pos = j + 2;
          seg = pos;
          continue;
        }
        value += text.slice(seg, j);
        pos = j + 1;
        closed = true;
        break;
      }
      if (code === 13) { // a CR inside quotes: CRLF or a lone CR, each read as one LF
        value += text.slice(seg, j) + '\n';
        line += 1;
        pos = text.charCodeAt(j + 1) === 10 ? j + 2 : j + 1;
        seg = pos;
        continue;
      }
      // An LF inside quotes is kept as it stands (it lies inside the verbatim span); only
      // the line count moves.
      line += 1;
      pos = j + 1;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after it is read
      // again as unquoted text.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      readUnquoted('"');
      return;
    }
    fValue = value;
    if (pos >= n) {
      fEnded = END;
      return;
    }
    const code = text.charCodeAt(pos);
    if (code === 44) { // ','
      pos += 1;
      fEnded = COMMA;
      return;
    }
    if (code === 10) { // LF
      pos += 1;
      line += 1;
      fEnded = BREAK;
      return;
    }
    if (code === 13 && text.charCodeAt(pos + 1) === 10) { // CRLF
      pos += 2;
      line += 1;
      fEnded = BREAK;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next comma or
    // line break; its own stray_cr errors land before the quote_junk.
    readUnquoted(value);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const code = text.charCodeAt(pos);
      if (code === 10) {
        pos += 1;
        line += 1;
      } else if (code === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr
    // errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
