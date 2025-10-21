import React, {useState, useEffect} from 'react';
import axios from 'axios';
import './Login.css';
import {API_BASE_URL, ACCESS_TOKEN_NAME, strDBName} from '../../constants/apiConstants';
import {Row, Col, Container} from 'reactstrap';
import { useNavigate } from 'react-router-dom';
import useToken from './useToken';
import useUserSession from '../User/useUserSession';
import GoogleLoginButton from './GoogleLoginButton';
import { jwtDecode } from 'jwt-decode';
function Login(props) {
    useEffect(() => {
        document.title = 'Login';
    }, []);

	const {setToken } = useToken();
	const {setUserID } = useUserSession();
	const {setUID} = useUserSession();
	const {setUType} = useUserSession();
	const {setUName} = useUserSession();
	const navigate = useNavigate();
    const [state , setState] = useState({
        email : "",
        password : "",
        successMessage: null
    })
    const handleChange = (e) => {
        const {id , value} = e.target   
        setState(prevState => ({
            ...prevState,
            [id] : value
        }))
    }
    const sendDetailsToServer = () => {
        if(state.email.length && state.password.length) {
           
            const payload={
				"dbName": strDBName,
				"collName": "user",
				"docContents": "{'email':'" +state.email + "','pwd':'"+state.password +"'}",
				"operator":"and",
                "returnType" :"result"
            }
			
            axios.post(API_BASE_URL+'/matchObject', payload, )
                .then(function (response) {
				
                    if(response.status === 200){
						if(response.data.doc_204 ==='No document matched' ){
							props.showError("Email or password did not match in our record, please try again!");
						}
						else{
							setUID(response.data.object._id);
                            setUType(response.data.object.type);
                            setUserID(state.email);
                            setUName(response.data.object.name);
                            if (props.setUName) props.setUName(response.data.object.name);
                            props.showError(null);
                            props.showID(state.email);
                            setState(prevState => ({
							...prevState,
							'successMessage' : 'Login successfully!'
							}))
							redirectToHome();
							//localStorage.setItem(ACCESS_TOKEN_NAME,response.data.token);
						}
                       
                      //  localStorage.setItem(ACCESS_TOKEN_NAME,response.data.token);
                        
                    } else{
                        props.showError("Oops! system error, it is on us, we are working on it!");
                    }
                })
                .catch(function (error) {
                    console.log(error);
                });    
        } else {
            props.showError('Please enter valid email and password')    
        }
        
    }
    const redirectToHome = () => {
		props.showError(null)
        props.updateTitle('Home')
		navigate('/')
      //  props.history.push('/');
    }
    const redirectToRegistration = () => {
        props.updateTitle('Login')
        navigate('/registration'); 
    }
    const handleSubmitClick = (e) => {
        e.preventDefault();
        sendDetailsToServer()
    }
    // Google login handlers
    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            console.log('Google login success:', credentialResponse);
            const decoded = jwtDecode(credentialResponse.credential);
            console.log(decoded);
            const email = decoded.email;
            const name = decoded.name || decoded.given_name || '';
            const profileImage = decoded.picture || null;
            if (!email) {
                props.showError('Google account did not return an email.');
                return;
            }
            // Prepare payload for backend
            const payload = {
                dbName: strDBName,
                collName: 'user',
                docContents: `{'email':'${email}'}`,
      	        uKey: 'email',
      
            };
            const response = await axios.post(`${API_BASE_URL}/getOneObject`, payload);
            if (response.status === 200) {
                if (response.data.doc_404 === 'Document does not exist') {
                    // No user found, create new user
                    const newUserPayload = {
                        dbName: strDBName,
                        collName: 'user',
                        docContents: `{'email':'${email}','name':'${name}', 'source':'google','type':'xtttributee','profileImage':'${profileImage || ''}'}`,
                        uKey: 'email'
                    };
                    const createResponse = await axios.post(`${API_BASE_URL}/newObject`, newUserPayload);
                    if (createResponse.status === 200 && createResponse.data.doc_201 === 'Document created') {
                        setUID(createResponse.data.object._id);
                        setUType(createResponse.data.object.type);
                        setUName(name);
                        setUserID(email);
                        if (props.setUName) props.setUName(name);
                        if (props.setProfileImage) props.setProfileImage(profileImage);
                        props.showError(null);
                        props.showID(email);
                        setState(prevState => ({
                            ...prevState,
                            successMessage: 'Account created and logged in successfully!'
                        }));
                    } else {
                        props.showError('Failed to create new user for this Google account.');
                    }
                } 
				else {
					if(response.data.object.source !=='google' ){
                        props.showError("Email already registered via "+response.data.object.source+" account, Please use that to log in.");
                        return;
                    }
                    // User exists, log them in
                    setUID(response.data.object._id);
					setUType(response.data.object.type);
                    setUserID(email);
					setUName(response.data.object.name);
                    if (props.setUName) props.setUName(response.data.object.name);
                    if (props.setProfileImage) props.setProfileImage(response.data.object.profileImage || profileImage);
                    props.showError(null);
                    props.showID(email);
                    setState(prevState => ({
                        ...prevState,
                        successMessage: 'Login successfully!'
                    }));
                    redirectToHome();
                }
            } else {
                props.showError('Oops! System error, it is on us, we are working on it!');
            }
        } catch (error) {
            console.error(error);
            props.showError('Google login failed or backend error.');
        }
    };
    const handleGoogleError = () => {
        console.error('Google login failed');
    };
    return(
        <div className="">
            <form>
			<Container>
				<Row>
					<Col>
		                <div className="form-group text-left">
		               
		                <input type="email" 
		                       className="form-control" 
		                       id="email" 
		                       aria-describedby="emailHelp" 
		                       placeholder="Enter email" 
		                       value={state.email}
		                       onChange={handleChange}
		                />
		               
		                </div>
		                <div className="form-group text-left">
						<label htmlFor="exampleInputPassword1"></label>
		                    <input type="password" 
		                        className="form-control" 
		                        id="password" 
		                        placeholder="Password"
		                        value={state.password}
		                        onChange={handleChange} 
		                    />
		                </div>
						</Col>
						<Col className="justify-content-end">
							<div>
								<button
							     type="submit" 
							     className="btn btn-primary btn-login"
							     onClick={handleSubmitClick}
							     >
							     Login
							      </button>
							</div>
							<div className="mt-2">
								<span>New to Xttribute? </span>
							    <span className="loginText" onClick={() => redirectToRegistration()}>Join!</span> 
							 </div>
							 <div className="mt-3 d-flex justify-content-center">
                       
                    </div>
						</Col>
					</Row>
					<Row><Col>
					<div className="mt-3 google-login-wrapper">
                        <GoogleLoginButton 
                            onSuccess={handleGoogleSuccess} 
                            onError={handleGoogleError} 
                        />
                    </div>
                    </Col>
					</Row>
			</Container>
            </form>
            <div className="alert alert-success mt-2" style={{display: state.successMessage ? 'block' : 'none' }} role="alert">
                {state.successMessage}
            </div>
            
            
        </div>
    )
}

export default Login;