import { useState } from 'react';
import Cookies from 'js-cookie';

export default function useCookie(cname) {
  	const getCookie = () => {
    	const cookieString = Cookies.get(cname);
		const cookie = cookieString;
    	return cookie
  	};

  	const [cookie, setCookie] = useState(getCookie());
	
	const saveCookie = cookie => {
	    //localStorage.setItem(ACCESS_TOKEN_NAME, userToken);
		Cookies.set(cname, cookie, { expires: 7 });
		setCookie(cookie);
	};
	
	return {
		setCookie: saveCookie,
	    cookie,
	}
}