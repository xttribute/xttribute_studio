import React, {useState, useEffect} from 'react';
import './Login.css';
import {Row, Col, Container} from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import useToken from './useToken';
import useHeader from '../useHeader'
import useUserSession from '../User/useUserSession';

function Logout(props) {
	const { destoryToken } = useToken();
	const {destoryUserID } = useUserSession();
	const navigate = useNavigate();
	const {setListType} = useHeader();
    const [state , setState] = useState({
        email : "",
        password : "",
        successMessage: null
    })
	
    const redirectToHome = () => {
		props.showError(null)
		props.showID(null)
        props.updateTitle('Home')
		navigate('/login')
      //  props.history.push('/');
    }
	destoryToken();
	destoryUserID();
	useEffect(()=>{
	 setListType("public");
	}, []); 
	redirectToHome();
    return(
        <div className="">
        </div>
    )
}

export default Logout;