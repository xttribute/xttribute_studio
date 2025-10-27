import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Attributes.css';
import { API_BASE_URL, objDBName, PRIMARY_COLOR } from '../../constants/apiConstants';
import useXttribute from '../Xttribute/useXttribute';
import Editable from '../InlineEdit/Editable';
import { Row, Col } from 'reactstrap';
import { FaTrash } from 'react-icons/fa';

function Attributes({ showError, editable }) {
  const { xid, xuid } = useXttribute();
  // refs for the inline-edit inputs so Add can read live DOM values even if blur/save races with click
  const newAttrNameRef = useRef(null);
  const newAttrValueRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  // new attribute inputs
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  // confirmation target for inline popup: { recordId, fieldName }
  const [confirmTarget, setConfirmTarget] = useState(null);

  useEffect(() => {
    if (!xid) return;
    setLoading(true);
    const payload = {
      dbName: objDBName,
      collName: 'attribute',
      docContents: "{'xid':'" + xid + "'}",
      uKey: 'xid'
    };
    axios.post(`${API_BASE_URL}/getOneObject`, payload)
      .then((response) => {
        const data = response && response.data ? response.data : null;
        console.debug('Attributes.getOneObject response:', data);

        const parseResponseRecords = (data) => {
          if (!data) return [];
          // direct array
          if (Array.isArray(data.objects) && data.objects.length) return data.objects;
          // If top-level contains any array-of-objects under any key, prefer that
          for (const k of Object.keys(data)) {
            if (Array.isArray(data[k]) && data[k].length && typeof data[k][0] === 'object') return data[k];
          }
          // object under common keys
          if (data.object && typeof data.object === 'object') return [{ _id: data._id || data.object._id || `obj-${Date.now()}`, doc: data.object }];
          if (data.doc && typeof data.doc === 'object') return [{ _id: data._id || data.doc._id || `obj-${Date.now()}`, doc: data.doc }];
          // If the single object contains nested arrays of objects (e.g., object.attributes), unwrap those
          const single = data.object || data.doc || null;
          if (single && typeof single === 'object') {
            for (const k of Object.keys(single)) {
              if (Array.isArray(single[k]) && single[k].length && typeof single[k][0] === 'object') return single[k];
            }
          }
          // other plural keys
          const pluralKeys = ['records','results','rows','items','data','objects'];
          for (const k of pluralKeys) {
            if (Array.isArray(data[k]) && data[k].length) return data[k];
          }
          // other single-object keys
          const singleKeys = ['record','result','row','item'];
          for (const k of singleKeys) {
            if (data[k] && typeof data[k] === 'object') return [{ _id: data._id || data[k]._id || `obj-${Date.now()}`, doc: data[k] }];
          }
          // If data itself looks like an object with attribute-like keys (not just metadata), return it
          const metaKeys = ['doc_302','doc_201','status','error','message'];
          const dataKeys = Object.keys(data).filter(k => !metaKeys.includes(k));
          if (dataKeys.length > 0) {
            // remove any known metadata keys
            const obj = { ...data };
            metaKeys.forEach(k => { if (obj.hasOwnProperty(k)) delete obj[k]; });
            // if there are still meaningful keys, treat as single object
            const meaningfulKeys = Object.keys(obj).filter(k => k !== 'ok' && k !== 'n');
            if (meaningfulKeys.length > 0) return [{ _id: data._id || obj._id || `obj-${Date.now()}`, doc: obj }];
          }
          return [];
        };

        if (response.status === 200) {
          const parsed = parseResponseRecords(data);
          if (parsed && parsed.length) {
            // Normalize: ensure each record has a doc property for consistent rendering
            // Special-case: array of {name, value} pairs => convert to docs where key=name -> value
            let normalized;
            if (Array.isArray(parsed) && parsed.length && parsed[0] && typeof parsed[0] === 'object' && ('name' in parsed[0] || 'field' in parsed[0]) && ('value' in parsed[0] || 'val' in parsed[0])) {
              normalized = parsed.map((el, idx) => {
                const key = el.name || el.field;
                const val = el.value !== undefined ? el.value : el.val;
                return { _id: el._id || el.id || `obj-${Date.now()}-${idx}`, doc: { [key]: val } };
              });
            } else {
              normalized = parsed.map((el, idx) => {
                if (!el) return null;
                if (el.doc || el.object) return el;
                if (typeof el === 'object') return { _id: el._id || el.id || `obj-${Date.now()}-${idx}`, doc: el };
                return el;
              }).filter(Boolean);
            }
            console.debug('Attributes normalized sample:', normalized && normalized[0]);
            console.debug('Attributes parsed records count:', normalized.length);
            setRecords(normalized);
          } 
         } else {
           setRecords([]);
         }
       })
      .catch((err) => {
        console.error('Attributes load error', err);
        if (showError) showError('Failed to load attributes');
      })
      .finally(() => setLoading(false));
  }, [xid]);

  const handleAddAttribute = () => {
    // Read live values from refs (fallback to state). Using refs avoids race between input blur and click handlers.
    const name = (newAttrNameRef && newAttrNameRef.current && typeof newAttrNameRef.current.value !== 'undefined') ? String(newAttrNameRef.current.value).trim() : (newAttrName || '').trim();
    const value = (newAttrValueRef && newAttrValueRef.current && typeof newAttrValueRef.current.value !== 'undefined') ? String(newAttrValueRef.current.value).trim() : (newAttrValue || '').trim();
    if (!name) {
      if (showError) showError('Attribute name required');
      return;
    }
    if (!xid || !xuid) {
      if (showError) showError('Missing xid or xuid');
      return;
    }
    // If attribute name already exists in any loaded record, instruct user to edit instead
    const nameExists = records && records.some(r => {
      const doc = r && (r.doc || r.object || r);
      if (!doc || typeof doc !== 'object') return false;
      return Object.prototype.hasOwnProperty.call(doc, name);
    });
    if (nameExists) {
      if (showError) showError(" Attribute name existed , please edit this attribute in the list if you would like to change it");
      return;
    }
    // If we already loaded an attribute document for this xid, update that document instead of creating a new one.
    const existing = records && records.find(r => r && r.doc && (r.doc.xid === xid || r.doc._id === xid || r._id === xid));
    if (existing) {
      setLoading(true);
      // Prefer record._id if present, otherwise doc._id
      const recordId = existing._id || (existing.doc && (existing.doc._id || existing.doc.id));
      if (!recordId) {
        if (showError) showError('Existing record missing _id');
        return;
      }
      // Build payload for updateObject: lookup by _id and update the field named `name` with `value`.
      const payload = {
        dbName: 'xtrObject',
        collName: 'attribute',
        uKey: '_id',
        updateKey: name,
        docContents: "{'_id':'" + recordId + "','" + name + "':'" + value + "'}"
      };
      axios.post(`${API_BASE_URL}/updateObject`, payload)
        .then((response) => {
          console.debug('Attributes.updateObject response:', response && response.data ? response.data : response);
          if (response.status === 200 && response.data && response.data.success === 'updated') {
            // Merge updated field into local copy
            setRecords(prev => prev.map(r => {
              if (r && (r._id === recordId || (r.doc && (r.doc._id === recordId || r.doc.id === recordId)))) {
                const newDoc = { ...(r.doc || {}), [name]: value };
                return { ...r, doc: newDoc };
              }
              return r;
            }));
            // clear inputs: if refs point to actual DOM inputs and inputs are uncontrolled this clears them; keep state in sync
            if (newAttrNameRef && newAttrNameRef.current) newAttrNameRef.current.value = '';
            if (newAttrValueRef && newAttrValueRef.current) newAttrValueRef.current.value = '';
            // ensure inputs lose focus (blur) so Editable exits edit mode
            try {
              if (newAttrNameRef && newAttrNameRef.current && typeof newAttrNameRef.current.blur === 'function') newAttrNameRef.current.blur();
              if (newAttrValueRef && newAttrValueRef.current && typeof newAttrValueRef.current.blur === 'function') newAttrValueRef.current.blur();
            } catch(e) { /* ignore */ }
            // As a robust fallback, blur the currently focused element after the update completes
            setTimeout(() => {
              try { if (document && document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); } catch (e) { /* ignore */ }
            }, 0);
            setNewAttrName('');
            setNewAttrValue('');
          } else {
            if (showError) showError('Failed to update attribute');
          }
        })
        .catch((err) => {
          console.error('Update attribute error', err);
          if (showError) showError('Failed to update attribute');
        })
        .finally(() => setLoading(false));
      return;
    }

    // No existing attribute doc for this xid -> create new document
    setLoading(true);
    const payload = {
      dbName: 'xtrObject',
      collName: 'attribute',
      // Put fields into docContents: include xid, xuid and the attribute as a named field
      docContents: "{'xid':'" + xid + "','xuid':'" + xuid + "','" + name + "':'" + value + "'}",
      uKey: '0'
    };
    axios.post(`${API_BASE_URL}/newObject`, payload)
      .then((response) => {
        console.debug('Attributes.newObject response:', response && response.data ? response.data : response);
        if (response.status === 200 && response.data && (response.data.doc_201 === 'Document created' || response.data._id)) {
          const createdId = response.data._id || response.data.id;
          const createdObj = response.data.object || response.data.doc || null;
          const createdRecord = createdObj ? { _id: createdId, doc: createdObj } : { _id: createdId, doc: { xid, xuid, [name]: value } };
          setRecords(prev => [createdRecord, ...prev]);
          if (newAttrNameRef && newAttrNameRef.current) newAttrNameRef.current.value = '';
          if (newAttrValueRef && newAttrValueRef.current) newAttrValueRef.current.value = '';
          // blur inputs to remove focus and exit edit mode
          try {
            if (newAttrNameRef && newAttrNameRef.current && typeof newAttrNameRef.current.blur === 'function') newAttrNameRef.current.blur();
            if (newAttrValueRef && newAttrValueRef.current && typeof newAttrValueRef.current.blur === 'function') newAttrValueRef.current.blur();
          } catch(e) { /* ignore */ }
          // robust fallback: blur active element after creation
          setTimeout(() => {
            try { if (document && document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); } catch (e) { /* ignore */ }
          }, 0);
          setNewAttrName('');
          setNewAttrValue('');
        } else {
          if (showError) showError('Failed to create attribute');
        }
      })
      .catch((err) => {
        console.error('Create attribute error', err);
        if (showError) showError('Failed to create attribute');
      })
      .finally(() => setLoading(false));
   };

  // show inline confirmation popup next to the trash icon
  const requestRemoveAttribute = (record, fieldName, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const recordId = record && (record._id || (record.doc && (record.doc._id || record.doc.id)));
    if (!recordId) {
      if (showError) showError('Cannot determine record id');
      return;
    }
    setConfirmTarget({ recordId, fieldName });
  };

  // perform removal (called when user confirms in the inline popup)
  const handleRemoveAttribute = (recordId, fieldName) => {
    if (!recordId || !fieldName) return;
    setLoading(true);
    const payload = {
      dbName: 'xtrObject',
      collName: 'attribute',
      uKey: '_id',
      updateKey: fieldName,
      docContents: "{'_id':'" + recordId + "','" + fieldName + "':''}"
    };
    axios.post(`${API_BASE_URL}/updateObject`, payload)
      .then((response) => {
        // On success, remove the field locally so UI updates
        setRecords(prev => prev.map(r => {
          if (r && (r._id === recordId || (r.doc && (r.doc._id === recordId || r.doc.id === recordId)))) {
            const newDoc = Object.assign({}, (r.doc || {}));
            if (Object.prototype.hasOwnProperty.call(newDoc, fieldName)) {
              delete newDoc[fieldName];
            }
            return { ...r, doc: newDoc };
          }
          return r;
        }));
        setConfirmTarget(null);
      })
      .catch((err) => {
        console.error('Remove attribute field error', err);
        if (showError) showError('Failed to remove attribute');
      })
      .finally(() => {
        setLoading(false);
        setConfirmTarget(null);
      });
  };

  // helper: save edited field (either a value change or renaming a field)
  const handleSaveField = async (record, fieldName, newText, isNameChange = false) => {
    if (!record) return;
    const recordId = record && (record._id || (record.doc && (record.doc._id || record.doc.id)));
    if (!recordId) {
      if (showError) showError('Cannot determine record id');
      return;
    }

    // current value from local doc
    const currentValue = (record.doc && Object.prototype.hasOwnProperty.call(record.doc, fieldName)) ? record.doc[fieldName] : undefined;

    // no-op if value/name unchanged
    if (!isNameChange && String(currentValue) === String(newText)) return;
    if (isNameChange && fieldName === newText) return;

    setLoading(true);

    try {
      if (isNameChange) {
        // Rename: create new field with same value, then remove old field.
        const newName = String(newText).trim();
        if (!newName) {
          if (showError) showError('Attribute name cannot be empty');
          setLoading(false);
          return;
        }
        // Step 1: set new field to current value
        const payloadSet = {
          dbName: 'xtrObject',
          collName: 'attribute',
          uKey: '_id',
          updateKey: newName,
          docContents: "{'_id':'" + recordId + "','" + newName + "':'" + (currentValue || '') + "' }"
        };
        await axios.post(`${API_BASE_URL}/updateObject`, payloadSet);
        // Step 2: clear old field
        const payloadClear = {
          dbName: 'xtrObject',
          collName: 'attribute',
          uKey: '_id',
          updateKey: fieldName,
          docContents: "{'_id':'" + recordId + "','" + fieldName + "':''}"
        };
        await axios.post(`${API_BASE_URL}/updateObject`, payloadClear);

        // Update local state: replace key
        setRecords(prev => prev.map(r => {
          if (r && (r._id === recordId || (r.doc && (r.doc._id === recordId || r.doc.id === recordId)))) {
            const newDoc = { ...(r.doc || {}) };
            if (Object.prototype.hasOwnProperty.call(newDoc, fieldName)) {
              newDoc[newName] = newDoc[fieldName];
              delete newDoc[fieldName];
            } else {
              newDoc[newName] = currentValue;
            }
            return { ...r, doc: newDoc };
          }
          return r;
        }));
      } else {
        // update value for existing field
        const payload = {
          dbName: 'xtrObject',
          collName: 'attribute',
          uKey: '_id',
          updateKey: fieldName,
          docContents: "{'_id':'" + recordId + "','" + fieldName + "':'" + newText + "' }"
        };
        await axios.post(`${API_BASE_URL}/updateObject`, payload);
        // update local
        setRecords(prev => prev.map(r => {
          if (r && (r._id === recordId || (r.doc && (r.doc._id === recordId || r.doc.id === recordId)))) {
            const newDoc = { ...(r.doc || {}) };
            newDoc[fieldName] = newText;
            return { ...r, doc: newDoc };
          }
          return r;
        }));
      }
    } catch (err) {
      console.error('Error saving field edit', err);
      if (showError) showError('Failed to save attribute change');
    } finally {
      setLoading(false);
    }
  };

  // Extract field pairs from a record.
  // If backend returned full object under `doc` or `object`, use it; otherwise use record itself.
  const getFieldPairs = (rec) => {
    const excluded = ['_id', 'id', 'xid', 'xuid', '__v'];
    let obj = null;
    if (!rec) return [];
    if (rec.doc && typeof rec.doc === 'object') obj = rec.doc;
    else if (rec.object && typeof rec.object === 'object') obj = rec.object;
    else if (rec && typeof rec === 'object') obj = rec;
    if (!obj) return [];
    return Object.entries(obj)
      .filter(([k, v]) => !excluded.includes(k))
      .map(([k, v]) => ({ name: k, value: v }));
  };

  return (
    <div className="attributes-root">
      <h3>Attributes</h3>
      {/* Inline-edit input pair for new attribute */}
      <div className="attributes-new-pair">
        <Row>
          <Col>
            <Editable
              text={newAttrName}
              placeholder="Attribute name"
              type="input"
              edit="t"
              childRef={newAttrNameRef}
              onSave={(txt) => setNewAttrName(txt)}
            >
              <input
                className="form-control"
                ref={newAttrNameRef}
                value={newAttrName}
                onChange={(e) => setNewAttrName(e.target.value)}
                placeholder="Attribute name"
              />
            </Editable>
          </Col>
          <Col>
            <Editable
              text={newAttrValue}
              placeholder="Attribute value"
              type="input"
              edit="t"
              childRef={newAttrValueRef}
              onSave={(txt) => setNewAttrValue(txt)}
            >
              <input
                className="form-control"
                ref={newAttrValueRef}
                value={newAttrValue}
                onChange={(e) => setNewAttrValue(e.target.value)}
                placeholder="Attribute value"
              />
            </Editable>
          </Col>
          <Col xs="auto">
            <button
              className="btn"
              onMouseDown={(e) => { e.preventDefault(); handleAddAttribute(); }}
              disabled={loading}
              style={{
                backgroundColor: PRIMARY_COLOR,
                borderColor: PRIMARY_COLOR,
                color: '#fff'
              }}
            >
              {loading ? 'Saving...' : 'Add'}
            </button>
          </Col>
        </Row>
      </div>
      {loading && <div>Loading...</div>}
      {!loading && records && records.length === 0 && (
        <div style={{ color: '#666' }}>No attributes found.</div>
      )}
      <ul className="attributes-list">
        {records && records.map((r) => {
          const pairs = getFieldPairs(r);
          return (
            <li key={r._id || r.id || JSON.stringify(r).slice(0,30)} className="attribute-item">
              {pairs && pairs.length > 0 ? (
                <div className="attribute-pairs">
                  {pairs.map((p, idx) => (
                    <div className="attribute-pair"
                      key={p.name + idx}
                    >
                      <div className="attribute-name">
                        <span title={p.name}>{p.name}</span>
                      </div>
                       <div className="attribute-value">
                         <Editable
                           text={String(p.value)}
                           placeholder="Attribute value"
                           type="input"
                           edit="t"
                           onSave={(txt) => handleSaveField(r, p.name, txt, false)}
                         >
                           <input
                             className="form-control"
                             defaultValue={p.value}
                           />
                         </Editable>
                       </div>
                       <button
                         className="btn btn-link attribute-remove-btn"
                         onClick={(e) => requestRemoveAttribute(r, p.name, e)}
                         title="Remove this attribute"
                       >
                         <FaTrash />
                       </button>
                       {confirmTarget && confirmTarget.recordId === (r._id || (r.doc && (r.doc._id || r.doc.id))) && confirmTarget.fieldName === p.name && (
                         <div className="confirm-popup">
                           <div className="confirm-actions">
                             <button className="btn btn-secondary btn-sm" onClick={() => setConfirmTarget(null)} disabled={loading}>Cancel</button>
                             <button className="btn btn-danger btn-sm" onClick={() => handleRemoveAttribute(r._id || (r.doc && (r.doc._id || r.doc.id)), p.name)} disabled={loading}>Confirm</button>
                           </div>
                         </div>
                       )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="attribute-plain">
                  <div className="attribute-name">{r.name || r.title || `Attribute ${r._id || r.id}`}</div>
                  <div className="attribute-value">{r.value || r.content || ''}</div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  );
}

export default Attributes;
