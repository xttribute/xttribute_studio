import React, { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import useXttribute from '../Xttribute/useXttribute';
import {API_BASE_URL, CDNURL} from '../../constants/apiConstants';
import './DropSound.css';
import { TbDragDrop2 } from "react-icons/tb";
import axios from 'axios';

const DropSound = ({
	type,
	folder,
	dbName,
	displayImage,
	collName,
	previewHeight,
	compId,
	...props
}) => {
	const preview ={
		height: previewHeight,
		paddingBottom : "10px",
	}

  const {xid} = useXttribute();
  const [fileList, setFileList] = useState([]);
  const [uploadedSoundSrc, setUploadedSoundSrc] = useState(null);
  // uploading state & progress (0-100)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  // localCompId mirrors compId prop so we react to prop changes from parent
  const [localCompId, setLocalCompId] = useState(compId || null);

  // keep localCompId in sync if parent provides/updates compId after mount
  useEffect(() => {
     if (compId) setLocalCompId(compId);
   }, [compId]);

  // keep a ref with latest compId/localCompId to avoid stale closures in upload handler
  const compRef = useRef({ compId: compId || null, localCompId: compId || null });
  useEffect(() => {
    compRef.current = { compId: compId || null, localCompId };
  }, [compId, localCompId]);

   // onDrop - handle images (resize) or audio (no resize) before preview and upload
   const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    const originalFile = acceptedFiles[0];

    // If uploading sound/audio, record filename and start upload (do NOT create a local audio preview)
    if (type === 'sound' || (originalFile && originalFile.type && originalFile.type.startsWith('audio/'))) {
      try {
        setFileList([{ name: originalFile.name }]);
        // upload and let server response provide persistent URL; uploadToServer will update audio player when done
        uploadToServer(originalFile);
      } catch (err) {
        console.error('Error preparing audio file:', err);
        uploadToServer(originalFile);
      }
      return;
    }

    try {

      uploadToServer(originalFile);
    } catch (err) {
      
      uploadToServer(acceptedFiles[0]);
    }
  }, [xid,  type]);
 
   // disable dropzone for sound until a compId (from parent or created locally) is available
   const disabledDrop = (type === 'sound' && !(compId || localCompId));

   const { getRootProps, getInputProps, isDragActive } = useDropzone({
     onDrop,
     accept: type === 'sound' ? 'audio/*' : 'image/*',
     disabled: disabledDrop,
     maxSize: 3256 * 3256 * 12,
     maxFiles: 3,
   });


   async function uploadToServer(file){
    // debug: show current compId values to help trace race conditions
    console.debug('uploadToServer called, compId prop:', compId, 'localCompId state:', localCompId);

    // If compId isn't set yet, wait briefly (up to 5s) for parent to supply it — handles race where parent creates record on +sound click
    const waitForCompId = async (timeoutMs = 5000, intervalMs = 200) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const current = compRef.current;
        if (current.compId || current.localCompId) return current.compId || current.localCompId;
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, intervalMs));
      }
      return null;
    };

    const availableCompId = (compRef.current.compId || compRef.current.localCompId) || await waitForCompId();
    if (!availableCompId) console.warn('No compId available before upload; proceeding without it.');

    const formData = new FormData();
    formData.append("files", file);
    formData.append("xid", xid);
    formData.append("type", type);
    formData.append("folder", folder);
    formData.append("dbName", dbName);

    const pick = v => (v === undefined || v === null) ? null : String(v).trim();
    const compToSend = pick(compId) || pick(localCompId) || pick(availableCompId);
    if (compToSend) formData.append("compId", compToSend);
    formData.append("collName", collName);

    // start uploading and show progress
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await axios.post(API_BASE_URL + '/uploadFile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: function(progressEvent) {
          try {
            if (progressEvent && progressEvent.total) {
              const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(pct);
            }
          } catch (e) { /* ignore */ }
        }
      });

      if (response && response.status === 200) {
        // ensure progress shows 100% briefly
        setUploadProgress(100);
        setTimeout(() => { setIsUploading(false); setUploadProgress(null); }, 600);
        if (response.data && response.data.file_409 === 'File upload to GSP failed') {
          props.handleError("Oops! File upload failed, Please try again!!");
          return;
        }

        props.handleError(null);

        // prepare server sound URL (prefer response.data.sound)
        if (type === 'sound') {
          const d = response.data || {};
          let src = null;
          if (d && d.sound) src = d.sound;
          else if (typeof d === 'string') src = d;
          else if (d.fileUrl) src = d.fileUrl;
          else if (d.url) src = d.url;
          else if (d.path) src = d.path;
          else if (d.file_path) src = d.file_path;
          else if (d.file && typeof d.file === 'string') src = d.file;
          else if (d.files && Array.isArray(d.files) && d.files[0]) {
            src = d.files[0].sound || d.files[0].url || d.files[0].path || d.files[0].file;
          }

          if (src && !src.startsWith('http')) {
            const base = (typeof CDNURL === 'string' && CDNURL) ? CDNURL : API_BASE_URL;
            src = src.startsWith('/') ? base + src : base + src;
          }

          if (src) {
            // update UI with server URL (do not use local blob for final player)
            setUploadedSoundSrc(src);
            setFileList([{ name: file.name }]);

            // notify parent with server response, original file, and explicit soundUrl
            if (typeof props.onSoundUploaded === 'function') {
              try { props.onSoundUploaded({ response: response.data, file: file, soundUrl: src }); }
              catch (e) { console.error('onSoundUploaded callback error', e); }
            }

            // no autoplay here — parent / modal player will handle playback
          } else {
            // no usable server URL — notify parent and keep local preview
            if (typeof props.onThumbnailUploaded === 'function') {
              try { props.onThumbnailUploaded({ response: response.data, file: file }); }
              catch (e) { console.error('onSoundUploaded callback error', e); }
            }
          }
        }
      }
    } catch (error) {
      setIsUploading(false);
      setUploadProgress(null);
      console.error('There was an error during upload:', error);
      if (typeof props.handleError === 'function') props.handleError('Upload failed');
    }
   };

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? 'active' : ''}`}
    >
      <input {...getInputProps()} /> 
      <div>
        {disabledDrop && (
          <div className="disabled-drop">
            Waiting for server to create record...
          </div>
        )}
      </div>
	  {/* show drop icon when no uploaded sound; after upload show filename instead of icon */}
	  {uploadedSoundSrc ? (
	    <div className="filename-center">{(fileList && fileList[0] && fileList[0].name) ? fileList[0].name : 'Uploaded'}</div>
	  ) : (!isUploading ? (
	    <div className="svg-center"><TbDragDrop2 /></div>
	  ) : null)}
      {/* progress bar shown while uploading */}
      {isUploading && (
        <div className="progress-wrap">
          <div className="progress-bar">
            <div className="progress-inner" style={{ width: `${uploadProgress || 0}%` }}></div>
          </div>
          <div className="progress-text">{uploadProgress ? `${uploadProgress}%` : 'Uploading...'}</div>
        </div>
      )}
    </div>
   );
 }
 
export default DropSound;