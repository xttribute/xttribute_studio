import { useState } from 'react';
import {X_ID, XU_ID} from '../../constants/apiConstants';
import Cookies from 'js-cookie';

export default function useXttribute() {
  	const getXID = () => {
    	const x_id = Cookies.get(X_ID);
    	const xID = x_id;
    	return xID
  	};
	
  	const [xid, setXID] = useState(getXID());
	const saveXID = xID => {
		Cookies.set(X_ID, xID, { expires: 7 });
		setXID(xID);
	};
	
	const removeXID = () => {
		Cookies.remove(X_ID);
	};
	
	const getXUID = () =>{
		const xu_id = Cookies.get(XU_ID);
		const xUID = xu_id;
		return xUID
	};
	const [xuid, setXUID] = useState(getXUID());
	const saveXUID = xUID => {
		Cookies.set(XU_ID, xUID, { expires: 7});
		setXUID(xUID);
	};
	const removeXUID = () => {
		Cookies.remove(XU_ID);
	}
		
	return {
		setXID: saveXID,
		setXUID: saveXUID,
		destoryXID: removeXID,
	   	xid,
		xuid,
	}
}