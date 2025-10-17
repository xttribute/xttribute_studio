import React , {useState,useRef,useEffect} from 'react';
import './Photos.css';
import Editable from '../InlineEdit/Editable';
import DeleteIcon from '@mui/icons-material/Delete';
import IconButton from '@mui/material/IconButton'
import { Resizable, ResizableBox } from "react-resizable";
import {CDNURL} from '../../constants/apiConstants';
import xttribute_no_image from '../../medias/images/xttribute_no_image.png';
import {Row, Col} from 'reactstrap';
import ModalController from "../Modal/ModalController";
import View from "../Stats/View";
const Photos = ({ records, onSaveTitle, onTextChange, removePhoto, iValues, setIValues, editable, isEdit, ref }) => {
	
	const textareaRef = useRef();
	const inputRef = useRef();
	const [status, setState] = React.useState(false);
	const [photoURL, setPhotoURL] = useState();
	const [photoId, setPhotoId] = useState();
	const [viewCount, setViewCount]= useState();
	const handleChange = ({ target }) => {
			setIValues(prevIValues => ({
			  ...prevIValues,
			  [target.name]: target.value
			}))
		}	
		
	const handleClick = (photoURL, photoId,viewCount) => {
		setIValues(prevIValues => ({
			...prevIValues,
			["vc_"+photoId]: viewCount+1
		}))
		setPhotoURL(photoURL);
		setPhotoId(photoId);
		setViewCount(viewCount);
		setState((prevStatus) => !prevStatus);
	};

	
	const rows = [];
	  for (let i = 0; i < records.length; i += 3) {
	    const rowRecords = records.slice(i, i + 3);
		
	    const row = (
	      <div key={i} className="row" class="photoRow">
	        {rowRecords.map((record, j) => (
				<ResizableBox className="resizebox" width={350} height={330}>
					<div class="photoTitle">
					<Row>
					<Col>
					{record.title}
					</Col>
					<Col xs={2} style={{marginTop:'-7px'}}>
					{isEdit?<IconButton aria-label="delete" onClick={()=>removePhoto(record._id)}>
						 <DeleteIcon />
					</IconButton>:""}
					</Col>
					</Row>
					</div>
					<div>
					<img onClick={()=>handleClick( CDNURL+record.photo,record._id,iValues["vc_"+record._id] )} src={record.photo? CDNURL+record.photo: xttribute_no_image} alt="Norway" style={{'width':'100%'}} />
					</div>
					<div>
						<View count={iValues["vc_"+record._id]}/>
					</div>			
				</ResizableBox>
			  
	        ))}
	      </div>
		  
	    );
	    rows.push(row);
	  }
	
	  return <div>{rows}
	  <ChildComponent
	  	isOpen={status}
	  	handleClick={handleClick}
	  	title="Photo"
		photoURL={photoURL}
		photoId ={photoId}
		viewCount ={viewCount}
	  />
	  </div>;
};
const ChildComponent = ({ isOpen, handleClick,title,photoURL,photoId, viewCount }) => {
  return (
    <>
      {isOpen && (
        <ModalController
          status={isOpen}
          handleClick={handleClick}
		  title={title}
		  photoURL={photoURL}
		  photoId ={photoId}
		  count ="1"
		  action="view"
		  source ="photo"
		  viewCount={viewCount}
        />
      )}
    </>
  );
};

export default Photos;