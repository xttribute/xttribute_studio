import React, {useState, useEffect} from 'react';
import { Container, Row, Col } from "reactstrap";
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Header from "./components/Header";
import './App.css';
import Registration from "./components/Registration/RegistrationForm";
import Login from "./components/Login/Login";
import Logout from "./components/Login/Logout";
import AlertComponent from './components/AlertComponent/AlertComponent'; 
import Xttribute from './components/Xttribute/Xttribute';  
import Xttributes from './components/Xttribute/Xttributes';
import 'bootstrap/dist/css/bootstrap.min.css';
function App(props) {
	const [title, updateTitle] = useState(null);
	 const [errorMessage, updateErrorMessage] = useState(null);
	 const [bg, changeBG] =useState();
	 const [id, showID] = useState(null);
	 const [menu, showMenu] = useState(null);
	 //const { id } = useUserSession();
	 //const [uid, showUID] = useState(null);

	 document.title = title;


	const ProtectedRoute = () => {
	  if (id==null ) {
	    return <Navigate to="/login" replace />;
	  }

	  return <Outlet />; // Render the child routes
	};
	return(
		<div class="css-bg-example-1">
		  <div class="demo-wrap">
		 {/*
		   <img
		      class="demo-bg"
		      src={bg}
		      alt=""
		    />*/}
		  <div class="demo-content">
	   <Header userID={id} showUID ={showID} menu={menu} showMenu={showMenu}/>
		<main className="my-5">
		     <Container className="px-0 mainBody">
			 <Row>
			 <AlertComponent errorMessage={errorMessage} hideError={updateErrorMessage}/>
			 </Row>
		       <Row
		         g-0
		       >
		         <Col
		         >
				 <Routes>
				 		<Route path="/registration" element={<Registration showError={updateErrorMessage} updateTitle={updateTitle}/>}  />
						<Route path="/login" element={<Login showID = {showID} showError={updateErrorMessage} updateTitle={updateTitle}/>}  />
						<Route path="/logout" element={<Logout showID ={showID} showError={updateErrorMessage} updateTitle={updateTitle}/>} />
						   <Route path="/xttribute" element={<Xttribute showError={updateErrorMessage} updateTitle={updateTitle} changeBG={changeBG}/>} />
							<Route path="/xttributes" element={<Xttributes showError={updateErrorMessage} updateTitle={updateTitle}/>} />
					</Routes>
		         </Col>
	
		       </Row>
		     </Container>
		   </main>
		   </div>
		  </div>
		  </div>
  );
};

export default App;