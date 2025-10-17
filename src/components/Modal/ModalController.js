import React from "react";
import './ModalController.css';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Pixel from '../Pixel/Pixel';
import View from '../Stats/View';
import {Row, Col} from 'reactstrap';
export default function ModalController({ handleClick, status,title,photoURL,photoId,count,action,source, viewCount }) {
  return (
      
      <Modal show={status} onHide={handleClick} dialogClassName="modalWidth"
	  aria-labelledby="example-custom-modal-styling-title"
	  >
        <Modal.Header closeButton>
          <Modal.Title id="example-custom-modal-styling-title">{title}</Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
         <img src={photoURL} alt="Norway" style={{'width':'100%'}} />
        </Modal.Body>
        <Modal.Footer>
		<Row style={{'width':'100%'}}><Col xs={10}>
			<View count={viewCount +1} />
		</Col>
		<Col xs={2}>
          <Button variant="secondary" onClick={handleClick}>
            Close
          </Button>
		 </Col>
		 </Row>
        </Modal.Footer>
		<Pixel _id= {photoId} count ={count} action= {action} source={source} />
      </Modal>
    
  );
}
