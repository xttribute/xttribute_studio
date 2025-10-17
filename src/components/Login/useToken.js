import { useState } from 'react';
import {ACCESS_TOKEN_NAME} from '../../constants/apiConstants';
import Cookies from 'js-cookie';

export default function useToken() {
  	const getToken = () => {
    	const tokenString = Cookies.get(ACCESS_TOKEN_NAME);
    	const userToken = tokenString;
    	return userToken
  	};

  	const [token, setToken] = useState(getToken());
	const [destoryToken] = useState(null);
	
	const saveToken = userToken => {
	    //localStorage.setItem(ACCESS_TOKEN_NAME, userToken);
		Cookies.set(ACCESS_TOKEN_NAME, userToken, { expires: 7 });
	    setToken(userToken);
	};
	
	const removeToken = () => {
		Cookies.remove(ACCESS_TOKEN_NAME);
		//setToken(null);
	};
	return {
		setToken: saveToken,
		destoryToken: removeToken,
	    token
	}
}