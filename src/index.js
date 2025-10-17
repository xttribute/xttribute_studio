import React, { useState }  from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Bootstrap CSS
import "bootstrap/dist/css/bootstrap.min.css";
// Bootstrap Bundle JS
import "bootstrap/dist/js/bootstrap.bundle.min"; 
//import useStoredFile from './components/Dropzone/useStoredFile';
const root = ReactDOM.createRoot(document.getElementById('root'));
function RootComponent(){
//	const {StoredURL} =useStoredFile();
//	const [data, setData] = useState('');
//	const updateData = (newData) => {
//		console.log(newData);
//	    setData(newData);
//	  };
//	  console.log(data);
	return(
		<GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
		  <BrowserRouter>
		    <App />
		  </BrowserRouter>
		</GoogleOAuthProvider>
	);
}
root.render(<RootComponent />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
//reportWebVitals();