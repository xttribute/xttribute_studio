import React, { useCallback, useState,useEffect } from "react";
import { useDropzone } from "react-dropzone";
import useXttribute from '../Xttribute/useXttribute';
import {API_BASE_URL} from '../../constants/apiConstants';
import './DropThumbnail.css';
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
  marginTop: "2rem",
  borderWidth: "2px",
  borderRadius: "10px",
  borderColor: "#eeeeee",
  borderStyle: "",
  backgroundColor: "#fafafa",
  color: "#bdbdbd",
  outline: "none",
  transition: "border 0.24s ease-in-out",
  cursor: "pointer",
  height: "300px",
  position: 'relative',
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

const svgCenterStyle = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
  color: '#bdbdbd',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 48,
};

// helper: resize an image File to maxWidth (preserve aspect ratio). Returns a File (or original file if no resize needed).
async function resizeImageFile(file, maxWidth = 400, quality = 0.9) {
  // only handle image types
  if (!file || !file.type || !file.type.startsWith('image/')) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const { width, height } = img;
        if (width <= maxWidth) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        const ratio = maxWidth / width;
        const targetWidth = Math.round(width * ratio);
        const targetHeight = Math.round(height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        canvas.toBlob((blob) => {
          if (!blob) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Canvas is empty'));
            return;
          }
          // create a new File so name/type are preserved
          const newFile = new File([blob], file.name, { type: file.type, lastModified: Date.now() });
          URL.revokeObjectURL(objectUrl);
          resolve(newFile);
        }, file.type || 'image/jpeg', quality);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for resizing'));
    };
    img.src = objectUrl;
  });
}

const DropThumbnail = ({
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
  const [photos, setPhotos] = useState([]);
 const {cookie, setCookie}= useCookie("photoURL");
  const {xid} = useXttribute();
  const [fileList, setFileList] = useState();

  // onDrop - resize the first accepted image (max width 400px) before preview and upload
  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    setCookie('');
    try {
      const originalFile = acceptedFiles[0];
      const resizedFile = await resizeImageFile(originalFile, 400, 0.9);

      // create preview from the resized file
      const previewFile = Object.assign(resizedFile, {
        preview: URL.createObjectURL(resizedFile),
      });
      setPhotos([previewFile]);
      setFileList([
        <li key={previewFile.name}>
          <img style={ImagePreview} src={previewFile.preview} alt={previewFile.name} />
          <span style={FileName}>{previewFile.name}</span>
        </li>
      ]);

      // upload the resized file
      uploadToServer(resizedFile);
    } catch (err) {
      console.error('Error resizing image:', err);
      // fallback: upload original
      setPhotos(
        acceptedFiles.map((file) =>
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          })
        )
      );
      setFileList (acceptedFiles.map((file) => (
        <li key={file.name}>
          <img style={ImagePreview} src={URL.createObjectURL(file)} alt={file.name} />
          <span style={FileName}>{file.name}</span>
        </li>
      )));
      uploadToServer(acceptedFiles[0]);
    }
  }, [xid, setCookie]);
 
   const { getRootProps, getInputProps, isDragActive } = useDropzone({
     onDrop,
     accept: "image/*",
     maxSize: 3256 * 3256 * 12,
     maxFiles: 3,
   });


  async function uploadToServer(file){
 		let formData = new FormData();
 		formData.append ("files", file);
 		formData.append ("xid",xid);
 		formData.append ("type", type);
 		formData.append ("folder", folder);
 		formData.append ("dbName", dbName);
 		formData.append ("compId", compId);
 		formData.append ("collName", collName);
 		try{
 			const response = await axios.post(API_BASE_URL+'/uploadFile', formData,{
 				headers:{
 					'Content-Type': 'multipart/form-data',
 				}
 			});
 			if(response.status === 200){	
 				if(response.data.file_409=== 'File upload to GSP failed'){
 				setFileList(<li key="uploadFailed">
 				<img style={ImagePreview} src={xttribute_no_image} alt="Upload failed"/>
 				</li>);
 				props.handleError("Oops! File upload failed, Please try again!!");
 				}else{
 					props.handleError(null);
 					// notify parent that upload succeeded and provide the file so parent can process it
 					if (typeof props.onThumbnailUploaded === 'function') {
 						try {
 							props.onThumbnailUploaded(file);
 						} catch (e) {
 							console.error('onThumbnailUploaded callback error', e);
 						}
 					}
 				}
 				};
 		}catch (error){
 			console.error('There was an error during upload:', error);
 		}

 	   };

  return (
    <div
      style={
        isDragActive
          ? { ...dropzoneStyle, ...activeDropzoneStyle }
          : dropzoneStyle
      }
      {...getRootProps()}
    >
      <input {...getInputProps()} /> 
      <div style={preview}>{cookie? parse (cookie):''}{fileList}</div>
	  <div style={svgCenterStyle}><TbDragDrop2 /></div>
    </div>
  );
}

export default DropThumbnail;