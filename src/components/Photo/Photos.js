import React, { useState, useRef, useEffect } from 'react';
import './Photos.css';
import Editable from '../InlineEdit/Editable';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton'
import { Resizable, ResizableBox } from "react-resizable";
import { CDNURL } from '../../constants/apiConstants';
import xttribute_no_image from '../../medias/images/xttribute_no_image.png';
import { Row, Col } from 'reactstrap';
import ModalController from "../Modal/ModalController";
import View from "../Stats/View";
import { ObjectId } from 'bson'; // Import ObjectId to decode timestamps

const Photos = ({ records, onSaveTitle, onTextChange, removePhoto, iValues, setIValues, editable, isEdit, ref }) => {
  const textareaRef = useRef();
  const inputRef = useRef();
  const [status, setState] = React.useState(false);
  const [photoURL, setPhotoURL] = useState();
  const [photoId, setPhotoId] = useState();
  const [viewCount, setViewCount] = useState();
  const [photoTitle, setPhotoTitle] = useState('');

  // local copy of photos so we can optimistically update a title when modal save succeeds
  const [photos, setPhotos] = useState(records || []);

  // sync local photos when parent records change
  useEffect(() => {
    setPhotos(records || []);
  }, [records]);

  const handleChange = ({ target }) => {
    setIValues((prevIValues) => ({
      ...prevIValues,
      [target.name]: target.value,
    }));
  };

  const handleClick = (photoURL, photoId, viewCount, title) => {
    setIValues((prevIValues) => ({
      ...prevIValues,
      ["vc_" + photoId]: viewCount + 1,
    }));
    setPhotoURL(photoURL);
    setPhotoId(photoId);
    setViewCount(viewCount);
    setPhotoTitle(title || 'Photo');
    setState(true);
  };

  const closeModal = () => {
    setState(false);
  };

  // wrapper to call parent onSaveTitle and update local photos array for the specific photo
  const handleSaveTitle = async (newTitle, id) => {
    let result;
    if (typeof onSaveTitle === 'function') {
      try {
        result = onSaveTitle(newTitle, id);
        if (result && typeof result.then === 'function') await result;
      } catch (e) {
        // rethrow so caller (Editable) can handle errors
        throw e;
      }
    }
    // update the local photos list so listing reflects the change immediately
    try {
      setPhotos(prev => prev.map(p => {
        const pid = p._id || p.id || '';
        if (String(pid) === String(id)) return { ...p, title: newTitle };
        return p;
      }));
    } catch (e) { /* ignore */ }
    return result;
  };

  // Group photos by date
  const groupPhotosByDate = (photosList) => {
    const grouped = {};
    photosList.forEach((photo) => {
      const objectId = new ObjectId(photo._id || photo.id);
      const date = new Date(objectId.getTimestamp()).toLocaleDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(photo);
    });
    return grouped;
  };

  const groupedPhotos = groupPhotosByDate(photos);

  return (
    <div>
      {Object.keys(groupedPhotos).map((date) => (
        <div key={date}>
          <h3 style={{ textAlign: 'center', color: '#555', fontSize: '14px' }}>{date}</h3>
          <div className="photoRow">
            {groupedPhotos[date].map((record) => (
              <ResizableBox className="resizebox" width={210} height={198} key={record._id || record.id}>
                <div class="photoTitle">
                  <Row>
                    <Col>
                      <span className="titleText">{record.title}</span>
                    </Col>
                    <Col xs={3} style={{ marginTop: '-7px' }}>
                      {isEdit ? (
                        <IconButton
                          aria-label="delete"
                          size="small"
                          onClick={() => removePhoto(record._id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        ""
                      )}
                    </Col>
                  </Row>
                </div>
                <div>
                  <img
                    onClick={() =>
                      handleClick(
                        CDNURL + record.photo,
                        record._id,
                        iValues["vc_" + record._id],
                        record.title
                      )
                    }
                    src={record.photo ? CDNURL + record.photo : xttribute_no_image}
                    alt="Norway"
                    style={{ width: '100%' }}
                  />
                </div>
              </ResizableBox>
            ))}
          </div>
        </div>
      ))}
      <ChildComponent
        isOpen={status}
        handleClick={handleClick}
        onClose={closeModal}
        title={photoTitle}
        photoURL={photoURL}
        photoId={photoId}
        viewCount={viewCount}
        onSave={handleSaveTitle}
        editable={isEdit || (editable === 't')}
      />
    </div>
  );
};

const ChildComponent = ({ isOpen, handleClick, onClose, title, photoURL, photoId, viewCount, onSave, editable }) => {
  return (
    <>
      {isOpen && (
        <ModalController
          status={isOpen}
          handleClick={handleClick}
          onClose={onClose}
          title={title}
          photoURL={photoURL}
          photoId={photoId}
          count="1"
          action="view"
          source="photo"
          viewCount={viewCount}
          onSave={onSave}
          editable={editable}
        />
      )}
    </>
  );
};

export default Photos;