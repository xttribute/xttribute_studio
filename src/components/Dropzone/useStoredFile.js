import { useState } from 'react';
import {ACCESS_TOKEN_NAME} from '../../constants/apiConstants';
import Cookies from 'js-cookie';

export default function useStoredFile() {
  	const getStoredFile = () => {
    	const StoredFileString = Cookies.get("StoredFile");
		const StoredFile = StoredFileString;
    	return StoredFile
  	};

  	const [StoredFile, setStoredFile] = useState(getStoredFile());
	
	const saveStoredFile = StoredFile => {
	    //localStorage.setItem(ACCESS_TOKEN_NAME, userToken);
		Cookies.set("StoredFile", StoredFile, { expires: 7 });
		setStoredFile(StoredFile);
	};
	const getStoredURL = () => {
		const StoredURLString = Cookies.get("StoredURL");
		const StoredURL = StoredURLString;
		return StoredURL
	};

	const [StoredURL, setStoredURL] = useState(getStoredURL());

	const saveStoredURL = StoredURL => {
	    //localStorage.setItem(ACCESS_TOKEN_NAME, userToken);
		Cookies.set("StoredURL", StoredURL, { expires: 7 });
		setStoredURL(StoredURL);
	};
	return {
		setStoredFile: saveStoredFile,
		setStoredURL: saveStoredURL,
	    StoredFile,
		StoredURL
	}
}