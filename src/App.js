import React, {useState, useEffect} from 'react';
import { Container, Row, Col } from "reactstrap";
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
// import Header from "./components/Header";
import './App.css';
import Registration from "./components/Registration/RegistrationForm";
import Login from "./components/Login/Login";
import Logout from "./components/Login/Logout";
import AlertComponent from './components/AlertComponent/AlertComponent'; 
import Xttribute from './components/Xttribute/Xttribute';  
import Xttributes from './components/Xttribute/Xttributes';
import NewXttribute from './components/Xttribute/NewXttribute';
import RightSidebar from './components/Layout/RightSidebar';
import Photo from './components/Photo/Photo';
import Sound from './components/Sound/sound';
import 'bootstrap/dist/css/bootstrap.min.css';
function App(props) {
	const [title, updateTitle] = useState(null);
	 const [errorMessage, updateErrorMessage] = useState(null);
	 const [bg, changeBG] =useState();
	 const [id, showID] = useState(null);
	 const [menu, showMenu] = useState(null);
	 const [rightSidebarExpanded, setRightSidebarExpanded] = useState(false);
	 // persisted user display info (name and profile image)
	 const [uName, setUNameState] = useState(null);
	 const [profileImage, setProfileImageState] = useState(null);

	// handlers that update state and persist into localStorage so values survive page reload
	const setUName = (name) => {
		if (name === null || name === undefined) {
			setUNameState(null);
			localStorage.removeItem('uName');
		} else {
			setUNameState(name);
			localStorage.setItem('uName', name);
		}
	};

	const setProfileImage = (src) => {
		if (src === null || src === undefined) {
			setProfileImageState(null);
			localStorage.removeItem('profileImage');
		} else {
			setProfileImageState(src);
			localStorage.setItem('profileImage', src);
		}
	};

	// initialize from localStorage on mount
	useEffect(() => {
		try {
			const storedName = localStorage.getItem('uName');
			const storedProfile = localStorage.getItem('profileImage');
			if (storedName) setUNameState(storedName);
			if (storedProfile) setProfileImageState(storedProfile);
		} catch (e) {
			console.warn('Unable to access localStorage', e);
		}
	}, []);

	 document.title = title;


	const ProtectedRoute = () => {
	  if (id==null ) {
	    return <Navigate to="/login" replace />;
	  }

	  return <Outlet />; // Render the child routes
	};
	 const toggleRightSidebar = () => setRightSidebarExpanded(expanded => !expanded);
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
 		{/* <Header userID={id} showUID ={showID} menu={menu} showMenu={showMenu}/> */}
 		<main className="my-5" style={{marginRight: rightSidebarExpanded ? 200 : 60}}>
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
 					<Route path="/login" element={<Login showID = {showID} showError={updateErrorMessage} updateTitle={updateTitle} setUName={setUName} setProfileImage={setProfileImage}/>}  />
 					<Route path="/logout" element={<Logout showID ={showID} showError={updateErrorMessage} updateTitle={updateTitle} setUName={setUName} setProfileImage={setProfileImage}/>} />
 					   <Route path="/xttribute" element={<Xttribute showError={updateErrorMessage} updateTitle={updateTitle} changeBG={changeBG}/>} />
 					<Route path="/newXttribute" element={<NewXttribute showError={updateErrorMessage} updateTitle={updateTitle} changeBG={changeBG}/>} />
 					<Route path="/xttributes" element={<Xttributes showError={updateErrorMessage} updateTitle={updateTitle}/>} />
 							<Route path="/photos" element={<Photo />} />
 							<Route path="/sounds" element={<Sound />} />
 				</Routes>
 		         </Col>
 		
 		       </Row>
 		     </Container>
 		   </main>
 		   <RightSidebar
                          expanded={rightSidebarExpanded}
                          onToggle={toggleRightSidebar}
                          userID={id}
                          menu={menu}
 				showUID ={showID}showMenu={showMenu}
 				uName={uName}
 				profileImage={profileImage}
 
                      />
 		   </div>
 		  </div>
 		  </div>
   );
  };
  
  export default App;