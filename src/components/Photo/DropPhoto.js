import React, { useCallback, useState,useEffect } from "react";
import { useDropzone } from "react-dropzone";
import useXttribute from '../Xttribute/useXttribute';
import {API_BASE_URL} from '../../constants/apiConstants';
import './DropPhoto.css';
import parse from 'html-react-parser'; 
import useCookie from '../Cookie/useCookie';
import { TbDragDrop2 } from "react-icons/tb";
import xttribute_no_image from '../../medias/images/xttribute_no_image.png';
import axios from 'axios';
const dropzoneStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  borderWidth: "2px",
  borderRadius: "10px",
  borderColor: "#eeeeee",
  borderStyle: "",
  backgroundColor: "#fafafa",
  color: "#bdbdbd",
  outline: "none",
  transition: "border 0.24s ease-in-out",
  cursor: "pointer",
};

const activeDropzoneStyle = {
  borderColor: "#00adb5",
};

const DropzoneText = {
  fontSize: "16px",
  fontWeight: "600",
  textAlign: "center",
  marginTop: "-10",
};

const ImagePreview = {
  display: "flex",
  maxWidth: "100%",
  maxHeight: "100%",
  margin: "auto",
  borderRadius: "2px",
};

const FileName = {
  display: "flex",
  fontSize: "14px",
  marginTop: "8px",
};

const progressContainerStyle = {
  height: '8px',
  width: '100%',
  background: '#eee',
  borderRadius: 6,
  overflow: 'hidden',
  marginTop: 8,
};

const progressBarBase = (pct) => ({
  height: '100%',
  width: pct + '%',
  background: 'linear-gradient(90deg,#00adb5,#00bfa5)',
  transition: 'width 300ms ease',
});

const DropPhoto = ({
	type,
	folder,
	dbName,
	displayImage,
	collName,
	previewHeight,
	compId,
	onUploadSuccess,
	...props
}) => {
   const preview ={
     height: previewHeight,
     paddingBottom : "10px",
   }
   const [photos, setPhotos] = useState([]);
  const {cookie, setCookie}= useCookie("photoURL");
   const {xid} = useXttribute();
   const [fileList, setFileList] = useState();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

 // Resize image to max width 1000px before upload (skip for animated gifs)
  const resizeImage = (file, maxWidth = 1000) => {
	return new Promise((resolve, reject) => {
		if (!file || !file.type || file.type === 'image/gif') {
			// do not attempt to resize GIFs (to preserve animation) or non-images
			return resolve(file);
		}
		const reader = new FileReader();
		reader.onerror = (e) => reject(e);
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				let width = img.width;
				let height = img.height;
				if (width <= maxWidth) {
					// no resize needed
					return resolve(file);
				}
				const scale = maxWidth / width;
				width = Math.round(width * scale);
				height = Math.round(height * scale);
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0, width, height);
				const outputType = (file.type === 'image/png') ? 'image/png' : 'image/jpeg';
				canvas.toBlob((blob) => {
					if (!blob) return resolve(file);
					try {
						const newFile = new File([blob], file.name, { type: outputType });
						resolve(newFile);
					} catch (err) {
						// File constructor may not be available; fallback to blob
						resolve(blob);
					}
				}, outputType, 0.92);
			};
			img.onerror = (err) => reject(err);
			img.src = e.target.result;
		};
		reader.readAsDataURL(file);
	});
  };

  const onDrop = useCallback(async (acceptedFiles) => {
	// don't clear cookie here unless we intend to
	setPhotos(
      acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      )
    );
	setFileList (acceptedFiles.map((file) => (
			 <li key={file.name}>
			<img style={ImagePreview} src={file.preview} alt={file.name} />
			 <span style={FileName}>{file.name}</span>
			</li>
	)));
	// resize before upload
	try {
		const resized = await resizeImage(acceptedFiles[0], 1000);
		uploadToServer(resized);
	} catch (err) {
		console.error('Resize error', err);
		// fallback to original
		uploadToServer(acceptedFiles[0]);
	}
 	}, [xid, compId]);
 
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: "image/*",
    maxSize: 3256 * 3256 * 12,
    maxFiles: 3,
  });
 
 
  async function uploadToServer(file){
    // start upload progress UI
    setIsUploading(true);
    setUploadProgress(0);
     let formData = new FormData();
		// if file is a Blob (not File) and has no name, give it one
		if (file instanceof Blob && !(file instanceof File)) {
			// try to create a File with a generic name
			try {
				file = new File([file], 'upload.jpg', { type: file.type || 'image/jpeg' });
			} catch (e) {
				// File constructor may not exist; append blob with a name via append(name, blob, filename)
				// We'll handle below by using a filename param in append
			}
		}

		// If still not File, we will append with a filename explicitly
		if (file instanceof File) {
			formData.append ("files", file);
		} else {
			formData.append ("files", file, 'upload.jpg');
		}

		formData.append ("xid",xid);
		formData.append ("type", type);
		formData.append("folder", folder);
		formData.append("dbName", dbName);
		formData.append("compId", compId || "");
		formData.append("collName", collName);
		try{
			const response = await axios.post(API_BASE_URL+'/uploadFile', formData,{
				headers:{
					'Content-Type': 'multipart/form-data',
				},
				onUploadProgress: function(progressEvent) {
					try {
						if (progressEvent && progressEvent.total) {
							const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
							setUploadProgress(percentCompleted);
						}
					} catch (e) { /* ignore */ }
				}
			});
             if(response.status === 200){
                 if(response.data.file_409=== 'File upload to GSP failed'){
                     setFileList(<li key="uploadFailed">
                     <img style={ImagePreview} src={xttribute_no_image} alt="Upload failed"/>
                     </li>);
                     props.showError("Oops! File upload failed, Please try again!!");
                    // stop upload UI
                    setIsUploading(false);
                    setUploadProgress(0);
                     return;
                 } else {
                     // Upload succeeded. Notify parent with the server response so it can create/track the photo record.
                     props.showError && props.showError(null);
                     if (typeof onUploadSuccess === 'function') {
                         // pass the entire response.data; parent can decide how to extract id
                         onUploadSuccess(response.data);
                     }
                    // finish upload UI
                    setUploadProgress(100);
                    setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 600);
                 }
             };
         }catch (error){
             console.error('There was an error during upload:', error);
             props.showError && props.showError('There was an error during upload');
            setIsUploading(false);
            setUploadProgress(0);
         }

         };

   return (
     <div
      style={
        isDragActive
          ? { ...dropzoneStyle, ...activeDropzoneStyle }
          : dropzoneStyle
      }
      {...getRootProps({ role: 'presentation' })}
    >
      <input {...getInputProps()} /> 
      <div style={preview}>
        {cookie ? parse(cookie) : ''}
        {fileList ? (
          fileList
        ) : (
          <div style={{ ...DropzoneText, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column' }}>
            <div>Drag & drop or Click to upload a photo</div>
            <h3 style={{ marginTop: '8px' }}><TbDragDrop2 /></h3>
          </div>
        )}
        {/* upload progress bar shown below preview while uploading */}
        {isUploading && (
          <div style={{ marginTop: 8 }}>
            <div style={progressContainerStyle} aria-hidden>
              <div style={progressBarBase(uploadProgress)} />
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 6, textAlign: 'center' }}>Uploading{uploadProgress ? ` ${uploadProgress}%` : ' ...'}</div>
          </div>
        )}
       </div>
     </div>
   );
 }

 export default DropPhoto;