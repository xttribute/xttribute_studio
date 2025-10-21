import avatar from '../medias/images/avatar.png';
import { useNavigate } from 'react-router-dom';

import {
  Container, Row, Col, Form, Input, Button, Navbar, Nav,
  NavbarBrand, NavLink, NavItem, UncontrolledDropdown,
  DropdownToggle, DropdownMenu, DropdownItem
} from 'reactstrap';
import useUserSession from './User/useUserSession';
import useHeader from './useHeader';

function Header(props) {
	const navigate = useNavigate();
	let logMenu;
	let xttributeMenu;
	const { id } = useUserSession();
	const {setListType} = useHeader();
//	console.log(props.userID);
	if(id!=null){
    	props.showUID(id);
	}
    const myXttributes =() => {
	   setListType("my");
	   navigate('xttributes');
	}
	const publicXttributes =() => {
	   setListType("public");
	   navigate('xttributes');
	}
	if(props.userID!=null || id!=null){
		logMenu = <DropdownItem onClick={() => navigate('logout')}>Logout</DropdownItem>;
		xttributeMenu =  [<DropdownItem onClick={() => navigate('xttribute')}>New Xttribute</DropdownItem>,
		 <DropdownItem style={{ color: '#8ea72d' }} onClick={myXttributes}>Xttributes</DropdownItem>];
	}else{
		logMenu = <div><DropdownItem onClick={() => navigate('registration')}>Join!</DropdownItem> <DropdownItem onClick={() => navigate('login')}>Login</DropdownItem></div>;
		xttributeMenu = <DropdownItem onClick={publicXttributes}>Xttributes</DropdownItem>;
	}

  	return(
			<header>
		    <Navbar fixed="top" color="light" light expand="xs" className="border-bottom border-gray bg-white" style={{ height: 80 }}>
		
		      <Container>
		        <Row g-0 className="position-relative w-100 align-items-center">
					<Col className="d-flex justify-content-xs-start">
				          <NavbarBrand className="d-inline-block p-0" href="/" style={{ width: 80 }}>
				            {/* Logo moved to sidebar */}
				          </NavbarBrand>
				    </Col>
				        
		          <Col className="d-none d-lg-flex justify-content-end">
		            <Nav className="mrx-auto" navbar>
					<NavItem className="d-flex align-items-center">
						      {props.userID}
							
							  
					</NavItem>
		              {/* NavItem and UncontrolledDropdown moved to RightSidebar */}
		            </Nav>
		          </Col>
		
		        
		        </Row>
		      </Container>
		
		    </Navbar>
		  </header>
		 );
};

export default Header