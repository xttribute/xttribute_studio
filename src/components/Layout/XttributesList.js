import React from 'react';
import './XttributesList.css';
import xttribute_no_image from '../../medias/images/xttribute_no_image.png';
import plusImage from '../../medias/images/plus.svg';
import useXttribute from '../Xttribute/useXttribute';
import { useNavigate } from 'react-router-dom';
import {CDNURL} from '../../constants/apiConstants';
import useStoredFile from '../Dropzone/useStoredFile';
const XttributesList = ({ records }) => {
	const {xid, setXID} = useXttribute();
	const {StoredFile, setStoredFile} = useStoredFile();
	const {StoredURL,setStoredURL} = useStoredFile();
	const navigate = useNavigate();
	function navToXttribute(xid,thumbnail){
		setXID(xid);
		setStoredFile('<img src='+CDNURL+thumbnail+' class=imagePreview />');
		setStoredURL(CDNURL+thumbnail);
		navigate('/xttribute'); 
	}
	function navToCreate(){
		// clear stored file/url and indicate a new xttribute
		setXID(null);
		setStoredFile(null);
		setStoredURL(null);
		navigate('/newXttribute');
	}
	const rows = [];
	  // prepend a virtual "add" record so it appears first and uses same styling
	  const items = [{ _id: '__add__', thumbnail: null, name: 'Xttribute', isAdd: true }, ...records];
	  for (let i = 0; i < items.length; i += 3) {
	    const rowRecords = items.slice(i, i + 3);
	    const row = (
	      <div key={i} className="row">
	        {rowRecords.map((record, j) => (
			
	          <div key={j} className="col-4">
	<div className={`polaroid ${record.isAdd ? 'add-card' : ''}`} onClick={()=> record.isAdd ? navToCreate() : navToXttribute(record._id,record.thumbnail)}>
		    	<img src={record.isAdd ? plusImage : (record.thumbnail? CDNURL+record.thumbnail: xttribute_no_image)} alt={record.name} className={record.isAdd ? 'add-image' : ''} />
		    	<div className="container">
		      	<p>{record.name}</p>
		    	</div>
			</div>
	          </div>
	        ))}
	      </div>
	    );
	    rows.push(row);
	  }
	
	  return <div>{rows}</div>;
};

export default XttributesList;