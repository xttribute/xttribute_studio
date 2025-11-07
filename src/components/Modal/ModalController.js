import React, { useRef, useState, useEffect } from "react";
import './ModalController.css';
import Modal from 'react-bootstrap/Modal';
import Editable from '../InlineEdit/Editable';
import { AiOutlineCheck } from 'react-icons/ai';
import { CiEdit } from 'react-icons/ci';

// ModalController renders the photo and supports inline-editing of the title
// using the same Editable style as Attributes.js. Pass `onSave` (text, keyId)
// and `editable` props from the parent to enable saving to backend.
export default function ModalController({ onClose, status, title, photoURL, photoId, count, action, source, viewCount, onSave, editable }) {
  const editControllerRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  // keep a local title so the modal reflects the latest value immediately
  const [localTitle, setLocalTitle] = useState(title);

  // update localTitle when parent prop changes (e.g. parent updated after save)
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  const startEditing = () => {
    try {
      if (editControllerRef.current && typeof editControllerRef.current.start === 'function') {
        editControllerRef.current.start();
      }
    } catch (e) { console.log('[ModalController] startEditing error', e); }
  };

  const confirmEdit = async () => {
    if (!editControllerRef.current || typeof editControllerRef.current.save !== 'function') return;
    try {
      setSaving(true);
      // prevent the Editable onBlur handler from triggering a duplicate save
      try { if (typeof editControllerRef.current.preventBlurOnce === 'function') editControllerRef.current.preventBlurOnce(); } catch (e) {}
      const result = editControllerRef.current.save();
      if (result && typeof result.then === 'function') await result;
    } catch (err) {
      console.log('[ModalController] save error', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={status}
      onHide={onClose}
      dialogClassName="modalWidth"
      aria-labelledby="example-custom-modal-styling-title"
    >
      <Modal.Header closeButton>
        <Modal.Title id="example-custom-modal-styling-title">
          <span className="modal-title-editable">
            <Editable
              text={localTitle}
              placeholder="Title"
              type="input"
              edit={editable ? "t" : "f"}
              onSave={async (txt) => {
                // call parent onSave if provided, wait for it, then update localTitle
                let result;
                if (typeof onSave === 'function') {
                  try {
                    result = onSave(txt, photoId);
                    if (result && typeof result.then === 'function') await result;
                  } catch (e) {
                    // if parent save failed, rethrow so Editable can handle it
                    throw e;
                  }
                }
                // update local title immediately after successful save
                try { setLocalTitle(txt); } catch (e) {}
                return result;
              }}
              editControllerRef={editControllerRef}
              hideIcon={true}
              onEditStateChange={(editing) => setIsEditing(!!editing)}
            >
              {/* Use a key tied to title so the input remounts when title changes after save */}
              <input className="form-control" defaultValue={localTitle} key={localTitle} />
            </Editable>

            {/* show pencil when not editing, check when editing */}
            {editable && !isEditing ? (
              <button
                type="button"
                className="modal-title-edit-btn"
                onClick={startEditing}
                aria-label="Edit title"
                title="Edit title"
              >
                <CiEdit />
              </button>
            ) : null}
            {isEditing ? (
              <button
                type="button"
                className="modal-title-edit-btn"
                onClick={confirmEdit}
                disabled={saving}
                aria-label="Confirm title"
                title="Confirm title"
              >
                <AiOutlineCheck />
              </button>
            ) : null}
           </span>
         </Modal.Title>
       </Modal.Header>

       <Modal.Body>
         <img src={photoURL} alt={localTitle || 'Photo'} style={{ width: '100%' }} />
       </Modal.Body>
       <Modal.Footer></Modal.Footer>
     </Modal>
   );
}