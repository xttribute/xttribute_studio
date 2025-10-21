import { useState } from 'react';
import {USER_ID,U_ID,U_TYPE,U_NAME} from '../../constants/apiConstants';
import Cookies from 'js-cookie';

export default function useUserSession() {
  	const getUserID = () => {
    	const user_id = Cookies.get(USER_ID);
    	const userID = user_id;
    	return userID
  	};
	
  	const [id, setUserID, destoryUserID] = useState(getUserID());
	const saveUserID = userID => {
	    //localStorage.setItem(ACCESS_TOKEN_NAME, userToken);
		Cookies.set(USER_ID, userID, { expires: 7 });
	    setUserID(userID);
	};
	
	const removeUserID = () => {
		Cookies.remove(USER_ID);
		Cookies.remove(U_ID);
		Cookies.remove(U_TYPE);
		Cookies.remove(U_NAME);
	};
	
	const getUID = () =>{
		const u_id = Cookies.get(U_ID);
		const uID = u_id;
		return uID
	};
	const [uid, setUID] = useState(getUID());
	const saveUID = uID => {
		Cookies.set(U_ID, uID, { expires: 7 });
		setUID(uID);
	};
	const getUType = () =>{
			const u_type = Cookies.get(U_TYPE);
			const uType = u_type;
			return uType
		};
	const [uType, setUType] = useState(getUType());
    const saveUType = uType => {
        Cookies.set(U_TYPE, uType, { expires: 7 });
        setUType(uType);
    };
	const getUName = () =>{
			const u_name = Cookies.get(U_NAME);
			const uName = u_name;
			return uName
	};
		const [uName, setUName] = useState(getUName());
	    const saveUName = uName => {
	        Cookies.set(U_NAME, uName, { expires: 7 });
	        setUName(uName);
	  };

	return {
		setUserID: saveUserID,
		destoryUserID: removeUserID,
	   	id,
		setUID: saveUID,
		uid,
		setUType: saveUType,
        uType,
		setUName: saveUName,
		uName
	}
}