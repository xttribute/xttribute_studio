import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import useXttribute from '../Xttribute/useXttribute';
import {API_BASE_URL, objDBName} from '../../constants/apiConstants';
import Cookies from 'js-cookie';
import './Dropzone.css';
import parse from 'html-react-parser'; 
import useStoredFile from './useStoredFile';
import { TbDragDrop2 } from "react-icons/tb";
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


const Dropzone = ({
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
  const [files, setFiles] = useState([]);
 const {StoredFile, setStoredFile}= useStoredFile();
  const {xid} = useXttribute();
  const onDrop = useCallback((acceptedFiles) => {
	setStoredFile('');
	setFiles(
      acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      )
    );
	uploadToServer(acceptedFiles[0]);
	
 	}, []);
 
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: "image/*",
    maxSize: 3256 * 3256 * 12,
    maxFiles: 3,
  });

  const fileList = files.map((file) => (
    <li key={file.name}>
      <img style={ImagePreview} src={file.preview} alt={file.name} />
      <span style={FileName}>{file.name}</span>
    </li>
  ));
  
  function uploadToServer(file){
   		let formData = new FormData();
   		formData.append ("files", file);
   		formData.append ("xid",xid);
   		formData.append ("type", type);
   		formData.append("folder", folder);
   		formData.append("dbName", dbName);
   		formData.append("collName", collName);
   		const response =  fetch(API_BASE_URL+'/uploadFile', {
   			method: "POST",
   			body: formData,
   		});

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
      <div style={preview}>{parse (StoredFile)}{fileList}</div>
	  <h3><TbDragDrop2 /></h3> 
    </div>
  );
}

export default Dropzone;