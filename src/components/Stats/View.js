import React, {useState} from 'react';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import IconButton from '@mui/material/IconButton'
import {Row, Col} from 'reactstrap';
import './View.css';
function View(props){
	
	return(
		<div class="viewStats">
			<Row><Col>		
			<VisibilityOutlinedIcon fontSize="small"/> {props.count? props.count:0}
			</Col>
			<Col xs={9}/>
			</Row>
			
		</div>
	);
}

export default View;