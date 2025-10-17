import { useState } from 'react';
import {LIST_TYPE} from '../constants/apiConstants';
import Cookies from 'js-cookie';

export default function useHeader() {
  	const getListType = () => {
    	const listTypeString = Cookies.get(LIST_TYPE);
		const listType = listTypeString
    	return listType
  	};

  	const [listType, setListType] = useState(getListType());
	const [destoryListType] = useState(null);
	
	const saveListType = listType => {
	    //localStorage.setItem(ACCESS_TOKEN_NAME, userToken);
		Cookies.set(LIST_TYPE, listType, { expires: 7 });
	    setListType(listType);
	};
	
	const removeListType = () => {
		Cookies.remove(LIST_TYPE);
		//setToken(null);
	};
	return {
		setListType: saveListType,
		destoryListType: removeListType,
	    listType
	}
}