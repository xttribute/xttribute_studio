import React, {useState} from 'react';
import axios from 'axios';
import './RegistrationForm.css';
import {API_BASE_URL, ACCESS_TOKEN_NAME, strDBName} from '../../constants/apiConstants';
import {Row, Col, Container} from 'reactstrap';
import { useNavigate } from 'react-router-dom';

function RegistrationForm(props) {
	const navigate = useNavigate();
    const [state , setState] = useState({
        email : "",
        password : "",
        confirmPassword: "",
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
				"docContents": "{'email':'" +state.email + "','pwd':'"+state.password +"','source':'xttribute','type':'xtttributee'}",
                "uKey" :"email"
            }
			
            axios.post(API_BASE_URL+'/newObject', payload, )
                .then(function (response) {
                    if(response.status === 200){
						if(response.data.doc_302 === 'Document exists'){
							props.showError("Email has already been associated with an account.");
						}
                        if(response.data.doc_201 === 'Document created'){
							props.showError(null)
							setState(prevState => ({
								...prevState,
								'successMessage' : 'User created, redirect to Xttribute home!'
								}))
							redirectToHome();
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
    const redirectToLogin = () => {
        props.updateTitle('Login')
        navigate('/login'); 
    }
    const handleSubmitClick = (e) => {
        e.preventDefault();
        if(state.password === state.confirmPassword) {
            sendDetailsToServer()    
        } else {
            props.showError('Passwords do not match');
        }
    }
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
		                <div className="form-group text-left">
		                    <label htmlFor="exampleInputPassword1"></label>
		                    <input type="password" 
		                        className="form-control" 
		                        id="confirmPassword" 
		                        placeholder="Confirm Password"
		                        value={state.confirmPassword}
		                        onChange={handleChange} 
		                    />
		                </div>
						</Col>
						<Col className="justify-content-end">
							<div>
								<button
							     type="submit" 
							     className="btn btn-primary btn-join"
							     onClick={handleSubmitClick}
							     >
							     Join
							      </button>
							</div>
							<div className="mt-2">
								<span>Already with us? </span>
							    <span className="loginText" onClick={() => redirectToLogin()}>Login here</span> 
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

export default RegistrationForm;