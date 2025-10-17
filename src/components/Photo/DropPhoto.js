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


const DropPhoto = ({
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
  const onDrop = useCallback((acceptedFiles) => {
	setCookie('');
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
	uploadToServer(acceptedFiles[0]);
 	}, []);
 
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
   		formData.append("folder", folder);
   		formData.append("dbName", dbName);
		formData.append("compId", compId);
   		formData.append("collName", collName);
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
				props.showError("Oops! File upload failed, Please try again!!");
				}else{
					props.showError(null);
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
	  <h3><TbDragDrop2 /></h3> 
    </div>
  );
}

export default DropPhoto;