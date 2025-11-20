import React, { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import useXttribute from '../Xttribute/useXttribute';
import {API_BASE_URL, CDNURL} from '../../constants/apiConstants';
import './DropVideo.css';
import { TbDragDrop2 } from "react-icons/tb";
import axios from 'axios';

const DropVideo = ({
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
  const [uploadedVideoSrc, setUploadedVideoSrc] = useState(null);
   // created object URL for local file preview (revoked on cleanup)
   const createdObjectUrlRef = useRef(null);
  // generated local thumbnail data URL (base64) for the file before/while uploading
  const [localThumbnail, setLocalThumbnail] = useState(null);
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

   // onDrop - handle images (resize) or video before preview and upload
   const onDrop = useCallback(async (acceptedFiles) => {
     if (!acceptedFiles || acceptedFiles.length === 0) return;

     const originalFile = acceptedFiles[0];

     // If uploading video, record filename and start upload (do NOT create a local preview)
     if (type === 'video') {
       try {
         setFileList([{ name: originalFile.name }]);
         // upload and let server response provide persistent URL; uploadToServer will update audio player when done
         uploadToServer(originalFile);
       } catch (err) {
         console.error('Error preparing video file:', err);
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
  
    // disable dropzone for video until a compId (from parent or created locally) is available
    const disabledDrop = (type === 'video' && !(compId || localCompId));

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
     onDrop,
     accept: type === 'video' ? 'video/*' : 'image/*',
     disabled: disabledDrop,
     maxSize: 3256 * 3256 * 12,
     maxFiles: 3,
   });


   async function uploadToServer(file){
    // debug: show current compId values to help trace race conditions
    console.debug('uploadToServer called, compId prop:', compId, 'localCompId state:', localCompId);

    // Create a local object URL for the file to use for immediate preview / reliable thumbnail extraction
    try {
      if (file && typeof URL !== 'undefined' && URL.createObjectURL) {
        // revoke previous if any
        try { if (createdObjectUrlRef.current) URL.revokeObjectURL(createdObjectUrlRef.current); } catch (e) {}
        const obj = URL.createObjectURL(file);
        createdObjectUrlRef.current = obj;
        setUploadedVideoSrc(obj);
        // try generating a thumbnail from the local object URL (best-effort, no CORS)
        try {
          generateThumbnailFromSrc(obj).then((thumb) => { if (thumb) setLocalThumbnail(thumb); }).catch(()=>{});
        } catch (e) {}
      }
    } catch (e) {
      console.warn('Failed to create object URL for preview', e);
    }

    // If compId isn't set yet, wait briefly (up to 5s) for parent to supply it — handles race where parent creates record on +video click
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

        // prepare server video URL (prefer response.data.video)
        if (type === 'video') {
          const d = response.data || {};
          let src = null;
          if (d && d.video) src = d.video;
          else if (typeof d === 'string') src = d;
          else if (d.fileUrl) src = d.fileUrl;
          else if (d.url) src = d.url;
          else if (d.path) src = d.path;
          else if (d.file_path) src = d.file_path;
          else if (d.file && typeof d.file === 'string') src = d.file;
          else if (d.files && Array.isArray(d.files) && d.files[0]) {
            src = d.files[0].video || d.files[0].url || d.files[0].path || d.files[0].file;
          }

          if (src && !src.startsWith('http')) {
            const base = (typeof CDNURL === 'string' && CDNURL) ? CDNURL : API_BASE_URL;
            src = src.startsWith('/') ? base + src : base + src;
          }

          if (src) {
            // update UI with server URL (do not use local blob for final player)
            setUploadedVideoSrc(src);
            setFileList([{ name: file.name }]);

            // notify parent with server response, original file, and explicit videoUrl
            if (typeof props.onVideoUploaded === 'function') {
              try { props.onVideoUploaded({ response: response.data, file: file, videoUrl: src, localUrl: createdObjectUrlRef.current || null, thumbnailData: localThumbnail || null }); }
               catch (e) { console.error('onVideoUploaded callback error', e); }
            }

            // no autoplay here — parent / modal player will handle playback
          } else {
            // no usable server URL — notify parent and keep local preview
            if (typeof props.onThumbnailUploaded === 'function') {
              try { props.onThumbnailUploaded({ response: response.data, file: file }); }
              catch (e) { console.error('onVideoUploaded callback error', e); }
            }
          }
        }
      }
    } catch (error) {
      // revoke local object URL on error to avoid leaks
      try { if (createdObjectUrlRef.current) { URL.revokeObjectURL(createdObjectUrlRef.current); createdObjectUrlRef.current = null; } } catch (e) {}
      setIsUploading(false);
      setUploadProgress(null);
      console.error('There was an error during upload:', error);
      if (typeof props.handleError === 'function') props.handleError('Upload failed');
    }
   };

  // cleanup created object URL on unmount
  useEffect(() => {
    return () => {
      try { if (createdObjectUrlRef.current) { URL.revokeObjectURL(createdObjectUrlRef.current); createdObjectUrlRef.current = null; } } catch (e) {}
    };
  }, []);

  // Helper to generate a thumbnail data URL from a video src (object URL or blob URL). Returns Promise<string|null>.
  async function generateThumbnailFromSrc(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      let v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'metadata';
      v.src = src;
      // place offscreen
      v.style.position = 'absolute'; v.style.left = '-9999px'; v.style.width = '160px'; v.style.height = '90px'; v.style.opacity = '0';
      document.body.appendChild(v);
      const cleanup = () => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} try { if (v.parentNode) v.parentNode.removeChild(v); } catch (e) {} v = null; };
      const onErr = () => { cleanup(); resolve(null); };
      const onLoaded = () => {
        const target = Math.min(1, Math.max(0, (v.duration || 0) / 3));
        const onSeeked = () => {
          try {
            const c = document.createElement('canvas');
            const w = v.videoWidth || 320; const h = v.videoHeight || 180; const maxW = 320; const scale = Math.min(1, maxW / w);
            c.width = Math.floor(w * scale); c.height = Math.floor(h * scale);
            const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0, c.width, c.height);
            const data = c.toDataURL('image/jpeg', 0.8);
            v.removeEventListener('seeked', onSeeked);
            cleanup();
            resolve(data);
          } catch (e) { v.removeEventListener('seeked', onSeeked); cleanup(); resolve(null); }
        };
        v.addEventListener('seeked', onSeeked);
        try { v.currentTime = target; } catch (e) { setTimeout(() => onSeeked(), 250); }
      };
      v.addEventListener('loadedmetadata', onLoaded);
      v.addEventListener('error', onErr);
      try { v.load(); } catch (e) { /* ignore */ }
      // timeout
      setTimeout(() => { try { if (v) { cleanup(); } } catch (e) {} resolve(null); }, 5000);
    });
  }

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
	  {/* show drop icon when no uploaded video; after upload show filename instead of icon */}
	  {uploadedVideoSrc ? (
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
  
 export default DropVideo;